import Foundation

/// Taxa diária do CDI (série SGS 12, em % ao dia).
public struct CDIDailyRate: Sendable, Equatable {
    public let date: Date
    public let percent: Double   // ex. 0.050788 (% a.d.)
    public init(date: Date, percent: Double) { self.date = date; self.percent = percent }
}

public enum CDICalculator {
    /// Valor bruto: para cada dia útil d com data >= aplicação, multiplica
    /// (1 + taxa_d * pctCDI). Convenção de mercado: o rendimento começa no dia
    /// útil da aplicação e a taxa do próprio dia de hoje ainda não é conhecida.
    public static func grossValue(principal: Double, start: Date, cdiPercent: Double,
                                  rates: [CDIDailyRate], until end: Date = Date()) -> Double {
        var factor = 1.0
        let pct = cdiPercent / 100
        for r in rates where r.date >= start && r.date < end {
            factor *= 1 + (r.percent / 100) * pct
        }
        return principal * factor
    }

    public static func value(of asset: FixedIncomeAsset, rates: [CDIDailyRate],
                             until end: Date = Date()) -> (invested: Double, gross: Double) {
        var inv = 0.0, gross = 0.0
        for d in asset.deposits {
            guard let date = DateParsing.iso.date(from: d.date) else { continue }
            inv += d.amount
            gross += grossValue(principal: d.amount, start: date, cdiPercent: asset.cdiPercent,
                                rates: rates, until: end)
        }
        return (inv, gross)
    }

    /// Taxa anualizada equivalente (252 d.u.) a partir da taxa diária.
    public static func annualized(dailyPercent: Double) -> Double {
        (pow(1 + dailyPercent / 100, 252) - 1) * 100
    }
}

public enum DateParsing {
    public static let iso: DateFormatter = make("yyyy-MM-dd")
    public static let br: DateFormatter = make("dd/MM/yyyy")
    static func make(_ f: String) -> DateFormatter {
        let d = DateFormatter()
        d.locale = Locale(identifier: "en_US_POSIX")
        d.timeZone = TimeZone(identifier: "America/Sao_Paulo")
        d.dateFormat = f
        return d
    }
}
