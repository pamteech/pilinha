# Pilinha — iPhone (Expo)

App de leitura da carteira: porquinho, total, variação do dia, carteira, evolução, proventos e cadastro. Sem banco, sem nuvem: tudo fica no iPhone.

## Desenvolvimento
```
npm install
npm test          # testes do núcleo (jest)
npm run typecheck # tsc --noEmit
npm run smoke     # testa as APIs reais (mostra só ok/erro)
```

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

## Submit para o TestFlight

`eas.json` já tem `submit.production.ios.ascAppId = 6826469667` (app com.pamtech.pilinha no App Store Connect), então `eas submit -p ios --latest` não pergunta mais o app.
Para ficar 100% não interativo (ex. `eas build --auto-submit` sem login da Apple) falta uma **App Store Connect API Key**, que só a Pamella pode criar:
App Store Connect > Usuários e Acesso > Integrações > App Store Connect API > gerar chave (papel App Manager), baixar o `.p8` e cadastrar no EAS com `eas credentials` (iOS > App Store Connect API Key). A chave nunca vai para o repositório.
