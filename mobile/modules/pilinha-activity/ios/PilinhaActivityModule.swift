import ExpoModulesCore
import ActivityKit

/// Mesmo nome e campos de targets/widget/Shared.swift.
struct PilinhaActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var mood: String
        var dayChangePct: Double?
        var totalText: String?
    }
    var title: String
}

public class PilinhaActivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("PilinhaActivity")

        Function("isSupported") { () -> Bool in
            if #available(iOS 16.2, *) { return ActivityAuthorizationInfo().areActivitiesEnabled }
            return false
        }

        Function("isRunning") { () -> Bool in
            if #available(iOS 16.2, *) { return !Activity<PilinhaActivityAttributes>.activities.isEmpty }
            return false
        }

        AsyncFunction("start") { (mood: String, dayChangePct: Double?, totalText: String?) in
            guard #available(iOS 16.2, *) else { throw Exception(name: "Unsupported", description: "Precisa do iOS 16.2+") }
            let state = PilinhaActivityAttributes.ContentState(mood: mood, dayChangePct: dayChangePct, totalText: totalText)
            if let a = Activity<PilinhaActivityAttributes>.activities.first {
                await a.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(30 * 60)))
                return
            }
            _ = try Activity.request(attributes: PilinhaActivityAttributes(title: "Pilinha"),
                                     content: ActivityContent(state: state, staleDate: Date().addingTimeInterval(30 * 60)))
        }

        AsyncFunction("update") { (mood: String, dayChangePct: Double?, totalText: String?) in
            guard #available(iOS 16.2, *) else { return }
            let state = PilinhaActivityAttributes.ContentState(mood: mood, dayChangePct: dayChangePct, totalText: totalText)
            for a in Activity<PilinhaActivityAttributes>.activities {
                await a.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(30 * 60)))
            }
        }

        AsyncFunction("stop") { () in
            guard #available(iOS 16.2, *) else { return }
            for a in Activity<PilinhaActivityAttributes>.activities {
                await a.end(nil, dismissalPolicy: .immediate)
            }
        }
    }
}
