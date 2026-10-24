import Foundation
import ActivityKit

let pilinhaAppGroup = "group.com.pamtech.pilinha"
let pilinhaWidgetKey = "pilinha.widget"

/// Resumo gravado pelo app (JSON). Quando `hidden` é true, `total` e `dayChange` vêm nulos.
struct PilinhaSummary: Codable {
    var total: Double?
    var dayChange: Double?
    var dayChangePct: Double?
    var mood: String
    var hidden: Bool
    var updatedAt: Double  // segundos desde 1970

    static let placeholder = PilinhaSummary(total: nil, dayChange: nil, dayChangePct: nil, mood: "neutro", hidden: true, updatedAt: 0)

    static func load() -> PilinhaSummary? {
        guard let s = UserDefaults(suiteName: pilinhaAppGroup)?.string(forKey: pilinhaWidgetKey),
              let d = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(PilinhaSummary.self, from: d)
    }
}

/// Mesmo nome e campos do módulo nativo do app (modules/pilinha-activity): o ActivityKit casa pelo tipo.
struct PilinhaActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var mood: String
        var dayChangePct: Double?
        var totalText: String?   // nil no modo discreto
    }
    var title: String
}

enum Fmt {
    static func brl(_ v: Double?) -> String {
        guard let v else { return "R$ ••••" }
        let f = NumberFormatter()
        f.numberStyle = .currency; f.locale = Locale(identifier: "pt_BR")
        return f.string(from: NSNumber(value: v)) ?? "R$ –"
    }
    static func pct(_ v: Double?) -> String {
        guard let v else { return "—" }
        return (v >= 0 ? "+" : "") + String(format: "%.2f", v).replacingOccurrences(of: ".", with: ",") + "%"
    }
    static func pigName(_ mood: String) -> String {
        ["feliz", "neutro", "triste", "dormindo", "erro", "ganhou"].contains(mood) ? "pig_" + mood : "pig_neutro"
    }
}
