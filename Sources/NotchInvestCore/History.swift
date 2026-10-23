import Foundation

/// Um ponto por dia do patrimônio, guardado só no Mac (~/.notchinvest/history.json, 600).
public struct HistoryPoint: Codable, Sendable, Equatable, Identifiable {
    public var id: String { day }
    public var day: String          // "yyyy-MM-dd" (horário de Brasília)
    public var total: Double
    public var invested: Double
    public var net: Double?
    public init(day: String, total: Double, invested: Double, net: Double? = nil) {
        self.day = day; self.total = total; self.invested = invested; self.net = net
    }
    public var date: Date { DateParsing.iso.date(from: day) ?? .distantPast }
    /// Ganho em % sobre o investido (o gráfico usa isso no modo discreto).
    public var gainPct: Double { invested > 0 ? (total / invested - 1) * 100 : 0 }
}

public enum HistoryRange: String, CaseIterable, Sendable, Identifiable {
    case dia = "Dia", semana = "Semana", mes = "Mês", tudo = "Tudo"
    public var id: String { rawValue }
    /// Dia = últimos 2 pontos (ontem → hoje), para ver a variação.
    var days: Int? { switch self { case .dia: return 1; case .semana: return 7; case .mes: return 30; case .tudo: return nil } }
}

public struct History: Codable, Sendable, Equatable {
    public var points: [HistoryPoint]
    public init(points: [HistoryPoint] = []) { self.points = points }

    public static var defaultURL: URL { LocalData.folder.appendingPathComponent("history.json") }

    /// Grava/atualiza o ponto do dia (o último refresh do dia vence). Ignora carteiras vazias.
    public mutating func record(total: Double, invested: Double, net: Double?, at now: Date = Date()) {
        guard total > 0 else { return }
        let day = DateParsing.iso.string(from: now)
        let p = HistoryPoint(day: day, total: total, invested: invested, net: net)
        if let i = points.firstIndex(where: { $0.day == day }) { points[i] = p } else { points.append(p) }
        points.sort { $0.day < $1.day }
    }

    public func points(in range: HistoryRange, now: Date = Date()) -> [HistoryPoint] {
        guard let n = range.days else { return points }
        let cut = DateParsing.iso.string(from: now.addingTimeInterval(-Double(n) * 86_400))
        return points.filter { $0.day >= cut }
    }

    public static func load(from url: URL = defaultURL) -> History {
        guard let d = try? Data(contentsOf: url), let h = try? JSONDecoder().decode(History.self, from: d) else { return History() }
        return h
    }
    public func save(to url: URL = History.defaultURL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true,
                                                attributes: [.posixPermissions: 0o700])
        let enc = JSONEncoder(); enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        try enc.encode(self).write(to: url, options: .atomic)
        try LocalData.restrict(url)
    }
}
