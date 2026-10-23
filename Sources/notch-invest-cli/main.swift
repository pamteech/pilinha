import Foundation
import NotchInvestCore

// Uso: notch-invest-cli [caminho/portfolio.json]
let path = CommandLine.arguments.dropFirst().first.map { URL(fileURLWithPath: $0) } ?? Portfolio.defaultURL
do {
    let p = try Portfolio.load(from: path)
    let s = await PortfolioEngine().snapshot(p)
    if let c = s.cdiAnnual { print(String(format: "CDI atual: %.2f%% a.a.", c)) }
    for i in s.items {
        let g = i.gainPct.map { String(format: " (%+.2f%%)", $0) } ?? ""
        print("[\(i.category)] \(i.name): \(BRL.format(i.current))\(g)")
    }
    if let d = s.dayChangePct { print(String(format: "Hoje: %+.3f%%", d)) }
    print("Humor do cofrinho: \(CofrinhoMood.from(dayChangePct: s.dayChangePct, loading: false, hasError: s.items.isEmpty && !s.errors.isEmpty).rawValue)")
    print("TOTAL: \(BRL.format(s.total))  investido: \(BRL.format(s.totalInvested))")
    s.errors.forEach { print("erro: \($0)") }
} catch {
    print("Falha ao ler \(path.path): \(error)"); exit(1)
}
