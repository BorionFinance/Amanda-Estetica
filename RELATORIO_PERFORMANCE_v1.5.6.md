# Relatório de desempenho — v1.5.6

## Gargalos encontrados

1. O fundo das janelas suspensas usava `backdrop-filter: blur(...)`. Ao abrir um cadastro, o navegador precisava recalcular e desfocar praticamente toda a aplicação a cada quadro da animação.
2. A janela, o fundo e vários elementos atrás dela eram promovidos para camadas gráficas ao mesmo tempo por `translateZ(0)`, `will-change`, sombras grandes e blur.
3. Trocar Lista/Colunas/Quadrados ou Todos/Dia/Mês executava `renderView()`, recriando cabeçalho, filtros e todo o conteúdo. Isso causava o “piscar”.
4. A pilha de cartões e as animações de entrada eram aplicadas a elementos demais.
5. O foco automático dos formulários acontecia durante a animação, podendo abrir teclado e forçar nova medição de layout no celular.

## Correções

- Modais usam apenas `transform` e `opacity`; o backdrop não desfoca mais a página inteira.
- O foco automático foi adiado e desativado em telas touch pequenas.
- Uma única gota se move dentro dos seletores; os botões não criam fundos separados.
- Clientes, protocolos, produtos e atendimentos recebem atualização parcial do conteúdo.
- Busca nessas áreas também atualiza apenas a lista.
- Limite de cartões simultaneamente empilhados/revelados reduzido.
- Camadas GPU permanentes e `translateZ(0)` desnecessários removidos.
- Tipografia passa a priorizar SF Pro/Segoe UI Variable e fontes nativas do sistema.

## Observação sobre 60/120/144 Hz

Um site não consegue obrigar o monitor ou celular a operar em uma taxa específica. As animações foram estruturadas para o compositor do navegador, permitindo que acompanhem a frequência disponível do aparelho quando o hardware, o navegador e a economia de energia permitirem.
