#if os(macOS)
import AppKit
import SwiftUI
import LocalAuthentication
import NotchInvestCore

/// Modo discreto + trava opcional com Touch ID. Estado salvo em UserDefaults (só preferências, nenhum valor).
@MainActor
final class PrivacyController: ObservableObject {
    private let d = UserDefaults.standard
    @Published var mode: PrivacyMode { didSet { d.set(mode.rawValue, forKey: "privacyMode") } }
    @Published private(set) var lock: PrivacyLock
    @Published var authError: String?
    private var relockTimer: Timer?
    private var observers: [(NotificationCenter, NSObjectProtocol)] = []

    init() {
        mode = PrivacyMode.load(d.string(forKey: "privacyMode"))      // 1ª vez: discreto
        if d.string(forKey: "privacyMode") == nil { d.set(PrivacyMode.firstRunDefault.rawValue, forKey: "privacyMode") }
        lock = PrivacyLock(enabled: d.bool(forKey: "lockEnabled"),
                           relockMinutes: d.object(forKey: "relockMinutes") as? Int ?? 5)
        observeSystemLock()
    }

    var unlocked: Bool { lock.isUnlocked() }
    var effective: PrivacyMode { mode.effective(unlocked: unlocked) }
    /// Valores precisam de Touch ID agora?
    var needsAuth: Bool { mode == .valores && !unlocked }

    func cycle() { mode = mode.next; if needsAuth { authenticate() } }
    func set(_ m: PrivacyMode) { mode = m; if needsAuth { authenticate() } }

    var lockEnabled: Bool {
        get { lock.enabled }
        set { lock = PrivacyLock(enabled: newValue, relockMinutes: lock.relockMinutes); d.set(newValue, forKey: "lockEnabled") }
    }
    var relockMinutes: Int {
        get { lock.relockMinutes }
        set { lock = PrivacyLock(enabled: lock.enabled, relockMinutes: newValue); d.set(newValue, forKey: "relockMinutes") }
    }

    /// Tela do sistema (Touch ID, ou senha do Mac como alternativa). O app só recebe sim/não.
    func authenticate() {
        let ctx = LAContext()
        ctx.localizedFallbackTitle = "Usar senha do Mac"
        var err: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err) else {
            authError = "Este Mac não permite autenticação: \(err?.localizedDescription ?? "")"; return
        }
        ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "mostrar os valores da carteira") { ok, e in
            Task { @MainActor [weak self] in
                guard let self else { return }
                if ok { self.lock.didAuthenticate(); self.authError = nil; self.scheduleRelock() }
                else { self.authError = (e as? LAError)?.code == .userCancel ? nil : "Não autenticado" }
                self.objectWillChange.send()
            }
        }
    }

    func relock() { lock.lock(); relockTimer?.invalidate(); objectWillChange.send() }

    private func scheduleRelock() {
        relockTimer?.invalidate()
        guard let t = lock.relockDate() else { return }
        relockTimer = Timer.scheduledTimer(withTimeInterval: max(1, t.timeIntervalSinceNow), repeats: false) { _ in
            Task { @MainActor [weak self] in self?.relock() }
        }
    }

    /// Mac bloqueou, protetor de tela, tela apagou ou dormiu → esconde de novo.
    private func observeSystemLock() {
        let dn = DistributedNotificationCenter.default()
        let ws = NSWorkspace.shared.notificationCenter
        let pairs: [(NotificationCenter, Notification.Name)] = [
            (dn, .init("com.apple.screenIsLocked")), (dn, .init("com.apple.screensaver.didstart")),
            (ws, NSWorkspace.willSleepNotification), (ws, NSWorkspace.screensDidSleepNotification),
            (ws, NSWorkspace.sessionDidResignActiveNotification),
        ]
        for (c, n) in pairs {
            let o = c.addObserver(forName: n, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.relock() }
            }
            observers.append((c, o))
        }
    }
}

/// Botão de olho (ilha aberta): alterna valores → R$ ••••• → só % .
struct PrivacyButton: View {
    @EnvironmentObject var privacy: PrivacyController
    var body: some View {
        Button { privacy.cycle() } label: {
            Image(systemName: icon).font(.system(size: 11, weight: .semibold))
                .frame(width: 22, height: 22).background(Circle().fill(Color.white.opacity(0.12)))
        }
        .buttonStyle(.plain).foregroundStyle(.white)
        .help("Modo discreto: \(privacy.mode.label)")
        .accessibilityLabel("Modo discreto")
    }
    var icon: String {
        switch privacy.mode { case .valores: return "eye"; case .oculto: return "eye.slash"; case .porcentagens: return "percent" }
    }
}

/// Tela "O que este app faz".
struct PrivacyInfoView: View {
    @EnvironmentObject var privacy: PrivacyController
    var onErased: () -> Void = {}
    @State private var confirmErase = false
    @State private var message: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("O que este app faz").font(.title2.bold())
                Group {
                    item("checkmark.shield", "Só mostra números", "Ele lê um arquivo que você mesma preenche e mostra o total e as variações. Nada além disso.")
                    item("building.columns", "Não acessa banco nem Nubank", "Não pede senha de banco, não se conecta à sua conta e não usa Open Finance.")
                    item("arrow.left.arrow.right", "Não move dinheiro", "Não faz Pix, transferência, compra nem venda. Não tem como.")
                    item("internaldrive", "Seus dados ficam só neste Mac", "No arquivo \(Portfolio.defaultURL.path). Não vai para nuvem nem para nós.")
                    item("eye.slash", "Sem rastreamento", "Sem conta, sem anúncios, sem estatísticas de uso, sem enviar nada sobre você.")
                }
                Text("Sites que ele consulta (só para buscar preços públicos)").font(.headline)
                site("Banco Central (api.bcb.gov.br)", "taxa do CDI, para calcular a renda fixa")
                site("brapi.dev", "cotação das ações/FIIs — envia só o código, ex. PETR4")
                site("CoinGecko", "preço do bitcoin em reais — envia só \"bitcoin\"")
                site("TradingView", "só se você abrir a aba Gráficos; o login é feito no site deles")
                Text("Nenhuma dessas consultas leva quanto você tem, quanto investiu ou seu nome.")
                    .font(.callout).foregroundStyle(.secondary)

                Divider()
                Text("Privacidade na tela").font(.headline)
                Picker("Mostrar", selection: Binding(get: { privacy.mode }, set: { privacy.set($0) })) {
                    ForEach(PrivacyMode.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                Toggle("Pedir Touch ID (ou senha do Mac) para mostrar valores", isOn: Binding(
                    get: { privacy.lockEnabled }, set: { privacy.lockEnabled = $0 }))
                if privacy.lockEnabled {
                    Picker("Esconder de novo após", selection: Binding(get: { privacy.relockMinutes }, set: { privacy.relockMinutes = $0 })) {
                        ForEach(PrivacyLock.minuteOptions, id: \.self) { Text("\($0) min").tag($0) }
                    }
                    Text("Também esconde quando o Mac bloqueia ou dorme. A tela de senha é do macOS; o app nunca vê sua digital nem sua senha.")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Divider()
                HStack {
                    Button("Abrir pasta dos dados") { openFolder() }
                    Button("Proteger arquivo (só eu leio)") {
                        do { try LocalData.restrict(); message = "Permissão ajustada para 600 (só a sua conta lê)." }
                        catch { message = "Arquivo não encontrado." }
                    }
                    Spacer()
                    Button("Apagar tudo…", role: .destructive) { confirmErase = true }
                }
                if let message { Text(message).font(.caption).foregroundStyle(.secondary) }
            }
            .padding(22)
        }
        .frame(width: 520, height: 620)
        .confirmationDialog("Apagar todos os dados do NotchInvest?", isPresented: $confirmErase) {
            Button("Apagar a pasta \(LocalData.folder.path)", role: .destructive) { erase() }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Isso remove o arquivo da carteira e as preferências deste app. Não mexe em nada no banco. Não dá para desfazer.")
        }
    }

    func item(_ icon: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon).frame(width: 22).foregroundStyle(.green)
            VStack(alignment: .leading, spacing: 2) { Text(title).bold(); Text(text).foregroundStyle(.secondary) }
        }
    }
    func site(_ name: String, _ why: String) -> some View {
        HStack(alignment: .top) { Text("•"); Text(name).bold() + Text(" — \(why)") }
    }
    func openFolder() {
        let f = LocalData.folder
        if FileManager.default.fileExists(atPath: f.path) { NSWorkspace.shared.activateFileViewerSelecting([Portfolio.defaultURL]) }
        else { message = "A pasta \(f.path) ainda não existe." }
    }
    func erase() {
        do {
            try LocalData.eraseAll()
            for k in ["privacyMode", "lockEnabled", "relockMinutes"] { UserDefaults.standard.removeObject(forKey: k) }
            privacy.mode = .firstRunDefault; privacy.lockEnabled = false; privacy.relock()
            message = "Tudo apagado."; onErased()
        } catch { message = "Não consegui apagar: \(error.localizedDescription)" }
    }
}

/// Janela normal para a tela de privacidade (fora da ilha).
@MainActor
final class PrivacyWindow {
    private var window: NSWindow?
    func show(privacy: PrivacyController, onErased: @escaping () -> Void) {
        if window == nil {
            let w = NSWindow(contentRect: .init(x: 0, y: 0, width: 520, height: 620), styleMask: [.titled, .closable],
                             backing: .buffered, defer: false)
            w.title = "O que este app faz"; w.isReleasedWhenClosed = false
            w.contentView = NSHostingView(rootView: PrivacyInfoView(onErased: onErased).environmentObject(privacy))
            w.center(); window = w
        }
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
    }
}
#endif
