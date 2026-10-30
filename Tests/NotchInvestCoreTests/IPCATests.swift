import Testing
import Foundation
@testable import NotchInvestCore

/// Dados fictícios.
@Suite struct IPCATests {
    let d = { (s: String) in DateParsing.iso.date(from: s)! }

    @Test func OldJSONDefaultsToCDI() throws {
        let json = #"{"name":"Caixinha","kind":"caixinha","cdiPercent":100,"deposits":[{"date":"2026-01-02","amount":1000}]}"#
        let a = try JSONDecoder().decode(FixedIncomeAsset.self, from: Data(json.utf8))
        #expect(a.effectiveIndexer == .cdi); #expect(a.realRate == nil); #expect(a.maturity == nil)
    }

    @Test func IPCAJSONRoundTrip() throws {
        let a = FixedIncomeAsset(name: "Teste IPCA", kind: .tesouro, cdiPercent: 0, deposits: [Deposit(date: "2026-01-02", amount: 100)],
                                 indexer: .ipca, realRate: 6.5, maturity: "2030-08-15")
        let b = try JSONDecoder().decode(FixedIncomeAsset.self, from: JSONEncoder().encode(a))
        #expect(b.effectiveIndexer == .ipca); #expect(b.realRate == 6.5); #expect(b.maturity == "2030-08-15")
    }

    @Test func InflationProRata() {
        // aplicação no meio de jan (30 dias de 31), fev inteiro, mar sem índice ainda
        let ipca = [IPCAMonthlyRate(month: d("2026-01-01"), percent: 0.31), IPCAMonthlyRate(month: d("2026-02-01"), percent: 0.5)]
        let f = IPCACalculator.inflationFactor(start: d("2026-01-02"), until: d("2026-03-10"), ipca: ipca)
        #expect(abs((f) - ((1 + 0.0031 * 30.0 / 31.0) * 1.005)) < 1e-9)
    }

    @Test func GrossValueOnCurve() {
        let ipca = [IPCAMonthlyRate(month: d("2026-01-01"), percent: 1.0)]
        let g = IPCACalculator.grossValue(principal: 1000, start: d("2026-01-01"), realRate: 6, ipca: ipca, businessDays: 252, until: d("2026-02-01"))
        #expect(abs((g) - (1000 * 1.01 * 1.06)) < 1e-6)
    }

    @Test func ValueUsesBusinessDaysFromCDISeries() {
        let a = FixedIncomeAsset(name: "X", kind: .tesouro, cdiPercent: 0, deposits: [Deposit(date: "2026-01-05", amount: 100)], indexer: .ipca, realRate: 10)
        let rates = (5...9).map { CDIDailyRate(date: d(String(format: "2026-01-%02d", $0)), percent: 0.05) }
        let v = CDICalculator.value(of: a, rates: rates, ipca: [], until: d("2026-01-10"))
        #expect(abs((v.gross) - (100 * pow(1.10, 5.0 / 252))) < 1e-9)
        #expect(CDICalculator.netValue(of: a, rates: rates, ipca: [], until: d("2026-01-10")) < v.gross)
    }

    @Test func DraftIPCA() throws {
        var dr = PortfolioDraft(Portfolio())
        dr.fixed = [.init(name: "Tesouro Teste", kind: .tesouro, cdiPercent: "", deposits: [.init(date: d("2026-01-05"), amount: "100")],
                          indexer: .ipca, realRate: "7,25", maturity: d("2032-08-15"))]
        let p = try dr.build(now: d("2026-02-01")).get()
        #expect(p.fixedIncome[0].indexer == .ipca); #expect(p.fixedIncome[0].realRate == 7.25)
        #expect(p.fixedIncome[0].maturity == "2032-08-15")
        #expect(PortfolioDraft(p).fixed[0].realRate == "7,25")
    }
}
