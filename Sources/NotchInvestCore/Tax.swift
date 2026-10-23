import Foundation

/// IR regressivo + IOF da renda fixa (regra da Receita para CDB, caixinhas do Nubank e Tesouro Direto).
/// LCI/LCA são isentas. Taxa de custódia da B3 no Tesouro não entra (é pequena e varia).
public enum FixedIncomeTax {
    /// Alíquota de IR (fração) pelo prazo em dias corridos desde a aplicação.
    public static func irRate(days: Int) -> Double {
        switch days {
        case ..<181: return 0.225     // até 180 dias
        case ..<361: return 0.20      // 181 a 360
        case ..<721: return 0.175     // 361 a 720
        default: return 0.15          // acima de 720
        }
    }

    /// Tabela regressiva do IOF (% do rendimento) — dia 1 = 96%, a partir do dia 30 = 0.
    static let iofTable: [Int] = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50,
                                  46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3]
    public static func iofRate(days: Int) -> Double {
        guard days >= 1 else { return 1 }       // resgate no mesmo dia: rendimento é todo IOF (na prática, zero)
        return days < 30 ? Double(iofTable[days - 1]) / 100 : 0
    }

    public struct Breakdown: Sendable, Equatable {
        public let gross: Double, iof: Double, ir: Double
        public var net: Double { gross - iof - ir }
    }

    /// Valor líquido de UMA aplicação, se resgatada em `days` dias.
    public static func breakdown(principal: Double, gross: Double, days: Int, exempt: Bool) -> Breakdown {
        let yield = max(0, gross - principal)
        guard !exempt, yield > 0 else { return .init(gross: gross, iof: 0, ir: 0) }
        let iof = yield * iofRate(days: days)
        let ir = (yield - iof) * irRate(days: days)
        return .init(gross: gross, iof: iof, ir: ir)
    }

    public static func days(from start: Date, to end: Date) -> Int {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = DateParsing.iso.timeZone
        return cal.dateComponents([.day], from: cal.startOfDay(for: start), to: cal.startOfDay(for: end)).day ?? 0
    }
}
