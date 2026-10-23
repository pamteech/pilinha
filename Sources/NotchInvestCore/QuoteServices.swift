import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public enum QuoteError: Error { case badResponse(String) }

func fetchData(_ url: URL, headers: [String: String] = [:]) async throws -> Data {
    var req = URLRequest(url: url)
    req.timeoutInterval = 15
    req.setValue("application/json", forHTTPHeaderField: "Accept")
    req.setValue("NotchInvest/0.1", forHTTPHeaderField: "User-Agent")
    for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
    #if canImport(FoundationNetworking)
    return try await withCheckedThrowingContinuation { cont in
        URLSession.shared.dataTask(with: req) { data, _, err in
            if let err { cont.resume(throwing: err) } else { cont.resume(returning: data ?? Data()) }
        }.resume()
    }
    #else
    let (data, _) = try await URLSession.shared.data(for: req)
    return data
    #endif
}

/// Banco Central — SGS série 12 (CDI diário, % a.d.). Sem chave.
public struct BCBService: Sendable {
    public init() {}
    struct Row: Decodable { let data: String; let valor: String }

    public func cdiRates(from start: Date, to end: Date = Date()) async throws -> [CDIDailyRate] {
        // A API limita consultas a janelas de 10 anos.
        let f = DateParsing.br
        let data = try await fetchData(Self.url(from: start, to: end))
        return try Self.parse(data)
    }

    /// Só datas: nenhum valor da carteira vai na requisição.
    public static func url(from start: Date, to end: Date) -> URL {
        let f = DateParsing.br
        return URL(string: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=\(f.string(from: start))&dataFinal=\(f.string(from: end))")!
    }

    public static func parse(_ data: Data) throws -> [CDIDailyRate] {
        try JSONDecoder().decode([Row].self, from: data).compactMap { r in
            guard let d = DateParsing.br.date(from: r.data), let v = Double(r.valor) else { return nil }
            return CDIDailyRate(date: d, percent: v)
        }
    }
}

/// brapi.dev — ações/FIIs da B3. Token opcional (env BRAPI_TOKEN); alguns tickers
/// funcionam sem token no plano gratuito. Nunca versionar o token.
public struct BrapiService: Sendable {
    public var token: String?
    public init(token: String? = ProcessInfo.processInfo.environment["BRAPI_TOKEN"]) { self.token = token }

    struct Resp: Decodable { let results: [R] }
    struct ErrResp: Decodable { let error: Bool?; let message: String? }
    struct R: Decodable { let symbol: String; let regularMarketPrice: Double?; let regularMarketChangePercent: Double? }

    /// Só o ticker público (ex. PETR4); quantidade e preço médio nunca saem do Mac.
    public static func url(_ ticker: String) -> URL {
        let t = ticker.uppercased().filter { $0.isLetter || $0.isNumber }
        return URL(string: "https://brapi.dev/api/quote/\(t)")!
    }

    public func quote(_ ticker: String) async throws -> (price: Double, changePct: Double?) {
        var headers: [String: String] = [:]
        if let token, !token.isEmpty { headers["Authorization"] = "Bearer \(token)" }
        let data = try await fetchData(Self.url(ticker), headers: headers)
        if let e = try? JSONDecoder().decode(ErrResp.self, from: data), e.error == true {
            throw QuoteError.badResponse("\(ticker): \(e.message ?? "erro brapi") (defina BRAPI_TOKEN)")
        }
        let r = try JSONDecoder().decode(Resp.self, from: data)
        guard let q = r.results.first, let p = q.regularMarketPrice else { throw QuoteError.badResponse(ticker) }
        return (p, q.regularMarketChangePercent)
    }
}

/// CoinGecko — preço em BRL, sem chave (rate limit baixo: ~1 req/min por segurança).
public struct CoinGeckoService: Sendable {
    public init() {}
    /// Só ids públicos de moedas (ex. bitcoin).
    public static func url(_ ids: [String]) -> URL {
        let clean = ids.map { $0.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "-" } }
        return URL(string: "https://api.coingecko.com/api/v3/simple/price?ids=\(clean.joined(separator: ","))&vs_currencies=brl&include_24hr_change=true")!
    }

    public func pricesBRL(_ ids: [String]) async throws -> [String: (price: Double, change24h: Double?)] {
        let data = try await fetchData(Self.url(ids))
        let obj = try JSONDecoder().decode([String: [String: Double?]].self, from: data)
        var out: [String: (price: Double, change24h: Double?)] = [:]
        for (k, v) in obj { if let p = v["brl"] ?? nil { out[k] = (p, v["brl_24h_change"] ?? nil) } }
        return out
    }
}
