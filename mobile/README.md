# Pilinha — iPhone (Expo)

App de leitura da carteira: porquinho, total, variação do dia, carteira, evolução, proventos e cadastro. Sem banco, sem nuvem: tudo fica no iPhone.

## Desenvolvimento
```
npm install
npm test          # testes do núcleo (jest)
npm run typecheck # tsc --noEmit
npm run smoke     # testa as APIs reais (mostra só ok/erro)
```

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
