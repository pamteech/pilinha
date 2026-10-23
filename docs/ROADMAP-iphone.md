# Pilinha no iPhone — plano

Privacidade: só leitura, sem conexão com banco, dados locais no aparelho. Só os códigos das ações saem do iPhone (pedidos de cotação).

## O que ela veria
- **App (SwiftUI):** porquinho, total, carteira, gráfico de evolução, proventos e cadastro.
- **Widgets (WidgetKit):** tela inicial e tela bloqueada, com o porquinho e a variação do dia.
- **Ilha Dinâmica / Live Activity:** durante o pregão (o iOS limita a algumas horas).
- **TradingView:** tela em webview, login por e-mail e senha.

## Limites
- Widgets atualizam a cada ~15–30 min (decisão do sistema).
- Carteira não sincroniza sozinha; exportar/importar arquivo entre Mac e iPhone (decisão pendente).

## Etapas
1. Separar o código de cálculos (NotchInvestCore) para uso compartilhado Mac + iOS.
2. Escrever app, widgets e Live Activity.
3. Instalar o Xcode completo no Mac da Pamella.
4. Publicar no TestFlight e convidar a namorada.
