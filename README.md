# 🐷 notch-invest

> **Seus investimentos morando no entalhe do Mac, cuidados por um porquinho que sorri quando o dinheiro rende.**

App de entalhe (notch) do Mac para acompanhar investimentos: renda fixa pelo CDI, ações e FIIs da B3 e bitcoin, tudo
numa ilhazinha preta em volta da câmera. **Só leitura, sem banco, dados só no seu Mac.**

<p align="center">
  <img src="personagem/opcao2d/previews/feliz.gif" width="96" alt="porquinho feliz">
  <img src="personagem/opcao2d/previews/neutro.gif" width="96" alt="porquinho neutro">
  <img src="personagem/opcao2d/previews/triste.gif" width="96" alt="porquinho triste">
  <img src="personagem/opcao2d/previews/dormindo.gif" width="96" alt="porquinho dormindo">
  <img src="personagem/opcao2d/previews/ganhou.gif" width="96" alt="porquinho comemorando">
  <img src="personagem/opcao2d/previews/erro.gif" width="96" alt="porquinho confuso">
</p>

| Ilha fechada | Ilha aberta |
|:---:|:---:|
| <img src="previews/notch_fechado.gif" alt="ilha fechada"> | <img src="previews/notch_aberto.gif" alt="ilha aberta"> |

| Aba Gráficos (TradingView) | Modo discreto |
|:---:|:---:|
| <img src="previews/notch_graficos_mockup.png" alt="aba gráficos"> | <img src="previews/notch_discreto_mockup.png" alt="modo discreto"> |

<sub>Imagens com dados de exemplo (mockups).</sub>

---

## ✨ Recursos
- 🏝️ **Ilha no entalhe:** fica fechada (porquinho + total + % do dia). Clique para abrir; fecha com outro clique, clique fora ou `Esc`.
- 💰 **Carteira:** caixinhas, CDB, Tesouro Selic, LCI/LCA (% do CDI), ações e FIIs (B3) e cripto em reais.
- 🔄 **Atualização automática** a cada 5 minutos, mais o botão ⟳.
- 📈 **Aba Gráficos:** o TradingView oficial num painel maior (720×460), com o login salvo, os seus layouts e uma troca rápida de ativo.
- 🙈 **Modo discreto:** valores → `R$ •••••` → só porcentagens. Vem ligado na primeira vez.
- 👆 **Trava com Touch ID** (opcional, com a senha do Mac como alternativa): os valores voltam a ser escondidos depois de X minutos ou quando o Mac bloqueia.
- 🛡️ **Tela "O que este app faz"**, com botões para abrir a pasta dos dados e apagar tudo.
- 🖥️ **Sem entalhe?** Em monitor externo, ela vira uma pílula sob a barra de menus.

## 🐷 Humores do porquinho
| Humor | Quando | Prévia |
|---|---|:---:|
| 😊 Feliz | carteira subiu mais de 0,05% no dia | <img src="personagem/opcao2d/previews/feliz.gif" width="56"> |
| 😐 Neutro | variação entre −0,05% e +0,05% | <img src="personagem/opcao2d/previews/neutro.gif" width="56"> |
| 😢 Triste | caiu mais de 0,05% no dia | <img src="personagem/opcao2d/previews/triste.gif" width="56"> |
| 😴 Dormindo | buscando cotações | <img src="personagem/opcao2d/previews/dormindo.gif" width="56"> |
| 🎉 Ganhou | uma vez, quando o total sobe num dia positivo | <img src="personagem/opcao2d/previews/ganhou.gif" width="56"> |
| 😵 Erro | sem dados / sem arquivo | <img src="personagem/opcao2d/previews/erro.gif" width="56"> |

## 🔒 Privacidade em primeiro lugar
> [!IMPORTANT]
> - **Só leitura:** o app mostra números. Não faz Pix, transferência, compra nem venda.
> - **Sem banco:** não acessa banco nem Nubank, não pede senha de banco e não usa Open Finance (e não vai usar).
> - **Dados locais:** a carteira fica só em `~/.notchinvest/portfolio.json`, com permissão `600` (só a sua conta lê).
> - **Sem conta e sem rastreamento:** nenhum login no app, nenhuma estatística de uso.

**O que sai do Mac (verificado no código e nos testes):** todas as consultas passam por `fetchData`, e as URLs são montadas só em:

| Para quê | Site | O que é enviado |
|---|---|---|
| Taxa do CDI | `api.bcb.gov.br` (série SGS 12) | só um intervalo de datas |
| Cotações B3 | `brapi.dev` | só o código público, ex. `PETR4` |
| Bitcoin em R$ | `api.coingecko.com` | só o id público, ex. `bitcoin` |
| Gráficos | `tradingview.com` | só se você abrir a aba; a URL leva só o símbolo |

Valores, quantidades, preço médio, nomes dos investimentos e o seu nome **nunca** saem do Mac.
O teste `PrivacyTests.testRequestsCarryOnlyPublicTickers` (via `NetworkAudit`) confirma isso.

<p align="center"><img src="previews/privacidade_mockup.png" width="420" alt="tela O que este app faz"></p>

## 🚀 Instalação no Mac
Requisitos: macOS 14+ e Xcode 15+ (ou as Command Line Tools com Swift 5.9+).
```bash
git clone https://github.com/pamteech/notch-invest.git && cd notch-invest
mkdir -p ~/.notchinvest && cp portfolio.example.json ~/.notchinvest/portfolio.json
chmod 600 ~/.notchinvest/portfolio.json        # edite com seus valores
swift test                                     # testes do núcleo
swift build -c release
swift run -c release NotchInvestApp
```
Ou abra o `Package.swift` no Xcode e rode o esquema **NotchInvestApp**. Para testar o cálculo no terminal:
`swift run notch-invest-cli portfolio.example.json`.

**Token da brapi (opcional):** alguns ativos (FIIs) exigem um token gratuito de brapi.dev. Use `export BRAPI_TOKEN=...`
e nunca coloque o token no git.

### Iniciar junto com o Mac (LaunchAgent)
Crie `~/Library/LaunchAgents/com.pamtech.notchinvest.plist`, trocando `/CAMINHO/notch-invest` pelo caminho do clone
(o launchd não expande `~`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.pamtech.notchinvest</string>
  <key>ProgramArguments</key>
  <array><string>/CAMINHO/notch-invest/.build/release/NotchInvestApp</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>ProcessType</key><string>Interactive</string>
</dict>
</plist>
```
```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.pamtech.notchinvest.plist   # ativar
launchctl bootout   gui/$(id -u) ~/Library/LaunchAgents/com.pamtech.notchinvest.plist   # desativar
```

## 📝 Preenchendo o `portfolio.json`
```json
{
  "owner": "eu",
  "fixedIncome": [
    { "name": "Caixinha Reserva", "kind": "caixinha", "cdiPercent": 100,
      "deposits": [ { "date": "2026-01-05", "amount": 1000 }, { "date": "2026-06-01", "amount": 500 } ] },
    { "name": "CDB 110%", "kind": "cdb", "cdiPercent": 110,
      "deposits": [ { "date": "2026-03-02", "amount": 2000 } ] }
  ],
  "stocks": [ { "ticker": "PETR4", "quantity": 10, "averagePrice": 35.0 } ],
  "crypto": [ { "coinId": "bitcoin", "symbol": "BTC", "quantity": 0.002, "averagePriceBRL": 350000 } ],
  "tradingview": { "layoutURL": "https://www.tradingview.com/chart/", "panelWidth": 720, "panelHeight": 460 }
}
```
- `kind`: `caixinha`, `cdb`, `tesouro`, `lci` ou `lca`. `cdiPercent: 110` significa 110% do CDI. Cada aporte tem data e valor.
- O CDI rende por dia útil: saldo × Π(1 + taxa do dia × %CDI). O IR não é descontado (por enquanto).
- `averagePrice` e `averagePriceBRL` são opcionais e servem para calcular o ganho em %.
- `coinId` é o id do CoinGecko (`bitcoin`, `ethereum`...).

## 📊 TradingView (aba Gráficos)
- Abre o site oficial (`/chart/` ou o seu layout salvo). O login fica salvo no armazenamento do próprio WebKit; o app nunca vê a senha.
- ⚠️ **Entre com e-mail e senha, não com o Google.** O Google bloqueia login em navegadores embutidos (`403 disallowed_useragent`).
  Se a sua conta foi criada pelo Google, defina uma senha no perfil do TradingView, ou use o botão **Abrir no navegador**.
- **Widget sem login:** alterna para o widget gratuito "Advanced Real-Time Chart" (com a atribuição do TradingView).
- Tickers da carteira: `BMFBOVESPA:PETR4`, `BINANCE:BTCBRL`. Dá para trocar em `tradingview.symbols`.
- Config: `layoutURL`, `layouts` (`[{ "name", "url" }]`), `panelWidth`, `panelHeight`, `symbols`, `preferWidget`.
- Uso pessoal, só para ver os gráficos, conforme os termos do TradingView. Nada de raspagem nem automação.
- O `Esc` fecha a ilha mesmo com o foco no gráfico. Para cancelar um desenho, use o clique direito.
- Para um build com App Sandbox, use `Support/NotchInvest.entitlements` (`network.client`).

## 🗂️ Estrutura
```
Sources/
  NotchInvestCore/   modelo, CDI, cotações (BCB, brapi, CoinGecko), humores, privacidade, TradingView — multiplataforma e testado
  NotchInvestApp/    app SwiftUI/AppKit: janela no entalhe, ilha, abas, gráficos, modo discreto/Touch ID, menu
    Resources/Cofrinho/   folhas de animação do porquinho (128 px e @2x, 24 fps)
  notch-invest-cli/  CLI para conferir os cálculos
Tests/NotchInvestCoreTests/   testes do núcleo
Support/             entitlements (só para build com sandbox)
personagem/opcao2d/  arte do porquinho: folha_ia.jpg + anima2d.py (gera frames, folhas e GIFs) + prévias
previews/            GIFs e mockups do README
docs/                notas de arquitetura
```
Para regenerar o porquinho: `cd personagem/opcao2d && python anima2d.py` (Pillow e NumPy), depois `pngquant` nas folhas.

## 🛣️ Roadmap
- [ ] 🔔 Alertas (ativo subiu ou caiu X%, CDI mudou)
- [ ] 🧾 Tela de cadastro (sem editar JSON)
- [ ] 🎯 Metas (ex. reserva de emergência) com progresso no porquinho
- [ ] 💸 Proventos (dividendos e JCP dos FIIs e ações)
- [ ] 🧮 Valor líquido (IR regressivo, IOF, isenção de LCI/LCA)

## 🙏 Créditos
- Feito por **Pam Tech**.
- A técnica de janela no entalhe foi **inspirada no [Coucou](https://github.com/Louis-CFM/coucou) (licença MIT)**, reescrita do zero
  (veja `NOTICE`). **Este projeto não usa o nome Coucou, o personagem Mochi, ícones, sons nem nenhum outro asset dele.**
- Porquinho original deste projeto. Dados públicos: Banco Central do Brasil (SGS), brapi.dev, CoinGecko. Gráficos: TradingView.

## 📄 Licença
[MIT](LICENSE) © 2026 Pam Tech
