import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public enum QuoteError: Error { case badResponse(String) }

func fetchData(_ url: URL, headers: [String: String] = [:]) async throws -> Data {
    var req = URLRequest(url: url)
    req.timeoutInterval = 15
    req.setValue("application/json", forHTTPHeaderField: "Accept")
    req.setValue("Pilinha/0.2", forHTTPHeaderField: "User-Agent")
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

/// brapi.dev — ações/FIIs da B3 + proventos. Token opcional (env BRAPI_TOKEN); sem token
/// o app usa o Yahoo Finance para cotação. Nunca versionar o token.
public struct BrapiService: Sendable {
    public var token: String?
    public init(token: String? = ProcessInfo.processInfo.environment["BRAPI_TOKEN"]) { self.token = token }

    struct Resp: Decodable { let results: [R] }
    struct ErrResp: Decodable { let error: Bool?; let message: String? }
    struct R: Decodable { let symbol: String; let regularMarketPrice: Double?; let regularMarketChangePercent: Double? }

    /// Só o ticker público (ex. PETR4); quantidade e preço médio nunca saem do Mac.
    /// `dividends: true` pede também o histórico de proventos (parâmetro fixo, nada da carteira).
    public static func url(_ ticker: String, dividends: Bool = false) -> URL {
        let t = ticker.uppercased().filter { $0.isLetter || $0.isNumber }
        return URL(string: "https://brapi.dev/api/quote/\(t)" + (dividends ? "?dividends=true" : ""))!
    }

    public func quote(_ ticker: String) async throws -> (price: Double, changePct: Double?) {
        let r = try await quoteWithDividends(ticker, dividends: false); return (r.price, r.changePct)
    }

    /// O token vai só no cabeçalho Authorization (nunca na URL, nunca em log).
    public func quoteWithDividends(_ ticker: String, dividends: Bool = true) async throws -> (price: Double, changePct: Double?, dividends: [CashDividend]) {
        var headers: [String: String] = [:]
        if let token, !token.isEmpty { headers["Authorization"] = "Bearer \(token)" }
        let data = try await fetchData(Self.url(ticker, dividends: dividends), headers: headers)
        if let e = try? JSONDecoder().decode(ErrResp.self, from: data), e.error == true {
            throw QuoteError.badResponse("\(ticker): \(e.message ?? "erro brapi") (cadastre o token da brapi)")
        }
        let r = try JSONDecoder().decode(Resp.self, from: data)
        guard let q = r.results.first, let p = q.regularMarketPrice else { throw QuoteError.badResponse(ticker) }
        return (p, q.regularMarketChangePercent, dividends ? ((try? Dividends.parseBrapi(data)) ?? []) : [])
    }
}

/// Yahoo Finance (chart v8) — fonte reserva sem token para ações/FIIs/ETFs da B3.
/// Só o ticker público vai na URL (ex. BBAS3.SA); nada da carteira.
public struct YahooFinanceService: Sendable {
    public init() {}
    static let browserUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

    public static func url(_ ticker: String) -> URL {
        let t = ticker.uppercased().filter { $0.isLetter || $0.isNumber }
        return URL(string: "https://query1.finance.yahoo.com/v8/finance/chart/\(t).SA?range=1d&interval=1d")!
    }

    struct Resp: Decodable { let chart: Chart }
    struct Chart: Decodable { let result: [Result]?; let error: Err? }
    struct Err: Decodable { let code: String?; let description: String? }
    struct Result: Decodable { let meta: Meta }
    struct Meta: Decodable { let regularMarketPrice: Double?; let chartPreviousClose: Double?; let previousClose: Double? }

    /// preço = meta.regularMarketPrice; variação = vs. chartPreviousClose (ou previousClose).
    public static func parse(_ data: Data, ticker: String) throws -> (price: Double, changePct: Double?) {
        guard let r = try? JSONDecoder().decode(Resp.self, from: data) else {
            let txt = String(data: data.prefix(80), encoding: .utf8) ?? ""
            throw QuoteError.badResponse("\(ticker): resposta inválida do Yahoo (\(txt))")
        }
        if let e = r.chart.error { throw QuoteError.badResponse("\(ticker): \(e.description ?? e.code ?? "erro Yahoo")") }
        guard let m = r.chart.result?.first?.meta, let p = m.regularMarketPrice else {
            throw QuoteError.badResponse("\(ticker): Yahoo sem preço")
        }
        let prev = m.chartPreviousClose ?? m.previousClose
        return (p, prev.flatMap { $0 > 0 ? (p / $0 - 1) * 100 : nil })
    }

    public func quote(_ ticker: String) async throws -> (price: Double, changePct: Double?) {
        let data = try await fetchData(Self.url(ticker), headers: ["User-Agent": Self.browserUA])
        return try Self.parse(data, ticker: ticker)
    }
}

/// Cotação de ações/FIIs: com token → brapi (com proventos), caindo no Yahoo em erro;
/// sem token → Yahoo direto (sem proventos automáticos; só os manuais).
public struct StockQuoteProvider: Sendable {
    public typealias Quote = (price: Double, changePct: Double?, dividends: [CashDividend], source: String)
    public let hasToken: Bool
    let brapi: @Sendable (String) async throws -> (price: Double, changePct: Double?, dividends: [CashDividend])
    let yahoo: @Sendable (String) async throws -> (price: Double, changePct: Double?)

    public init(brapiToken: String?) {
        let b = BrapiService(token: brapiToken), y = YahooFinanceService()
        self.init(hasToken: !(brapiToken ?? "").isEmpty,
                  brapi: { try await b.quoteWithDividends($0) }, yahoo: { try await y.quote($0) })
    }

    public init(hasToken: Bool,
                brapi: @escaping @Sendable (String) async throws -> (price: Double, changePct: Double?, dividends: [CashDividend]),
                yahoo: @escaping @Sendable (String) async throws -> (price: Double, changePct: Double?)) {
        self.hasToken = hasToken; self.brapi = brapi; self.yahoo = yahoo
    }

    public func quote(_ ticker: String) async throws -> Quote {
        var brapiErr: Error?
        if hasToken {
            do { let q = try await brapi(ticker); return (q.price, q.changePct, q.dividends, "brapi") }
            catch { brapiErr = error }
        }
        do { let q = try await yahoo(ticker); return (q.price, q.changePct, [], "yahoo") }
        catch {
            if let brapiErr {
                throw QuoteError.badResponse("\(ticker): sem cotação (brapi: \(brapiErr); Yahoo: \(error))")
            }
            throw QuoteError.badResponse("\(ticker): sem cotação no Yahoo Finance (\(error)). Confira o código ou cadastre o token da brapi.")
        }
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
