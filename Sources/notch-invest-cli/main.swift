import Foundation
import NotchInvestCore

// Uso: notch-invest-cli [caminho/portfolio.json]
if let a = CommandLine.arguments.dropFirst().first, ["-h", "--help", "help"].contains(a) {
    print("""
    Pilinha 🐷 — conferir a carteira no terminal (mesmos cálculos do app de entalhe)

    Uso: notch-invest-cli [caminho/portfolio.json]
      sem argumento, lê \(Portfolio.defaultURL.path)
      -h, --help   mostra esta ajuda
    """)
    exit(0)
}
let path = CommandLine.arguments.dropFirst().first.map { URL(fileURLWithPath: $0) } ?? Portfolio.defaultURL
do {
    let p = try Portfolio.load(from: path)
    let s = await PortfolioEngine().snapshot(p)
    if let c = s.cdiAnnual { print(String(format: "CDI atual: %.2f%% a.a.", c)) }
    for i in s.items {
        let g = i.gainPct.map { String(format: " (%+.2f%%)", $0) } ?? ""
        let n = i.net.map { " líquido \(BRL.format($0))" } ?? ""
        let dp = i.dayPct.map { " hoje \(pctBR($0))" } ?? ""
        print("[\(i.category)] \(i.name): \(BRL.format(i.current))\(g)\(n)\(dp)")
    }
    for gr in PortfolioGroups.group(s.items) { print("grupo \(gr.title): hoje \(gr.dayPct.map(pctBR) ?? "–")") }
    if let d = s.dayChangePct { print(String(format: "Hoje: %+.3f%%", d)) }
    print("Humor do cofrinho: \(CofrinhoMood.from(dayChangePct: s.dayChangePct, loading: false, hasError: s.items.isEmpty && !s.errors.isEmpty).rawValue)")
    print("TOTAL: \(BRL.format(s.total))  investido: \(BRL.format(s.totalInvested))")
    print("LÍQUIDO (sem IR/IOF da renda fixa): \(BRL.format(s.totalNet))  impostos: \(BRL.format(s.totalTaxes))")
    if s.dividends.last12m > 0 { print("Proventos 12 meses (estimativa): \(BRL.format(s.dividends.last12m))") }
    s.errors.forEach { print("erro: \($0)") }
} catch {
    print("Falha ao ler \(path.path): \(error)"); exit(1)
}
