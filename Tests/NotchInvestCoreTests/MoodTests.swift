import Testing
import Foundation
@testable import NotchInvestCore

@Suite struct MoodTests {
    @Test func mood() {
        #expect(CofrinhoMood.from(dayChangePct: 0.2, loading: true, hasError: true) == .dormindo)
        #expect(CofrinhoMood.from(dayChangePct: 0.2, loading: false, hasError: true) == .erro)
        #expect(CofrinhoMood.from(dayChangePct: 0.06, loading: false, hasError: false) == .feliz)
        #expect(CofrinhoMood.from(dayChangePct: 0.05, loading: false, hasError: false) == .neutro)
        #expect(CofrinhoMood.from(dayChangePct: -0.06, loading: false, hasError: false) == .triste)
        #expect(CofrinhoMood.from(dayChangePct: nil, loading: false, hasError: false) == .neutro)
    }
    @Test func celebrate() {
        #expect(CofrinhoMood.shouldCelebrate(previousTotal: 100, newTotal: 101, dayChangePct: 0.1))
        #expect(!(CofrinhoMood.shouldCelebrate(previousTotal: nil, newTotal: 101, dayChangePct: 0.1)))
        #expect(!(CofrinhoMood.shouldCelebrate(previousTotal: 100, newTotal: 101, dayChangePct: -0.1)))
    }
    @Test func frameCountsMatchSheets() throws {
        // confere largura das folhas = quadros × 128 (lendo o cabeçalho PNG)
        let dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
            .appendingPathComponent("../../Sources/NotchInvestApp/Resources/Cofrinho").standardized
        for m in CofrinhoMood.allCases {
            for (suffix, px) in [("", 128), ("@2x", 256)] {
                let d = try Data(contentsOf: dir.appendingPathComponent(m.sheetName(retina: suffix == "@2x") + ".png"))
                let w = d[16..<20].reduce(0) { $0 << 8 | Int($1) }, h = d[20..<24].reduce(0) { $0 << 8 | Int($1) }
                #expect(w == m.frameCount * px, Comment(rawValue: "\(m)\(suffix)")); #expect(h == px)
            }
        }
    }
}
