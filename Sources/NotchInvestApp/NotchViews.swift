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
                            Button { model.onShowSync?() } label: {
                                Image(systemName: "iphone").font(.system(size: 11, weight: .semibold))
                                    .frame(width: 22, height: 22).background(Circle().fill(Color.white.opacity(0.12)))
                            }.buttonStyle(.plain).help("Conectar ao iPhone…").accessibilityLabel("Conectar ao iPhone")
                            Button { model.onShowPrivacyInfo?() } label: {
                                Image(systemName: "info.circle").font(.system(size: 11, weight: .semibold))
                                    .frame(width: 22, height: 22).background(Circle().fill(Color.white.opacity(0.12)))
                            }.buttonStyle(.plain).help("O que este app faz").accessibilityLabel("O que este app faz")
                            RefreshButton()
                        }
                        if let c = s.cdiAnnual { Text(String(format: "CDI %.2f%% a.a.", c)).foregroundStyle(.secondary) }
                        if let d = s.usdBRL {
                            HStack(spacing: 3) {
                                Image(systemName: "dollarsign.circle").foregroundStyle(Color(red: 0.62, green: 0.45, blue: 0.98))
                                Text("US$ 1 = " + String(format: "R$ %.4f", d).replacingOccurrences(of: ".", with: ","))
                                if let c = s.usdChangePct { Text(String(format: "%+.2f%%", c).replacingOccurrences(of: ".", with: ",")).foregroundStyle(c >= 0 ? .green : .red) }
                            }.foregroundStyle(.secondary).help("Cotação do dólar agora (AwesomeAPI; reserva: PTAX do Banco Central)")
                        }
                    }
                }
                NetSummaryRow(snapshot: s)
                ScrollView(showsIndicators: true) {
                    ForEach(PortfolioGroups.group(s.items)) { g in
                        HStack {
                            if g.key == "dolar" { Image(systemName: "dollarsign.circle").foregroundStyle(Color(red: 0.62, green: 0.45, blue: 0.98)) }
                            Text(g.title.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                            Spacer()
                            if let v = privacy.mode.money(g.total, unlocked: privacy.unlocked) { Text(v).font(.caption2).monospacedDigit().foregroundStyle(.secondary) }
                            if let d = g.dayPct { Text(pctBR(d)).font(.caption2.weight(.semibold)).monospacedDigit().foregroundStyle(d >= 0 ? .green : .red) }
                        }.padding(.top, 4)
                    ForEach(g.items) { i in
                        if i.category == "dolar" {
                            HStack {
                                Text("US$").font(.caption2).foregroundStyle(.secondary).frame(width: 60, alignment: .leading)
                                if let q = i.quantity, privacy.mode.money(q, unlocked: privacy.unlocked).map({ !$0.contains("•") }) ?? false {
                                    Text("US$ " + DecimalInput.format(q, maxDecimals: 2)).monospacedDigit()
                                } else { Text("Dólar") }
                                Spacer()
                                if let v = privacy.mode.money(i.current, unlocked: privacy.unlocked) { Text(v).monospacedDigit() }
                                if let d = i.dayPct {
                                    Text(pctBR(d)).monospacedDigit().foregroundStyle(d >= 0 ? .green : .red).frame(width: 58, alignment: .trailing)
                                }
                            }.font(.system(size: 12))
                        } else {
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
                                // Variação do dia (vs. fechamento anterior da B3); visível também no modo discreto.
                                Text(i.dayPct.map(pctBR) ?? "–").monospacedDigit()
                                    .foregroundStyle(i.dayPct.map { $0 >= 0 ? Color.green : Color.red } ?? .secondary).frame(width: 58, alignment: .trailing)
                            } else if let g = i.gainPct {
                                Text(String(format: "%+.2f%%", g)).monospacedDigit()
                                    .foregroundStyle(g >= 0 ? .green : .red).frame(width: 64, alignment: .trailing)
                            }
                        }.font(.system(size: 12))
                        GainDetailRow(item: i)
                        }
                    }
                    }
                    if !s.watch.isEmpty { WatchSection(rows: s.watch) }
                }
                HStack(spacing: 8) {
                    Text("Atualizado \(s.updatedAt.formatted(date: .omitted, time: .shortened))")
                        .font(.caption2).foregroundStyle(.secondary)
                    if s.stale.stale { StaleBadge(info: s.stale) }
                }
            }
        }
        .foregroundStyle(.white)
    }
}
/// Bruto × líquido (IR/IOF da renda fixa) e proventos dos últimos 12 meses.
struct NetSummaryRow: View {
    @EnvironmentObject var privacy: PrivacyController
    @EnvironmentObject var model: PortfolioModel
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
            if let nx = s.nextDividend {
                Label("Próximo \(nx.ticker) \(nx.paymentDate.formatted(.dateTime.day().month(.abbreviated)))", systemImage: "calendar.badge.clock")
                    .help("Próximo provento anunciado (brapi)")
            }
            if let r = Optional(Dividends.receivedTotal(model.portfolio?.manualDividends)), r.count > 0 {
                Label(privacy.mode.money(r.total, unlocked: u).map { "Recebido \($0)" } ?? "Recebido", systemImage: "tray.and.arrow.down")
                    .help("Soma dos proventos lançados no Cadastro")
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

/// Linha fina embaixo do ativo: resultado em R$ (e %) e, no Tesouro, o valor de venda hoje.
struct GainDetailRow: View {
    @EnvironmentObject var privacy: PrivacyController
    let item: LineItem
    var body: some View {
        let u = privacy.unlocked
        if item.gain != nil || item.marketValue != nil {
            HStack(spacing: 8) {
                Spacer().frame(width: 60)
                if let g = item.gain {
                    let money = privacy.mode.money(abs(g), unlocked: u).map { (g >= 0 ? "+" : "−") + $0 }
                    Text([money, item.gainPct.map(pctBR)].compactMap { $0 }.joined(separator: " · "))
                        .foregroundStyle(g >= 0 ? .green : .red).help("Resultado: valor atual menos o investido")
                }
                if let m = item.marketValue {
                    HStack(spacing: 3) {
                        Image(systemName: "building.columns")
                        Text("Venda hoje " + (privacy.mode.money(m, unlocked: u) ?? pctBR(((m / max(item.invested ?? m, 0.01)) - 1) * 100)))
                        if let r = item.marketRate { Text(String(format: "taxa %.2f%%", r).replacingOccurrences(of: ".", with: ",")) }
                    }.foregroundStyle(.secondary).help("Preço de resgate do Tesouro Direto (planilha oficial de \(item.marketDay ?? "hoje")). Na curva = valor acima.")
                }
                Spacer()
            }.font(.system(size: 9)).monospacedDigit()
        }
    }
}

/// Favoritos: cotação, alvo e quanto falta.
struct WatchSection: View {
    @EnvironmentObject var privacy: PrivacyController
    let rows: [WatchRow]
    var body: some View {
        HStack {
            Image(systemName: "star").foregroundStyle(Color(red: 0.62, green: 0.45, blue: 0.98))
            Text("QUERO COMPRAR").font(.caption2.weight(.semibold)).foregroundStyle(.secondary); Spacer()
        }.padding(.top, 4)
        ForEach(rows) { w in
            HStack {
                Image(systemName: w.reached ? "star.fill" : "star").foregroundStyle(w.reached ? .green : .secondary).frame(width: 60, alignment: .leading)
                Text(w.ticker)
                VStack(alignment: .leading, spacing: 0) {
                    Text("alvo " + BRL.format(w.targetPrice)).foregroundStyle(.secondary)
                    if let a = w.amount, let t = privacy.mode.money(a, unlocked: privacy.unlocked) {
                        Text("investir \(t)" + (w.shares.map { " (~\($0) cotas)" } ?? "")).font(.system(size: 9)).foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Text(w.price.map(BRL.format) ?? "–").monospacedDigit()
                Text(w.reached ? "no preço" : w.distancePct.map { String(format: "-%.1f%%", $0).replacingOccurrences(of: ".", with: ",") } ?? "–")
                    .monospacedDigit().foregroundStyle(w.reached ? .green : .secondary).frame(width: 58, alignment: .trailing)
                    .help(w.reached ? "Cotação no preço que você quer" : "Quanto ainda precisa cair até o alvo")
            }.font(.system(size: 12))
        }
    }
}

/// Aviso discreto: ícone de relógio; o detalhe técnico aparece ao passar o mouse ou clicar.
struct StaleBadge: View {
    let info: StaleInfo
    @State private var show = false
    var body: some View {
        Button { show.toggle() } label: {
            Label(info.title, systemImage: "clock.badge.exclamationmark").font(.caption2).foregroundStyle(.secondary)
        }.buttonStyle(.plain).help(info.detail)
        .popover(isPresented: $show) { Text(info.detail).font(.caption).padding(10).frame(width: 300).textSelection(.enabled) }
    }
}
#endif
