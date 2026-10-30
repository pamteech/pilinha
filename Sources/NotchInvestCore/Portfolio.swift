import Foundation

/// Carteira configurada via JSON local (~/.notchinvest/portfolio.json).
public struct Portfolio: Codable, Sendable {
    public var owner: String?
    public var fixedIncome: [FixedIncomeAsset]
    public var stocks: [StockPosition]
    public var crypto: [CryptoPosition]
    /// Opcional: aba Gráficos (TradingView).
    public var tradingview: TradingViewConfig?
    /// Proventos lançados à mão (fallback quando a brapi não informa).
    public var manualDividends: [ManualDividend]?
    /// Opcional: dólares guardados (conta global, espécie). Carteiras antigas não têm.
    public var usd: USDPosition?

    public init(owner: String? = nil, fixedIncome: [FixedIncomeAsset] = [], stocks: [StockPosition] = [], crypto: [CryptoPosition] = [],
                tradingview: TradingViewConfig? = nil, manualDividends: [ManualDividend]? = nil) {
        self.manualDividends = manualDividends
        self.owner = owner; self.fixedIncome = fixedIncome; self.stocks = stocks; self.crypto = crypto; self.tradingview = tradingview
    }

    public static func load(from url: URL) throws -> Portfolio {
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(Portfolio.self, from: data)
    }

    public static var defaultURL: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".notchinvest/portfolio.json")
    }
}

public enum FixedIncomeKind: String, Codable, Sendable { case caixinha, cdb, tesouro, lci, lca
    public var label: String {
        switch self { case .caixinha: return "Caixinha"; case .cdb: return "CDB"; case .tesouro: return "Tesouro"; case .lci: return "LCI"; case .lca: return "LCA" }
    }
}

/// Indexador da renda fixa. JSON antigo não tem o campo: vale CDI.
public enum FixedIncomeIndexer: String, Codable, Sendable, CaseIterable { case cdi, ipca
    public var label: String { self == .cdi ? "% do CDI" : "IPCA+" }
}

/// Renda fixa pós-fixada: aplicações (data + valor) rendendo X% do CDI,
/// ou IPCA + taxa real (Tesouro IPCA+), calculada na curva da taxa contratada.
public struct FixedIncomeAsset: Codable, Sendable, Identifiable {
    public var id: String { name }
    public var name: String
    public var kind: FixedIncomeKind
    public var cdiPercent: Double          // ex. 100 = 100% do CDI
    public var deposits: [Deposit]
    public var taxExempt: Bool?            // LCI/LCA = true (sem IR/IOF)
    public var indexer: FixedIncomeIndexer? // nil = cdi
    public var realRate: Double?           // IPCA+: taxa real % a.a. (ex. 7,5)
    public var maturity: String?           // "yyyy-MM-dd", opcional
    public init(name: String, kind: FixedIncomeKind, cdiPercent: Double, deposits: [Deposit], taxExempt: Bool? = nil,
                indexer: FixedIncomeIndexer? = nil, realRate: Double? = nil, maturity: String? = nil) {
        self.name = name; self.kind = kind; self.cdiPercent = cdiPercent; self.deposits = deposits; self.taxExempt = taxExempt
        self.indexer = indexer; self.realRate = realRate; self.maturity = maturity
    }
    public var effectiveIndexer: FixedIncomeIndexer { indexer ?? .cdi }
    /// LCI/LCA são isentas por padrão; o campo explícito vence.
    public var isTaxExempt: Bool { taxExempt ?? (kind == .lci || kind == .lca) }
}

public struct Deposit: Codable, Sendable {
    public var date: String                // "yyyy-MM-dd"
    public var amount: Double
    public init(date: String, amount: Double) { self.date = date; self.amount = amount }
}

public struct StockPosition: Codable, Sendable, Identifiable {
    public var id: String { ticker }
    public var ticker: String              // PETR4, MXRF11...
    public var quantity: Double
    public var averagePrice: Double?
    public init(ticker: String, quantity: Double, averagePrice: Double? = nil) {
        self.ticker = ticker; self.quantity = quantity; self.averagePrice = averagePrice
    }
}

public struct CryptoPosition: Codable, Sendable, Identifiable {
    public var id: String { coinId }
    public var coinId: String              // id CoinGecko, ex. "bitcoin"
    public var symbol: String
    public var quantity: Double
    public var averagePriceBRL: Double?
    public init(coinId: String, symbol: String, quantity: Double, averagePriceBRL: Double? = nil) {
        self.coinId = coinId; self.symbol = symbol; self.quantity = quantity; self.averagePriceBRL = averagePriceBRL
    }
}

/// Dólares em mãos: quantidade em US$ e, se quiser, a cotação média paga (R$ por US$).
public struct USDPosition: Codable, Sendable, Equatable {
    public var amount: Double
    public var averageRateBRL: Double?
    public init(amount: Double, averageRateBRL: Double? = nil) { self.amount = amount; self.averageRateBRL = averageRateBRL }
}

/// Provento recebido, digitado pela dona (valor total em R$, já líquido como cai na conta).
public struct ManualDividend: Codable, Sendable, Equatable {
    public var ticker: String
    public var date: String                // "yyyy-MM-dd"
    public var amount: Double
    public init(ticker: String, date: String, amount: Double) { self.ticker = ticker; self.date = date; self.amount = amount }
}
