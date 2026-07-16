# Clube de Leitura da Biblia PIBA

Primeira versao do portal diario de leitura biblica.

## Como usar

Publique esta pasta no GitHub Pages, preferencialmente no repositorio:

```text
leitura-biblica
```

Assim o endereco principal ficara:

```text
https://prgilbertosilva.github.io/leitura-biblica/
```

O site carrega o plano de `data/leituras.js`, com `data/leituras.json` mantido como referencia. O texto biblico vem de `data/biblia-nvi.js`, gerado a partir do modulo local `biblia/NVI.ont`.

Para acrescentar novos dias, adicione objetos neste formato:

```json
{
  "date": "2026-07-16",
  "oldTestament": "Eclesiastes 7-8",
  "wisdom": "",
  "newTestament": "Colossenses 3",
  "oldText": "",
  "wisdomText": "",
  "newText": "",
  "message": "Texto da reflexao do dia."
}
```

Quando os campos `oldText`, `wisdomText` e `newText` ficam vazios, o site busca automaticamente o texto biblico em `data/biblia-nvi.js`.

## Links diarios

Quando publicado em `https://prgilbertosilva.github.io/leitura-biblica/`, a leitura do dia 16 de julho de 2026 ficara em:

```text
https://prgilbertosilva.github.io/leitura-biblica/2026/07/16/
```

Para URLs desse formato funcionarem no GitHub Pages, publique tambem uma copia de `index.html` como `404.html`, ou configure o repositorio para redirecionar todas as rotas para a pagina principal.

Este pacote ja inclui o arquivo `404.html`.

## Mensagem para WhatsApp

O botao "Compartilhar" monta automaticamente uma mensagem neste modelo:

```text
📖 Leitura para hoje: 16 de julho de 2026
Bom dia! ☀️

📘 Eclesiastes 7 a 8
📗 Colossenses 3

🔗 Acesse a leitura de hoje:
https://prgilbertosilva.github.io/leitura-biblica/2026/07/16/

🌱📖 Reflexao do dia...

Leu tudinho? Deixe o seu amem 🙌🙏
```

## Gerar JSON a partir de CSV

Use `tools/csv-to-json.ps1` com um CSV exportado da planilha contendo as colunas:

```text
Data,Antigo Testamento,Salmos / Proverbios,Novo Testamento,Texto Antigo Testamento,Texto Salmos / Proverbios,Texto Novo Testamento,Mensagem
```

Exemplo:

```powershell
powershell.exe -ExecutionPolicy Bypass -File tools\csv-to-json.ps1 -CsvPath plano.csv
```

O script atualiza `data/leituras.json` e `data/leituras.js`.

## Publicar no GitHub Pages

1. Crie um repositorio chamado `leitura-biblica`.
2. Envie todos os arquivos desta pasta para o repositorio.
3. No GitHub, abra `Settings` > `Pages`.
4. Em `Build and deployment`, escolha `Deploy from a branch`.
5. Selecione a branch principal e a pasta `/root`.
6. Acesse `https://prgilbertosilva.github.io/leitura-biblica/`.

Depois disso, a mensagem diaria do WhatsApp pode apontar sempre para o link do dia, por exemplo:

```text
https://prgilbertosilva.github.io/leitura-biblica/2026/07/16/
```
