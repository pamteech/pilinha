# Guia do Pilinha no iPhone

Pilinha é um cofrinho que acompanha os seus investimentos. Ele **só lê** os dados que você cadastra: não conecta no banco, não pede senha do Nubank e tudo fica guardado só no seu iPhone.

## 1. Instalar pelo TestFlight
1. Abra o e-mail de convite da Apple (TestFlight) e toque em **Ver no TestFlight**.
2. Se ainda não tiver, instale o app **TestFlight** pela App Store.
3. No TestFlight, toque em **Instalar** no Pilinha. Atualizações aparecem ali também (toque em **Atualizar**).

## 2. Cadastrar a carteira (aba Cadastro)
- **Renda fixa** (Caixinha, CDB, Tesouro, LCI/LCA): nome, tipo, % do CDI, data do aporte (AAAA-MM-DD) e valor. Para outro aporte no mesmo investimento, use o mesmo nome.
- **Ações e FIIs**: código (ex. PETR4, MXRF11), quantidade e **preço médio**.
- **Bitcoin**: quantidade (ex. 0,0015) e preço médio em R$.
- Para corrigir, cadastre de novo com o mesmo código; para apagar, toque em **remover**.

## 3. Preço médio (PM)
Na Carteira, cada ação mostra a **cotação de agora** e, embaixo, o **PM**. Fica **verde** quando a cotação está igual ou acima do PM e **vermelho** quando está abaixo. O PM está no app do Nubank, na página de cada ação.

## 4. Esconder valores
Toque no card **Seu patrimônio** no Início para esconder ou mostrar os valores (aparece "R$ ••••"). Vale também para o widget e a Ilha Dinâmica.

## 5. Alertas de preço
Toque no **sininho** no topo. Escolha o ativo e o tipo: **acima de**, **abaixo de** ou **cair X% no dia**. Permita as notificações quando o iPhone pedir. Cada alerta avisa no máximo uma vez por dia. Com o app fechado, o iPhone decide quando checar (geralmente a cada 15 minutos ou mais).

## 6. Meta do cofrinho
Toque na **engrenagem** no topo > **Meta do cofrinho** e digite o valor. O Início mostra a barra de progresso (escondida junto com os valores).

## 7. Face ID
Engrenagem > **Face ID**: dá para exigir Face ID **ao abrir o app** e/ou **para mostrar os valores escondidos**. Se o Face ID falhar, dá para usar a senha do iPhone.

## 8. Widget
Na tela inicial, segure num espaço vazio > **+** (Editar) > procure **Pilinha** > escolha o tamanho > **Adicionar widget**. Ele mostra o porquinho, o total e a variação do dia.

## 9. Ilha Dinâmica
No Início, toque em **Acompanhar na Ilha Dinâmica**. O porquinho aparece no topo da tela com a variação do dia. Para tirar, toque no mesmo botão de novo.

## 10. Trazer a carteira do Mac
No Mac, o arquivo fica em `~/.notchinvest/portfolio.json`. Mande por **AirDrop** para o iPhone (ou salve no app Arquivos). No Pilinha: Cadastro > **Importar arquivo** e escolha o arquivo. Isso substitui a carteira do iPhone. O arquivo tem os seus valores, então não mande por e-mail ou WhatsApp.

## Dúvidas comuns
- **"Hoje —"**: ainda não tem variação do dia (bolsa fechada ou carregando). Puxe a tela para baixo para atualizar.
- **Erro de cotação**: confira o código da ação. O app usa o Yahoo Finance; com o token da brapi (opcional, no Cadastro) aparecem também os proventos automáticos.
