# Testes automatizados — proteção de dados (V1.20.0)

Testes reais, sem dependências externas (usam só `node:test`, nativo do Node 18+).

## Rodar

```bash
node --test tests/*.test.js
```

(Rodar `node --test tests/` sem o `*.test.js` também tenta executar os
arquivos auxiliares como se fossem testes — use sempre o glob acima.)

## Arquivos

- `data-guard.test.js` — lógica pura de contagem de registros e detecção de
  gravação suspeita (`js/services/data-guard.js`). 12 casos.
- `app-lifecycle.test.js` — máquina de estados de inicialização e as travas
  de gravação (`js/services/app-lifecycle.js`). 9 casos.
- `google-drive-guard.simulation.test.js` — testes de ponta a ponta rodando
  o **código real** de `js/services/google-drive.js` dentro de um sandbox
  Node (`vm`), contra um Google Drive falso em memória (`fake-drive-server.js`).
  Inclui a reprodução exata do incidente relatado (cache local vazio tentando
  sobrescrever uma base do Drive com dados). 8 casos.
- `browser-sandbox.js` / `fake-drive-server.js` / `setup-crypto-shim.js` —
  infraestrutura de apoio aos testes acima (não são testes por si só).

## O que NÃO é coberto aqui

OAuth real do Google e o seletor de pastas (Picker) exigem um navegador de
verdade e uma conta autorizada — não dá para simular isso em Node. Esses
pontos ficam no checklist manual do `RELATORIO_SEGURANCA_DADOS_v1.20.0.md`.
