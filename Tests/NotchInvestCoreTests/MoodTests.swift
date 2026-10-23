import XCTest
@testable import NotchInvestCore

final class MoodTests: XCTestCase {
    func testMood() {
        XCTAssertEqual(CofrinhoMood.from(dayChangePct: 0.2, loading: true, hasError: true), .dormindo)
        XCTAssertEqual(CofrinhoMood.from(dayChangePct: 0.2, loading: false, hasError: true), .erro)
        XCTAssertEqual(CofrinhoMood.from(dayChangePct: 0.06, loading: false, hasError: false), .feliz)
        XCTAssertEqual(CofrinhoMood.from(dayChangePct: 0.05, loading: false, hasError: false), .neutro)
        XCTAssertEqual(CofrinhoMood.from(dayChangePct: -0.06, loading: false, hasError: false), .triste)
        XCTAssertEqual(CofrinhoMood.from(dayChangePct: nil, loading: false, hasError: false), .neutro)
    }
    func testCelebrate() {
        XCTAssertTrue(CofrinhoMood.shouldCelebrate(previousTotal: 100, newTotal: 101, dayChangePct: 0.1))
        XCTAssertFalse(CofrinhoMood.shouldCelebrate(previousTotal: nil, newTotal: 101, dayChangePct: 0.1))
        XCTAssertFalse(CofrinhoMood.shouldCelebrate(previousTotal: 100, newTotal: 101, dayChangePct: -0.1))
    }
    func testFrameCountsMatchSheets() throws {
        // confere largura das folhas = quadros × 128 (lendo o cabeçalho PNG)
        let dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
            .appendingPathComponent("../../Sources/NotchInvestApp/Resources/Cofrinho").standardized
        for m in CofrinhoMood.allCases {
            for (suffix, px) in [("", 128), ("@2x", 256)] {
                let d = try Data(contentsOf: dir.appendingPathComponent(m.sheetName(retina: suffix == "@2x") + ".png"))
                let w = d[16..<20].reduce(0) { $0 << 8 | Int($1) }, h = d[20..<24].reduce(0) { $0 << 8 | Int($1) }
                XCTAssertEqual(w, m.frameCount * px, "\(m)\(suffix)"); XCTAssertEqual(h, px)
            }
        }
    }
}
