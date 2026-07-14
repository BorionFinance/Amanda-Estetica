# Primeiros passos

## 1. Publique apenas o aplicativo

Envie ao GitHub somente os arquivos deste projeto.

**Não envie ao GitHub:** `Amanda_Clinica_Importacao_Privada.json`.

## 2. Importe os dados privados

Depois que o site estiver publicado:

1. Abra `Configurações`.
2. Clique em `Importar JSON`.
3. Selecione `Amanda_Clinica_Importacao_Privada.json`.
4. Confirme a substituição da base vazia.

## 3. Conecte o Google Drive

1. Em `Google Drive — conta`, clique em `Conectar Google`.
2. Entre com a conta da Amanda.
3. Escolha uma pasta privada.
4. Clique em `Salvar agora`.

## 4. Faça um teste completo

- cadastre um cliente de teste;
- crie um agendamento;
- transforme-o em atendimento;
- confira a entrada no financeiro;
- recarregue a página;
- use `Sincronizar agora`;
- confirme se `Amanda_Clinica_Dados.json` e a pasta `Backups` apareceram no Drive.

Depois, exclua o cliente de teste.

## Estrutura modular v1.5.0

Ao publicar no GitHub, envie as pastas `css` e `js` completas, preservando exatamente os nomes e subpastas. Não mova os arquivos internos para a raiz, porque o `index.html` e o cache offline usam esses caminhos.
