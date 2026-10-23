import XCTest
@testable import NotchInvestCore

final class PrivacyTests: XCTestCase {
    func testModeCycleAndDefault() {
        XCTAssertEqual(PrivacyMode.load(nil), .porcentagens)
        XCTAssertTrue(PrivacyMode.load(nil).isDiscreet)
        XCTAssertEqual(PrivacyMode.load("valores"), .valores)
        XCTAssertEqual(PrivacyMode.valores.next.next.next, .valores)
    }
    func testFormatting() {
        XCTAssertEqual(PrivacyMode.oculto.money(1234.5), "R$ •••••")
        XCTAssertNil(PrivacyMode.porcentagens.money(1234.5))
        XCTAssertNotNil(PrivacyMode.valores.money(1234.5))
        XCTAssertEqual(PrivacyMode.valores.money(1234.5, unlocked: false), "R$ •••••")
        XCTAssertNil(PrivacyMode.oculto.compactLeft(total: 10))
        XCTAssertNil(PrivacyMode.valores.compactLeft(total: 10, unlocked: false))
        XCTAssertNotNil(PrivacyMode.valores.compactLeft(total: 10))
    }
    func testLock() {
        let t0 = Date(timeIntervalSince1970: 1_000_000)
        var l = PrivacyLock(enabled: true, relockMinutes: 5)
        XCTAssertFalse(l.isUnlocked(now: t0))
        l.didAuthenticate(at: t0)
        XCTAssertTrue(l.isUnlocked(now: t0.addingTimeInterval(299)))
        XCTAssertFalse(l.isUnlocked(now: t0.addingTimeInterval(301)))
        l.lock(); XCTAssertFalse(l.isUnlocked(now: t0))
        XCTAssertTrue(PrivacyLock(enabled: false).isUnlocked())
    }
    func testFilePermissions600AndErase() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("ni-\(UUID().uuidString)")
        let f = dir.appendingPathComponent("portfolio.json")
        try LocalData.save(Portfolio(owner: "x"), to: f)
        XCTAssertEqual(LocalData.permissions(f), 0o600)
        try LocalData.eraseAll(folder: dir)
        XCTAssertFalse(FileManager.default.fileExists(atPath: dir.path))
    }
    func testRequestsCarryOnlyPublicTickers() throws {
        let p = try JSONDecoder().decode(Portfolio.self, from: Data(contentsOf: URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("portfolio.example.json")))
        var q = p; q.owner = "Fulana"
        let reqs = NetworkAudit.requests(for: q)
        XCTAssertFalse(reqs.isEmpty)
        for r in reqs {
            XCTAssertEqual(r.url.scheme, "https")
            XCTAssertTrue(["api.bcb.gov.br", "brapi.dev", "api.coingecko.com"].contains(r.url.host ?? ""))
        }
        XCTAssertNil(BrapiService.url("petr4?x=1&y=2").query)   // ticker não injeta parâmetros
        XCTAssertTrue(NetworkAudit.leaksNothing(q))
    }
}
