import Foundation

public struct LineItem: Sendable, Identifiable {
    public var id: String { name }
    public let name: String
    public let category: String
    public let invested: Double?
    public let current: Double
    /// Variação do dia em R$ (nil se a fonte não informa).
    public var dayChange: Double? = nil
    public var gain: Double? { invested.map { current - $0 } }
    public var gainPct: Double? { invested.flatMap { $0 > 0 ? (current / $0 - 1) * 100 : nil } }
}

public struct Snapshot: Sendable {
    public let items: [LineItem]
    public let cdiAnnual: Double?
    public let updatedAt: Date
    public let errors: [String]
    public var total: Double { items.reduce(0) { $0 + $1.current } }
    public var totalInvested: Double { items.reduce(0) { $0 + ($1.invested ?? $1.current) } }
    /// Ganho total em % (para o modo "só porcentagens").
    public var totalGainPct: Double { totalInvested > 0 ? (total / totalInvested - 1) * 100 : 0 }
    /// Variação % da carteira no dia (soma das variações / valor de ontem).
    public var dayChangePct: Double? {
        let ch = items.compactMap(\.dayChange)
        guard !ch.isEmpty else { return nil }
        let d = ch.reduce(0, +), prev = total - d
        return prev > 0 ? d / prev * 100 : nil
    }
}

public struct PortfolioEngine: Sendable {
    let bcb = BCBService(), brapi = BrapiService(), gecko = CoinGeckoService()
    public init() {}

    public func snapshot(_ p: Portfolio, now: Date = Date()) async -> Snapshot {
        var items: [LineItem] = [], errors: [String] = []
        var cdiAnnual: Double?

        let earliest = p.fixedIncome.flatMap(\.deposits).compactMap { DateParsing.iso.date(from: $0.date) }.min()
        if let earliest {
            do {
                let rates = try await bcb.cdiRates(from: earliest, to: now)
                cdiAnnual = rates.last.map { CDICalculator.annualized(dailyPercent: $0.percent) }
                for a in p.fixedIncome {
                    let v = CDICalculator.value(of: a, rates: rates, until: now)
                    // rendimento do último dia útil: taxa do dia × %CDI sobre o valor anterior
                    let lastPct = (rates.last?.percent ?? 0) / 100 * a.cdiPercent / 100
                    items.append(LineItem(name: a.name, category: a.kind.rawValue, invested: v.invested, current: v.gross,
                                          dayChange: v.gross - v.gross / (1 + lastPct)))
                }
            } catch { errors.append("CDI: \(error)") }
        }
        for s in p.stocks {
            do {
                let q = try await brapi.quote(s.ticker)
                items.append(LineItem(name: s.ticker, category: s.ticker.hasSuffix("11") ? "fii" : "acao",
                                      invested: s.averagePrice.map { $0 * s.quantity }, current: q.price * s.quantity,
                                      dayChange: q.changePct.map { let v = q.price * s.quantity; return v - v / (1 + $0 / 100) }))
            } catch { errors.append("\(s.ticker): \(error)") }
        }
        if !p.crypto.isEmpty {
            do {
                let prices = try await gecko.pricesBRL(p.crypto.map(\.coinId))
                for c in p.crypto {
                    guard let px = prices[c.coinId]?.price else { errors.append("\(c.symbol): sem preço"); continue }
                    items.append(LineItem(name: c.symbol, category: "cripto",
                                          invested: c.averagePriceBRL.map { $0 * c.quantity }, current: px * c.quantity,
                                          dayChange: prices[c.coinId]?.change24h.map { let v = px * c.quantity; return v - v / (1 + $0 / 100) }))
                }
            } catch { errors.append("cripto: \(error)") }
        }
        return Snapshot(items: items, cdiAnnual: cdiAnnual, updatedAt: now, errors: errors)
    }
}

public enum BRL {
    public static func format(_ v: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency; f.locale = Locale(identifier: "pt_BR"); f.currencySymbol = "R$"
        return f.string(from: NSNumber(value: v)) ?? String(format: "R$ %.2f", v)
    }
}
