#if os(macOS)
import AppKit
import SwiftUI
import Combine
import NotchInvestCore

/// Onde o Pilinha aparece. Padrão: entalhe (comportamento original).
/// Para usar na barra de menus:  defaults write com.pamtech.pilinha displayMode menuBar
enum DisplayMode: String {
    case notch, menuBar
    static var current: DisplayMode {
        let raw = UserDefaults.standard.string(forKey: "displayMode")
            ?? ProcessInfo.processInfo.environment["PILINHA_DISPLAY_MODE"]
        return raw.flatMap(DisplayMode.init(rawValue:)) ?? .notch
    }
}

/// Conteúdo do item na barra de menus: porquinho pequeno + patrimônio (respeita o modo discreto).
struct MenuBarLabel: View {
    @EnvironmentObject var model: PortfolioModel
    @EnvironmentObject var privacy: PrivacyController
    var body: some View {
        HStack(spacing: 3) {
            CofrinhoView(mood: model.mood, size: 18) { model.celebrating = false }
            Text(label).font(.system(size: 12, weight: .semibold, design: .rounded)).lineLimit(1)
                .fixedSize()
        }
        .padding(.horizontal, 4)
        .frame(height: 22)
    }
    var label: String {
        guard let s = model.snapshot else { return "…" }
        if let t = privacy.mode.compactLeft(total: s.total, unlocked: privacy.unlocked), !t.isEmpty { return t }
        return s.dayChangePct.map { String(format: "%+.2f%%", $0) } ?? ""
    }
}

/// Painel do popover: as mesmas abas e views da ilha do entalhe.
struct MenuBarPanelView: View {
    @EnvironmentObject var model: PortfolioModel
    var body: some View {
        VStack(spacing: 8) {
            IslandTabBar()
            switch model.tab {
            case .carteira: ExpandedView()
            case .evolucao: HistoryChartView()
            case .graficos: ChartsView()
            }
        }
        .padding(.horizontal, model.tab == .graficos ? 10 : 18).padding(.vertical, 12)
        .frame(width: model.openSize.width, height: model.openSize.height - 20)
        .background(Color.black)
        .environment(\.colorScheme, .dark)
        .tint(.purple)
    }
}

final class PassThroughHostingView<Content: View>: NSHostingView<Content> {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }   // cliques vão para o botão
}

@MainActor
final class MenuBarController: NSObject, NSPopoverDelegate {
    let item: NSStatusItem
    let popover = NSPopover()
    private let model: PortfolioModel
    private let menu: NSMenu
    private let host: NSHostingView<AnyView>
    private var bag = Set<AnyCancellable>()

    init(model: PortfolioModel, charts: ChartWebController, privacy: PrivacyController, menu: NSMenu) {
        self.model = model; self.menu = menu
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        host = PassThroughHostingView(rootView: AnyView(MenuBarLabel()
            .environmentObject(model).environmentObject(privacy)))
        super.init()
        if let b = item.button {
            b.title = ""; b.addSubview(host)
            b.target = self; b.action = #selector(clicked(_:))
            b.sendAction(on: [.leftMouseUp, .rightMouseUp])
            b.setAccessibilityLabel("Pilinha")
        }
        popover.behavior = .transient
        popover.animates = true
        popover.delegate = self
        popover.appearance = NSAppearance(named: .darkAqua)
        popover.contentViewController = NSHostingController(rootView: MenuBarPanelView()
            .environmentObject(model).environmentObject(charts).environmentObject(privacy))
        model.onRequestExpand = { [weak self] open in self?.setOpen(open) }
        model.onRequestTab = { [weak self] t in
            guard let self else { return }
            self.model.tab = t
            self.popover.contentSize = self.popoverSize
        }
        model.objectWillChange.merge(with: privacy.objectWillChange)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.relayout() }.store(in: &bag)
        relayout()
    }

    private var popoverSize: CGSize { let s = model.openSize; return CGSize(width: s.width, height: s.height - 20) }

    private func relayout() {
        let w = max(host.fittingSize.width, 28)
        item.length = w
        host.frame = NSRect(x: 0, y: 0, width: w, height: NSStatusBar.system.thickness)
    }

    @objc private func clicked(_ sender: NSStatusBarButton) {
        if NSApp.currentEvent?.type == .rightMouseUp || NSApp.currentEvent?.modifierFlags.contains(.control) == true {
            popover.performClose(nil)
            item.menu = menu; item.button?.performClick(nil); item.menu = nil   // menu de opções
            return
        }
        setOpen(!popover.isShown)
    }

    func setOpen(_ open: Bool) {
        if open, !popover.isShown, let b = item.button {
            popover.contentSize = popoverSize
            popover.show(relativeTo: b.bounds, of: b, preferredEdge: .minY)
            popover.contentViewController?.view.window?.makeKey()
            model.expanded = true
        } else if !open, popover.isShown {
            popover.performClose(nil)
        }
    }
    nonisolated func popoverDidClose(_ n: Notification) {
        MainActor.assumeIsolated { model.expanded = false }
    }
}
#endif
