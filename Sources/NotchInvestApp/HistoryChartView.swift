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

    var showMoney: Bool { privacy.effective == .valores }

    var body: some View {
        let pts = model.history.points(in: range)
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Picker("", selection: $range) {
                    ForEach(HistoryRange.allCases) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented).labelsHidden().frame(width: 260)
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
}
#endif
