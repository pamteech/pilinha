import Testing
import Foundation
@testable import NotchInvestCore

@Suite struct YahooTests {
    static let fixture = """
    {"chart":{"result":[{"meta":{"currency":"BRL","symbol":"MXRF11.SA","regularMarketPrice":9.75,"chartPreviousClose":9.70,"previousClose":9.71},"timestamp":[1761220800],"indicators":{"quote":[{}]}}],"error":null}}
    """
    static let notFound = """
    {"chart":{"result":null,"error":{"code":"Not Found","description":"No data found, symbol may be delisted"}}}
    """

    @Test func parsesPriceAndChange() throws {
        let q = try YahooFinanceService.parse(Data(Self.fixture.utf8), ticker: "MXRF11")
        #expect(q.price == 9.75)
        #expect(abs((q.changePct ?? 0) - (9.75 / 9.70 - 1) * 100) < 1e-9)
    }
    @Test func usesPreviousCloseWhenChartPreviousMissing() throws {
        let j = #"{"chart":{"result":[{"meta":{"regularMarketPrice":22,"previousClose":20}}],"error":null}}"#
        let q = try YahooFinanceService.parse(Data(j.utf8), ticker: "BBAS3")
        #expect(abs((q.changePct ?? 0) - 10) < 1e-9)
    }
    @Test func errorsAreClear() {
        #expect(throws: QuoteError.self) { try YahooFinanceService.parse(Data(Self.notFound.utf8), ticker: "XXXX3") }
        #expect(throws: QuoteError.self) { try YahooFinanceService.parse(Data("Too Many Requests".utf8), ticker: "BBAS3") }
    }
    @Test func urlCarriesOnlyTicker() {
        let u = YahooFinanceService.url("bbas3?x=1&y=2")
        #expect(u.host == "query1.finance.yahoo.com")
        #expect(u.path == "/v8/finance/chart/BBAS3X1Y2.SA")
        #expect(u.query == "range=1d&interval=1d")
    }
    @Test func fallbackHostAndShortUA() {
        #expect(YahooFinanceService.url("bbas3", host: "query2").host == "query2.finance.yahoo.com")
        #expect(YahooFinanceService.url("bbas3", host: "evil.com").host == "query1.finance.yahoo.com")
        #expect(YahooFinanceService.browserUA == "Mozilla/5.0")
    }

    final class Calls: @unchecked Sendable { var log: [String] = []; let l = NSLock()
        func add(_ s: String) { l.lock(); log.append(s); l.unlock() } }
    struct Boom: Error {}

    @Test func withTokenUsesBrapiFirst() async throws {
        let c = Calls()
        let p = StockQuoteProvider(hasToken: true,
            brapi: { c.add("brapi"); return (10, 1, [CashDividend(ticker: $0, paymentDate: Date(), ratePerShare: 0.1, label: "x")]) },
            yahoo: { _ in c.add("yahoo"); return (99, nil) })
        let q = try await p.quote("PETR4")
        #expect(q.price == 10 && q.source == "brapi" && q.dividends.count == 1)
        #expect(c.log == ["brapi"])
    }
    @Test func withTokenFallsBackToYahoo() async throws {
        let c = Calls()
        let p = StockQuoteProvider(hasToken: true,
            brapi: { _ in c.add("brapi"); throw Boom() },
            yahoo: { _ in c.add("yahoo"); return (9.75, 0.5) })
        let q = try await p.quote("MXRF11")
        #expect(q.price == 9.75 && q.source == "yahoo" && q.dividends.isEmpty)
        #expect(c.log == ["brapi", "yahoo"])
    }
    @Test func withoutTokenGoesStraightToYahoo() async throws {
        let c = Calls()
        let p = StockQuoteProvider(hasToken: false,
            brapi: { _ in c.add("brapi"); return (1, nil, []) },
            yahoo: { _ in c.add("yahoo"); return (30, nil) })
        let q = try await p.quote("BBAS3")
        #expect(q.source == "yahoo" && c.log == ["yahoo"])
    }
    @Test func bothFailGivesClearError() async {
        let p = StockQuoteProvider(hasToken: true, brapi: { _ in throw Boom() }, yahoo: { _ in throw Boom() })
        do { _ = try await p.quote("HGLG11"); Issue.record("devia falhar") }
        catch { #expect("\(error)".contains("HGLG11") && "\(error)".contains("brapi") && "\(error)".contains("Yahoo")) }
    }
}
