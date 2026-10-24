import ActivityKit
import WidgetKit
import SwiftUI

struct PilinhaLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PilinhaActivityAttributes.self) { context in
            // Tela bloqueada / banner
            HStack {
                Image(Fmt.pigName(context.state.mood)).resizable().scaledToFit().frame(width: 44, height: 44)
                VStack(alignment: .leading) {
                    Text(context.state.totalText ?? context.attributes.title).font(.headline)
                    Text("Hoje \(Fmt.pct(context.state.dayChangePct))").font(.subheadline)
                        .foregroundStyle((context.state.dayChangePct ?? 0) >= 0 ? .green : .red)
                }
                Spacer()
            }
            .padding()
            .activityBackgroundTint(Color(red: 0.08, green: 0.06, blue: 0.10))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(Fmt.pigName(context.state.mood)).resizable().scaledToFit().frame(width: 40, height: 40)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(Fmt.pct(context.state.dayChangePct)).font(.title3)
                        .foregroundStyle((context.state.dayChangePct ?? 0) >= 0 ? .green : .red)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.totalText ?? "Pilinha").font(.headline)
                }
            } compactLeading: {
                Image(Fmt.pigName(context.state.mood)).resizable().scaledToFit()
            } compactTrailing: {
                Text(Fmt.pct(context.state.dayChangePct)).font(.caption2)
                    .foregroundStyle((context.state.dayChangePct ?? 0) >= 0 ? .green : .red)
            } minimal: {
                Image(Fmt.pigName(context.state.mood)).resizable().scaledToFit()
            }
        }
    }
}
