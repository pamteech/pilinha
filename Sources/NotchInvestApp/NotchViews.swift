#if os(macOS)
import SwiftUI
import NotchInvestCore

struct NotchRootView: View {
    @EnvironmentObject var model: PortfolioModel
    let notchWidth: CGFloat
    let notchHeight: CGFloat
    @State private var hovering = false

    var body: some View {
        ZStack(alignment: .top) {
            // Margem transparente em volta da ilha: clique aqui conta como "fora" e fecha.
            Color.clear
                .contentShape(Rectangle())
                .onTapGesture { if model.expanded { model.requestExpand(false) } }
            island
                .scaleEffect(hovering && !model.expanded ? 1.03 : 1, anchor: .top)
                .shadow(color: .purple.opacity(hovering && !model.expanded ? 0.55 : 0), radius: 6)
                .onHover { h in withAnimation(.easeOut(duration: 0.15)) { hovering = h } }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    var island: some View {
        let closed = IslandSize.closed(notchWidth: notchWidth, notchHeight: notchHeight)
        let size = model.expanded ? model.openSize : closed
        return ZStack(alignment: .top) {
            UnevenRoundedRectangle(bottomLeadingRadius: model.expanded ? 24 : 10,
                                   bottomTrailingRadius: model.expanded ? 24 : 10)
                .fill(.black)
                .overlay(
                    UnevenRoundedRectangle(bottomLeadingRadius: model.expanded ? 24 : 10,
                                           bottomTrailingRadius: model.expanded ? 24 : 10)
                        .stroke(Color.white.opacity(hovering && !model.expanded ? 0.18 : 0), lineWidth: 1)
                )
            if model.expanded {
                VStack(spacing: 8) {
                    // Faixa do entalhe: clicar nela fecha a ilha. O conteúdo abaixo (lista, gráfico)
                    // não tem gesto de fechar, então clicar/arrastar no gráfico nunca fecha.
                    Color.black.frame(height: notchHeight).contentShape(Rectangle())
                        .onTapGesture { model.requestExpand(false) }
                    IslandTabBar()
                    switch model.tab {
                    case .carteira: ExpandedView()
                    case .evolucao: HistoryChartView()
                    case .graficos: ChartsView()
                    }
                }
                .padding(.horizontal, model.tab == .graficos ? 10 : 18).padding(.bottom, 12)
            } else {
                CompactView(notchWidth: notchWidth).frame(height: notchHeight)
                    .contentShape(Rectangle())
                    .onTapGesture { model.requestExpand(true) }     // fechada: clique em qualquer ponto abre
            }
        }
        .frame(width: size.width, height: size.height)
        .clipped()
    }
}

/// Faixa compacta: total à esquerda do entalhe, variação à direita.
struct CompactView: View {
    @EnvironmentObject var model: PortfolioModel
    @EnvironmentObject var privacy: PrivacyController
    let notchWidth: CGFloat
    var body: some View {
        HStack(spacing: 0) {
            HStack(spacing: 4) {
                CofrinhoView(mood: model.mood, size: 28) { model.celebrating = false }
                // Modo discreto: lado esquerdo não mostra o total (só o porquinho); a % fica à direita.
                Text(model.snapshot.map { privacy.mode.compactLeft(total: $0.total, unlocked: privacy.unlocked) ?? "" } ?? "…")
                    .font(.system(size: 11, weight: .semibold, design: .rounded)).foregroundStyle(.white)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            Color.clear.frame(width: notchWidth)
            Text(gainText).font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(gain >= 0 ? .green : .red).frame(maxWidth: .infinity)
        }
    }
    // Lado direito: variação do dia (o humor do cofrinho segue o mesmo número).
    var gain: Double { model.snapshot?.dayChangePct ?? 0 }
    var gainText: String {
        guard let d = model.snapshot?.dayChangePct else { return "" }
        return String(format: "%+.2f%%", d)
    }
}

struct ExpandedView: View {
    @EnvironmentObject var model: PortfolioModel
    @EnvironmentObject var privacy: PrivacyController
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let err = model.loadError {
                HStack { Text(err).foregroundStyle(.orange)
                    Button("Cadastrar") { model.onShowEditor?() }.buttonStyle(.link)
                    Spacer(); RefreshButton() }
            } else if model.snapshot == nil {
                HStack { Text("Carregando…").foregroundStyle(.secondary); Spacer(); RefreshButton() }
            }
            if let s = model.snapshot {
                HStack(alignment: .center, spacing: 10) {
                    CofrinhoView(mood: model.mood, size: 72) { model.celebrating = false }
                    VStack(alignment: .leading, spacing: 2) {
                        if let t = privacy.mode.money(s.total, unlocked: privacy.unlocked) {
                            Text(t).font(.title3.bold())
                        } else {
                            Text(String(format: "%+.2f%% no total", s.totalGainPct)).font(.title3.bold())
                        }
                        if privacy.needsAuth {
                            Button("Mostrar com Touch ID") { privacy.authenticate() }.buttonStyle(.link).font(.caption)
                        }
                        if let d = s.dayChangePct {
                            Text(String(format: "hoje %+.2f%%", d)).font(.caption)
                                .foregroundStyle(d >= 0 ? .green : .red)
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 4) {
                        HStack(spacing: 6) {
                            PrivacyButton()
                            Button { model.onShowEditor?() } label: {
                                Image(systemName: "pencil").font(.system(size: 11, weight: .semibold))
                                    .frame(width: 22, height: 22).background(Circle().fill(Color.white.opacity(0.12)))
                            }.buttonStyle(.plain).help("Cadastrar carteira").accessibilityLabel("Cadastrar carteira")
                            Button { model.onShowPrivacyInfo?() } label: {
                                Image(systemName: "info.circle").font(.system(size: 11, weight: .semibold))
                                    .frame(width: 22, height: 22).background(Circle().fill(Color.white.opacity(0.12)))
                            }.buttonStyle(.plain).help("O que este app faz").accessibilityLabel("O que este app faz")
                            RefreshButton()
                        }
                        if let c = s.cdiAnnual { Text(String(format: "CDI %.2f%% a.a.", c)).foregroundStyle(.secondary) }
                    }
                }
                NetSummaryRow(snapshot: s)
                ScrollView(showsIndicators: true) {
                    ForEach(s.items) { i in
                        HStack {
                            Text(i.category.uppercased()).font(.caption2).foregroundStyle(.secondary).frame(width: 60, alignment: .leading)
                            Text(i.name)
                            Spacer()
                            if let v = privacy.mode.money(i.current, unlocked: privacy.unlocked) { Text(v).monospacedDigit() }
                            if let px = i.unitPrice {
                                // Ações/FIIs/cripto: cotação do momento + preço médio (no lugar da %).
                                VStack(alignment: .trailing, spacing: 0) {
                                    Text(BRL.format(px)).monospacedDigit()
                                        .foregroundStyle(i.averagePrice.map { px >= $0 ? Color.green : Color.red } ?? Color.white)
                                    if let pm = i.averagePrice, let t = privacy.mode.money(pm, unlocked: privacy.unlocked) {
                                        Text("PM " + t).font(.system(size: 9)).monospacedDigit().foregroundStyle(.secondary)
                                    }
                                }.frame(minWidth: 78, alignment: .trailing)
                            } else if let g = i.gainPct {
                                Text(String(format: "%+.2f%%", g)).monospacedDigit()
                                    .foregroundStyle(g >= 0 ? .green : .red).frame(width: 64, alignment: .trailing)
                            }
                        }.font(.system(size: 12))
                    }
                }
                if !s.errors.isEmpty {
                    Text("⚠️ " + s.errors.joined(separator: " · "))
                        .font(.caption2).foregroundStyle(.orange).lineLimit(3)
                        .textSelection(.enabled)
                }
                Text("Atualizado \(s.updatedAt.formatted(date: .omitted, time: .shortened))")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(.white)
    }
}
/// Bruto × líquido (IR/IOF da renda fixa) e proventos dos últimos 12 meses.
struct NetSummaryRow: View {
    @EnvironmentObject var privacy: PrivacyController
    let snapshot: Snapshot
    var body: some View {
        let s = snapshot, u = privacy.unlocked
        HStack(spacing: 10) {
            if s.totalTaxes > 0.005 {
                if let net = privacy.mode.money(s.totalNet, unlocked: u) {
                    Label("Líquido \(net)", systemImage: "banknote").help("Se resgatar hoje: bruto menos IR regressivo e IOF da renda fixa")
                } else {
                    let pct = s.totalInvested > 0 ? (s.totalNet / s.totalInvested - 1) * 100 : 0
                    Label(String(format: "Líquido %+.2f%%", pct), systemImage: "banknote")
                }
                if let tx = privacy.mode.money(s.totalTaxes, unlocked: u) { Text("IR/IOF \(tx)").foregroundStyle(.secondary) }
            }
            if s.dividends.last12m > 0 {
                Label(privacy.mode.money(s.dividends.last12m, unlocked: u).map { "Proventos 12m \($0)" } ?? "Proventos 12m ✓",
                      systemImage: "leaf").help("FIIs/ações: brapi (estimativa com a quantidade atual) ou lançamentos manuais")
            }
            Spacer()
        }
        .font(.caption).foregroundStyle(.white.opacity(0.85)).labelStyle(.titleAndIcon)
    }
}

/// Abas da ilha aberta.
struct IslandTabBar: View {
    @EnvironmentObject var model: PortfolioModel
    var body: some View {
        HStack(spacing: 4) {
            ForEach(IslandTab.allCases) { t in
                Button { model.requestTab(t) } label: {
                    Text(t.rawValue).font(.system(size: 11, weight: .semibold))
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(Capsule().fill(model.tab == t ? Color.white.opacity(0.18) : .clear))
                        .foregroundStyle(model.tab == t ? .white : .secondary)
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }
}

/// Botão pequeno de atualizar (além do automático a cada 5 min).
struct RefreshButton: View {
    @EnvironmentObject var model: PortfolioModel
    var body: some View {
        Button {
            Task { await model.refresh() }
        } label: {
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 11, weight: .semibold))
                .rotationEffect(.degrees(model.loading ? 360 : 0))
                .animation(model.loading ? .linear(duration: 0.8).repeatForever(autoreverses: false) : .default, value: model.loading)
                .frame(width: 22, height: 22)
                .background(Circle().fill(Color.white.opacity(0.12)))
        }
        .buttonStyle(.plain)
        .foregroundStyle(.white)
        .disabled(model.loading)
        .help("Atualizar agora")
        .accessibilityLabel("Atualizar")
    }
}
#endif
