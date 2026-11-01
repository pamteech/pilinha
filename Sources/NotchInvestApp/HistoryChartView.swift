#if os(macOS)
import SwiftUI
import Charts
import NotchInvestCore

/// Aba "Evolução": patrimônio dia a dia a partir de ~/.notchinvest/history.json.
/// Modo discreto: o eixo vira ganho em % (nunca mostra R$).
struct HistoryChartView: View {
    @EnvironmentObject var model: PortfolioModel
    @EnvironmentObject var privacy: PrivacyController
    @State private var range: HistoryRange = .mes
    @State private var vsCDI = false
    @State private var rates: [CDIDailyRate]? = nil
    @State private var ratesKey = ""

    var showMoney: Bool { privacy.effective == .valores }

    var body: some View {
        let pts = model.history.points(in: range)
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Picker("", selection: $range) {
                    ForEach(HistoryRange.allCases) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented).labelsHidden().frame(width: 220)
                Toggle(isOn: $vsCDI) { Label("vs CDI", systemImage: "chart.line.uptrend.xyaxis") }
                    .toggleStyle(.button).controlSize(.small).help("Comparar a rentabilidade da carteira com 100% do CDI no mesmo período")
                Spacer()
                if let a = pts.first, let b = pts.last, pts.count > 1 {
                    let d = a.total > 0 ? (b.total / a.total - 1) * 100 : 0
                    Text(String(format: "%+.2f%% no período", d)).font(.caption.bold()).foregroundStyle(d >= 0 ? .green : .red)
                }
            }
            if pts.count < 2 {
                Spacer()
                HStack { Spacer()
                    VStack(spacing: 6) {
                        CofrinhoView(mood: .dormindo, size: 56) {}
                        Text(pts.isEmpty ? "Ainda sem histórico." : "Só 1 dia salvo até agora.").font(.callout)
                        Text("O porquinho guarda um ponto por dia, só neste Mac.\nVolte amanhã para ver a curva.")
                            .font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    }
                    Spacer() }
                Spacer()
            } else if vsCDI {
                CDICompareChart(points: pts, rates: rates)
                    .task(id: "\(pts.first?.day ?? "")|\(pts.last?.day ?? "")") { await loadRates(pts) }
            } else {
                Chart(pts) { p in
                    let y = showMoney ? p.total : p.gainPct
                    AreaMark(x: .value("Dia", p.date), y: .value(showMoney ? "R$" : "%", y))
                        .foregroundStyle(.linearGradient(colors: [.pink.opacity(0.45), .clear], startPoint: .top, endPoint: .bottom))
                        .interpolationMethod(.monotone)
                    LineMark(x: .value("Dia", p.date), y: .value(showMoney ? "R$" : "%", y), series: .value("s", "total"))
                        .foregroundStyle(.pink).interpolationMethod(.monotone)
                    if showMoney {
                        LineMark(x: .value("Dia", p.date), y: .value("Investido", p.invested), series: .value("s", "investido"))
                            .foregroundStyle(.white.opacity(0.35)).lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    }
                }
                .chartYScale(domain: .automatic(includesZero: false))
                .chartYAxis {
                    AxisMarks(position: .trailing) { v in
                        AxisGridLine().foregroundStyle(.white.opacity(0.1))
                        AxisValueLabel {
                            if let d = v.as(Double.self) {
                                Text(showMoney ? BRL.format(d) : String(format: "%+.1f%%", d)).font(.system(size: 9))
                            }
                        }
                    }
                }
                .chartXAxis { AxisMarks(values: .automatic(desiredCount: 5)) { _ in AxisValueLabel(format: .dateTime.day().month(.abbreviated)) } }
                Text(showMoney ? "Linha tracejada = quanto foi aplicado." : "Modo discreto: mostrando ganho em % sobre o aplicado.")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(.white)
    }

    func loadRates(_ pts: [HistoryPoint]) async {
        guard let a = pts.first, let b = pts.last else { return }
        let k = a.day + b.day; if k == ratesKey, rates != nil { return }
        rates = nil; ratesKey = k
        rates = (try? await BCBService().cdiRates(from: a.date, to: b.date)) ?? []
    }
}

/// Rentabilidade acumulada da carteira (descontando aportes) contra 100% do CDI.
struct CDICompareChart: View {
    let points: [HistoryPoint]
    let rates: [CDIDailyRate]?
    var body: some View {
        if let rates {
            let b = Benchmark.series(points, rates: rates)
            if rates.isEmpty && points.count > 1 {
                Text("Não deu para buscar o CDI agora. Tente de novo mais tarde.").font(.caption).foregroundStyle(.secondary)
            }
            Chart {
                ForEach(b) { p in
                    LineMark(x: .value("Dia", p.date), y: .value("%", p.carteira), series: .value("s", "Carteira"))
                        .foregroundStyle(.pink).interpolationMethod(.monotone)
                    LineMark(x: .value("Dia", p.date), y: .value("%", p.cdi), series: .value("s", "CDI"))
                        .foregroundStyle(Color(red: 0.71, green: 0.55, blue: 0.78)).lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                }
            }
            .chartYAxis { AxisMarks(position: .trailing) { v in AxisGridLine().foregroundStyle(.white.opacity(0.1))
                AxisValueLabel { if let d = v.as(Double.self) { Text(String(format: "%+.1f%%", d)).font(.system(size: 9)) } } } }
            .chartXAxis { AxisMarks(values: .automatic(desiredCount: 5)) { _ in AxisValueLabel(format: .dateTime.day().month(.abbreviated)) } }
            if let l = b.last {
                let diff = l.carteira - l.cdi
                HStack(spacing: 10) {
                    Label("Carteira " + pctBR(l.carteira), systemImage: "circle.fill").foregroundStyle(.pink)
                    Label("CDI " + pctBR(l.cdi), systemImage: "circle.dashed").foregroundStyle(Color(red: 0.71, green: 0.55, blue: 0.78))
                    Text(diff >= 0 ? "ganhando do CDI" : "perdendo do CDI").foregroundStyle(diff >= 0 ? .green : .red)
                }.font(.caption2)
            }
        } else {
            HStack { ProgressView().controlSize(.small); Text("Buscando o CDI…").font(.caption).foregroundStyle(.secondary) }
        }
    }
}
#endif
