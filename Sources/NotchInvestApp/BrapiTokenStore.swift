#if os(macOS)
import Foundation
import Security

/// Token da brapi no Keychain do Mac (nunca no JSON, nunca em log).
/// Se não houver no Keychain, usa a variável de ambiente BRAPI_TOKEN (útil para testes).
enum BrapiTokenStore {
    private static let service = "com.pamtech.notchinvest.brapi"
    private static let account = "brapi-token"
    private static var base: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }

    static func read() -> String? {
        var q = base
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        if SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data,
           let s = String(data: d, encoding: .utf8), !s.isEmpty { return s }
        let env = ProcessInfo.processInfo.environment["BRAPI_TOKEN"]
        return (env?.isEmpty ?? true) ? nil : env
    }
    static var hasKeychainToken: Bool {
        var q = base; q[kSecReturnData as String] = false
        return SecItemCopyMatching(q as CFDictionary, nil) == errSecSuccess
    }

    @discardableResult
    static func save(_ token: String) -> Bool {
        let t = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return delete() }
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = Data(t.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly   // não vai pro iCloud
        add[kSecAttrLabel as String] = "Pilinha — token brapi"
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }
    @discardableResult
    static func delete() -> Bool {
        let s = SecItemDelete(base as CFDictionary); return s == errSecSuccess || s == errSecItemNotFound
    }
}
#endif
