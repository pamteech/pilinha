#if canImport(CryptoKit)
import Testing
import Foundation
import CryptoKit
@testable import NotchInvestCore

/// Vetor gerado em mobile/src/core/sync.ts (@noble): Swift e JS precisam bater byte a byte.
@Suite struct SyncTests {
    static let code = "abcd-efgh-2345-6789"
    static let plain = #"{"stocks":[{"ticker":"FAKE3","quantity":1,"averagePrice":10}]}"#
    static let blobB64 = "AQIDBAUGBwgJCgsMIUqMH7Hr3bhM54ajIoKWCMT2+qWqi+C8sJs016HSlxMwH17H9FzYUyp9T7SCdcWwXdH3L/arvbMPL13M5fxomPkyf06SkHAe5HeMAxPF"
    @Test func derivesSameKeysAsJS() throws {
        let k = try #require(PilinhaSync.keys(Self.code))
        #expect(k.id == "23d10dee8f0d2f01e16ec8b0e1e24e54")
        #expect(k.writeToken == "95f865075b5832a663fa683661d460b43bb567bc6c1fc5589ce7eaa00e5027ed")
        #expect(PilinhaSync.keyHex(k.key) == "7e0d8eca82a8ff1c95ae2823422aa6317a9a6e109a21836bffd0328ffeb7c76b")
    }
    @Test func sealMatchesJSAndOpens() throws {
        let k = try #require(PilinhaSync.keys(Self.code))
        let nonce = try AES.GCM.Nonce(data: Data((1...12).map { UInt8($0) }))
        let blob = try PilinhaSync.seal(Data(Self.plain.utf8), key: k.key, nonce: nonce)
        #expect(blob.base64EncodedString() == Self.blobB64)
        #expect(String(decoding: try PilinhaSync.open(Data(base64Encoded: Self.blobB64)!, key: k.key), as: UTF8.self) == Self.plain)
    }
    @Test func codes() {
        let c = PilinhaSync.newCode()
        #expect(c.count == 16 && PilinhaSync.normalize(c) == c)
        #expect(PilinhaSync.normalize("ABCD-EFGH-2345-678O") == nil)   // sem O
        #expect(PilinhaSync.format("ABCDEFGH23456789") == "ABCD-EFGH-2345-6789")
    }
}
#endif
