import Foundation

/// Configuração da aba Gráficos (campo `tradingview` do portfolio.json).
/// O app só carrega o site oficial; login/senha ficam no próprio TradingView (cookies do WebKit).
public struct TradingViewConfig: Codable, Sendable, Equatable {
    /// Layout salvo padrão, ex. "https://www.tradingview.com/chart/AbCd1234/".
    public var layoutURL: String?
    /// Outros layouts salvos, com nome para o menu.
    public var layouts: [TradingViewLayout]?
    /// Tamanho do painel aberto na aba Gráficos (pontos). Padrão 720x460.
    public var panelWidth: Double?
    public var panelHeight: Double?
    /// Sobrescreve o símbolo TradingView de um ticker/coinId (ex. {"bitcoin": "BITSTAMP:BTCUSD"}).
    public var symbols: [String: String]?
    /// Começar no widget público (sem login) em vez do site completo.
    public var preferWidget: Bool?

    public init(layoutURL: String? = nil, layouts: [TradingViewLayout]? = nil, panelWidth: Double? = nil, panelHeight: Double? = nil,
                symbols: [String: String]? = nil, preferWidget: Bool? = nil) {
        self.layoutURL = layoutURL; self.layouts = layouts; self.panelWidth = panelWidth; self.panelHeight = panelHeight
        self.symbols = symbols; self.preferWidget = preferWidget
    }
}

public struct TradingViewLayout: Codable, Sendable, Equatable, Identifiable {
    public var id: String { url }
    public var name: String
    public var url: String
    public init(name: String, url: String) { self.name = name; self.url = url }
}

public struct ChartSymbol: Sendable, Equatable, Identifiable {
    public var id: String { tvSymbol }
    public let label: String       // "PETR4", "BTC"
    public let tvSymbol: String    // "BMFBOVESPA:PETR4"
}

public enum TradingView {
    public static let chartBase = "https://www.tradingview.com/chart/"
    public static let defaultPanel = (width: 720.0, height: 460.0)

    /// Mapa padrão de cripto (CoinGecko id → símbolo TradingView em BRL).
    static let cryptoDefaults: [String: String] = [
        "bitcoin": "BINANCE:BTCBRL", "ethereum": "BINANCE:ETHBRL", "solana": "BINANCE:SOLBRL",
    ]

    /// Símbolos da carteira para o menu de tickers (ações/FIIs na B3, cripto em BRL).
    public static func symbols(for p: Portfolio) -> [ChartSymbol] {
        let over = p.tradingview?.symbols ?? [:]
        var out: [ChartSymbol] = p.stocks.map { s in
            let t = s.ticker.uppercased()
            return ChartSymbol(label: t, tvSymbol: over[t] ?? over[s.ticker] ?? "BMFBOVESPA:\(t)")
        }
        out += p.crypto.map { c in
            let sym = c.symbol.uppercased()
            return ChartSymbol(label: sym, tvSymbol: over[c.coinId] ?? over[sym] ?? cryptoDefaults[c.coinId] ?? "BINANCE:\(sym)BRL")
        }
        var seen = Set<String>()
        return out.filter { seen.insert($0.tvSymbol).inserted }
    }

    /// Layouts disponíveis (padrão primeiro, sem duplicar). Sempre há ao menos o gráfico em branco.
    public static func layouts(for c: TradingViewConfig?) -> [TradingViewLayout] {
        var list: [TradingViewLayout] = []
        if let u = c?.layoutURL, isAllowed(u) { list.append(.init(name: "Layout padrão", url: u)) }
        for l in c?.layouts ?? [] where isAllowed(l.url) && !list.contains(where: { $0.url == l.url }) { list.append(l) }
        if list.isEmpty { list.append(.init(name: "Gráfico", url: chartBase)) }
        return list
    }

    /// URL do site completo, opcionalmente trocando o símbolo (?symbol=EXCHANGE:TICKER).
    /// Num layout salvo, `symbol` troca o ativo mantendo desenhos/indicadores do layout.
    public static func chartURL(layout: String?, symbol: String?) -> URL? {
        let base = (layout.flatMap { isAllowed($0) ? $0 : nil }) ?? chartBase
        guard var comps = URLComponents(string: base) else { return nil }
        if let symbol, !symbol.isEmpty {
            var q = (comps.queryItems ?? []).filter { $0.name != "symbol" }
            q.append(URLQueryItem(name: "symbol", value: symbol)); comps.queryItems = q
        }
        return comps.url
    }

    /// Só aceita https em tradingview.com (evita abrir outro site por engano no painel).
    public static func isAllowed(_ s: String) -> Bool {
        guard let u = URL(string: s), u.scheme == "https", let h = u.host?.lowercased() else { return false }
        return h == "tradingview.com" || h.hasSuffix(".tradingview.com")
    }

    /// Hosts que o painel deixa navegar; o resto (ex. login Google/Apple, links externos) abre no navegador.
    public static func staysInPanel(host: String?) -> Bool {
        guard let h = host?.lowercased() else { return true }
        return h == "tradingview.com" || h.hasSuffix(".tradingview.com") || h.hasSuffix(".tradingview-widget.com")
    }

    /// HTML do widget gratuito "Advanced Real-Time Chart" (sem login, mantém a atribuição do TradingView).
    public static func widgetHTML(symbol: String, dark: Bool = true, locale: String = "br") -> String {
        let cfg: [String: Any] = [
            "autosize": true, "symbol": symbol, "interval": "D", "timezone": "America/Sao_Paulo",
            "theme": dark ? "dark" : "light", "style": "1", "locale": locale,
            "allow_symbol_change": true, "hide_side_toolbar": false, "support_host": "https://www.tradingview.com",
        ]
        let json = (try? JSONSerialization.data(withJSONObject: cfg, options: [.sortedKeys]))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        return """
        <!doctype html><html><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>html,body{margin:0;height:100%;background:\(dark ? "#000" : "#fff")}.tradingview-widget-container{height:100%}</style>
        </head><body>
        <!-- TradingView Widget BEGIN -->
        <div class="tradingview-widget-container" style="height:100%;width:100%">
          <div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div>
          <div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div>
          <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>
          \(json)
          </script>
        </div>
        <!-- TradingView Widget END -->
        </body></html>
        """
    }
}
