import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

// MARK: - Tesouro marcado a mercado (CSV oficial do Tesouro Transparente)

/// Linha do PrecoTaxaTesouroDireto.csv (só os títulos da carteira).
public struct TreasuryRow: Codable, Sendable, Equatable {
    public var title: String, maturity: String, day: String
    public var buyRate: Double?, sellRate: Double?, puBuy: Double?, puSell: Double?
}

public struct MarketValue: Sendable, Equatable { public let value: Double; public let day: String; public let sellRate: Double?; public let quantity: Double }

public enum Treasury {
    public static let csvURL = URL(string: "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv")!
    public struct Title: Sendable, Equatable, Hashable { public let title: String; public let maturity: String }

    /// Título do CSV para um ativo (só Tesouro com vencimento cadastrado).
    public static func title(for a: FixedIncomeAsset) -> Title? {
        guard a.kind == .tesouro, let m = a.maturity else { return nil }
        let n = a.name.lowercased()
        let t: String
        if a.effectiveIndexer == .ipca {
            t = n.contains("renda") ? "Tesouro Renda+ Aposentadoria Extra" : n.contains("educa") ? "Tesouro Educa+"
              : (n.contains("juros") || n.contains("semestra")) ? "Tesouro IPCA+ com Juros Semestrais" : "Tesouro IPCA+"
        } else { t = "Tesouro Selic" }
        return Title(title: t, maturity: String(m.prefix(10)))
    }
    static func key(_ t: String, _ m: String) -> String { t.trimmingCharacters(in: .whitespaces).lowercased() + "|" + m }
    static func num(_ s: Substring?) -> Double? {
        guard let s else { return nil }
        let v = Double(s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: "."))
        return v.flatMap { $0.isFinite && $0 > 0 ? $0 : nil }
    }
    static func isoFromBR(_ s: Substring) -> String? {
        let p = s.trimmingCharacters(in: .whitespaces).split(separator: "/")
        guard p.count == 3, p[0].count == 2, p[1].count == 2, p[2].count == 4 else { return nil }
        return "\(p[2])-\(p[1])-\(p[0])"
    }

    /// Lê o CSV (;) guardando só os títulos pedidos e datas a partir de `since` (yyyy-MM-dd).
    public static func parseCSV(_ text: String, wanted: [Title], since: String = "0000-00-00") -> [TreasuryRow] {
        let want = Set(wanted.map { key($0.title, $0.maturity) })
        var out: [TreasuryRow] = []
        text.enumerateLines { line, _ in
            let c = line.split(separator: ";", omittingEmptySubsequences: false)
            guard c.count >= 7, let m = isoFromBR(c[1]), let d = isoFromBR(c[2]), d >= since,
                  want.contains(key(String(c[0]), m)) else { return }
            out.append(TreasuryRow(title: c[0].trimmingCharacters(in: .whitespaces), maturity: m, day: d,
                                   buyRate: num(c[3]), sellRate: num(c[4]), puBuy: num(c[5]), puSell: num(c[6])))
        }
        return out.sorted { $0.day < $1.day }
    }

    /// Quantidade estimada = aplicado / PU de compra no dia do aporte (ou último dia útil antes);
    /// valor de venda hoje = quantidade × PU de venda mais recente. Nil se faltar dado.
    public static func markToMarket(_ a: FixedIncomeAsset, rows: [TreasuryRow]) -> MarketValue? {
        guard let t = title(for: a), !a.deposits.isEmpty else { return nil }
        let k = key(t.title, t.maturity)
        let rs = rows.filter { key($0.title, $0.maturity) == k }
        guard let last = rs.last(where: { $0.puSell != nil }), let sell = last.puSell else { return nil }
        var q = 0.0
        for d in a.deposits {
            guard let ref = rs.last(where: { $0.day <= d.date && $0.puBuy != nil }) ?? rs.first(where: { $0.puBuy != nil }),
                  let pu = ref.puBuy else { return nil }
            q += d.amount / pu
        }
        return MarketValue(value: q * sell, day: last.day, sellRate: last.sellRate, quantity: q)
    }
}

/// Baixa o CSV (~15 MB) no máximo a cada 12 h; guarda só as linhas da carteira em ~/.notchinvest/tesouro-cache.json.
public struct TreasuryService: Sendable {
    struct Cache: Codable { var at: Date; var keys: String; var rows: [TreasuryRow] }
    public let cacheURL: URL
    public init(cacheURL: URL = LocalData.folder.appendingPathComponent("tesouro-cache.json")) { self.cacheURL = cacheURL }

    public func rows(for p: Portfolio, now: Date = Date()) async -> [TreasuryRow]? {
        let wanted = p.fixedIncome.compactMap(Treasury.title(for:))
        guard !wanted.isEmpty else { return nil }
        let keys = wanted.map { "\($0.title)|\($0.maturity)" }.sorted().joined(separator: ",")
        let cache = (try? Data(contentsOf: cacheURL)).flatMap { try? JSONDecoder().decode(Cache.self, from: $0) }
        if let c = cache, c.keys == keys, now.timeIntervalSince(c.at) < 12 * 3600 { return c.rows }
        do {
            var req = URLRequest(url: Treasury.csvURL); req.timeoutInterval = 60
            req.setValue("Pilinha/0.2", forHTTPHeaderField: "User-Agent")
            let data = try await URLSession.shared.data(for: req).0
            let text = String(decoding: data, as: UTF8.self)
            let earliest = p.fixedIncome.flatMap(\.deposits).map(\.date).min() ?? DateParsing.iso.string(from: now)
            let since = DateParsing.iso.date(from: earliest).map { DateParsing.iso.string(from: $0.addingTimeInterval(-15 * 86_400)) } ?? earliest
            let rows = Treasury.parseCSV(text, wanted: wanted, since: since)
            if !rows.isEmpty {
                if let d = try? JSONEncoder().encode(Cache(at: now, keys: keys, rows: rows)) {
                    try? d.write(to: cacheURL, options: .atomic); try? LocalData.restrict(cacheURL)
                }
                return rows
            }
        } catch {}
        return cache?.rows   // falha silenciosa: segue só com a curva
    }
}

// MARK: - Favoritos (quero comprar)

public struct WatchItem: Codable, Sendable, Equatable, Identifiable {
    public var id: String { ticker }
    public var ticker: String
    public var targetPrice: Double
    public var amount: Double?
    public init(ticker: String, targetPrice: Double, amount: Double? = nil) { self.ticker = ticker; self.targetPrice = targetPrice; self.amount = amount }
}

public struct WatchRow: Sendable, Equatable, Identifiable {
    public var id: String { ticker }
    public let ticker: String, targetPrice: Double, amount: Double?, price: Double?, dayPct: Double?
    /// > 0 = quanto ainda precisa cair até o alvo.
    public var distancePct: Double? { price.flatMap { targetPrice > 0 ? ($0 / targetPrice - 1) * 100 : nil } }
    public var reached: Bool { price.map { $0 <= targetPrice } ?? false }
    public var shares: Int? {
        guard let a = amount, a > 0 else { return nil }
        let ref = min(price ?? targetPrice, targetPrice); return ref > 0 ? Int((a / ref).rounded(.down)) : nil
    }
    public init(_ w: WatchItem, price: Double?, dayPct: Double?) {
        ticker = w.ticker.uppercased(); targetPrice = w.targetPrice; amount = w.amount; self.price = price; self.dayPct = dayPct
    }
}

// MARK: - Alertas (notificação local)

public enum AlertKind: String, Codable, Sendable, CaseIterable {
    case above, below, dropPct, risePct
    public var label: String { switch self { case .above: return "Acima de R$"; case .below: return "Abaixo de R$"; case .dropPct: return "Cair % no dia"; case .risePct: return "Subir % no dia" } }
}
public struct PriceAlert: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var ticker: String
    public var kind: AlertKind
    public var value: Double
    public var enabled: Bool
    public init(id: String = UUID().uuidString, ticker: String, kind: AlertKind, value: Double, enabled: Bool = true) {
        self.id = id; self.ticker = ticker; self.kind = kind; self.value = value; self.enabled = enabled
    }
    public var label: String {
        let v = DecimalInput.format(value, maxDecimals: 2)
        switch kind {
        case .above: return "\(ticker) acima de \(BRL.format(value))"
        case .below: return "\(ticker) abaixo de \(BRL.format(value))"
        case .dropPct: return "\(ticker) caindo \(v)% no dia"
        case .risePct: return "\(ticker) subindo \(v)% no dia"
        }
    }
}
public struct QuoteLite: Sendable, Equatable { public let price: Double?; public let dayPct: Double?
    public init(price: Double?, dayPct: Double?) { self.price = price; self.dayPct = dayPct } }

/// Alertas em ~/.notchinvest/alerts.json (fora da carteira) e registro de disparos do dia.
public struct AlertStore: Codable, Sendable, Equatable {
    public var alerts: [PriceAlert] = []
    /// id → dia (yyyy-MM-dd) em que já avisou. Um aviso por alerta por dia.
    public var fired: [String: String] = [:]
    public init(alerts: [PriceAlert] = [], fired: [String: String] = [:]) { self.alerts = alerts; self.fired = fired }
    public static var defaultURL: URL { LocalData.folder.appendingPathComponent("alerts.json") }
    public static func load(from url: URL = defaultURL) -> AlertStore {
        (try? Data(contentsOf: url)).flatMap { try? JSONDecoder().decode(AlertStore.self, from: $0) } ?? AlertStore()
    }
    public func save(to url: URL = AlertStore.defaultURL) throws {
        let enc = JSONEncoder(); enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        try enc.encode(self).write(to: url, options: .atomic); try LocalData.restrict(url)
    }
}

public enum Alerts {
    public static func triggered(_ a: PriceAlert, _ q: QuoteLite?) -> Bool {
        guard a.enabled, let q, a.value > 0 else { return false }
        switch a.kind {
        case .above: return q.price.map { $0 >= a.value } ?? false
        case .below: return q.price.map { $0 <= a.value } ?? false
        case .dropPct: return q.dayPct.map { $0 <= -a.value } ?? false
        case .risePct: return q.dayPct.map { $0 >= a.value } ?? false
        }
    }
    /// Favoritos viram alertas "abaixo de" (id estável por ticker+alvo).
    public static func fromWatchlist(_ w: [WatchItem]?) -> [PriceAlert] {
        (w ?? []).map { PriceAlert(id: "w:\($0.ticker.uppercased()):\($0.targetPrice)", ticker: $0.ticker.uppercased(), kind: .below, value: $0.targetPrice) }
    }
    public struct Fire: Sendable, Equatable { public let id: String; public let title: String; public let body: String }
    public static func evaluate(_ alerts: [PriceAlert], quotes: [String: QuoteLite], fired: [String: String], now: Date = Date()) -> (toFire: [Fire], fired: [String: String]) {
        let day = DateParsing.iso.string(from: now)
        var next: [String: String] = [:], out: [Fire] = []
        for a in alerts {
            if let f = fired[a.id] { next[a.id] = f }
            let q = quotes[a.ticker.uppercased()]
            guard fired[a.id] != day, triggered(a, q), let q else { continue }
            next[a.id] = day
            let px = q.price.map(BRL.format) ?? "–"
            let watch = a.id.hasPrefix("w:")
            let body = a.kind == .dropPct || a.kind == .risePct ? "Hoje \(q.dayPct.map(pctBR) ?? "–") · cotação \(px)" : "Cotação agora: \(px)"
            out.append(Fire(id: a.id, title: watch ? "\(a.ticker) chegou no seu preço" : a.label,
                            body: watch ? "Favorito: alvo \(BRL.format(a.value)) · \(body)" : body))
        }
        return (out, next)
    }
}

// MARK: - Comparação com o CDI

public struct BenchPoint: Sendable, Equatable, Identifiable {
    public var id: String { day }
    public let day: String, carteira: Double, cdi: Double
    public var date: Date { DateParsing.iso.date(from: day) ?? .distantPast }
}
public enum Benchmark {
    /// Rentabilidade acumulada (%) desde o primeiro ponto: carteira pelo índice total/investido (neutraliza aportes),
    /// CDI pelo produto das taxas diárias do BCB no período.
    public static func series(_ points: [HistoryPoint], rates: [CDIDailyRate]) -> [BenchPoint] {
        let pts = points.filter { $0.invested > 0 && $0.total > 0 }
        guard let first = pts.first else { return [] }
        let t0 = first.date, idx0 = first.total / first.invested
        let sorted = rates.sorted { $0.date < $1.date }
        return pts.map { p in
            let f = sorted.filter { $0.date >= t0 && $0.date < p.date }.reduce(1.0) { $0 * (1 + $1.percent / 100) }
            return BenchPoint(day: p.day, carteira: ((p.total / p.invested) / idx0 - 1) * 100, cdi: (f - 1) * 100)
        }
    }
}

// MARK: - Aviso de dados atrasados

public struct StaleInfo: Sendable, Equatable {
    public let stale: Bool, title: String, detail: String
    public init(errors: [String]) {
        stale = !errors.isEmpty; title = "Dados atrasados"
        detail = errors.isEmpty ? "" : "Algumas cotações não chegaram agora (\(errors.count)). O Pilinvest mostra o último valor conhecido e tenta de novo sozinho.\n\n" + errors.joined(separator: "\n")
    }
}
