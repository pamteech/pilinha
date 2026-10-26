import Testing
import Foundation
@testable import NotchInvestCore

@Suite struct PrivacyTests {
    @Test func modeCycleAndDefault() {
        #expect(PrivacyMode.load(nil) == .porcentagens)
        #expect(PrivacyMode.load(nil).isDiscreet)
        #expect(PrivacyMode.load("valores") == .valores)
        #expect(PrivacyMode.valores.next.next.next == .valores)
    }
    @Test func formatting() {
        #expect(PrivacyMode.oculto.money(1234.5) == "R$ •••••")
        #expect(PrivacyMode.porcentagens.money(1234.5) == nil)
        #expect(PrivacyMode.valores.money(1234.5) != nil)
        #expect(PrivacyMode.valores.money(1234.5, unlocked: false) == "R$ •••••")
        #expect(PrivacyMode.oculto.compactLeft(total: 10) == nil)
        #expect(PrivacyMode.valores.compactLeft(total: 10, unlocked: false) == nil)
        #expect(PrivacyMode.valores.compactLeft(total: 10) != nil)
    }
    @Test func lock() {
        let t0 = Date(timeIntervalSince1970: 1_000_000)
        var l = PrivacyLock(enabled: true, relockMinutes: 5)
        #expect(!(l.isUnlocked(now: t0)))
        l.didAuthenticate(at: t0)
        #expect(l.isUnlocked(now: t0.addingTimeInterval(299)))
        #expect(!(l.isUnlocked(now: t0.addingTimeInterval(301))))
        l.lock(); #expect(!(l.isUnlocked(now: t0)))
        #expect(PrivacyLock(enabled: false).isUnlocked())
    }
    @Test func filePermissions600AndErase() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("ni-\(UUID().uuidString)")
        let f = dir.appendingPathComponent("portfolio.json")
        try LocalData.save(Portfolio(owner: "x"), to: f)
        #expect(LocalData.permissions(f) == 0o600)
        try LocalData.eraseAll(folder: dir)
        #expect(!(FileManager.default.fileExists(atPath: dir.path)))
    }
    @Test func requestsCarryOnlyPublicTickers() throws {
        let p = try JSONDecoder().decode(Portfolio.self, from: Data(contentsOf: URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("portfolio.example.json")))
        var q = p; q.owner = "Fulana"
        let reqs = NetworkAudit.requests(for: q)
        #expect(!(reqs.isEmpty))
        for r in reqs {
            #expect(r.url.scheme == "https")
            #expect(["api.bcb.gov.br", "brapi.dev", "query1.finance.yahoo.com", "query2.finance.yahoo.com", "api.coingecko.com"].contains(r.url.host ?? ""))
        }
        #expect(BrapiService.url("petr4?x=1&y=2").query == nil)   // ticker não injeta parâmetros
        #expect(NetworkAudit.leaksNothing(q))
    }
}
