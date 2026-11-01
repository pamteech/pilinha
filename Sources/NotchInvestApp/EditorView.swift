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
                Text("Renda fixa").tag(0); Text("Ações e FIIs").tag(1); Text("Cripto").tag(2); Text("Dólar").tag(5)
                Text("Proventos").tag(3); Text("Favoritos").tag(6); Text("Alertas").tag(7); Text("Token brapi").tag(4)
            }.pickerStyle(.segmented).labelsHidden().padding(12)
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    switch section {
                    case 0: fixedSection
                    case 1: stockSection
                    case 2: cryptoSection
                    case 5: usdSection
                    case 3: dividendSection
                    case 6: watchSection
                    case 7: AlertsEditor()
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
                            Picker("", selection: $f.indexer) {
                                Text("CDI").tag(FixedIncomeIndexer.cdi); Text("IPCA+").tag(FixedIncomeIndexer.ipca)
                            }.labelsHidden().frame(width: 80)
                            if f.indexer == .cdi {
                                TextField("% CDI", text: $f.cdiPercent).frame(width: 60)
                                Text("% do CDI").foregroundStyle(.secondary)
                            } else {
                                Text("IPCA +").foregroundStyle(.secondary)
                                TextField("taxa", text: $f.realRate).frame(width: 50)
                                Text("% a.a.").foregroundStyle(.secondary)
                            }
                            removeButton { state.draft.fixed.removeAll { $0.id == f.id } }
                        }
                        if f.indexer == .ipca {
                            HStack {
                                Toggle("Vencimento", isOn: Binding(get: { f.maturity != nil }, set: { f.maturity = $0 ? (f.maturity ?? Date()) : nil }))
                                if let m = f.maturity {
                                    DatePicker("", selection: Binding(get: { m }, set: { f.maturity = $0 }), displayedComponents: .date).labelsHidden().frame(width: 120)
                                }
                                Text("Na curva da taxa contratada; o resgate antecipado pode diferir.").font(.caption).foregroundStyle(.secondary)
                            }
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
            hint("Ticker da B3 (PETR4, MXRF11…). Preço médio é opcional: aparece como PM ao lado da cotação do momento (verde se acima, vermelho se abaixo). Cotação de qualquer ação/FII/ETF funciona sem token (Yahoo Finance).")
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

    // MARK: dólar
    var usdSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            hint("Só digite quantos dólares você tem. A cotação é automática: o Pilinvest busca o dólar ao vivo (AwesomeAPI; reserva: PTAX do Banco Central) e atualiza sozinho a cada 5 minutos. Deixe vazio para tirar o dólar.")
            HStack {
                Image(systemName: "dollarsign.circle").foregroundStyle(.purple)
                Text("US$").foregroundStyle(.secondary)
                TextField("quantidade (ex. 1500,00)", text: $state.draft.usdAmount).frame(width: 150)
                Spacer()
            }
            DisclosureGroup("Opcional: quanto paguei em média (só para mostrar ganho/perda)") {
                HStack {
                    Text("R$ por dólar").foregroundStyle(.secondary)
                    TextField("pode deixar vazio", text: $state.draft.usdAverage).frame(width: 140)
                    Spacer()
                }
            }.font(.caption).foregroundStyle(.secondary)
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

    // MARK: favoritos
    var watchSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            hint("Ações que você pretende comprar. Coloque o preço que quer pagar e, se quiser, quanto pretende investir. O painel mostra a cotação, quanto falta e o Pilinvest avisa (notificação) quando chegar no preço.")
            ForEach($state.draft.watch) { $w in
                HStack {
                    Image(systemName: "star").foregroundStyle(.purple)
                    TextField("Ticker", text: $w.ticker).frame(width: 90)
                    Text("Preço desejado R$").foregroundStyle(.secondary)
                    TextField("ex. 34,50", text: $w.target).frame(width: 90)
                    Text("Investir R$").foregroundStyle(.secondary)
                    TextField("opcional", text: $w.amount).frame(width: 100)
                    Spacer()
                    removeButton { state.draft.watch.removeAll { $0.id == w.id } }
                }
            }
            addButton("Adicionar favorito") { state.draft.watch.append(.init()); AlertNotifier.requestPermission() }
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
                Text("Salvo em ~/.notchinvest/portfolio.json (só você lê) e copiado para iCloud Drive/Pilinha/carteira.json. Para o iPhone receber sozinho, conecte ao iPhone.").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Button { SyncPairing.show() } label: { Label("Conectar ao iPhone…", systemImage: "iphone") }
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

/// Alertas de preço (salvos em ~/.notchinvest/alerts.json; não mexem na carteira).
struct AlertsEditor: View {
    @State private var store = AlertStore.load()
    @State private var ticker = ""
    @State private var value = ""
    @State private var kind: AlertKind = .below
    @State private var err: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Notificação do macOS quando a ação sobe ou cai mais de X% no dia, ou bate um preço. Um aviso por alerta por dia, checado a cada atualização (5 min).")
                .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            HStack {
                TextField("Ticker", text: $ticker).frame(width: 90)
                Picker("", selection: $kind) { ForEach(AlertKind.allCases, id: \.self) { Text($0.label).tag($0) } }.labelsHidden().frame(width: 140)
                TextField(kind == .dropPct || kind == .risePct ? "% (ex. 3)" : "preço (ex. 40,00)", text: $value).frame(width: 110)
                Button { add() } label: { Label("Criar alerta", systemImage: "bell.badge") }
            }
            if let err { Label(err, systemImage: "exclamationmark.triangle").foregroundStyle(.orange).font(.caption) }
            ForEach(store.alerts) { a in
                HStack {
                    Image(systemName: a.kind == .above || a.kind == .risePct ? "arrow.up.circle" : "arrow.down.circle").foregroundStyle(a.enabled ? (a.kind == .above || a.kind == .risePct ? .green : .red) : .secondary)
                    Text(a.label).foregroundStyle(a.enabled ? .primary : .secondary)
                    Spacer()
                    Button { toggle(a) } label: { Image(systemName: a.enabled ? "bell.fill" : "bell.slash") }.buttonStyle(.borderless).help(a.enabled ? "Pausar" : "Ativar")
                    Button { store.alerts.removeAll { $0.id == a.id }; persist() } label: { Image(systemName: "trash") }.buttonStyle(.borderless).foregroundStyle(.red).help("Remover")
                }
            }
            if store.alerts.isEmpty { Text("Nenhum alerta ainda. Favoritos avisam sozinhos quando chegam no preço.").font(.caption).foregroundStyle(.secondary) }
        }
    }
    func add() {
        let t = ticker.uppercased().filter { $0.isLetter || $0.isNumber }
        guard t.count >= 5, t.count <= 7, let v = DecimalInput.parse(value), v > 0 else { err = "Informe o ticker (ex. PETR4) e um valor maior que zero."; return }
        if (kind == .dropPct || kind == .risePct) && v >= 100 { err = "A variação tem que ser menor que 100%."; return }
        err = nil; store.alerts.append(PriceAlert(ticker: t, kind: kind, value: v)); ticker = ""; value = ""; persist()
        AlertNotifier.requestPermission()
    }
    func toggle(_ a: PriceAlert) { if let i = store.alerts.firstIndex(where: { $0.id == a.id }) { store.alerts[i].enabled.toggle(); persist() } }
    func persist() { var s = AlertStore.load(); s.alerts = store.alerts; try? s.save(); store = s }
}

/// Janela normal (não o painel do entalhe), para o teclado funcionar nos campos.
@MainActor
final class EditorWindow: NSObject, NSWindowDelegate {
    private var window: NSWindow?
    func show(onSaved: @escaping () -> Void) {
        if window == nil {
            let w = NSWindow(contentRect: .init(x: 0, y: 0, width: 700, height: 580), styleMask: [.titled, .closable, .resizable, .miniaturizable],
                             backing: .buffered, defer: false)
            w.title = "Pilinvest — Cadastro da carteira"; w.isReleasedWhenClosed = false; w.delegate = self
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
