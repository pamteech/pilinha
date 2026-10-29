#if os(macOS)
import AppKit
import CoreImage
import NotchInvestCore

/// Janela "Conectar ao iPhone": mostra o código de pareamento (e um QR) para digitar no app do iPhone.
@MainActor
enum SyncPairing {
    static func qr(_ text: String, size: CGFloat = 180) -> NSImage? {
        guard let f = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        f.setValue(Data(text.utf8), forKey: "inputMessage"); f.setValue("M", forKey: "inputCorrectionLevel")
        guard let out = f.outputImage else { return nil }
        let scaled = out.transformed(by: CGAffineTransform(scaleX: size / out.extent.width, y: size / out.extent.height))
        let rep = NSCIImageRep(ciImage: scaled); let img = NSImage(size: rep.size); img.addRepresentation(rep); return img
    }

    static func show(fresh: Bool = false) {
        let code: String
        do { code = try PilinhaSync.ensureCode(fresh: fresh) } catch {
            let a = NSAlert(); a.messageText = "Não deu para criar o código"; a.informativeText = error.localizedDescription; a.runModal(); return
        }
        Task.detached { await PilinhaSync.pushCurrent(force: true) }
        let a = NSAlert()
        a.messageText = "Conectar ao iPhone"
        a.informativeText = """
        No iPhone, abra o Pilinha › Cadastro › "Conectar ao Mac" e digite o código abaixo \
        (ou aponte a Câmera do iPhone para o QR). Depois disso a carteira daqui aparece lá sozinha.

        A carteira vai cifrada: o servidor não consegue ler. Não mostre este código para outras pessoas.
        """
        let box = NSStackView(); box.orientation = .vertical; box.alignment = .centerX; box.spacing = 10
        let label = NSTextField(labelWithString: PilinhaSync.format(code))
        label.font = .monospacedSystemFont(ofSize: 22, weight: .semibold); label.isSelectable = true
        box.addArrangedSubview(label)
        if let img = qr(PilinhaSync.pairingLink(code)) { box.addArrangedSubview(NSImageView(image: img)) }
        box.frame = NSRect(x: 0, y: 0, width: 300, height: 230)
        a.accessoryView = box
        a.addButton(withTitle: "OK")
        a.addButton(withTitle: "Copiar código")
        a.addButton(withTitle: "Gerar código novo")
        a.addButton(withTitle: "Desligar sincronização")
        NSApp.activate(ignoringOtherApps: true)
        switch a.runModal() {
        case .alertSecondButtonReturn:
            NSPasteboard.general.clearContents(); NSPasteboard.general.setString(PilinhaSync.format(code), forType: .string)
        case .alertThirdButtonReturn:
            let c = NSAlert(); c.messageText = "Gerar código novo?"
            c.informativeText = "O iPhone conectado com o código atual para de receber atualizações até você digitar o novo."
            c.addButton(withTitle: "Gerar"); c.addButton(withTitle: "Cancelar")
            if c.runModal() == .alertFirstButtonReturn { show(fresh: true) }
        case NSApplication.ModalResponse(rawValue: NSApplication.ModalResponse.alertThirdButtonReturn.rawValue + 1):
            PilinhaSync.disable()
        default: break
        }
    }
}
#endif
