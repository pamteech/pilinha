import Foundation

public struct LineItem: Sendable, Identifiable {
    public var id: String { name }
    public let name: String
    public let category: String
    public let invested: Double?
    public let current: Double
    /// Variação do dia em R$ (nil se a fonte não informa).
    public var dayChange: Double? = nil
    /// Renda fixa: valor se resgatar hoje, já sem IR/IOF. Demais: nil (= igual ao bruto).
    public var net: Double? = nil
    /// Ações/FIIs/cripto: cotação do momento (R$ por unidade).
    public var unitPrice: Double? = nil
    /// Ações/FIIs/cripto: preço médio pago por unidade, se cadastrado.
    public var averagePrice: Double? = nil
    /// Dólar: quantidade em US$.
    public var quantity: Double? = nil
    /// Tesouro: valor de venda hoje (CSV oficial), data do preço e taxa de venda.
    public var marketValue: Double? = nil
    public var marketDay: String? = nil
    public var marketRate: Double? = nil
    /// Variação do dia em % (a partir de dayChange).
    public var dayPct: Double? { dayChange.flatMap { let prev = current - $0; return prev > 0 ? $0 / prev * 100 : nil } }
    public var netOrCurrent: Double { net ?? current }
    public var gain: Double? { invested.map { current - $0 } }
    /// Resultado em R$ (atual − investido).
    public var gainPct: Double? { invested.flatMap { $0 > 0 ? (current / $0 - 1) * 100 : nil } }
}

public struct Snapshot: Sendable {
    public let items: [LineItem]
    public let cdiAnnual: Double?
    public let updatedAt: Date
    public let errors: [String]
    public var dividends = Dividends.Summary()
    /// Cotação do dólar (R$ por US$) e variação do dia em %, para mostrar no painel.
    public var usdBRL: Double? = nil
    public var usdChangePct: Double? = nil
    /// Favoritos com cotação (fora do total).
    public var watch: [WatchRow] = []
    /// Próximo provento anunciado (brapi), se houver.
    public var nextDividend: CashDividend? = nil
    public var stale: StaleInfo { StaleInfo(errors: errors) }
    public var totalNet: Double { items.reduce(0) { $0 + $1.netOrCurrent } }
    public var totalTaxes: Double { total - totalNet }
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
    let bcb = BCBService(), stocks: StockQuoteProvider, gecko = CoinGeckoService(), fx = USDQuoteService()
    /// Token da brapi vem do Keychain (app) ou da variável BRAPI_TOKEN (CLI).
    public init(brapiToken: String? = ProcessInfo.processInfo.environment["BRAPI_TOKEN"]) { stocks = StockQuoteProvider(brapiToken: brapiToken) }

    public func snapshot(_ p: Portfolio, now: Date = Date(), treasury: [TreasuryRow]? = nil) async -> Snapshot {
        var items: [LineItem] = [], errors: [String] = []
        var cdiAnnual: Double?

        let earliest = p.fixedIncome.flatMap(\.deposits).compactMap { DateParsing.iso.date(from: $0.date) }.min()
        if let earliest {
            do {
                // Falha de rede no BCB não pode esconder o título: sem taxas, vale o aplicado (rendimento 0).
                var rates: [CDIDailyRate] = []
                do { rates = try await bcb.cdiRates(from: min(earliest, now), to: now) } catch { errors.append("CDI indisponível agora; renda fixa mostrada pelo valor aplicado") }
                cdiAnnual = rates.last.map { CDICalculator.annualized(dailyPercent: $0.percent) }
                var ipca: [IPCAMonthlyRate] = []
                if p.fixedIncome.contains(where: { $0.effectiveIndexer == .ipca }) {
                    ipca = (try? await bcb.ipcaMonthly(from: min(earliest, now), to: now)) ?? []
                }
                for a in p.fixedIncome {
                    let v = CDICalculator.value(of: a, rates: rates, ipca: ipca, until: now)
                    let net = CDICalculator.netValue(of: a, rates: rates, ipca: ipca, until: now)
                    // rendimento do último dia útil: CDI → taxa do dia × %CDI; IPCA+ → só a parcela da taxa real
                    let lastPct = a.effectiveIndexer == .ipca
                        ? pow(1 + (a.realRate ?? 0) / 100, 1.0 / 252) - 1
                        : (rates.last?.percent ?? 0) / 100 * a.cdiPercent / 100
                    var li = LineItem(name: a.name, category: a.kind.rawValue, invested: v.invested, current: v.gross,
                                      dayChange: v.gross - v.gross / (1 + lastPct), net: net)
                    if let t = treasury, let m = Treasury.markToMarket(a, rows: t) { li.marketValue = m.value; li.marketDay = m.day; li.marketRate = m.sellRate }
                    items.append(li)
                }
            }
        }
        var cash: [CashDividend] = []
        for s in p.stocks {
            do {
                let q = try await stocks.quote(s.ticker)
                cash += q.dividends
                items.append(LineItem(name: s.ticker, category: s.ticker.hasSuffix("11") ? "fii" : "acao",
                                      invested: s.averagePrice.map { $0 * s.quantity }, current: q.price * s.quantity,
                                      dayChange: q.changePct.map { let v = q.price * s.quantity; return v - v / (1 + $0 / 100) },
                                      unitPrice: q.price, averagePrice: s.averagePrice))
            } catch { errors.append("\(error)") }
        }
        if !p.crypto.isEmpty {
            do {
                let prices = try await gecko.pricesBRL(p.crypto.map(\.coinId))
                for c in p.crypto {
                    guard let px = prices[c.coinId]?.price else { errors.append("\(c.symbol): sem preço"); continue }
                    items.append(LineItem(name: c.symbol, category: "cripto",
                                          invested: c.averagePriceBRL.map { $0 * c.quantity }, current: px * c.quantity,
                                          dayChange: prices[c.coinId]?.change24h.map { let v = px * c.quantity; return v - v / (1 + $0 / 100) },
                                          unitPrice: px, averagePrice: c.averagePriceBRL))
                }
            } catch { errors.append("cripto: \(error)") }
        }
        var fxq: USDQuote?
        do { fxq = try await fx.quote(now: now) } catch { if p.usd != nil { errors.append("dólar: \(error)") } }
        if let u = p.usd, u.amount > 0, let q = fxq {
            items.append(Self.usdItem(u, q))
        }
        var snap = Snapshot(items: items, cdiAnnual: cdiAnnual, updatedAt: now, errors: errors)
        snap.usdBRL = fxq?.bid; snap.usdChangePct = fxq?.changePct
        if let wl = p.watchlist, !wl.isEmpty {
            var have: [String: QuoteLite] = [:]
            for i in items where i.unitPrice != nil { have[i.name.uppercased()] = QuoteLite(price: i.unitPrice, dayPct: i.dayPct) }
            for w in wl {
                let t = w.ticker.uppercased()
                if let q = have[t] { snap.watch.append(WatchRow(w, price: q.price, dayPct: q.dayPct)); continue }
                let q = try? await stocks.quote(t)     // favorito sem cotação não vira erro da carteira
                snap.watch.append(WatchRow(w, price: q?.price, dayPct: q?.changePct))
            }
        }
        let held = Set(p.stocks.map { $0.ticker.uppercased() })
        snap.nextDividend = cash.filter { $0.paymentDate >= now && held.contains($0.ticker) }.min { $0.paymentDate < $1.paymentDate }
        snap.dividends = Dividends.summary(stocks: p.stocks, brapi: cash, manual: p.manualDividends ?? [], now: now)
        return snap
    }
}

extension PortfolioEngine {
    public static let usdItemName = "Dólar"
    public static func usdItem(_ u: USDPosition, _ q: USDQuote) -> LineItem {
        let v = q.bid * u.amount
        return LineItem(name: usdItemName, category: "dolar", invested: u.averageRateBRL.map { $0 * u.amount }, current: v,
                        dayChange: q.changePct.map { v - v / (1 + $0 / 100) }, unitPrice: q.bid, averagePrice: u.averageRateBRL, quantity: u.amount)
    }
}

/// Grupos do painel: renda fixa, ações e FIIs, cripto e dólar (cada um separado; vazios somem).
public struct ItemGroup: Sendable, Identifiable {
    public let key: String, title: String, items: [LineItem]
    public var id: String { key }
    public var total: Double { items.reduce(0) { $0 + $1.current } }
    /// Variação do dia do grupo em % (soma das variações em R$ / valor de ontem). Nil se nenhum item informa.
    public var dayPct: Double? {
        let ch = items.compactMap(\.dayChange); guard !ch.isEmpty else { return nil }
        let d = ch.reduce(0, +), prev = items.filter { $0.dayChange != nil }.reduce(0) { $0 + $1.current } - d
        return prev > 0 ? d / prev * 100 : nil
    }
}
/// "+1,23%" no formato brasileiro.
public func pctBR(_ v: Double) -> String { String(format: "%+.2f%%", v).replacingOccurrences(of: ".", with: ",") }
public enum PortfolioGroups {
    public static func key(_ category: String) -> String {
        switch category { case "acao", "fii": return "acoes"; case "cripto": return "cripto"; case "dolar": return "dolar"; default: return "renda" }
    }
    static let titles = ["renda": "Renda fixa", "acoes": "Ações e FIIs", "cripto": "Cripto", "dolar": "Dólar"]
    public static func group(_ items: [LineItem]) -> [ItemGroup] {
        ["renda", "acoes", "cripto", "dolar"].compactMap { k in
            let it = items.filter { key($0.category) == k }
            return it.isEmpty ? nil : ItemGroup(key: k, title: titles[k]!, items: it)
        }
    }
}

public enum BRL {
    public static func format(_ v: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency; f.locale = Locale(identifier: "pt_BR"); f.currencySymbol = "R$"
        return f.string(from: NSNumber(value: v)) ?? String(format: "R$ %.2f", v)
    }
}
