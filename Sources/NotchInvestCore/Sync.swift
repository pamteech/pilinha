#if canImport(CryptoKit)
import Foundation
import CryptoKit

/// Sincronização Mac → iPhone cifrada ponta a ponta (ver mobile/src/core/sync.ts, mesmo formato).
/// Do código de pareamento saem, por HKDF-SHA256: o id no servidor, a chave AES-GCM e o token de escrita.
/// O servidor só guarda nonce|cifrado|tag; nunca vê a carteira nem o código.
public enum PilinhaSync {
    public static let endpoint = URL(string: "https://pilinha-sync.pamellaks22.workers.dev")!
    public static let alphabet = Array("23456789ABCDEFGHJKMNPQRSTUVWXYZ")
    static let salt = Data("pilinha-sync-v1".utf8)
    static let aad = Data("pilinha-sync-v1".utf8)

    public struct Keys { public let id: String; public let key: SymmetricKey; public let writeToken: String }

    /// 16 caracteres sem 0/O/1/I/L (~79 bits). Aceita minúsculas, espaços e traços.
    public static func normalize(_ s: String) -> String? {
        let c = s.uppercased().filter { $0 != "-" && !$0.isWhitespace }
        return c.count == 16 && c.allSatisfy(alphabet.contains) ? c : nil
    }
    public static func format(_ c: String) -> String {
        stride(from: 0, to: c.count, by: 4).map { i in
            let a = c.index(c.startIndex, offsetBy: i); return String(c[a..<c.index(a, offsetBy: min(4, c.count - i))])
        }.joined(separator: "-")
    }
    public static func newCode() -> String {
        var g = SystemRandomNumberGenerator()
        return String((0..<16).map { _ in alphabet[Int(g.next(upperBound: UInt32(alphabet.count)))] })
    }
    static func hex(_ d: some ContiguousBytes) -> String { d.withUnsafeBytes { $0.map { String(format: "%02x", $0) }.joined() } }
    public static func keys(_ code: String) -> Keys? {
        guard let n = normalize(code) else { return nil }
        let ikm = SymmetricKey(data: Data(n.utf8))
        func d(_ info: String, _ len: Int) -> SymmetricKey {
            HKDF<SHA256>.deriveKey(inputKeyMaterial: ikm, salt: salt, info: Data(info.utf8), outputByteCount: len)
        }
        return Keys(id: hex(d("id", 16)), key: d("key", 32), writeToken: hex(d("write", 32)))
    }
    public static func seal(_ plain: Data, key: SymmetricKey, nonce: AES.GCM.Nonce = AES.GCM.Nonce()) throws -> Data {
        guard let c = try AES.GCM.seal(plain, using: key, nonce: nonce, authenticating: aad).combined else { throw CocoaError(.coderInvalidValue) }
        return c
    }
    public static func open(_ blob: Data, key: SymmetricKey) throws -> Data {
        try AES.GCM.open(try AES.GCM.SealedBox(combined: blob), using: key, authenticating: aad)
    }
    public static func keyHex(_ k: SymmetricKey) -> String { hex(k) }

    // MARK: código guardado no Mac (~/.notchinvest/sync-code, 600)
    public static var codeURL: URL { LocalData.folder.appendingPathComponent("sync-code") }
    public static func savedCode(at url: URL = codeURL) -> String? {
        (try? String(contentsOf: url, encoding: .utf8)).flatMap { normalize($0) }
    }
    /// Cria (ou troca, com `fresh`) o código de pareamento e grava só para a dona.
    @discardableResult
    public static func ensureCode(fresh: Bool = false, at url: URL = codeURL) throws -> String {
        if !fresh, let c = savedCode(at: url) { return c }
        let c = newCode()
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true,
                                                attributes: [.posixPermissions: 0o700])
        try Data(c.utf8).write(to: url, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
        return c
    }
    public static func disable(at url: URL = codeURL) { try? FileManager.default.removeItem(at: url) }
    /// Link que o QR do Mac carrega: a Câmera do iPhone abre o Pilinha já conectando.
    public static func pairingLink(_ code: String) -> String { "pilinha://sync?code=\(format(code))" }

    // MARK: envio
    nonisolated(unsafe) static var lastSent: (digest: String, at: Date)?
    /// Cifra e envia a carteira atual. Não reenvia o mesmo conteúdo antes de 1 h. Falha em silêncio (sem internet etc.).
    @discardableResult
    public static func pushCurrent(from url: URL = Portfolio.defaultURL, force: Bool = false) async -> Bool {
        guard let code = savedCode(), let k = keys(code), let data = try? Data(contentsOf: url) else { return false }
        let digest = hex(SHA256.hash(data: data + Data(code.utf8)))
        if !force, let l = lastSent, l.digest == digest, Date().timeIntervalSince(l.at) < 3600 { return true }
        guard let blob = try? seal(data, key: k.key) else { return false }
        var req = URLRequest(url: endpoint.appendingPathComponent("v1/sync/\(k.id)"))
        req.httpMethod = "PUT"; req.httpBody = blob; req.timeoutInterval = 20
        req.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
        req.setValue(k.writeToken, forHTTPHeaderField: "X-Write-Token")
        guard let (_, resp) = try? await URLSession.shared.data(for: req), (resp as? HTTPURLResponse)?.statusCode == 200 else { return false }
        lastSent = (digest, Date())
        return true
    }
}
#endif
