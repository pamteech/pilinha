#if os(macOS)
import AppKit
import SwiftUI
import NotchInvestCore

@main
struct NotchInvestMain {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)   // sem ícone no Dock
        app.run()
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    var notch: NotchWindowController?
    let model = PortfolioModel()
    let charts = ChartWebController()
    let privacy = PrivacyController()
    let privacyWindow = PrivacyWindow()
    var statusItem: NSStatusItem?
    func applicationDidFinishLaunching(_ n: Notification) {
        notch = NotchWindowController(model: model, charts: charts, privacy: privacy)
        notch?.showWindow(nil)
        model.onShowPrivacyInfo = { [weak self] in self?.showPrivacyInfo() }
        setupMenu()
        model.start()
    }

    /// Menu na barra (ícone de cofrinho): modo discreto, Touch ID, privacidade, sair.
    private func setupMenu() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        item.button?.image = NSImage(systemSymbolName: "eye.slash", accessibilityDescription: "NotchInvest")
        let menu = NSMenu(); menu.delegate = self
        item.menu = menu; statusItem = item
    }
    @objc func setMode(_ s: NSMenuItem) { if let m = s.representedObject as? String, let pm = PrivacyMode(rawValue: m) { privacy.set(pm) } }
    @objc func toggleLock() { privacy.lockEnabled.toggle() }
    @objc func lockNow() { privacy.relock() }
    @objc func showPrivacyInfo() { privacyWindow.show(privacy: privacy) { [weak self] in Task { await self?.model.refresh() } } }
}

extension AppDelegate: NSMenuDelegate {
    /// Remonta o menu ao abrir, para refletir o estado atual.
    nonisolated func menuNeedsUpdate(_ menu: NSMenu) {
        MainActor.assumeIsolated { buildMenu(menu) }
    }
    func buildMenu(_ menu: NSMenu) {
        menu.removeAllItems()
        let head = NSMenuItem(title: "Modo discreto", action: nil, keyEquivalent: ""); head.isEnabled = false; menu.addItem(head)
        for m in PrivacyMode.allCases {
            let i = NSMenuItem(title: m.label, action: #selector(setMode(_:)), keyEquivalent: "")
            i.target = self; i.representedObject = m.rawValue; i.state = privacy.mode == m ? .on : .off; menu.addItem(i)
        }
        menu.addItem(.separator())
        let l = NSMenuItem(title: "Pedir Touch ID para ver valores", action: #selector(toggleLock), keyEquivalent: "")
        l.target = self; l.state = privacy.lockEnabled ? .on : .off; menu.addItem(l)
        if privacy.lockEnabled && privacy.unlocked {
            let n = NSMenuItem(title: "Esconder agora", action: #selector(lockNow), keyEquivalent: ""); n.target = self; menu.addItem(n)
        }
        menu.addItem(.separator())
        let p = NSMenuItem(title: "O que este app faz…", action: #selector(showPrivacyInfo), keyEquivalent: ""); p.target = self; menu.addItem(p)
        menu.addItem(NSMenuItem(title: "Sair", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
    }
}

enum IslandTab: String, CaseIterable, Identifiable {
    case carteira = "Carteira", graficos = "Gráficos"
    var id: String { rawValue }
}

@MainActor
final class PortfolioModel: ObservableObject {
    @Published var snapshot: Snapshot?
    @Published var expanded = false
    /// Última carteira lida (usada pela aba Gráficos: layouts e tickers).
    @Published var portfolio: Portfolio?
    @Published var tab: IslandTab = .carteira
    @Published var loadError: String?
    @Published var loading = false
    /// Transição "ganhou dinheiro hoje" em andamento (toca uma vez, depois volta ao humor).
    @Published var celebrating = false
    private var timer: Timer?
    var onShowPrivacyInfo: (() -> Void)?
    /// Ligado pelo NotchWindowController: abre/fecha a ilha (redimensiona a janela + anima).
    var onRequestExpand: ((Bool) -> Void)?
    func requestExpand(_ open: Bool) {
        if let f = onRequestExpand { f(open) } else { expanded = open }
    }
    /// Troca de aba; o controller redimensiona a janela (Gráficos usa um painel maior).
    var onRequestTab: ((IslandTab) -> Void)?
    func requestTab(_ t: IslandTab) {
        if let f = onRequestTab { f(t) } else { tab = t }
    }

    /// Tamanho da ilha aberta para a aba atual.
    var openSize: CGSize { size(for: tab) }
    func size(for t: IslandTab) -> CGSize {
        switch t {
        case .carteira: return IslandSize.open
        case .graficos:
            let c = portfolio?.tradingview
            let w = c?.panelWidth ?? TradingView.defaultPanel.width, h = c?.panelHeight ?? TradingView.defaultPanel.height
            // limita à tela (deixa folga nas laterais e embaixo)
            let vis = NSScreen.main?.frame.size ?? CGSize(width: 1440, height: 900)
            return CGSize(width: min(max(w, 480), vis.width - 40), height: min(max(h, 300), vis.height * 0.85))
        }
    }

    var mood: CofrinhoMood {
        if celebrating && !loading { return .ganhou }
        let failed = loadError != nil || (snapshot.map { $0.items.isEmpty && !$0.errors.isEmpty } ?? false)
        return CofrinhoMood.from(dayChangePct: snapshot?.dayChangePct, loading: loading, hasError: failed)
    }

    func start() {
        Task { await refresh() }
        timer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            Task { await self?.refresh() }
        }
    }

    func refresh() async {
        guard !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let p = try Portfolio.load(from: Portfolio.defaultURL)
            // Se o arquivo estiver legível por outros usuários do Mac, deixa só para a dona (600).
            if let perm = LocalData.permissions(), perm & 0o077 != 0 { try? LocalData.restrict() }
            portfolio = p
            let previous = snapshot?.total
            let new = await PortfolioEngine().snapshot(p)
            snapshot = new
            loadError = nil
            if CofrinhoMood.shouldCelebrate(previousTotal: previous, newTotal: new.total, dayChangePct: new.dayChangePct) {
                celebrating = true
            }
        } catch {
            loadError = "Crie ~/.notchinvest/portfolio.json"
        }
    }
}
#endif
