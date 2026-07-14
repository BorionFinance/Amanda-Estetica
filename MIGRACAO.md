# Migração da planilha para o aplicativo

A importação privada foi construída a partir das abas:

- `AMANDA`
- `Clientes`
- `Protocolos`
- `Produtos`
- `Pacotes_Sessoes`
- `Atendimentos`
- `Financeiro_Detalhado`

Foram extraídos para o arquivo privado:

- 11 clientes
- 20 protocolos
- 27 produtos
- 4 pacotes
- 22 atendimentos
- 15 lançamentos financeiros

As fórmulas da planilha não foram copiadas literalmente. O aplicativo recalcula custos, resultados, sessões restantes, retornos e resumos diretamente em JavaScript.

Campos clínicos sem registros preenchidos na planilha, como anamnese, consentimentos e fotos, começam vazios e já estão prontos para uso.

O projeto público não contém esses registros. Eles estão somente em `Amanda_Clinica_Importacao_Privada.json`, entregue separadamente para importação após a publicação.
