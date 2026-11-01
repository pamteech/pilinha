import Foundation

/// Modo discreto: como os valores aparecem na ilha.
public enum PrivacyMode: String, Codable, Sendable, CaseIterable {
    case valores        // R$ 12.345,67
    case oculto         // R$ •••••
    case porcentagens   // só % (variação/ganho)

    /// Primeira execução: começa discreto.
    public static let firstRunDefault: PrivacyMode = .porcentagens
    public static let mask = "R$ •••••"

    public var next: PrivacyMode {
        switch self { case .valores: return .oculto; case .oculto: return .porcentagens; case .porcentagens: return .valores }
    }
    public var label: String {
        switch self { case .valores: return "Mostrar valores"; case .oculto: return "Esconder valores (R$ •••••)"; case .porcentagens: return "Só porcentagens" }
    }
    public var isDiscreet: Bool { self != .valores }

    /// Texto de um valor em reais. `nil` = não mostrar nada (modo só %).
    /// `unlocked` = falso quando a trava (Touch ID) está ligada e ainda não autenticou.
    public func money(_ v: Double, unlocked: Bool = true) -> String? {
        switch effective(unlocked: unlocked) {
        case .valores: return BRL.format(v)
        case .oculto: return Self.mask
        case .porcentagens: return nil
        }
    }
    /// Com a trava fechada, "valores" vira "oculto".
    public func effective(unlocked: Bool) -> PrivacyMode { (self == .valores && !unlocked) ? .oculto : self }

    /// Ilha fechada: no modo discreto só a %.
    public func compactLeft(total: Double, unlocked: Bool = true) -> String? {
        effective(unlocked: unlocked) == .valores ? BRL.format(total) : nil
    }

    /// Lê o estado salvo; sem estado salvo = padrão discreto.
    public static func load(_ raw: String?) -> PrivacyMode { raw.flatMap(PrivacyMode.init(rawValue:)) ?? firstRunDefault }
}

/// "Abrir com valores escondidos": cada vez que o painel abre, os R$ começam ocultos; um clique no total/olho revela.
/// Só vale na sessão do painel (não muda o modo salvo). Preferência `hideOnOpen` ligada por padrão.
public struct PrivacyVeil: Sendable, Equatable {
    public var hideOnOpen: Bool
    public private(set) var veiled: Bool
    public init(hideOnOpen: Bool = true) { self.hideOnOpen = hideOnOpen; veiled = hideOnOpen }
    /// Lê a preferência; sem valor salvo = ligada.
    public static func load(_ raw: Any?) -> PrivacyVeil { PrivacyVeil(hideOnOpen: (raw as? Bool) ?? true) }
    public mutating func panelOpened() { veiled = hideOnOpen }
    public mutating func reveal() { veiled = false }
    public mutating func setHideOnOpen(_ on: Bool) { hideOnOpen = on; if !on { veiled = false } }
}

/// Trava opcional (Touch ID/senha do Mac). A autenticação em si é do sistema (LocalAuthentication);
/// aqui só fica a regra de quando os valores voltam a ser escondidos.
public struct PrivacyLock: Sendable, Equatable {
    public var enabled: Bool
    public var relockMinutes: Int
    public private(set) var unlockedAt: Date?

    public init(enabled: Bool = false, relockMinutes: Int = 5, unlockedAt: Date? = nil) {
        self.enabled = enabled; self.relockMinutes = max(1, relockMinutes); self.unlockedAt = unlockedAt
    }
    public static let minuteOptions = [1, 5, 15, 30, 60]

    /// Valores podem aparecer?
    public func isUnlocked(now: Date = Date()) -> Bool {
        guard enabled else { return true }
        guard let t = unlockedAt else { return false }
        return now.timeIntervalSince(t) < Double(relockMinutes) * 60 && now >= t
    }
    public mutating func didAuthenticate(at now: Date = Date()) { unlockedAt = now }
    /// Mac bloqueou / dormiu / tempo acabou.
    public mutating func lock() { unlockedAt = nil }
    /// Quando a trava vai fechar sozinha (para agendar o timer).
    public func relockDate() -> Date? { unlockedAt.map { $0.addingTimeInterval(Double(relockMinutes) * 60) } }
}

/// Arquivo local e permissões.
public enum LocalData {
    public static var folder: URL { Portfolio.defaultURL.deletingLastPathComponent() }

    /// Salva o JSON só para o usuário (rw-------, 600) e a pasta com 700.
    public static func save(_ p: Portfolio, to url: URL = Portfolio.defaultURL) throws {
        let fm = FileManager.default
        try fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true,
                               attributes: [.posixPermissions: 0o700])
        let enc = JSONEncoder(); enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try enc.encode(p)
        try data.write(to: url, options: .atomic)
        try restrict(url)
        if url == Portfolio.defaultURL { mirrorToICloud(data) }
    }

    /// Pasta do iCloud Drive (~/Library/Mobile Documents/com~apple~CloudDocs/Pilinha). Nil se o iCloud Drive estiver desligado.
    public static var iCloudFolder: URL? {
        let drive = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Mobile Documents/com~apple~CloudDocs", isDirectory: true)
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: drive.path, isDirectory: &isDir), isDir.boolValue else { return nil }
        return drive.appendingPathComponent("Pilinha", isDirectory: true)
    }
    public static var iCloudCopyURL: URL? { iCloudFolder?.appendingPathComponent("carteira.json") }

    /// Copia a carteira para o iCloud Drive (o app do iPhone importa de lá). Só grava se mudou; falha em silêncio.
    @discardableResult
    public static func mirrorToICloud(_ data: Data) -> Bool {
        guard let dest = iCloudCopyURL else { return false }
        let fm = FileManager.default
        if let old = try? Data(contentsOf: dest), old == data { return true }
        do {
            try fm.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: dest, options: .atomic)
            try? fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: dest.path)
            return true
        } catch { return false }
    }
    /// Espelha o arquivo atual (cobre edições feitas à mão no portfolio.json).
    @discardableResult
    public static func mirrorCurrentToICloud(from url: URL = Portfolio.defaultURL) -> Bool {
        guard let data = try? Data(contentsOf: url) else { return false }
        return mirrorToICloud(data)
    }
    /// Ajusta um arquivo já existente para 600.
    public static func restrict(_ url: URL = Portfolio.defaultURL) throws {
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }
    public static func permissions(_ url: URL = Portfolio.defaultURL) -> Int? {
        (try? FileManager.default.attributesOfItem(atPath: url.path)[.posixPermissions] as? NSNumber)?.intValue
    }
    /// Apaga a pasta de dados inteira (~/.notchinvest). Só chamar depois de confirmação.
    public static func eraseAll(folder: URL = LocalData.folder) throws {
        if FileManager.default.fileExists(atPath: folder.path) { try FileManager.default.removeItem(at: folder) }
    }
}

/// Lista o que o app consulta na internet para uma carteira — usado na tela de privacidade e nos testes.
public enum NetworkAudit {
    public struct Request: Sendable { public let site: String; public let purpose: String; public let url: URL }

    public static func requests(for p: Portfolio, now: Date = Date()) -> [Request] {
        var out: [Request] = []
        if !p.fixedIncome.isEmpty {
            let start = Calendar(identifier: .gregorian).date(byAdding: .year, value: -1, to: now)!
            out.append(.init(site: "Banco Central (api.bcb.gov.br)", purpose: "taxa do CDI", url: BCBService.url(from: start, to: now)))
        }
        for s in p.stocks {
            out.append(.init(site: "brapi.dev", purpose: "cotação e proventos de \(s.ticker.uppercased())", url: BrapiService.url(s.ticker, dividends: true)))
            out.append(.init(site: "Yahoo Finance", purpose: "cotação de \(s.ticker.uppercased()) (reserva / sem token)", url: YahooFinanceService.url(s.ticker)))
        }
        if !p.crypto.isEmpty {
            out.append(.init(site: "CoinGecko", purpose: "preço do bitcoin/cripto em reais", url: CoinGeckoService.url(p.crypto.map(\.coinId))))
        }
        out.append(.init(site: "AwesomeAPI (economia.awesomeapi.com.br)", purpose: "cotação do dólar", url: USDQuoteService.awesomeURL))
        out.append(.init(site: "Banco Central (olinda.bcb.gov.br)", purpose: "PTAX do dólar (reserva)", url: USDQuoteService.ptaxURL(now: now)))
        return out
    }

    /// Números privados da carteira (valores, quantidades, preços médios) em formas que poderiam vazar numa URL.
    public static func privateTokens(_ p: Portfolio) -> [String] {
        var nums: [Double] = []
        for f in p.fixedIncome { nums += f.deposits.map(\.amount) }
        for m in p.manualDividends ?? [] { nums.append(m.amount) }
        for s in p.stocks { nums.append(s.quantity); if let a = s.averagePrice { nums.append(a) } }
        for c in p.crypto { nums.append(c.quantity); if let a = c.averagePriceBRL { nums.append(a) } }
        var t = Set<String>()
        for n in nums where n != 0 {
            t.insert(String(n)); t.insert(String(format: "%.2f", n))
            if n == n.rounded() { t.insert(String(Int(n))) }
        }
        // números muito curtos (ex. "1") aparecem em datas/qualquer lugar; ignora para não dar falso alarme
        return t.filter { $0.count >= 3 }.sorted()
    }

    /// true se nenhuma URL contém valores/quantidades da carteira nem o nome do dono.
    public static func leaksNothing(_ p: Portfolio, now: Date = Date()) -> Bool {
        let urls = requests(for: p, now: now).map { $0.url.absoluteString.removingPercentEncoding ?? $0.url.absoluteString }
        var tokens = privateTokens(p)
        if let o = p.owner, !o.isEmpty { tokens.append(o) }
        tokens += p.fixedIncome.map(\.name)
        return !urls.contains { u in tokens.contains { u.contains($0) } }
    }
}
