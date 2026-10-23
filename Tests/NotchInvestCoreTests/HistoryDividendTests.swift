import Testing
import Foundation
@testable import NotchInvestCore

@Suite struct HistoryTests {
    func d(_ s: String) -> Date { DateParsing.iso.date(from: s)!.addingTimeInterval(12 * 3600) }

    @Test func onePointPerDayAndRanges() throws {
        var h = History()
        h.record(total: 100, invested: 90, net: 98, at: d("2026-09-01"))
        h.record(total: 110, invested: 90, net: nil, at: d("2026-10-20"))
        h.record(total: 111, invested: 90, net: nil, at: d("2026-10-20"))   // mesmo dia: substitui
        h.record(total: 112, invested: 90, net: nil, at: d("2026-10-23"))
        h.record(total: 0, invested: 0, net: nil, at: d("2026-10-22"))      // carteira vazia não entra
        #expect(h.points.map(\.day) == ["2026-09-01", "2026-10-20", "2026-10-23"])
        #expect(h.points[1].total == 111)
        let now = d("2026-10-23")
        #expect(h.points(in: .tudo, now: now).count == 3)
        #expect(h.points(in: .mes, now: now).count == 2)
        #expect(h.points(in: .semana, now: now).count == 2)
        #expect(h.points(in: .dia, now: now).count == 1)
        #expect(abs(h.points[0].gainPct - 11.111) < 0.01)

        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("nih-\(UUID().uuidString)")
        let f = dir.appendingPathComponent("history.json")
        try h.save(to: f)
        #expect(LocalData.permissions(f) == 0o600)
        #expect(History.load(from: f) == h)
        #expect(History.load(from: dir.appendingPathComponent("nada.json")).points.isEmpty)
        try LocalData.eraseAll(folder: dir)
    }
}

@Suite struct DividendTests {
    let sample = #"""
    {"results":[{"symbol":"MXRF11","regularMarketPrice":10.1,"dividendsData":{"cashDividends":[
      {"paymentDate":"2026-10-15T00:00:00.000Z","rate":0.10,"label":"RENDIMENTO"},
      {"paymentDate":"2026-09-15T00:00:00.000Z","rate":0.09,"label":"RENDIMENTO"},
      {"paymentDate":"2024-01-15T00:00:00.000Z","rate":0.50,"label":"RENDIMENTO"},
      {"paymentDate":null,"rate":0.2}]}}]}
    """#

    @Test func parseAndSummarize() throws {
        let cash = try Dividends.parseBrapi(Data(sample.utf8))
        #expect(cash.count == 3)
        let now = DateParsing.iso.date(from: "2026-10-23")!
        let s = Dividends.summary(stocks: [.init(ticker: "MXRF11", quantity: 100)], brapi: cash, manual: [], now: now)
        #expect(abs(s.last12m - 19) < 1e-9)
        #expect(s.source["MXRF11"] == "brapi")
    }
    @Test func manualWins() throws {
        let cash = try Dividends.parseBrapi(Data(sample.utf8))
        let now = DateParsing.iso.date(from: "2026-10-23")!
        let s = Dividends.summary(stocks: [.init(ticker: "MXRF11", quantity: 100), .init(ticker: "PETR4", quantity: 10)], brapi: cash,
                                  manual: [.init(ticker: "mxrf11", date: "2026-10-15", amount: 9.8), .init(ticker: "PETR4", date: "2020-01-01", amount: 99)],
                                  now: now)
        #expect(s.byTicker["MXRF11"] == 9.8)
        #expect(s.source["MXRF11"] == "manual")
        #expect(s.byTicker["PETR4"] == nil)      // fora dos 12 meses
        #expect(s.last12m == 9.8)
    }
    @Test func dividendsURLHasNoPrivateData() {
        #expect(BrapiService.url("PETR4", dividends: true).absoluteString == "https://brapi.dev/api/quote/PETR4?dividends=true")
    }
}
