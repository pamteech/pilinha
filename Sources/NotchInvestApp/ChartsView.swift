#if os(macOS)
import AppKit
import SwiftUI
import WebKit
import NotchInvestCore

/// Dono do WKWebView da aba Gráficos. Uma única instância vive o app inteiro, então o
/// gráfico não recarrega a cada abertura da ilha.
/// Login: a pessoa entra pelo próprio site do TradingView. Os cookies ficam no
/// WKWebsiteDataStore.default() (persistente, no perfil do WebKit deste app);
/// o app nunca lê, guarda nem injeta senha/cookies.
@MainActor
final class ChartWebController: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    enum Mode: String { case site, widget }

    @Published var mode: Mode = .site
    @Published var layoutURL: String?
    @Published var symbol: ChartSymbol?
    @Published var isLoading = false
    /// Aviso curto mostrado sobre o gráfico (ex. login com Google bloqueado em webview).
    @Published var notice: String?

    let webView: WKWebView
    private var configured = false

    override init() {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()                 // persistente: login do TradingView continua salvo
        cfg.preferences.javaScriptCanOpenWindowsAutomatically = true
        cfg.defaultWebpagePreferences.allowsContentJavaScript = true
        webView = WKWebView(frame: .zero, configuration: cfg)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.underPageBackgroundColor = .black          // sem flash branco no fundo preto
        // Não alteramos o user agent (nada de se passar por navegador para burlar login).
    }

    /// Primeira vez que a aba abre: aplica a config do portfolio.json e carrega.
    func configureIfNeeded(_ c: TradingViewConfig?) {
        guard !configured else { return }
        configured = true
        mode = (c?.preferWidget ?? false) ? .widget : .site
        layoutURL = TradingView.layouts(for: c).first?.url
        reload()
    }

    func select(layout: TradingViewLayout) { layoutURL = layout.url; symbol = nil; mode = .site; reload() }
    func select(symbol s: ChartSymbol?) { symbol = s; reload() }
    func toggleMode() { mode = (mode == .site) ? .widget : .site; reload() }

    func reload() {
        notice = nil
        switch mode {
        case .site:
            if let url = TradingView.chartURL(layout: layoutURL, symbol: symbol?.tvSymbol) { webView.load(URLRequest(url: url)) }
        case .widget:
            let html = TradingView.widgetHTML(symbol: symbol?.tvSymbol ?? "BMFBOVESPA:IBOV")
            webView.loadHTMLString(html, baseURL: URL(string: "https://www.tradingview.com/"))
        }
    }

    func openInBrowser() {
        let u = webView.url.flatMap { $0.scheme == "https" ? $0 : nil }
            ?? TradingView.chartURL(layout: layoutURL, symbol: symbol?.tvSymbol)
        if let u { NSWorkspace.shared.open(u) }
    }

    /// Dá o teclado ao gráfico (atalhos, busca de símbolo, digitar no login).
    func focus() { webView.window?.makeFirstResponder(webView) }

    // MARK: WKNavigationDelegate
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.allow) }
        let mainFrame = action.targetFrame?.isMainFrame ?? true
        if mainFrame, url.scheme == "https" || url.scheme == "http", !TradingView.staysInPanel(host: url.host) {
            if let h = url.host?.lowercased(), h.hasSuffix("google.com") || h.hasSuffix("apple.com") || h.hasSuffix("facebook.com") {
                notice = "Login social não funciona dentro do app (Google bloqueia webviews). Entre com e-mail e senha do TradingView, ou use “Abrir no navegador”."
            }
            NSWorkspace.shared.open(url)               // links externos e logins sociais vão para o navegador padrão
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { isLoading = true }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { isLoading = false }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { isLoading = false }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        isLoading = false; notice = "Não foi possível carregar o TradingView: \(error.localizedDescription)"
    }

    // MARK: WKUIDelegate — janelas novas (target=_blank, pop-ups)
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if TradingView.staysInPanel(host: url.host) { webView.load(action.request) }   // abre no próprio painel
            else { NSWorkspace.shared.open(url) }
        }
        return nil
    }
}

/// Embute o WKWebView compartilhado no SwiftUI.
struct ChartWebView: NSViewRepresentable {
    let controller: ChartWebController
    func makeNSView(context: Context) -> WKWebView { controller.webView }
    func updateNSView(_ nsView: WKWebView, context: Context) {}
}

struct ChartsView: View {
    @EnvironmentObject var model: PortfolioModel
    @EnvironmentObject var charts: ChartWebController

    var body: some View {
        let cfg = model.portfolio?.tradingview
        let layouts = TradingView.layouts(for: cfg)
        let symbols = model.portfolio.map(TradingView.symbols(for:)) ?? []
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                if layouts.count > 1 {
                    Menu {
                        ForEach(layouts) { l in Button(l.name) { charts.select(layout: l) } }
                    } label: { Label(layouts.first { $0.url == charts.layoutURL }?.name ?? "Layout", systemImage: "rectangle.3.group") }
                    .menuStyle(.borderlessButton).fixedSize()
                }
                Menu {
                    Button("Do layout") { charts.select(symbol: nil) }
                    if !symbols.isEmpty { Divider() }
                    ForEach(symbols) { s in Button("\(s.label)  ·  \(s.tvSymbol)") { charts.select(symbol: s) } }
                } label: { Label(charts.symbol?.label ?? "Ativo", systemImage: "chart.xyaxis.line") }
                .menuStyle(.borderlessButton).fixedSize()
                .help("Trocar o ativo do gráfico (mantém os desenhos do layout)")
                Spacer()
                if charts.isLoading { ProgressView().controlSize(.small) }
                Button { charts.toggleMode() } label: {
                    Text(charts.mode == .site ? "Widget sem login" : "Site com login").font(.system(size: 10, weight: .semibold))
                }
                .buttonStyle(.plain).foregroundStyle(.secondary)
                .help("Widget: gráfico público do TradingView, sem conta. Site: seus layouts, desenhos e indicadores.")
                Button { charts.reload() } label: { Image(systemName: "arrow.clockwise") }.buttonStyle(.plain).help("Recarregar")
                Button { charts.openInBrowser() } label: { Image(systemName: "safari") }.buttonStyle(.plain).help("Abrir no navegador")
            }
            .font(.system(size: 11))
            .foregroundStyle(.white)
            ZStack(alignment: .top) {
                ChartWebView(controller: charts)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                if let n = charts.notice {
                    HStack(alignment: .top) {
                        Text(n).font(.caption).foregroundStyle(.white)
                        Spacer()
                        Button { charts.notice = nil } label: { Image(systemName: "xmark") }.buttonStyle(.plain)
                    }
                    .padding(8).background(RoundedRectangle(cornerRadius: 8).fill(Color.orange.opacity(0.9))).padding(8)
                }
            }
        }
        .onAppear {
            charts.configureIfNeeded(cfg)
            // espera a janela crescer/virar key antes de dar o foco ao gráfico
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { charts.focus() }
        }
    }
}
#endif
