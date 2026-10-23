import Testing
import Foundation
@testable import NotchInvestCore

@Suite struct TaxTests {
    func d(_ s: String) -> Date { DateParsing.iso.date(from: s)! }

    @Test(arguments: [(1, 0.225), (180, 0.225), (181, 0.20), (360, 0.20), (361, 0.175), (720, 0.175), (721, 0.15), (2000, 0.15)])
    func irTable(days: Int, rate: Double) { #expect(FixedIncomeTax.irRate(days: days) == rate) }

    @Test func iofTable() {
        #expect(FixedIncomeTax.iofRate(days: 1) == 0.96)
        #expect(FixedIncomeTax.iofRate(days: 10) == 0.66)
        #expect(FixedIncomeTax.iofRate(days: 29) == 0.03)
        #expect(FixedIncomeTax.iofRate(days: 30) == 0)
        #expect(FixedIncomeTax.iofRate(days: 400) == 0)
    }

    @Test func breakdownWithIOFAndIR() {
        // rendimento 10 em 10 dias: IOF 66% = 6,60; IR 22,5% de 3,40 = 0,765
        let b = FixedIncomeTax.breakdown(principal: 1000, gross: 1010, days: 10, exempt: false)
        #expect(abs(b.iof - 6.6) < 1e-9)
        #expect(abs(b.ir - 0.765) < 1e-9)
        #expect(abs(b.net - 1002.635) < 1e-9)
    }
    @Test func breakdownLongAndExemptAndLoss() {
        #expect(abs(FixedIncomeTax.breakdown(principal: 1000, gross: 1200, days: 800, exempt: false).net - 1170) < 1e-9)
        #expect(FixedIncomeTax.breakdown(principal: 1000, gross: 1200, days: 5, exempt: true).net == 1200)
        #expect(FixedIncomeTax.breakdown(principal: 1000, gross: 990, days: 5, exempt: false).net == 990)
    }
    @Test func netValuePerDeposit() {
        // dois aportes com prazos diferentes: cada um com sua alíquota
        let rates = (0..<400).map { CDIDailyRate(date: d("2025-09-01").addingTimeInterval(Double($0) * 86_400), percent: 0.05) }
        let a = FixedIncomeAsset(name: "CDB", kind: .cdb, cdiPercent: 100,
                                 deposits: [.init(date: "2025-09-01", amount: 1000), .init(date: "2026-09-20", amount: 1000)])
        let end = d("2026-10-01")
        let g1 = CDICalculator.grossValue(principal: 1000, start: d("2025-09-01"), cdiPercent: 100, rates: rates, until: end)
        let g2 = CDICalculator.grossValue(principal: 1000, start: d("2026-09-20"), cdiPercent: 100, rates: rates, until: end)
        let expected = 1000 + (g1 - 1000) * (1 - 0.175) + 1000 + (g2 - 1000) * (1 - FixedIncomeTax.iofRate(days: 11)) * (1 - 0.225)
        #expect(abs(CDICalculator.netValue(of: a, rates: rates, until: end) - expected) < 1e-6)
        var lci = a; lci.kind = .lci
        #expect(lci.isTaxExempt)
        #expect(abs(CDICalculator.netValue(of: lci, rates: rates, until: end) - (g1 + g2)) < 1e-6)
    }
    @Test func daysCounting() { #expect(FixedIncomeTax.days(from: d("2026-01-01"), to: d("2026-01-31")) == 30) }
}
