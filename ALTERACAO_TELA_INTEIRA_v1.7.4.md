# Amanda Estética v1.7.4 — Tela de entrada inteira e assinatura sem recorte

- Removido o limite de largura da tela de entrada (`max-width`).
- A assinatura agora usa um canvas fixo do tamanho exato do viewport.
- O desenho é calculado pela área real dos traços, com margens seguras em todos os lados.
- O B permanece inteiro mesmo em telas largas, baixas ou no modo mobile.
- O início do A ganhou uma entrada progressiva antes da sequência dos 20 frames.
- A interpolação usa `requestAnimationFrame` e crossfade correto entre os frames.
- Adicionado parallax extremamente sutil no desktop, sem afetar o desempenho mobile.
- Conteúdo da frente continua recortando visualmente a assinatura e permanece legível.
