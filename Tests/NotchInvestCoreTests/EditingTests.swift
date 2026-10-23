import Testing
import Foundation
@testable import NotchInvestCore

@Suite struct EditingTests {
    @Test(arguments: [("1.234,56", 1234.56), ("1234,56", 1234.56), ("1234.56", 1234.56), ("R$ 10", 10.0),
                      ("1,234.56", 1234.56), ("0,0015", 0.0015), ("0.0015", 0.0015), ("110%", 110.0), ("1.000.000", 1_000_000.0)])
    func parses(raw: String, value: Double) { #expect(DecimalInput.parse(raw) == value) }

    @Test(arguments: ["", "abc", "1,2,3", "12a", "--"])
    func rejects(raw: String) { #expect(DecimalInput.parse(raw) == nil) }

    @Test func formatUsesComma() { #expect(DecimalInput.format(1234.5) == "1234,5") }

    @Test func roundTripAndValidation() throws {
        let p = Portfolio(owner: "x", fixedIncome: [.init(name: "Caixinha", kind: .caixinha, cdiPercent: 100, deposits: [.init(date: "2026-01-02", amount: 500.5)])],
                          stocks: [.init(ticker: "PETR4", quantity: 10, averagePrice: 35.2)],
                          crypto: [.init(coinId: "bitcoin", symbol: "BTC", quantity: 0.0015, averagePriceBRL: 350000)],
                          tradingview: .init(layoutURL: "https://www.tradingview.com/chart/X/"))
        var draft = PortfolioDraft(p)
        #expect(draft.fixed.first?.deposits.first?.amount == "500,5")
        let built = try draft.build().get()
        #expect(built.fixedIncome.first?.deposits.first?.amount == 500.5)
        #expect(built.crypto.first?.quantity == 0.0015)
        #expect(built.tradingview?.layoutURL == p.tradingview?.layoutURL)   // campos não editados preservados
        #expect(built.owner == "x")

        draft.stocks.append(.init(ticker: "mxrf11", quantity: "100", averagePrice: "10,05"))
        draft.dividends.append(.init(ticker: "MXRF11", date: DateParsing.iso.date(from: "2026-09-15")!, amount: "9,50"))
        let b2 = try draft.build().get()
        #expect(b2.stocks.last?.ticker == "MXRF11")
        #expect(b2.stocks.last?.averagePrice == 10.05)
        #expect(b2.manualDividends?.first?.amount == 9.5)
    }

    @Test func validationMessages() {
        var d = PortfolioDraft(Portfolio())
        d.fixed.append(.init(name: "", kind: .cdb, cdiPercent: "abc", deposits: [.init(date: Date().addingTimeInterval(86_400 * 3), amount: "0")]))
        d.stocks.append(.init(ticker: "X", quantity: "1,2,3"))
        d.stocks.append(.init(ticker: "PETR4", quantity: "1"))
        d.stocks.append(.init(ticker: "petr4", quantity: "1"))
        guard case .failure(let e) = d.build() else { Issue.record("deveria falhar"); return }
        let all = e.messages.joined(separator: "\n")
        #expect(all.contains("dê um nome"))
        #expect(all.contains("número inválido"))
        #expect(all.contains("data no futuro"))
        #expect(all.contains("maior que zero"))
        #expect(all.contains("ticker inválido"))
        #expect(all.contains("ticker repetido"))
    }

    @Test func savedFileIs600AndDecodesOldFormat() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("ni-\(UUID().uuidString)")
        let f = dir.appendingPathComponent("portfolio.json")
        try LocalData.save(Portfolio(manualDividends: [.init(ticker: "MXRF11", date: "2026-01-01", amount: 1)]), to: f)
        #expect(LocalData.permissions(f) == 0o600)
        #expect(try Portfolio.load(from: f).manualDividends?.count == 1)
        // arquivo antigo, sem manualDividends
        let old = #"{"fixedIncome":[],"stocks":[],"crypto":[]}"#
        #expect(try JSONDecoder().decode(Portfolio.self, from: Data(old.utf8)).manualDividends == nil)
        try LocalData.eraseAll(folder: dir)
    }
}
