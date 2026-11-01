import XCTest
@testable import NotchInvestCore

final class ExtrasTests: XCTestCase {
    let csv = """
    Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha
    Tesouro IPCA+;15/08/2032;29/10/2026;7,84;7,96;3090,37;3069,51;3069,51
    Tesouro IPCA+;15/08/2032;30/10/2026;7,89;8,01;3083,90;3062,48;3062,48
    Tesouro Selic;01/03/2029;30/10/2026;0,06;0,07;20185,67;20170,66;20170,66
    """
    let asset = FixedIncomeAsset(name: "Tesouro IPCA+ 2032", kind: .tesouro, cdiPercent: 0, deposits: [Deposit(date: "2026-10-30", amount: 1000)],
                                 indexer: .ipca, realRate: 7.89, maturity: "2032-08-15")
    func testMarkToMarket() throws {
        let t = try XCTUnwrap(Treasury.title(for: asset))
        XCTAssertEqual(t.title, "Tesouro IPCA+")
        let rows = Treasury.parseCSV(csv, wanted: [t])
        XCTAssertEqual(rows.count, 2)
        let m = try XCTUnwrap(Treasury.markToMarket(asset, rows: rows))
        XCTAssertEqual(m.value, 1000 / 3083.9 * 3062.48, accuracy: 0.0001)
        XCTAssertEqual(m.sellRate, 8.01)
        XCTAssertNil(Treasury.markToMarket(asset, rows: []))
    }
    func testWatchAndAlerts() {
        let r = WatchRow(WatchItem(ticker: "taee11", targetPrice: 30, amount: 500), price: 33, dayPct: 1)
        XCTAssertEqual(r.distancePct!, 10, accuracy: 1e-9); XCTAssertFalse(r.reached); XCTAssertEqual(r.shares, 16)
        let al = Alerts.fromWatchlist([WatchItem(ticker: "TAEE11", targetPrice: 30)])
        let d = Date(timeIntervalSince1970: 1_793_800_000)
        let e = Alerts.evaluate(al, quotes: ["TAEE11": QuoteLite(price: 29, dayPct: -1)], fired: [:], now: d)
        XCTAssertEqual(e.toFire.count, 1)
        XCTAssertEqual(Alerts.evaluate(al, quotes: ["TAEE11": QuoteLite(price: 29, dayPct: -1)], fired: e.fired, now: d).toFire.count, 0)
        XCTAssertTrue(Alerts.triggered(PriceAlert(ticker: "X", kind: .risePct, value: 3), QuoteLite(price: 1, dayPct: 3.2)))
    }
    func testOldJSONStillDecodes() throws {
        let p = try JSONDecoder().decode(Portfolio.self, from: Data(#"{"fixedIncome":[],"stocks":[],"crypto":[]}"#.utf8))
        XCTAssertNil(p.watchlist)
        let q = try JSONDecoder().decode(Portfolio.self, from: Data(#"{"fixedIncome":[],"stocks":[],"crypto":[],"watchlist":[{"ticker":"TAEE11","targetPrice":30}]}"#.utf8))
        XCTAssertEqual(q.watchlist?.first?.targetPrice, 30)
    }
    func testBenchmark() {
        let pts = [HistoryPoint(day: "2026-10-01", total: 100, invested: 100), HistoryPoint(day: "2026-10-03", total: 102, invested: 100)]
        let r = [CDIDailyRate(date: DateParsing.iso.date(from: "2026-10-01")!, percent: 0.05), CDIDailyRate(date: DateParsing.iso.date(from: "2026-10-02")!, percent: 0.05)]
        let b = Benchmark.series(pts, rates: r)
        XCTAssertEqual(b.last!.carteira, 2, accuracy: 1e-9); XCTAssertEqual(b.last!.cdi, (1.0005 * 1.0005 - 1) * 100, accuracy: 1e-9)
    }
}
