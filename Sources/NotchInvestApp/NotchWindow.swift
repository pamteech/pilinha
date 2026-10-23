#if os(macOS)
import AppKit
import SwiftUI

/// Painel sem borda acima da barra de menus, centralizado no entalhe.
/// Técnica (inspirada no Coucou, MIT): NSPanel .borderless + .nonactivatingPanel,
/// nível mainMenu+3, presente em todos os Spaces, tamanho do entalhe lido de
/// NSScreen.safeAreaInsets / auxiliaryTopLeftArea / auxiliaryTopRightArea.
final class NotchPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

struct NotchGeometry {
    let width: CGFloat, height: CGFloat, hasNotch: Bool
    static func of(_ screen: NSScreen) -> NotchGeometry {
        let top = screen.safeAreaInsets.top
        if top > 0, let l = screen.auxiliaryTopLeftArea, let r = screen.auxiliaryTopRightArea {
            return .init(width: screen.frame.width - l.width - r.width, height: top, hasNotch: true)
        }
        // Sem entalhe (monitor externo): pílula falsa sob a barra de menus.
        let menuBar = screen.frame.maxY - screen.visibleFrame.maxY
        return .init(width: 200, height: max(menuBar, 24), hasNotch: false)
    }
    static var targetScreen: NSScreen {
        NSScreen.screens.first { $0.safeAreaInsets.top > 0 } ?? NSScreen.main ?? NSScreen.screens[0]
    }
}

/// Hosting view que aceita o primeiro clique (o painel não ativa o app, então sem isso
/// o 1º clique só "focaria" a janela).
final class NotchHostingView<Content: View>: NSHostingView<Content> {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

/// Tamanhos da ilha (em pontos). A janela tem sempre o tamanho da ilha + uma margem
/// pequena para o efeito de hover, então não bloqueia cliques no resto do topo da tela.
enum IslandSize {
    static let hoverMargin: CGFloat = 6
    static let closedExtraWidth: CGFloat = 160          // espaço para porquinho + valores ao redor do entalhe
    static let open = CGSize(width: 480, height: 280)
    static func closed(notchWidth: CGFloat, notchHeight: CGFloat) -> CGSize {
        CGSize(width: notchWidth + closedExtraWidth, height: notchHeight)
    }
}

@MainActor
final class NotchWindowController: NSWindowController {
    private var model: PortfolioModel!
    private var geo: NotchGeometry!
    private var screen: NSScreen!
    private var globalClickMonitor: Any?
    private var localKeyMonitor: Any?
    private var shrinkWork: DispatchWorkItem?
    /// App que estava em primeiro plano ao abrir: devolvemos o foco de teclado a ele ao fechar.
    private var previousApp: NSRunningApplication?
    static let animation = Animation.spring(response: 0.35, dampingFraction: 0.82)
    static let animationDuration: TimeInterval = 0.4

    convenience init(model: PortfolioModel, charts: ChartWebController, privacy: PrivacyController) {
        let screen = NotchGeometry.targetScreen
        let geo = NotchGeometry.of(screen)
        let panel = NotchPanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel],
                               backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.mainMenuWindow)) + 3)
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        panel.isMovable = false
        panel.hidesOnDeactivate = false
        let root = NotchRootView(notchWidth: geo.width, notchHeight: geo.height)
            .environmentObject(model).environmentObject(charts).environmentObject(privacy)
        panel.contentView = NotchHostingView(rootView: root)
        self.init(window: panel)
        self.model = model; self.geo = geo; self.screen = screen
        model.onRequestExpand = { [weak self] open in self?.setExpanded(open) }
        model.onRequestTab = { [weak self] t in self?.setTab(t) }
        resizeWindow(open: false)
    }

    /// Mantém a janela ancorada no topo, centralizada no entalhe.
    private func resizeWindow(open: Bool, size: CGSize? = nil) {
        guard let panel = window else { return }
        let island = open ? (size ?? model.openSize) : IslandSize.closed(notchWidth: geo.width, notchHeight: geo.height)
        let m = IslandSize.hoverMargin
        let w = island.width + 2 * m, h = island.height + m     // margem nas laterais e embaixo
        let sf = screen.frame
        panel.setFrame(NSRect(x: sf.midX - w / 2, y: sf.maxY - h, width: w, height: h), display: true)
    }

    /// Abre/fecha. Ao abrir: cresce a janela primeiro e depois anima o conteúdo.
    /// Ao fechar: anima o conteúdo e só então encolhe a janela.
    func setExpanded(_ open: Bool) {
        guard open != model.expanded else { return }
        shrinkWork?.cancel(); shrinkWork = nil
        if open {
            resizeWindow(open: true)
            Task { @MainActor in withAnimation(Self.animation) { self.model.expanded = true } }
            let front = NSWorkspace.shared.frontmostApplication
            previousApp = front?.processIdentifier == ProcessInfo.processInfo.processIdentifier ? nil : front
            window?.makeKey()                    // para receber Esc (painel não ativa o app)
            installMonitors()
        } else {
            removeMonitors()
            withAnimation(Self.animation) { model.expanded = false }
            // Se a ilha ficou com o teclado (fechou por Esc/clique nela), devolve ao app anterior.
            if window?.isKeyWindow == true { previousApp?.activate() }
            previousApp = nil
            let work = DispatchWorkItem { [weak self] in
                MainActor.assumeIsolated {
                    guard let self, !self.model.expanded else { return }
                    self.resizeWindow(open: false)
                }
            }
            shrinkWork = work
            DispatchQueue.main.asyncAfter(deadline: .now() + Self.animationDuration, execute: work)
        }
    }

    /// Troca de aba com a ilha aberta: se o painel cresce, a janela cresce antes da animação;
    /// se diminui, a janela encolhe depois dela (nada fica cortado).
    func setTab(_ t: IslandTab) {
        guard t != model.tab else { return }
        guard model.expanded else { model.tab = t; return }
        shrinkWork?.cancel(); shrinkWork = nil
        let old = model.size(for: model.tab), new = model.size(for: t)
        if new.width >= old.width || new.height >= old.height {
            resizeWindow(open: true, size: CGSize(width: max(old.width, new.width), height: max(old.height, new.height)))
        }
        withAnimation(Self.animation) { model.tab = t }
        let work = DispatchWorkItem { [weak self] in
            MainActor.assumeIsolated {
                guard let self, self.model.expanded else { return }
                self.resizeWindow(open: true)
            }
        }
        shrinkWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.animationDuration, execute: work)
    }

    private func installMonitors() {
        removeMonitors()
        // Cliques em outros apps/áreas da tela (não chegam à nossa janela) fecham a ilha.
        // Monitor global de mouse não exige permissão de Acessibilidade.
        globalClickMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown]) { [weak self] _ in
            Task { @MainActor in self?.setExpanded(false) }
        }
        // Esc com a ilha aberta (a janela vira key ao abrir).
        localKeyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] e in
            guard e.keyCode == 53 else { return e }
            MainActor.assumeIsolated { self?.setExpanded(false) }
            return nil
        }
    }

    private func removeMonitors() {
        if let m = globalClickMonitor { NSEvent.removeMonitor(m); globalClickMonitor = nil }
        if let m = localKeyMonitor { NSEvent.removeMonitor(m); localKeyMonitor = nil }
    }
}
#endif
