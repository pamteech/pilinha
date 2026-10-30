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

    /// Bruto de um aporte conforme o indexador (CDI ou IPCA+).
    public static func depositGross(_ asset: FixedIncomeAsset, principal: Double, start: Date, rates: [CDIDailyRate],
                                    ipca: [IPCAMonthlyRate], until end: Date) -> Double {
        switch asset.effectiveIndexer {
        case .cdi: return grossValue(principal: principal, start: start, cdiPercent: asset.cdiPercent, rates: rates, until: end)
        case .ipca:
            let du = rates.filter { $0.date >= start && $0.date < end }.count
            return IPCACalculator.grossValue(principal: principal, start: start, realRate: asset.realRate ?? 0,
                                             ipca: ipca, businessDays: du, until: end)
        }
    }

    public static func value(of asset: FixedIncomeAsset, rates: [CDIDailyRate], ipca: [IPCAMonthlyRate] = [],
                             until end: Date = Date()) -> (invested: Double, gross: Double) {
        var inv = 0.0, gross = 0.0
        for d in asset.deposits {
            guard let date = DateParsing.iso.date(from: d.date) else { continue }
            inv += d.amount
            gross += depositGross(asset, principal: d.amount, start: date, rates: rates, ipca: ipca, until: end)
        }
        return (inv, gross)
    }

    /// Valor líquido (sem IR regressivo e IOF) se resgatar tudo em `end`; cada aporte tem seu próprio prazo.
    public static func netValue(of asset: FixedIncomeAsset, rates: [CDIDailyRate], ipca: [IPCAMonthlyRate] = [],
                                until end: Date = Date()) -> Double {
        asset.deposits.reduce(0) { acc, d in
            guard let date = DateParsing.iso.date(from: d.date) else { return acc }
            let g = depositGross(asset, principal: d.amount, start: date, rates: rates, ipca: ipca, until: end)
            return acc + FixedIncomeTax.breakdown(principal: d.amount, gross: g, days: FixedIncomeTax.days(from: date, to: end),
                                                  exempt: asset.isTaxExempt).net
        }
    }

    /// Taxa anualizada equivalente (252 d.u.) a partir da taxa diária.
    public static func annualized(dailyPercent: Double) -> Double {
        (pow(1 + dailyPercent / 100, 252) - 1) * 100
    }
}

/// IPCA mensal (BCB SGS série 433, % no mês). `month` = dia 1 do mês de referência.
public struct IPCAMonthlyRate: Sendable, Equatable {
    public let month: Date
    public let percent: Double
    public init(month: Date, percent: Double) { self.month = month; self.percent = percent }
}

/// Tesouro IPCA+ / renda fixa IPCA + taxa, NA CURVA da taxa contratada (sem marcação a mercado):
/// valor = aplicado × Π(1 + IPCA_m × fração_m) × (1 + taxa)^(dias úteis / 252).
/// - fração_m: parte do mês m dentro de [aplicação, hoje), em dias corridos (pró-rata simples).
/// - Só entram meses com IPCA já divulgado; o mês corrente (ainda sem índice) fica sem inflação até o IBGE publicar.
/// - Dias úteis = dias com taxa CDI publicada (série 12) no período, a mesma base do resto do app.
/// O preço de resgate antecipado no Tesouro Direto (marcação a mercado) pode ser maior ou menor.
public enum IPCACalculator {
    public static func inflationFactor(start: Date, until end: Date, ipca: [IPCAMonthlyRate]) -> Double {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "America/Sao_Paulo")!
        var f = 1.0
        for m in ipca {
            guard let next = cal.date(byAdding: .month, value: 1, to: m.month) else { continue }
            let a = max(start, m.month), b = min(end, next)
            guard b > a else { continue }
            let frac = b.timeIntervalSince(a) / next.timeIntervalSince(m.month)
            f *= 1 + m.percent / 100 * min(1, frac)
        }
        return f
    }

    public static func grossValue(principal: Double, start: Date, realRate: Double, ipca: [IPCAMonthlyRate],
                                  businessDays: Int, until end: Date = Date()) -> Double {
        principal * inflationFactor(start: start, until: end, ipca: ipca) * pow(1 + realRate / 100, Double(businessDays) / 252)
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
