import Testing
import Foundation
@testable import NotchInvestCore

@Suite struct CDITests {
    func d(_ s: String) -> Date { DateParsing.iso.date(from: s)! }

    @Test func compounding100and110() {
        let rates = (1...10).map { CDIDailyRate(date: d(String(format: "2026-01-%02d", $0)), percent: 0.05) }
        let v100 = CDICalculator.grossValue(principal: 1000, start: d("2026-01-01"), cdiPercent: 100, rates: rates, until: d("2026-02-01"))
        #expect(abs((v100) - (1000 * pow(1.0005, 10))) < 1e-9)
        let v110 = CDICalculator.grossValue(principal: 1000, start: d("2026-01-06"), cdiPercent: 110, rates: rates, until: d("2026-02-01"))
        #expect(abs((v110) - (1000 * pow(1 + 0.0005 * 1.1, 5))) < 1e-9)
    }

    @Test func annualized() {
        #expect(abs((CDICalculator.annualized(dailyPercent: 0.050788)) - (13.65)) < 0.05)
    }

    @Test func parseBCB() throws {
        let json = #"[{"data":"21/10/2026","valor":"0.050788"}]"#.data(using: .utf8)!
        let r = try BCBService.parse(json)
        #expect(r.first?.percent == 0.050788)
    }

    @Test func portfolioDecode() throws {
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
            .appendingPathComponent("../../portfolio.example.json").standardized
        let p = try Portfolio.load(from: url)
        #expect(!(p.fixedIncome.isEmpty))
    }
}
