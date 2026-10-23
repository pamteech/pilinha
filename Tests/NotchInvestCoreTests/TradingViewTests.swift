import XCTest
@testable import NotchInvestCore

final class TradingViewTests: XCTestCase {
    func testSymbols() {
        let p = Portfolio(stocks: [.init(ticker: "petr4", quantity: 1, averagePrice: nil), .init(ticker: "MXRF11", quantity: 1, averagePrice: nil)],
                          crypto: [.init(coinId: "bitcoin", symbol: "BTC", quantity: 1, averagePriceBRL: nil)],
                          tradingview: .init(symbols: ["MXRF11": "BMFBOVESPA:MXRF11"]))
        XCTAssertEqual(TradingView.symbols(for: p).map(\.tvSymbol), ["BMFBOVESPA:PETR4", "BMFBOVESPA:MXRF11", "BINANCE:BTCBRL"])
    }
    func testChartURL() {
        XCTAssertEqual(TradingView.chartURL(layout: nil, symbol: "BMFBOVESPA:PETR4")?.absoluteString,
                       "https://www.tradingview.com/chart/?symbol=BMFBOVESPA:PETR4")
        XCTAssertEqual(TradingView.chartURL(layout: "https://www.tradingview.com/chart/AbC123/?symbol=X", symbol: "BINANCE:BTCBRL")?.absoluteString,
                       "https://www.tradingview.com/chart/AbC123/?symbol=BINANCE:BTCBRL")
        // URL fora do TradingView é ignorada
        XCTAssertEqual(TradingView.chartURL(layout: "https://evil.example/chart", symbol: nil)?.absoluteString, TradingView.chartBase)
    }
    func testLayoutsAndHosts() {
        let c = TradingViewConfig(layoutURL: "https://br.tradingview.com/chart/A/", layouts: [.init(name: "Swing", url: "https://www.tradingview.com/chart/B/"),
                                                                                             .init(name: "Ruim", url: "http://x.com")])
        XCTAssertEqual(TradingView.layouts(for: c).map(\.name), ["Layout padrão", "Swing"])
        XCTAssertEqual(TradingView.layouts(for: nil).first?.url, TradingView.chartBase)
        XCTAssertTrue(TradingView.staysInPanel(host: "br.tradingview.com"))
        XCTAssertFalse(TradingView.staysInPanel(host: "accounts.google.com"))
    }
    func testWidgetHTMLAndDecode() throws {
        let h = TradingView.widgetHTML(symbol: "BMFBOVESPA:PETR4")
        XCTAssertTrue(h.contains("embed-widget-advanced-chart.js")); XCTAssertTrue(h.contains("\"symbol\":\"BMFBOVESPA:PETR4\""))
        XCTAssertTrue(h.contains("tradingview-widget-copyright"))
        let json = #"{"fixedIncome":[],"stocks":[],"crypto":[],"tradingview":{"layoutURL":"https://www.tradingview.com/chart/X/","panelWidth":800}}"#
        let p = try JSONDecoder().decode(Portfolio.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(p.tradingview?.panelWidth, 800)
    }
}
