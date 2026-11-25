# Pilinha no iPhone — plano (rota Expo + EAS)

Privacidade: só leitura, sem conexão com banco, dados só no aparelho (carteira e histórico no AsyncStorage, token da brapi no Keychain via expo-secure-store). Só tickers, ids de moeda e datas saem do iPhone (e, com o aviso do dólar ligado, uma busca fixa "dólar hoje" no RSS do Google Notícias).

## Rota escolhida: Expo + EAS (sem Xcode local)
- App em `mobile/` (Expo SDK 58, TypeScript, expo-router), só iOS, bundle `com.pamtech.pilinha`.
- Build na nuvem com `eas build`, envio ao TestFlight com `eas submit`.
- Projeto EAS configurado em `app.json` / `eas.json` (o `projectId` e o que o EAS exige para o build ficam só nesses arquivos de config).

## Marco 1 — pronto
- [x] Núcleo portado para TS (`mobile/src/core`): CDI (BCB SGS 12), brapi (token opcional) com Yahoo de reserva (query1 → query2), bitcoin pela CoinGecko, IR regressivo + IOF por aporte, LCI/LCA isentas, proventos 12 meses, humor do porquinho, histórico diário.
- [x] 30 testes jest + smoke test de rede real (só status, sem valores).
- [x] Telas: porquinho + total + dia, carteira, evolução (gráfico SVG; modo discreto mostra só %), proventos, cadastro (renda fixa, ações/FIIs, bitcoin, token brapi).
- [x] `eas.json` com perfis development / preview / production e submit.

## Marco 2 — pronto no código (falta validar num build real)
- [x] Widgets (tela inicial: pequeno/médio; tela bloqueada: circular, retangular, em linha) via **@bacons/apple-targets** (`mobile/targets/widget`, SwiftUI/WidgetKit). Porquinho + total + variação do dia.
- [x] Dados pelo App Group `group.com.pamtech.pilinha`: o app grava um resumo JSON (`pilinha.widget`) com `ExtensionStorage` e chama `reloadWidget`. **Modo discreto:** o resumo vai sem nenhum valor em R$ (só % e humor). A opção "esconder valores" agora fica salva.
- [x] Linha do tempo do widget: relê a cada ~20 min. O widget **não** busca cotações sozinho; mostra o último resumo do app (o app atualiza a cada 5 min quando aberto).
- [x] Live Activity / Ilha Dinâmica: módulo nativo local `mobile/modules/pilinha-activity` (ActivityKit) + `ActivityConfiguration` no mesmo alvo do widget. Botão na tela inicial (avisa se a bolsa está fechada; pregão ≈ seg–sex 10h–18h). Atualiza a cada refresh do app.
- [x] Proventos lançados à mão no Cadastro.
- [x] Aba Gráficos: TradingView oficial em webview (só domínios tradingview.com), login por e-mail e senha.
- [x] Exportar/importar carteira (JSON igual ao `~/.notchinvest/portfolio.json` do Mac) por folha de compartilhar / seletor de arquivos, com validação.

## Ainda não verificado (só num `eas build` de verdade)
- Compilação do Swift (no Linux só deu para checar a sintaxe com `swiftc -parse`) e do módulo nativo.
- Assinatura do alvo do widget e do App Group: o EAS precisa criar o App Group e o perfil do widget; o `ios.appleTeamId` ainda falta no app.json.
- Live Activity com o app fechado: sem servidor de push, ela só muda quando o app roda; o iOS a encerra depois de ~8 h.

## Próximos
- [ ] Credenciais Apple no EAS (primeiro `eas build` interativo) e envio ao TestFlight.
- [ ] (Opcional) widget buscar cotações sozinho (exigiria repassar a carteira ao App Group).
- [ ] (Opcional) atualizar a Live Activity por push (precisa de servidor; fora do escopo local).

## Observação
O Yahoo responde 429 para alguns User-Agents completos de navegador (visto em 23/10/2026); o app usa `Mozilla/5.0` curto. Vale conferir o app do Mac, que usa um UA longo de Chrome.

## Sincronização com o Mac (merge de três vias)
O iPhone guarda a última carteira que o Mac mandou (`pilinha.macBase.v1`). A cada sync, `mergeFromMac(iPhone, Mac, base)` só deixa o Mac
sobrescrever um item que **mudou no Mac** desde a última vez; o resto (editado, igual ou removido no iPhone) fica. Antes o Mac vencia sempre
e desfazia o que era alterado no celular (US$, quantidade de uma ação) no próximo sync — às vezes segundos depois de salvar, porque o
download já estava em andamento. O merge também usa a carteira do iPhone *de agora*, não a de antes do download.

## Aviso do dólar
Depois das 17h (dias úteis), se o dólar caiu no dia (AwesomeAPI/PTAX), uma notificação "Dólar fechou em queda (−x%)" com a manchete que
explica o motivo (RSS do Google Notícias, busca fixa) e o link; tocar abre a matéria. Um aviso por sessão; o mesmo card aparece no Início.
Ligado por padrão; limiar e desligar em Alertas.
