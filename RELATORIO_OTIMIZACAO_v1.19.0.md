# Amanda Estética Clínica v1.19.0 — Performance Fluida

## Base utilizada

- Amanda Estética Clínica v1.18.0 — Configurações Organizadas.
- A estrutura de Configurações aprovada foi preservada.
- Não houve alteração no formato de `STATE`, perfis, registros, backups, Google Drive ou pasta local.

## Objetivo

Reduzir travamentos de rolagem, repinturas, recálculos de layout e pausas após operações de salvamento, mantendo a identidade rosa premium e aumentando discretamente a legibilidade.

## Principais otimizações aplicadas

### Rolagem e composição

- Removido o empilhamento automático que transformava dezenas de cartões em elementos `sticky`.
- Removido o `IntersectionObserver` recriado a cada renderização das páginas.
- Cartões voltaram ao fluxo normal, evitando recálculo contínuo de sobreposição, sombra e profundidade.
- Listas longas usam `content-visibility: auto` e tamanho intrínseco, permitindo ao navegador ignorar a pintura de itens fora da tela.
- Removidos `will-change` permanentes e camadas GPU desnecessárias.
- Efeitos de vidro em tempo real (`backdrop-filter`) foram substituídos por fundos e gradientes estáveis visualmente semelhantes.

### Navegação, filtros e animações

- Transições de página ficaram mais curtas e usam somente opacidade e transformação.
- Atualizações parciais de filtros não fazem mais leitura geométrica síncrona antes de trocar o conteúdo.
- O observador do Borion Hub deixou de monitorar toda a árvore do aplicativo.
- Observadores de modal e shell ficaram restritos ao nível necessário.
- Arraste da ordenação nas Configurações e arraste de modais são limitados a uma atualização por quadro com `requestAnimationFrame`.
- Atualização da viewport mobile é agrupada por quadro e não roda durante o scroll.

### Salvamento e transações

- A conexão com IndexedDB é reutilizada, em vez de ser reaberta em cada operação.
- O estado principal continua sendo salvo imediatamente no IndexedDB.
- O snapshot redundante do `localStorage` agora é consolidado e executado em período ocioso.
- Removida a clonagem e serialização dupla do estado para o snapshot local.
- Autosave da pasta e Google Drive é agrupado e executado fora do momento crítico da interação.
- Dados, integridade, backup e sincronização mantêm os mesmos formatos e fluxos.

### Tipografia e acabamento

- Aumento leve e consistente das fontes em menus, botões, campos, tabelas, cartões e Configurações.
- Textos auxiliares pequenos foram ampliados para melhorar a leitura.
- Mantidos os tons rosados, bordas suaves, gradientes e hierarquia visual.
- Hovers foram reduzidos a microinterações discretas, sem ampliar cartões inteiros.

### Arquivos de imagem

- `signature-animation.webp`: 3.167.828 bytes → 1.986.898 bytes, redução de 37,28%.
- `signature-final.webp`: 76.980 bytes → 42.272 bytes, redução de 45,09%.
- Dimensão da assinatura: 668×1000 → 501×750.
- Os 83 quadros e o comportamento de repetição original foram preservados.
- Depois da animação, o aplicativo troca para a imagem final estática para liberar a sequência animada.

## Resultado de tamanho

- Projeto descompactado antes: 3.901.439 bytes.
- Projeto descompactado depois: 2.678.902 bytes.
- Redução total aproximada: 31,34%.

## Arquivos modificados

- `assets/signature-animation.webp`
- `assets/signature-final.webp`
- `css/180-performance-fluid.css` — novo
- `index.html`
- `js/borion-hub.js`
- `js/core/01-state-utils.js`
- `js/core/03-shell-navigation.js`
- `js/core/05-events-boot.js`
- `js/core/06-fast-ui.js`
- `js/core/07-login-signature.js`
- `js/core/09-mobile-experience.js`
- `js/services/storage.js`
- `manifest.json`
- `sw.js`

## Versionamento e cache

- Versão atualizada para `1.19.0`.
- Cache do Service Worker: `amanda-clinica-v1.19.0-performance-fluid`.
- Novo CSS adicionado ao `APP_SHELL`.
- Query strings dos arquivos alterados atualizadas para `v=1.19.0`.
- Referências do `index.html` e do Service Worker conferidas de forma exata.

## Validações executadas

- 221 verificações automatizadas concluídas sem erro.
- Sintaxe validada em 25 arquivos JavaScript e no Service Worker.
- Todos os 26 arquivos CSS analisados sem erro de parsing.
- `manifest.json` validado.
- Todos os caminhos do `index.html` e `APP_SHELL` existem e estão alinhados.
- Cinco seções de Configurações preservadas.
- Um único input de importação JSON preservado.
- Assinatura validada com 83 quadros, dimensão correta e repetição original.
- ZIP testado quanto à integridade após a compactação.

## Observação sobre 60 FPS

O código foi reorganizado para trabalhar dentro do padrão de um quadro por atualização e para evitar os gargalos que causavam a aparência de 3 FPS. A taxa exata depende do aparelho, navegador, quantidade de registros, tamanho das fotos e tarefas do sistema operacional. O ambiente de geração não permitiu abrir uma sessão gráfica real do Chromium para medir FPS com DevTools; portanto, não há uma promessa artificial de um número fixo em todos os dispositivos. A validação final em aparelho deve observar scroll, filtros, abertura de modais e salvamentos com uma base real grande.
