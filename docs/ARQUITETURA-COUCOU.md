# Coucou — resumo da arquitetura (referência, MIT)
- Projeto Xcode gerado por XcodeGen (`NotchBuddy/project.yml`), Swift + SwiftUI + AppKit; alvos: App, CoucouKit, Widgets, Phone, NotificationContent.
- `IslandWindowController.swift`: cria um `IslandPanel` (subclasse de NSPanel) `.borderless + .nonactivatingPanel`, 720x560, centralizado no topo da tela; `level = mainMenuWindow + 3`; `collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]`; fundo transparente, sem sombra; `ignoresMouseEvents` alternado conforme hover (área ativa = forma da ilha).
- Geometria do notch: `IslandDisplayChoice`/`screenGeometry` escolhem a tela com notch (safeAreaInsets/auxiliaryTop*Area) e repassam largura/altura ao `AppState`; sem notch, desenha pílula falsa.
- Conteúdo: `NSHostingView(IslandRootView)` com `AppState.shared` (ObservableObject singleton); `IslandStateMachine` controla estados compacto/expandido/views (música, cripto, e-mail, Claude, etc.) com animações spring.
- Integrações como "pollers" (GitHub, Notion, n8n, Cal.com) e controllers (Crypto, Music, Mail) que publicam no AppState.
- O NotchInvest reaproveita apenas a técnica de painel (reescrita, mais simples); nada de assets.
