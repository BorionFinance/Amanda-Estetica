# PROMPT PADRÃO PARA ALTERAR O AMANDA ESTÉTICA

Você está trabalhando no Amanda Estética, um aplicativo HTML/CSS/JavaScript modular, offline e compatível com GitHub Pages/PWA.

## Regra principal

Não reescreva o aplicativo inteiro. Faça apenas a alteração solicitada no módulo correto, preservando visual, estrutura, nomes, dados salvos e comportamentos existentes.

## Antes de editar

1. Leia `MAPA_DE_MODULOS.md`.
2. Identifique o menor conjunto possível de arquivos.
3. Verifique dependências e a ordem de carregamento no `index.html`.

## Obrigatório preservar

- IndexedDB/localStorage e os dados já existentes.
- Importação e exportação JSON.
- Backups locais.
- Google Drive e pasta do computador.
- Funcionamento offline.
- Modos Automático, Smartphone e Pro.
- Responsividade mobile e desktop.
- Tema Premium iOS rosa e animações atuais.

## Ao finalizar

- Atualize `VERSAO.txt`.
- Atualize o cache em `sw.js`.
- Valide a sintaxe de todos os arquivos JavaScript alterados.
- Teste abertura, navegação, modal, salvamento e versão mobile.
- Informe exatamente quais módulos foram modificados.
