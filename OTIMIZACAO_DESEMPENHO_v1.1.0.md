# Otimização de desempenho — Hub Borion v1.1.0

## Alterações

- Céu renderizado apenas na abertura e depois de redimensionar a janela.
- Removido loop permanente de `requestAnimationFrame` a 60 FPS.
- Meteoro migrado para animação rara pelo compositor do navegador.
- Removidos `backdrop-filter` e blur de 80 px em camada maior que a tela.
- Aurora convertida em gradientes estáticos.
- Flutuação contínua dos três orbes removida.
- Movimento do satélite ocorre somente durante hover/foco.
- Reflexo do mouse ativado somente em dispositivos com ponteiro preciso.
- Densidade máxima do canvas limitada a 1,35× para reduzir memória em celulares de alta resolução.
- Redimensionamento usa debounce e não redesenha continuamente ao maximizar a aba.
- Cartões receberam borda parcial e mais discreta para reforçar o efeito flutuante.

## Resultado arquitetural

Em repouso, o Hub não mantém loop de desenho ou animações visuais contínuas. O navegador só trabalha novamente ao redimensionar, interagir, exibir o meteoro raro ou navegar para outro aplicativo.
