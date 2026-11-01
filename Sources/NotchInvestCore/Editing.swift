import Foundation

/// Números digitados no formato brasileiro ou americano: "1.234,56", "1234,56", "1234.56", "R$ 10".
public enum DecimalInput {
    public static func parse(_ raw: String) -> Double? {
        var s = raw.replacingOccurrences(of: "R$", with: "").replacingOccurrences(of: "%", with: "")
            .trimmingCharacters(in: .whitespaces).replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "\u{00A0}", with: "")
        guard !s.isEmpty else { return nil }
        let hasComma = s.contains(","), hasDot = s.contains(".")
        if hasComma && hasDot {
            // o último separador é o decimal
            if s.lastIndex(of: ",")! > s.lastIndex(of: ".")! {
                s = s.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".")
            } else { s = s.replacingOccurrences(of: ",", with: "") }
        } else if hasComma {
            guard s.filter({ $0 == "," }).count == 1 else { return nil }
            s = s.replacingOccurrences(of: ",", with: ".")
        } else if hasDot, s.filter({ $0 == "." }).count > 1 {
            s = s.replacingOccurrences(of: ".", with: "")        // "1.234.567" = milhar
        }
        guard s.allSatisfy({ $0.isNumber || $0 == "." || $0 == "-" }), let v = Double(s), v.isFinite else { return nil }
        return v
    }
    /// Texto para o campo de edição (vírgula decimal).
    public static func format(_ v: Double?, maxDecimals: Int = 8) -> String {
        guard let v else { return "" }
        let f = NumberFormatter(); f.locale = Locale(identifier: "pt_BR"); f.numberStyle = .decimal
        f.usesGroupingSeparator = false; f.maximumFractionDigits = maxDecimals; f.minimumFractionDigits = 0
        return f.string(from: NSNumber(value: v)) ?? String(v)
    }
}

/// Rascunho editável da carteira (tudo texto, como nos campos da tela). `build()` valida e gera o Portfolio.
public struct PortfolioDraft: Sendable, Equatable {
    public struct Dep: Sendable, Equatable, Identifiable { public var id = UUID(); public var date: Date; public var amount: String
        public init(date: Date, amount: String) { self.date = date; self.amount = amount } }
    public struct Fixed: Sendable, Equatable, Identifiable {
        public var id = UUID(); public var name: String; public var kind: FixedIncomeKind; public var cdiPercent: String; public var deposits: [Dep]
        public var indexer: FixedIncomeIndexer = .cdi; public var realRate = ""; public var maturity: Date? = nil
        public init(name: String = "", kind: FixedIncomeKind = .caixinha, cdiPercent: String = "100", deposits: [Dep] = [Dep(date: Date(), amount: "")],
                    indexer: FixedIncomeIndexer = .cdi, realRate: String = "", maturity: Date? = nil) {
            self.name = name; self.kind = kind; self.cdiPercent = cdiPercent; self.deposits = deposits
            self.indexer = indexer; self.realRate = realRate; self.maturity = maturity }
    }
    public struct Stock: Sendable, Equatable, Identifiable {
        public var id = UUID(); public var ticker: String; public var quantity: String; public var averagePrice: String
        public init(ticker: String = "", quantity: String = "", averagePrice: String = "") { self.ticker = ticker; self.quantity = quantity; self.averagePrice = averagePrice }
    }
    public struct Crypto: Sendable, Equatable, Identifiable {
        public var id = UUID(); public var coinId: String; public var symbol: String; public var quantity: String; public var averagePrice: String
        public init(coinId: String = "bitcoin", symbol: String = "BTC", quantity: String = "", averagePrice: String = "") {
            self.coinId = coinId; self.symbol = symbol; self.quantity = quantity; self.averagePrice = averagePrice }
    }
    public struct Dividend: Sendable, Equatable, Identifiable {
        public var id = UUID(); public var ticker: String; public var date: Date; public var amount: String
        public init(ticker: String = "", date: Date = Date(), amount: String = "") { self.ticker = ticker; self.date = date; self.amount = amount }
    }

    public struct Watch: Sendable, Equatable, Identifiable {
        public var id = UUID(); public var ticker: String; public var target: String; public var amount: String
        public init(ticker: String = "", target: String = "", amount: String = "") { self.ticker = ticker; self.target = target; self.amount = amount }
    }
    public var watch: [Watch] = []
    public var fixed: [Fixed] = []
    public var stocks: [Stock] = []
    public var crypto: [Crypto] = []
    public var dividends: [Dividend] = []
    /// Dólar: quantidade em US$ e cotação média (opcional). Vazio = sem dólar.
    public var usdAmount = "", usdAverage = ""
    /// Campos que o cadastro não edita (dono, TradingView) passam intactos.
    public var base: Portfolio

    public init(_ p: Portfolio) {
        base = p
        fixed = p.fixedIncome.map { a in
            Fixed(name: a.name, kind: a.kind, cdiPercent: DecimalInput.format(a.cdiPercent),
                  deposits: a.deposits.map { Dep(date: DateParsing.iso.date(from: $0.date) ?? Date(), amount: DecimalInput.format($0.amount, maxDecimals: 2)) },
                  indexer: a.effectiveIndexer, realRate: DecimalInput.format(a.realRate, maxDecimals: 2),
                  maturity: a.maturity.flatMap { DateParsing.iso.date(from: $0) })
        }
        stocks = p.stocks.map { Stock(ticker: $0.ticker, quantity: DecimalInput.format($0.quantity), averagePrice: DecimalInput.format($0.averagePrice, maxDecimals: 2)) }
        crypto = p.crypto.map { Crypto(coinId: $0.coinId, symbol: $0.symbol, quantity: DecimalInput.format($0.quantity), averagePrice: DecimalInput.format($0.averagePriceBRL, maxDecimals: 2)) }
        usdAmount = DecimalInput.format(p.usd?.amount); usdAverage = DecimalInput.format(p.usd?.averageRateBRL, maxDecimals: 4)
        watch = (p.watchlist ?? []).map { Watch(ticker: $0.ticker, target: DecimalInput.format($0.targetPrice, maxDecimals: 2), amount: DecimalInput.format($0.amount, maxDecimals: 2)) }
        dividends = (p.manualDividends ?? []).map { Dividend(ticker: $0.ticker, date: DateParsing.iso.date(from: $0.date) ?? Date(), amount: DecimalInput.format($0.amount, maxDecimals: 2)) }
    }

    public static func == (a: Self, b: Self) -> Bool { a.fixed == b.fixed && a.stocks == b.stocks && a.crypto == b.crypto && a.dividends == b.dividends && a.watch == b.watch && a.usdAmount == b.usdAmount && a.usdAverage == b.usdAverage }

    static func ticker(_ s: String) -> String { s.uppercased().filter { $0.isLetter || $0.isNumber } }

    /// Valida tudo; devolve a carteira ou a lista de problemas (em português, para mostrar na tela).
    public func build(now: Date = Date()) -> Result<Portfolio, ValidationErrors> {
        var errs: [String] = []
        func num(_ s: String, _ what: String, optional: Bool = false, positive: Bool = true) -> Double? {
            if s.trimmingCharacters(in: .whitespaces).isEmpty { if !optional { errs.append("\(what): preencha o valor") }; return nil }
            guard let v = DecimalInput.parse(s) else { errs.append("\(what): número inválido \"\(s)\" (use 1234,56 ou 1234.56)"); return nil }
            if positive && v <= 0 { errs.append("\(what): precisa ser maior que zero") }
            return v
        }
        var p = base
        var names = Set<String>()
        p.fixedIncome = fixed.enumerated().map { i, f in
            let name = f.name.trimmingCharacters(in: .whitespaces)
            let label = name.isEmpty ? "Renda fixa \(i + 1)" : name
            if name.isEmpty { errs.append("\(label): dê um nome") }
            if !names.insert(name.lowercased()).inserted && !name.isEmpty { errs.append("\(label): nome repetido") }
            var pct = 0.0, real: Double? = nil
            if f.indexer == .cdi {
                pct = num(f.cdiPercent, "\(label) — % do CDI") ?? 100
                if pct > 300 { errs.append("\(label) — % do CDI: \(DecimalInput.format(pct))% parece alto demais") }
            } else {
                real = num(f.realRate, "\(label) — taxa IPCA+", positive: false) ?? 0
                if let r = real, r < 0 || r > 30 { errs.append("\(label) — taxa IPCA+: \(DecimalInput.format(r))% fora do esperado") }
            }
            if f.deposits.isEmpty { errs.append("\(label): adicione pelo menos um aporte") }
            let deps = f.deposits.enumerated().map { j, d -> Deposit in
                if d.date > now { errs.append("\(label) — aporte \(j + 1): data no futuro") }
                return Deposit(date: DateParsing.iso.string(from: d.date), amount: num(d.amount, "\(label) — aporte \(j + 1)") ?? 0)
            }.sorted { $0.date < $1.date }
            return FixedIncomeAsset(name: name, kind: f.kind, cdiPercent: pct, deposits: deps,
                                    taxExempt: f.kind == .lci || f.kind == .lca ? true : nil,
                                    indexer: f.indexer == .ipca ? .ipca : nil, realRate: real,
                                    maturity: f.maturity.map { DateParsing.iso.string(from: $0) })
        }
        var tickers = Set<String>()
        p.stocks = stocks.enumerated().map { i, s in
            let t = Self.ticker(s.ticker)
            let label = t.isEmpty ? "Ação/FII \(i + 1)" : t
            if t.count < 5 || t.count > 7 || !(t.last?.isNumber ?? false) { errs.append("\(label): ticker inválido (ex. PETR4, MXRF11)") }
            if !tickers.insert(t).inserted { errs.append("\(label): ticker repetido") }
            return StockPosition(ticker: t, quantity: num(s.quantity, "\(label) — quantidade") ?? 0,
                                 averagePrice: num(s.averagePrice, "\(label) — preço médio", optional: true))
        }
        p.crypto = crypto.enumerated().map { i, c in
            let id = c.coinId.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "-" }
            let sym = Self.ticker(c.symbol)
            let label = sym.isEmpty ? "Cripto \(i + 1)" : sym
            if id.isEmpty { errs.append("\(label): informe o id do CoinGecko (ex. bitcoin)") }
            return CryptoPosition(coinId: id, symbol: sym.isEmpty ? id.uppercased() : sym,
                                  quantity: num(c.quantity, "\(label) — quantidade") ?? 0,
                                  averagePriceBRL: num(c.averagePrice, "\(label) — preço médio", optional: true))
        }
        let md = dividends.enumerated().map { i, d -> ManualDividend in
            let t = Self.ticker(d.ticker)
            if t.isEmpty { errs.append("Provento \(i + 1): informe o ticker") }
            return ManualDividend(ticker: t, date: DateParsing.iso.string(from: d.date), amount: num(d.amount, "Provento \(t.isEmpty ? String(i + 1) : t)") ?? 0)
        }
        p.manualDividends = md.isEmpty ? nil : md
        var wt = Set<String>()
        let wl = watch.enumerated().map { i, w -> WatchItem in
            let t = Self.ticker(w.ticker), label = t.isEmpty ? "Favorito \(i + 1)" : t
            if t.count < 5 || t.count > 7 || !(t.last?.isNumber ?? false) { errs.append("\(label): ticker inválido (ex. TAEE11)") }
            if !wt.insert(t).inserted { errs.append("\(label): favorito repetido") }
            return WatchItem(ticker: t, targetPrice: num(w.target, "\(label) — preço desejado") ?? 0,
                             amount: num(w.amount, "\(label) — valor a investir", optional: true))
        }
        p.watchlist = wl.isEmpty ? nil : wl
        if usdAmount.trimmingCharacters(in: .whitespaces).isEmpty {
            if !usdAverage.trimmingCharacters(in: .whitespaces).isEmpty { errs.append("Dólar: informe quantos dólares você tem") }
            p.usd = nil
        } else {
            p.usd = USDPosition(amount: num(usdAmount, "Dólar — quantidade em US$") ?? 0,
                                averageRateBRL: num(usdAverage, "Dólar — cotação média", optional: true))
        }
        return errs.isEmpty ? .success(p) : .failure(ValidationErrors(messages: errs))
    }
}

public struct ValidationErrors: Error, Sendable, Equatable { public let messages: [String] }
