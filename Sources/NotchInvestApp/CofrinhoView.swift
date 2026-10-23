#if os(macOS)
import AppKit
import SwiftUI
import NotchInvestCore

/// Carrega e recorta os sprite sheets do porquinho 2D (Bundle.module/Cofrinho/porco2d_*.png).
@MainActor
final class CofrinhoSprites {
    static let shared = CofrinhoSprites()
    private var cache: [String: [CGImage]] = [:]

    /// NotchInvest.app: sprites em Contents/Resources/<bundle SwiftPM>/Cofrinho (build-app.sh copia para lá).
    /// `swift run`: Bundle.module. Procura primeiro no .app para não depender do caminho da pasta de build.
    static func spriteURL(_ name: String) -> URL? {
        let fm = FileManager.default
        if let res = Bundle.main.resourceURL {
            for sub in ["NotchInvest_NotchInvestApp.bundle/Cofrinho", "NotchInvest_NotchInvestApp.bundle/Contents/Resources/Cofrinho", "Cofrinho"] {
                let u = res.appendingPathComponent(sub).appendingPathComponent(name + ".png")
                if fm.fileExists(atPath: u.path) { return u }
            }
        }
        return Bundle.module.url(forResource: name, withExtension: "png", subdirectory: "Cofrinho")
            ?? Bundle.module.url(forResource: name, withExtension: "png")
    }

    /// Quadros do humor. `retina` escolhe a folha @2x (256 px por quadro).
    func frames(_ mood: CofrinhoMood, retina: Bool) -> [CGImage] {
        let name = mood.sheetName(retina: retina)
        if let c = cache[name] { return c }
        guard let url = Self.spriteURL(name),
              let src = CGImageSourceCreateWithURL(url as CFURL, nil),
              let sheet = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
            cache[name] = []; return []
        }
        let side = sheet.height
        // usa a largura real da folha como limite, caso a contagem e o arquivo divirjam
        let n = min(mood.frameCount, side > 0 ? sheet.width / side : 0)
        let out: [CGImage] = (0..<n).compactMap { i in
            sheet.cropping(to: CGRect(x: i * side, y: 0, width: side, height: side))
        }
        cache[name] = out
        return out
    }
}

/// Toca os quadros a 24 fps. Humores em loop repetem; `ganhou` toca uma vez e chama `onFinish`.
struct CofrinhoView: View {
    let mood: CofrinhoMood
    var size: CGFloat = 32
    var onFinish: (() -> Void)? = nil

    @Environment(\.displayScale) private var displayScale
    @State private var start = Date()
    @State private var finished = false

    var body: some View {
        let frames = CofrinhoSprites.shared.frames(mood, retina: displayScale * size > 128)
        TimelineView(.animation(minimumInterval: 1 / CofrinhoMood.fps, paused: frames.isEmpty || finished)) { ctx in
            let idx = frameIndex(at: ctx.date, count: frames.count)
            Group {
                if frames.isEmpty {
                    Circle().fill(Color.purple).padding(size * 0.2)    // fallback sem recursos
                } else {
                    Image(decorative: frames[idx], scale: 1).resizable().interpolation(.high)
                }
            }
            .frame(width: size, height: size)
        }
        .onChange(of: mood, initial: true) { _, _ in   // reinicia a animação ao trocar de humor
            start = Date(); finished = false
        }
        .accessibilityLabel("Porquinho \(mood.rawValue)")
    }

    private func frameIndex(at date: Date, count: Int) -> Int {
        guard count > 0 else { return 0 }
        let raw = Int(date.timeIntervalSince(start) * CofrinhoMood.fps)
        if mood.loops { return ((raw % count) + count) % count }
        if raw >= count - 1 {
            if !finished {
                DispatchQueue.main.async { finished = true; onFinish?() }
            }
            return count - 1
        }
        return max(raw, 0)
    }
}
#endif
