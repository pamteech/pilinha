#if os(macOS)
import AppKit
import SwiftUI
import NotchInvestCore

/// Tela de cadastro: lê ~/.notchinvest/portfolio.json, edita e salva (600). Nada sai do Mac.
@MainActor
final class EditorState: ObservableObject {
    @Published var draft: PortfolioDraft
    @Published var errors: [String] = []
    @Published var saved = false
    @Published var tokenInput = ""
    @Published var hasToken = BrapiTokenStore.hasKeychainToken
    private var original: PortfolioDraft

    init() {
        let p = (try? Portfolio.load(from: Portfolio.defaultURL)) ?? Portfolio()
        let d = PortfolioDraft(p); draft = d; original = d
    }
    var dirty: Bool { draft != original }

    func save() -> Bool {
        switch draft.build() {
        case .failure(let e): errors = e.messages; saved = false; return false
        case .success(let p):
            do {
                try LocalData.save(p)
                errors = []; saved = true; original = draft
                return true
            } catch { errors = ["Não consegui salvar: \(error.localizedDescription)"]; return false }
        }
    }
    func saveToken() {
        if BrapiTokenStore.save(tokenInput) { tokenInput = ""; hasToken = BrapiTokenStore.hasKeychainToken }
        else { errors = ["Não consegui guardar o token no Keychain."] }
    }
    func deleteToken() { BrapiTokenStore.delete(); hasToken = false }
}

struct EditorView: View {
    @StateObject var state = EditorState()
    var onSaved: () -> Void
    @State private var section = 0

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $section) {
                Text("Renda fixa").tag(0); Text("Ações e FIIs").tag(1); Text("Cripto").tag(2)
                Text("Proventos").tag(3); Text("Token brapi").tag(4)
            }.pickerStyle(.segmented).labelsHidden().padding(12)
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    switch section {
                    case 0: fixedSection
                    case 1: stockSection
                    case 2: cryptoSection
                    case 3: dividendSection
                    default: tokenSection
                    }
                }.padding(16).frame(maxWidth: .infinity, alignment: .leading)
            }
            Divider()
            footer.padding(12)
        }
        .frame(minWidth: 640, minHeight: 520)
    }

    // MARK: renda fixa
    var fixedSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            hint("Caixinhas, CDB, Tesouro Selic, LCI/LCA pós-fixados. Cada aporte rende desde a data dele. Use vírgula ou ponto: 1234,56.")
            ForEach($state.draft.fixed) { $f in
                GroupBox {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            TextField("Nome (ex. Caixinha Viagem)", text: $f.name)
                            Picker("", selection: $f.kind) {
                                ForEach([FixedIncomeKind.caixinha, .cdb, .tesouro, .lci, .lca], id: \.self) { Text($0.label).tag($0) }
                            }.labelsHidden().frame(width: 110)
                            TextField("% CDI", text: $f.cdiPercent).frame(width: 60)
                            Text("% do CDI").foregroundStyle(.secondary)
                            removeButton { state.draft.fixed.removeAll { $0.id == f.id } }
                        }
                        ForEach($f.deposits) { $d in
                            HStack {
                                Text("Aporte").foregroundStyle(.secondary).frame(width: 50, alignment: .leading)
                                DatePicker("", selection: $d.date, in: ...Date(), displayedComponents: .date).labelsHidden().frame(width: 120)
                                Text("R$").foregroundStyle(.secondary)
                                TextField("valor", text: $d.amount).frame(width: 120)
                                if f.deposits.count > 1 { removeButton { f.deposits.removeAll { $0.id == d.id } } }
                            }
                        }
                        Button { f.deposits.append(.init(date: Date(), amount: "")) } label: { Label("Aporte", systemImage: "plus") }
                            .buttonStyle(.link)
                    }.padding(4)
                }
            }
            addButton("Adicionar renda fixa") { state.draft.fixed.append(.init()) }
        }
    }

    // MARK: ações
    var stockSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            hint("Ticker da B3 (PETR4, MXRF11…). Preço médio é opcional: aparece como "PM" ao lado da cotação do momento (verde se acima, vermelho se abaixo). Cotação de qualquer ação/FII/ETF funciona sem token (Yahoo Finance).")
            ForEach($state.draft.stocks) { $s in
                HStack {
                    TextField("Ticker", text: $s.ticker).frame(width: 90)
                    TextField("Quantidade", text: $s.quantity).frame(width: 100)
                    Text("Preço médio R$").foregroundStyle(.secondary)
                    TextField("opcional", text: $s.averagePrice).frame(width: 100)
                    Spacer()
                    removeButton { state.draft.stocks.removeAll { $0.id == s.id } }
                }
            }
            addButton("Adicionar ação/FII") { state.draft.stocks.append(.init()) }
        }
    }

    // MARK: cripto
    var cryptoSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            hint("Id do CoinGecko (bitcoin, ethereum…) e quantidade, ex. 0,0015. Preço médio em reais, opcional.")
            ForEach($state.draft.crypto) { $c in
                HStack {
                    TextField("id (bitcoin)", text: $c.coinId).frame(width: 110)
                    TextField("Símbolo", text: $c.symbol).frame(width: 60)
                    TextField("Quantidade", text: $c.quantity).frame(width: 110)
                    Text("Preço médio R$").foregroundStyle(.secondary)
                    TextField("opcional", text: $c.averagePrice).frame(width: 100)
                    Spacer()
                    removeButton { state.draft.crypto.removeAll { $0.id == c.id } }
                }
            }
            addButton("Adicionar cripto") { state.draft.crypto.append(.init()) }
        }
    }

    // MARK: proventos
    var dividendSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            hint("Com token da brapi, os proventos vêm automaticamente (estimativa com a quantidade atual). Se quiser o valor exato que caiu na conta, lance aqui: o lançamento manual vale no lugar da brapi para aquele ticker.")
            ForEach($state.draft.dividends) { $d in
                HStack {
                    TextField("Ticker", text: $d.ticker).frame(width: 90)
                    DatePicker("", selection: $d.date, in: ...Date(), displayedComponents: .date).labelsHidden().frame(width: 120)
                    Text("R$").foregroundStyle(.secondary)
                    TextField("valor recebido", text: $d.amount).frame(width: 120)
                    Spacer()
                    removeButton { state.draft.dividends.removeAll { $0.id == d.id } }
                }
            }
            addButton("Lançar provento") { state.draft.dividends.append(.init()) }
        }
    }

    // MARK: token
    var tokenSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            hint("Opcional. Sem token, as cotações vêm do Yahoo Finance e os proventos só pelos lançamentos manuais. Com o token grátis da brapi.dev (crie em brapi.dev/dashboard), as cotações vêm da brapi (o Yahoo vira reserva) e os proventos entram automaticamente. Ele fica no Keychain deste Mac (não vai para o portfolio.json, nem para o iCloud, nem para logs).")
            HStack {
                Image(systemName: state.hasToken ? "checkmark.seal.fill" : "xmark.seal").foregroundStyle(state.hasToken ? .green : .secondary)
                Text(state.hasToken ? "Token guardado no Keychain" : "Nenhum token guardado")
            }
            HStack {
                SecureField("cole o token aqui", text: $state.tokenInput).frame(width: 320)
                Button("Guardar") { state.saveToken(); onSaved() }.disabled(state.tokenInput.isEmpty)
                if state.hasToken { Button("Apagar token", role: .destructive) { state.deleteToken(); onSaved() } }
            }
        }
    }

    // MARK: rodapé
    var footer: some View {
        VStack(alignment: .leading, spacing: 6) {
            if !state.errors.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(state.errors.prefix(6), id: \.self) { Label($0, systemImage: "exclamationmark.triangle").foregroundStyle(.orange) }
                    if state.errors.count > 6 { Text("+ \(state.errors.count - 6) outros").foregroundStyle(.secondary) }
                }.font(.caption)
            }
            HStack {
                Image(systemName: "lock.fill").foregroundStyle(.secondary)
                Text("Salvo só neste Mac em ~/.notchinvest/portfolio.json (só você lê).").font(.caption).foregroundStyle(.secondary)
                Spacer()
                if state.saved && !state.dirty { Label("Salvo", systemImage: "checkmark").foregroundStyle(.green).font(.caption) }
                Button("Salvar") { if state.save() { onSaved() } }
                    .keyboardShortcut("s", modifiers: .command).buttonStyle(.borderedProminent).disabled(!state.dirty)
            }
        }
    }

    func hint(_ s: String) -> some View { Text(s).font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true) }
    func addButton(_ t: String, _ a: @escaping () -> Void) -> some View {
        Button(action: a) { Label(t, systemImage: "plus.circle.fill") }
    }
    func removeButton(_ a: @escaping () -> Void) -> some View {
        Button(action: a) { Image(systemName: "trash") }.buttonStyle(.borderless).foregroundStyle(.red).help("Remover")
    }
}

/// Janela normal (não o painel do entalhe), para o teclado funcionar nos campos.
@MainActor
final class EditorWindow: NSObject, NSWindowDelegate {
    private var window: NSWindow?
    func show(onSaved: @escaping () -> Void) {
        if window == nil {
            let w = NSWindow(contentRect: .init(x: 0, y: 0, width: 700, height: 580), styleMask: [.titled, .closable, .resizable, .miniaturizable],
                             backing: .buffered, defer: false)
            w.title = "Pilinha — Cadastro da carteira"; w.isReleasedWhenClosed = false; w.delegate = self
            w.contentView = NSHostingView(rootView: EditorView(onSaved: onSaved))
            w.center(); window = w
        }
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
    }
    /// Fecha e descarta: na próxima abertura relê o arquivo.
    func windowWillClose(_ n: Notification) { window = nil }
}
#endif
