import Foundation

/// Humores do personagem (cofrinho). Os nomes batem com os sprite sheets
/// `porco2d_<humor>.png` (128px/quadro) e `porco2d_<humor>@2x.png` (256px/quadro),
/// em Resources/Cofrinho do app (personagem 2D, opção B).
public enum CofrinhoMood: String, CaseIterable, Sendable {
    case feliz, neutro, triste, dormindo, erro, ganhou

    /// Quantidade de quadros de cada folha (24 fps).
    public var frameCount: Int {
        switch self {
        case .feliz, .erro: return 24
        case .neutro, .triste, .dormindo: return 48
        case .ganhou: return 37
        }
    }
    /// `ganhou` é transição: toca uma vez e volta para `feliz`.
    public var loops: Bool { self != .ganhou }
    /// Prefixo das folhas de sprites no bundle.
    public static let sheetPrefix = "porco2d_"
    /// Nome do recurso (sem extensão) para este humor.
    public func sheetName(retina: Bool) -> String { Self.sheetPrefix + rawValue + (retina ? "@2x" : "") }
    public static let fps: Double = 24
    public static let happyThreshold = 0.05   // % no dia
    public static let sadThreshold = -0.05

    /// Decide o humor. Prioridade: carregando > erro > humor do dia.
    public static func from(dayChangePct: Double?, loading: Bool, hasError: Bool) -> CofrinhoMood {
        if loading { return .dormindo }
        if hasError { return .erro }
        guard let d = dayChangePct else { return .neutro }
        if d > happyThreshold { return .feliz }
        if d < sadThreshold { return .triste }
        return .neutro
    }

    /// Dispara a transição "ganhou dinheiro hoje" quando o total sobe entre duas
    /// atualizações e o dia está positivo.
    public static func shouldCelebrate(previousTotal: Double?, newTotal: Double, dayChangePct: Double?) -> Bool {
        guard let prev = previousTotal, let d = dayChangePct else { return false }
        return newTotal > prev + 0.005 && d > happyThreshold
    }
}
