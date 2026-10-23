import Foundation

/// Provento por cota informado pela brapi (`?dividends=true` → dividendsData.cashDividends).
public struct CashDividend: Sendable, Equatable {
    public let ticker: String
    public let paymentDate: Date
    public let ratePerShare: Double
    public let label: String
}

public enum Dividends {
    struct Resp: Decodable {
        struct R: Decodable { let symbol: String; let dividendsData: D? }
        struct D: Decodable { let cashDividends: [C]? }
        struct C: Decodable { let paymentDate: String?; let rate: Double?; let label: String? }
        let results: [R]
    }

    /// Lê a resposta da brapi; aceita "2026-10-15T00:00:00.000Z" ou "2026-10-15".
    public static func parseBrapi(_ data: Data) throws -> [CashDividend] {
        let r = try JSONDecoder().decode(Resp.self, from: data)
        return r.results.flatMap { res in
            (res.dividendsData?.cashDividends ?? []).compactMap { c in
                guard let s = c.paymentDate, let rate = c.rate, let d = DateParsing.iso.date(from: String(s.prefix(10))) else { return nil }
                return CashDividend(ticker: res.symbol.uppercased(), paymentDate: d, ratePerShare: rate, label: c.label ?? "")
            }
        }
    }

    public struct Summary: Sendable, Equatable {
        public var last12m: Double = 0
        public var byTicker: [String: Double] = [:]
        public var source: [String: String] = [:]     // ticker → "brapi" | "manual"
    }

    /// Soma dos últimos 12 meses. Estimativa com a quantidade ATUAL (a brapi não sabe quando ela comprou).
    /// Se houver lançamento manual para o ticker, o manual vence (é o que caiu na conta de verdade).
    public static func summary(stocks: [StockPosition], brapi: [CashDividend], manual: [ManualDividend],
                               now: Date = Date()) -> Summary {
        let start = now.addingTimeInterval(-365 * 86_400)
        var s = Summary()
        let manualTickers = Set(manual.map { $0.ticker.uppercased() })
        for m in manual {
            guard let d = DateParsing.iso.date(from: m.date), d >= start, d <= now else { continue }
            let t = m.ticker.uppercased()
            s.byTicker[t, default: 0] += m.amount; s.source[t] = "manual"
        }
        for st in stocks {
            let t = st.ticker.uppercased()
            guard !manualTickers.contains(t) else { continue }
            let v = brapi.filter { $0.ticker == t && $0.paymentDate >= start && $0.paymentDate <= now }
                .reduce(0) { $0 + $1.ratePerShare * st.quantity }
            if v > 0 { s.byTicker[t, default: 0] += v; s.source[t] = "brapi" }
        }
        s.last12m = s.byTicker.values.reduce(0, +)
        return s
    }
}
