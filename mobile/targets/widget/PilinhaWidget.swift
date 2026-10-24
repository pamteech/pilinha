import WidgetKit
import SwiftUI

struct PilinhaEntry: TimelineEntry {
    let date: Date
    let summary: PilinhaSummary
}

struct PilinhaProvider: TimelineProvider {
    func placeholder(in context: Context) -> PilinhaEntry { PilinhaEntry(date: Date(), summary: .placeholder) }
    func getSnapshot(in context: Context, completion: @escaping (PilinhaEntry) -> Void) {
        completion(PilinhaEntry(date: Date(), summary: PilinhaSummary.load() ?? .placeholder))
    }
    /// Lê o último resumo gravado pelo app e pede nova leitura em ~20 min.
    /// O app também chama reloadTimelines a cada atualização.
    func getTimeline(in context: Context, completion: @escaping (Timeline<PilinhaEntry>) -> Void) {
        let entry = PilinhaEntry(date: Date(), summary: PilinhaSummary.load() ?? .placeholder)
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(20 * 60))))
    }
}

struct PilinhaWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PilinhaEntry
    var s: PilinhaSummary { entry.summary }
    var changeColor: Color { (s.dayChangePct ?? 0) >= 0 ? .green : .red }

    var body: some View {
        switch family {
        case .accessoryCircular:
            VStack(spacing: 0) {
                Image(Fmt.pigName(s.mood)).resizable().scaledToFit()
                Text(Fmt.pct(s.dayChangePct)).font(.system(size: 10)).minimumScaleFactor(0.6)
            }
        case .accessoryInline:
            Text("🐷 \(Fmt.pct(s.dayChangePct)) hoje")
        case .accessoryRectangular:
            HStack {
                Image(Fmt.pigName(s.mood)).resizable().scaledToFit()
                VStack(alignment: .leading) {
                    Text(s.hidden ? "Pilinha" : Fmt.brl(s.total)).font(.headline).minimumScaleFactor(0.6)
                    Text("Hoje \(Fmt.pct(s.dayChangePct))").font(.caption)
                }
            }
        default:
            VStack(spacing: 4) {
                Image(Fmt.pigName(s.mood)).resizable().scaledToFit().frame(maxHeight: 70)
                Text(s.hidden ? "R$ ••••" : Fmt.brl(s.total)).font(.headline).minimumScaleFactor(0.5).lineLimit(1)
                Text("Hoje \(Fmt.pct(s.dayChangePct))").font(.caption).foregroundStyle(changeColor)
            }
        }
    }
}

struct PilinhaWidget: Widget {
    let kind = "PilinhaWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PilinhaProvider()) { entry in
            PilinhaWidgetView(entry: entry)
                .containerBackground(Color(red: 0.08, green: 0.06, blue: 0.10), for: .widget)
        }
        .configurationDisplayName("Pilinha")
        .description("O porquinho e como a carteira está hoje.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
