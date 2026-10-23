# Pilinha no iPhone — plano (rota Expo + EAS)

Privacidade: só leitura, sem conexão com banco, dados só no aparelho (carteira e histórico no AsyncStorage, token da brapi no Keychain via expo-secure-store). Só tickers, ids de moeda e datas saem do iPhone.

## Rota escolhida: Expo + EAS (sem Xcode local)
- App em `mobile/` (Expo SDK 58, TypeScript, expo-router), só iOS, bundle `com.pamtech.pilinha`.
- Build na nuvem com `eas build`, envio ao TestFlight com `eas submit`.
- Projeto EAS: `@pamssoares/pilinha` (conta Expo da Pamella).

## Marco 1 — pronto
- [x] Núcleo portado para TS (`mobile/src/core`): CDI (BCB SGS 12), brapi (token opcional) com Yahoo de reserva (query1 → query2), bitcoin pela CoinGecko, IR regressivo + IOF por aporte, LCI/LCA isentas, proventos 12 meses, humor do porquinho, histórico diário.
- [x] 30 testes jest + smoke test de rede real (só status, sem valores).
- [x] Telas: porquinho + total + dia, carteira, evolução (gráfico SVG; modo discreto mostra só %), proventos, cadastro (renda fixa, ações/FIIs, bitcoin, token brapi).
- [x] `eas.json` com perfis development / preview / production e submit.

## Próximos
- [ ] Credenciais Apple no EAS (primeiro `eas build` interativo) e envio ao TestFlight.
- [ ] Lançar proventos à mão no cadastro (o núcleo já suporta).
- [ ] TradingView em webview (login por e-mail e senha; o Google bloqueia login em webview).
- [ ] Exportar/importar carteira entre Mac e iPhone (arquivo JSON compatível com `portfolio.json`) — decisão pendente.
- [ ] Widgets (tela inicial e bloqueada) e Live Activity / Ilha Dinâmica via **expo-apple-targets** (`@bacons/apple-targets`): alvo `widget` em `mobile/targets/`, escrito em SwiftUI; dados passados por App Group (`group.com.pamtech.pilinha`) com o resumo já calculado (humor, % do dia; valores só se o modo discreto estiver desligado). Live Activity precisa de um módulo nativo para iniciar/atualizar (ActivityKit). O iOS atualiza widgets a cada ~15–30 min.

## Observação
O Yahoo responde 429 para alguns User-Agents completos de navegador (visto em 23/10/2026); o app usa `Mozilla/5.0` curto. Vale conferir o app do Mac, que usa um UA longo de Chrome.
