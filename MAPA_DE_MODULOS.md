# MAPA DE MÓDULOS — Amanda Estética v1.8.0

Esta versão foi organizada para permitir alterações pequenas e seguras por área, sem reescrever o aplicativo inteiro.

## Estrutura principal

- `index.html` — carrega os arquivos na ordem correta.
- `manifest.json` — instalação como PWA.
- `sw.js` — cache/offline. Sempre aumente a versão do cache ao publicar mudanças.
- `initial-data.json` — base inicial legível, sem dados privados da clínica.

## CSS

- `css/00-base.css` — base visual, shell, componentes, páginas e formulários.
- `css/10-views-filters.css` — lista/colunas/quadrados, filtros e responsividade inicial.
- `css/20-theme-premium-ios.css` — tema rosa, vidro e acabamento Premium iOS.
- `css/30-pro-layout.css` — layout Pro, dashboard e Configurações.
- `css/40-transitions-ios.css` — transições entre telas e seletores mobile.
- `css/50-fixed-menu-depth.css` — menu fixo, microzoom e profundidade.
- `css/60-transparency-menu.css` — transparência da barra lateral, topo e seleção.
- `css/70-stack-scroll.css` — sobreposição dos cartões durante o scroll.
- `css/80-liquid-interface.css` — gotas líquidas, toggles, modos de interface e FAB móvel.
- `css/90-performance.css` a `css/97-continuity-expandable-stack.css` — desempenho, modais leves, filtros e pilha universal.
- `css/98-lockscreen-clock.css` — relógio da Visão Geral.
- `css/99-login-signature.css` — assinatura e autenticação da tela de bloqueio.
- `css/100-integrity-relations.css` — relatório de integridade, estados arquivados, vínculos e alertas clínicos.

A ordem dos CSS no `index.html` é intencional. Arquivos posteriores refinam os anteriores.

## JavaScript — dados e serviços

- `js/data/initial-data.js` — estrutura inicial do aplicativo.
- `js/services/storage.js` — IndexedDB/localStorage, importação, exportação, pasta e backups locais.
- `js/services/google-drive.js` — conexão e sincronização com Google Drive.
- `js/services/sync-backup.js` — comandos de salvar, carregar, sincronizar e exportar.

## JavaScript — núcleo

- `js/core/00-config-icons.js` — nomes das telas e ícones SVG.
- `js/core/01-state-utils.js` — estado, utilitários, persistência, privacidade, filtros e modos Pro/Smartphone/Automático.
- `js/core/02-ui-components.js` — campos, modais e roletas iOS de data/hora.
- `js/core/03-shell-navigation.js` — login, shell, menu, transições, relógio e navegação.
- `js/core/04-actions.js` — central que liga botões às funções.
- `js/core/05-events-boot.js` — inicialização e eventos globais.
- `js/core/06-fast-ui.js` — atualizações parciais e filtros sem piscar a tela.
- `js/core/07-login-signature.js` — desenho sólido da assinatura na tela de bloqueio.
- `js/core/08-integrity-relations.js` — vínculos, estoque, sessões, financeiro, auditoria, exclusão e arquivamento seguro.

## JavaScript — telas

- `js/views/00-dashboard.js` — Visão Geral.
- `js/views/01-agenda-clients.js` — Agenda e Clientes.
- `js/views/02-clinical-catalog.js` — Protocolos, pacotes, atendimentos, anamneses, consentimentos, fotos e produtos.
- `js/views/03-finance-settings.js` — Financeiro e Configurações.

## JavaScript — formulários

- `js/forms/00-appointments-clients.js` — Agenda, Clientes e Protocolos.
- `js/forms/01-packages-attendance.js` — Pacotes, sessões e Atendimentos.
- `js/forms/02-records-media.js` — Anamneses, Consentimentos e Fotos.
- `js/forms/03-products-profile.js` — Produtos, Financeiro, Perfil e Dados da clínica.

## Regras para futuras alterações

1. Não reescrever o aplicativo inteiro.
2. Alterar somente o módulo relacionado ao pedido.
3. Preservar os nomes dos campos e a estrutura dos dados já salvos.
4. Preservar funcionamento offline, pasta local, Google Drive e backups.
5. Não adicionar bibliotecas externas sem necessidade.
6. Ao publicar uma nova versão, atualizar `VERSAO.txt` e o nome do cache em `sw.js`.
7. Manter a ordem de CSS e JavaScript definida no `index.html`.

- `css/90-performance.css`: otimizações gerais de renderização, blur, listas extensas e mobile.
- `css/95-performance-critical.css`: otimização crítica da página Configurações e da transição bloqueio ↔ aplicativo. Deve permanecer por último na cascata.

## Performance e atualizações parciais
- `js/core/06-fast-ui.js`: gota líquida, troca parcial de listas e filtros sem recriar a página.
- `css/96-performance-ultra.css`: modal leve, tipografia refinada e ajustes finais de fluidez.

- `css/97-continuity-expandable-stack.css`: filtros expansíveis, continuidade do shell e pilha universal de listas/cartões.
