import Foundation
import Testing
@testable import NotchInvestCore

// Tesouro Selic/Prefixado gravados pelo iPhone (valores fictícios).
@Suite struct TesouroTiposTests {
    let json = #"""
    {"fixedIncome":[
      {"name":"Tesouro Prefixado 2031","kind":"tesouro","cdiPercent":100,"treasuryType":"prefixado","fixedRate":12,"maturity":"2031-01-01","deposits":[{"date":"2026-01-01","amount":1000}]},
      {"name":"Tesouro Selic 2029","kind":"tesouro","cdiPercent":100,"treasuryType":"selic","deposits":[{"date":"2026-01-01","amount":1000}]},
      {"name":"Velho","kind":"tesouro","cdiPercent":100,"treasuryType":"futuro","deposits":[{"date":"2026-01-01","amount":1}]}
    ],"stocks":[],"crypto":[]}
    """#
    func d(_ s: String) -> Date { DateParsing.iso.date(from: s)! }

    @Test func lerTiposNovosSemQuebrar() throws {
        let p = try JSONDecoder().decode(Portfolio.self, from: Data(json.utf8))
        #expect(p.fixedIncome.count == 3)
        #expect(p.fixedIncome[0].isPrefixed); #expect(!p.fixedIncome[1].isPrefixed); #expect(!p.fixedIncome[2].isPrefixed)
        #expect(Treasury.title(for: p.fixedIncome[0])?.title == "Tesouro Prefixado")
    }
    @Test func prefixadoRendePelaTaxa() throws {
        let p = try JSONDecoder().decode(Portfolio.self, from: Data(json.utf8))
        let rates = (0..<252).map { CDIDailyRate(date: d("2026-01-01").addingTimeInterval(Double($0) * 86_400), percent: 0.05) }
        let v = CDICalculator.value(of: p.fixedIncome[0], rates: rates, until: d("2027-01-01"))
        #expect(abs(v.gross - 1120) < 0.5)
        let s = CDICalculator.value(of: p.fixedIncome[1], rates: rates, until: d("2027-01-01"))
        #expect(abs(s.gross - 1000 * pow(1.0005, 252)) < 0.001)
    }
    @Test func editorDoMacPreservaCampos() throws {
        let p = try JSONDecoder().decode(Portfolio.self, from: Data(json.utf8))
        let out = try PortfolioDraft(p).build(now: d("2026-11-01")).get()
        #expect(out.fixedIncome[0].treasuryType == "prefixado"); #expect(out.fixedIncome[0].fixedRate == 12)
        #expect(out.fixedIncome[1].treasuryType == "selic")
    }
}
