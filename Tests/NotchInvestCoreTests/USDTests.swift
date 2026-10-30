import Testing
import Foundation
@testable import NotchInvestCore

/// Dólar com dados falsos.
@Suite struct USDTests {
    @Test func oldPortfolioWithoutUSDStillLoads() throws {
        let p = try JSONDecoder().decode(Portfolio.self, from: Data(#"{"fixedIncome":[],"stocks":[],"crypto":[]}"#.utf8))
        #expect(p.usd == nil)
    }
    @Test func roundTrip() throws {
        let p = Portfolio(usd: USDPosition(amount: 100, averageRateBRL: 5))
        let q = try JSONDecoder().decode(Portfolio.self, from: JSONEncoder().encode(p))
        #expect(q.usd == USDPosition(amount: 100, averageRateBRL: 5))
    }
    @Test func parsers() {
        let a = USDQuoteService.parseAwesome(Data(#"{"USDBRL":{"bid":"5.5000","pctChange":"0.5"}}"#.utf8))
        #expect(a?.bid == 5.5 && a?.changePct == 0.5)
        let b = USDQuoteService.parsePTAX(Data(#"{"value":[{"cotacaoCompra":5.1,"cotacaoVenda":5.2}]}"#.utf8))
        #expect(b?.bid == 5.2)
        #expect(USDQuoteService.parseAwesome(Data("{}".utf8)) == nil)
    }
    @Test func lineItem() {
        let i = PortfolioEngine.usdItem(USDPosition(amount: 100, averageRateBRL: 5), USDQuote(bid: 5.5, changePct: nil, source: "x"))
        #expect(abs(i.current - 550) < 0.001 && i.invested == 500 && abs((i.gain ?? 0) - 50) < 0.001)
    }
    @Test func draft() throws {
        var d = PortfolioDraft(Portfolio())
        d.usdAmount = "1500,50"; d.usdAverage = "5,1"
        let p = try d.build().get()
        #expect(p.usd?.amount == 1500.5 && p.usd?.averageRateBRL == 5.1)
        d.usdAmount = ""; d.usdAverage = ""
        #expect(try d.build().get().usd == nil)
    }
}
