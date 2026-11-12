# Pilinha — iPhone (Expo)

App de leitura da carteira: porquinho, total, variação do dia, carteira, evolução, proventos e cadastro. Sem banco, sem nuvem: tudo fica no iPhone.

## Desenvolvimento
```
npm install
npm test          # testes do núcleo (jest)
npm run typecheck # tsc --noEmit
npm run smoke     # testa as APIs reais (mostra só ok/erro)
```

## Sincronização com o Mac e edições no iPhone
O Mac manda a carteira cifrada; o iPhone junta com a dele por um merge de três vias (`mergeFromMac` em `src/core/io.ts`, base = última carteira do Mac,
guardada no aparelho). O Mac só substitui um item que mudou **lá**; o que foi editado no iPhone (quantidade, dólar, remoção) fica. Testes em `macmerge.test.ts`.

## Aviso do dólar
Depois das 17h, em dia útil, se o dólar fechou em queda: notificação com a manchete do motivo (RSS público do Google Notícias, busca fixa "dólar hoje")
e link para a matéria; o mesmo card aparece no Início. Ligado por padrão, limiar e desligar em Alertas. Código em `src/core/news.ts` (testes em `usdnews.test.ts`),
`src/lib/news.ts` e `src/lib/alerts.ts`.

## Gráficos e simulador da landing (site/index.html)
- **Distribuição por tipo** (Carteira): barra empilhada com cor fixa por tipo (renda fixa, Tesouro, ações, FIIs, bitcoin, dólar) e legenda com % e valor. Paleta validada para daltonismo (`allocation` em `src/core/insights.ts`).
- **Dividendos por mês** (Proventos): últimos 12 meses por data de pagamento, média mensal e melhor mês (`dividendsByMonth` em `src/core/dividends.ts`).
- **Evolução contra o CDI** com Semana, Mês, 6 meses, 1 ano e Tudo (`HISTORY_RANGES`).
- **Simulador de metas** (Ajustes): prazo para um aporte mensal, aporte para um prazo, e a renda passiva projetada da meta pelo CDI de hoje (`monthsToGoal`, `monthlyForGoal`, `passiveIncome` em `src/core/goal.ts`). Testes em `landing.test.ts`.

## Meu plano (meta por idade)
Tela `src/app/plano.tsx` (cartão da meta no Início, ou Ajustes › Meta e plano): quanto quer ter, a idade, com que idade quer chegar (opcional),
quanto pode investir por mês, o cenário de rendimento acima da inflação (4%, 6% ou 8%) e o dia do lembrete. A conta é em dinheiro de hoje
(`src/core/plan.ts`): aporte mensal necessário, idade em que chega no ritmo atual, caminho ano a ano, os três cenários, o valor nominal
estimado da meta (IPCA de 4,5%) e a renda mensal que ela gera. Acompanhamento: aporte do mês pelo histórico do valor investido e posição
contra o caminho desde o início do plano. Lembrete mensal agendado no próprio iPhone (9h, sem valores no texto). Testes em `plano.test.ts`.

## Humores do porquinho
Doze humores (`src/core/mood.ts`): os seis originais (feliz, neutro, triste, dormindo, erro, ganhou) e seis novos, todos gerados por
`personagem/opcao2d/gera_folhas.py` a partir da folha de arte ampliada 4x por IA (`superres.py`, Real-ESRGAN): **preocupado** (quadro que estava sem uso), **apaixonado**, **pensando**,
**rico**, **surpreso** e **chorando** (símbolos por cima dos rostos, como o zzz e o "!" originais). Quando aparecem: carregando → pensando;
cotações atrasadas → preocupado (sem nada → erro); meta batida → rico; provento hoje → apaixonado; ±2% no dia → surpreso / chorando;
dia bom/ruim → feliz / triste; parado fora do pregão → dormindo. Widget e Ilha Dinâmica usam o mais parecido entre os seis originais (`baseMood`).
As folhas são WebP em grade de 8 colunas com quadros de 384 px (nítido a 3x); loops lentos a 12 fps, rápidos a 24.

## Modo escuro
Ajustes › Aparência: Automático (segue o iPhone), Claro ou Escuro. As paletas ficam em `src/lib/theme.ts` (`PALETTES`); `T` é um objeto mutável que o `_layout` troca com `applyTheme` e remonta a árvore ao mudar de esquema, por isso nenhuma cor de `T` pode ser guardada em constante de módulo. A distribuição por tipo usa uma paleta própria para o fundo escuro, validada para daltonismo.

## Estrutura
- `src/core` — cálculos (CDI, IR/IOF, cotações, proventos, histórico, import/export). Testado com jest.
- `src/app` — telas (expo-router): Pilinha, Carteira, Evolução, Proventos, Gráficos (TradingView), Cadastro.
- `targets/widget` — widgets e Live Activity em SwiftUI (gerado no Xcode pelo `@bacons/apple-targets`).
- `modules/pilinha-activity` — módulo nativo para iniciar/parar a Live Activity.
- `ios/` não vai pro git: é gerado por `npx expo prebuild -p ios` (o EAS gera sozinho).

Widgets e Live Activity **não funcionam no Expo Go**; só no app instalado pelo TestFlight (ou num build `development`).

## Antes do primeiro build
Coloque o Team ID da conta Apple (developer.apple.com → Membership, 10 letras/números) em `app.json`:
`"ios": { "appleTeamId": "XXXXXXXXXX", ... }`. O EAS também pergunta e cria o App Group `group.com.pamtech.pilinha` e os perfis do app e do widget.

## Mandar para o TestFlight (no Mac da Pamella, sem Xcode)
1. `npm i -g eas-cli`
2. `eas login` (conta Expo **pamssoares**)
3. `cd mobile && npm install`
4. `eas build -p ios --profile production`
   - Na primeira vez o EAS pede login da conta Apple Developer e cria certificado e perfil sozinho (responda "sim").
5. `eas submit -p ios --latest`
   - Pede o app no App Store Connect; deixe o EAS criar (ou crie antes com o bundle `com.pamtech.pilinha`).
6. No App Store Connect → TestFlight: adicione a namorada como testadora (e-mail do Apple ID dela). Ela instala o app **TestFlight** e aceita o convite.

Perfis em `eas.json`: `development` (dev client), `preview` (instalação interna por link), `production` (TestFlight/App Store).

## Build no Mac (quando o limite do Expo acabar)
O plano gratuito do Expo dá um número limitado de builds de iPhone por mês. Build local não conta nesse limite:
`./mobile/scripts/testflight-local.sh` compila neste Mac e envia ao TestFlight. Precisa do Xcode completo (App Store),
`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` e `brew install cocoapods fastlane`.

## Submit para o TestFlight

`eas.json` já tem `submit.production.ios.ascAppId = 6826469667` (app com.pamtech.pilinha no App Store Connect), então `eas submit -p ios --latest` não pergunta mais o app.
Para ficar 100% não interativo (ex. `eas build --auto-submit` sem login da Apple) falta uma **App Store Connect API Key**, que só a Pamella pode criar:
App Store Connect > Usuários e Acesso > Integrações > App Store Connect API > gerar chave (papel App Manager), baixar o `.p8` e cadastrar no EAS com `eas credentials` (iOS > App Store Connect API Key). A chave nunca vai para o repositório.
