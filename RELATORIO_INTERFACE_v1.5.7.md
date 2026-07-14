# Amanda Estética v1.5.7

## Alterações

- Filtros de visualização e período reduzidos a um único ícone.
- Expansão animada no hover em computador e no toque em celular.
- Recolhimento automático após selecionar uma opção.
- Atualização parcial do conteúdo em clientes, protocolos, produtos, atendimentos e financeiro.
- Pilha de scroll aplicada a listas, colunas e cartões compactos, sem aplicar ao menu.
- Efeito implementado sem `backdrop-filter` nos itens repetidos para evitar custo gráfico excessivo.
- Menu lateral, cabeçalho, busca e conteúdo integrados visualmente.
- Tela de perfil sem painel branco ao redor das opções.

## Desempenho

A pilha usa `position: sticky` com superfícies quase opacas e sem blur por item. O número de elementos empilhados é limitado por seção para preservar fluidez em bases grandes. Os filtros não recriam o cabeçalho: somente o conteúdo abaixo é substituído.
