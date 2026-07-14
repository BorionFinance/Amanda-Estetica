## v1.8.0 — Auditoria relacional e integridade total

- Cliente, protocolo, pacote, atendimento, estoque e financeiro agora usam vínculos protegidos.
- Sessões movimentam estoque e reconciliam pacote/financeiro automaticamente.
- Consentimentos, anamneses, agenda, pacotes, perfis e demais registros receberam exclusão segura ou arquivamento.
- Configurações ganhou o relatório “Verificar integridade”.
- Consulte `RELATORIO_AUDITORIA_SISTEMA_v1.8.0.md` para a análise completa.

## v1.7.5 — Assinatura sem movimento por cursor
- Mantém o desenho animado da assinatura, mas remove o parallax ao passar o mouse.

## v1.7.2 — Correção emergencial
- Layout original da tela de entrada restaurado.
- Assinatura mantida grande, em tela cheia e sem recorte.
- Campos de entrada voltaram exatamente ao posicionamento da versão estável.

## v1.6.1 — Assinatura mais centralizada e fluida
- Ajuste de posição e interpolação em canvas.

## v1.5.9 — Relógio estilo tela de bloqueio

A Visão Geral agora exibe data e horário sem caixa branca, com tipografia leve e contraste elegante sobre o degradê rosa.

## v1.5.8 — Filtros expansíveis, pilha universal e continuidade visual

- Filtros viraram um único ícone que se expande no hover ou toque e se recolhe após a escolha.
- Clientes, protocolos, produtos, atendimentos, financeiro e demais listas/cartões recebem empilhamento suave no scroll.
- Menu lateral e barra superior foram integrados ao fundo para dar sensação de página única.
- Tela de seleção/criação de perfil ficou totalmente transparente, sem caixa branca.
- Trocas de filtro continuam parciais, sem recriar ou piscar a página inteira.

## v1.5.6 — Pente-fino de desempenho
- Modais sem blur de fundo e com animação apenas por transform/opacity.
- Filtros e modos de visualização com uma única gota deslizante.
- Clientes, protocolos, produtos e atendimentos atualizam apenas o conteúdo necessário, sem piscar a página.
- Tipografia nativa refinada e redução de camadas GPU permanentes.
- Limites seguros para pilha de cartões e animações de entrada.

## v1.5.2 — Configurações e transição otimizadas

- Remove blur aninhado dos cartões sticky da página Configurações.
- Impede que cards empilhados recebam simultaneamente animação de revelação.
- Transição entre bloqueio e aplicativo usa apenas transform/opacity e desliga efeitos caros enquanto ocorre.
- Mantém a pilha iOS, o fundo rosa e a direção lateral da animação.


## v1.5.1 — Otimização de desempenho

- Blur pesado concentrado apenas na barra superior, menu e janelas flutuantes.
- Cartões repetidos mantêm a transparência usando superfícies leves.
- Pilha iOS limitada a uma quantidade segura de cartões por tela.
- Animações observadas somente até aparecerem e depois liberadas.
- Imagens clínicas carregam sob demanda.
- Relógio, busca, redimensionamento e arraste do botão flutuante foram otimizados.
- Novo módulo: `css/90-performance.css`.
- Novo módulo: `css/95-performance-critical.css`.
# Amanda Estética v1.5.0 — Estrutura Modular

Esta versão mantém as funções e o visual da v1.4.4, mas organiza todo o código em pastas e módulos menores. Consulte `MAPA_DE_MODULOS.md` antes de alterar o projeto.

## v1.4.4 — Modos de interface e controles líquidos
- Menu móvel mais opaco e legível, preservando o degradê rosa.
- Modos Automático, Smartphone e Pro disponíveis em Configurações.
- Botão flutuante móvel, centralizado e arrastável para a lateral desejada.
- Seletores de lista/colunas/quadrados e opções liga/desliga com acabamento de vidro líquido.
- Barras de rolagem mais finas e delicadas.

## v1.4.3 — Pilha iOS corrigida

- Restaura o efeito de cartões sobrepostos durante a rolagem.
- A pilha agora é limitada ao próprio bloco e desaparece ao final da seção.
- O último cartão libera a pilha, evitando elementos presos ou aparecendo ao fundo.
- Aplicado às duas colunas de Configurações, no desktop e no mobile.
- Mantidas a transparência do menu, a barra superior translúcida e o fundo rosa em degradê.

## v1.4.1 — Login limpo, menu fixo e profundidade iOS
- Tela de entrada sem relógio nem monograma AB, com perfil e criação de perfil mais transparentes.
- Menu lateral fixo em toda a altura, com rolagem independente, transparência em degradê e microzoom ao passar o mouse.
- Topo mobile usa o ícone da página atual no lugar do menu de três riscos.
- Efeito de profundidade e empilhamento iOS aplicado às telas, com correção de textos sobrepostos.
- Inicial dos avatares centralizada e aviso de edição removido da visão geral.

## v1.4.0 — Rosa Premium, transições iOS e seletor em roleta

- Fundo rosa premium recuperado da v1.2.0.
- Troca de telas com deslizamento suave para esquerda e direita.
- Entrada no aplicativo e bloqueio com transições opostas.
- Seletor de data e horário em roleta no celular.
- Visão geral com saudação por horário, relógio ao vivo e botão de privacidade.
- Perfil da visão geral agora é somente informativo; alterações ficam em Configurações.

## v1.2.0 — Visual premium iOS rosa
- Interface remodelada com efeito translúcido (glassmorphism) em toda a aplicação.
- Animações mais suaves e elegantes em botões, cartões, navegação e modais.
- Visual mais sofisticado, com aparência de clínica estética premium.

# Amanda Estética — Clínica v1.1.0

Aplicativo web estático e instalável, pronto para GitHub Pages, criado a partir da planilha **CLINICA ESTETICA AVANÇADA AMANDA**.

## O que já funciona

- Perfil da Amanda, com estrutura pronta para perfis adicionais e PIN opcional
- Visão geral sem gráficos, com agenda do dia, retornos, estoque e pendências
- Agenda com confirmação e conversão do agendamento em atendimento
- Cadastro completo de clientes e histórico por cliente
- Protocolos, preços, custos, preparos e retorno
- Pacotes e controle de sessões
- Atendimentos com geração automática de entrada financeira
- Anamnese completa
- Consentimentos com impressão / salvar como PDF
- Fotos de antes e depois, com compressão no navegador
- Produtos, custos e controle de estoque
- Financeiro simples, sem gráficos, com exportação CSV
- Backup JSON, importação, backups locais e atalho `Ctrl + S`
- Google Drive direto pela conta Google, no celular e no computador
- Alternativa de sincronização por pasta do Google Drive para computador
- PWA instalável no celular e no computador

## Privacidade: leia antes de publicar

O ZIP público começa **sem clientes e sem dados clínicos**. Isso é intencional.

O arquivo separado `Amanda_Clinica_Importacao_Privada.json` contém os dados migrados da planilha e **nunca deve ser enviado ao GitHub**, anexado ao repositório ou compartilhado publicamente.

O PIN do perfil é apenas uma trava de uso dentro do navegador; ele não substitui autenticação de servidor. A proteção real dos dados depende de:

- não publicar o JSON privado;
- usar uma pasta privada no Google Drive;
- manter a conta Google com senha forte e verificação em duas etapas;
- proteger o computador e o celular usados pela clínica.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub, por exemplo `Amanda-Estetica`.
2. Envie **somente o conteúdo deste ZIP** para a raiz do repositório.
3. Abra `Settings` → `Pages`.
4. Em `Build and deployment`, selecione `Deploy from a branch`.
5. Escolha a branch `main` e a pasta `/ (root)`.
6. Salve e aguarde o endereço do GitHub Pages.

## Primeira configuração

1. Abra o aplicativo já publicado.
2. Entre no perfil Amanda.
3. Vá a `Configurações` → `Importar JSON`.
4. Escolha o arquivo privado `Amanda_Clinica_Importacao_Privada.json`.
5. Confirme a importação.
6. Em `Google Drive — conta`, clique em `Conectar Google`.
7. Entre com a conta da Amanda e escolha uma pasta privada.
8. Clique em `Salvar agora` para criar o JSON mestre e o primeiro backup no Drive.

O sistema grava na pasta escolhida:

- `Amanda_Clinica_Dados.json` — arquivo mestre;
- `Backups/` — cópias manuais e de segurança.

## Google Drive

A integração direta usa login Google e o seletor oficial de pastas. Ela funciona em celular e computador. O aplicativo só grava na pasta escolhida pela usuária.

A integração reutiliza o projeto Google já configurado para o Borion. Como a autorização OAuth é definida por origem, um repositório novo em `https://borionfinance.github.io/...` usa a mesma origem. Caso o aplicativo seja publicado em outro domínio, adicione essa nova origem autorizada no Google Cloud.

Como alternativa, Chrome e Edge no computador também permitem conectar uma pasta local já sincronizada pelo Google Drive para computador.

## Arquivos principais

- `index.html` — entrada do aplicativo
- `styles.css` — interface responsiva em rosa claro
- `app.js` — módulos e regras da clínica
- `storage.js` — IndexedDB, backups e pasta local
- `gdrive.js` — login, pasta e sincronização com Google Drive
- `initial-data.js` — base pública vazia
- `manifest.json` e `sw.js` — instalação e funcionamento como PWA

## Limites atuais

- Não há servidor próprio nem login centralizado.
- Alterações simultâneas em dois dispositivos não são mescladas campo a campo; ao sincronizar, o aplicativo compara a data da base e pergunta antes de carregar uma versão mais recente.
- Fotos ficam dentro do JSON e podem aumentar o tamanho do backup. Use imagens objetivas e acompanhe o crescimento do arquivo.
- Consentimentos são gerados para impressão/salvar como PDF; assinatura eletrônica com validade jurídica específica não foi implementada.


## Correção 1.0.1
- Botões X, Cancelar e ações dentro de janelas suspensas corrigidos.
- Clique fora da janela não fecha mais o formulário.
- Botões Salvar dos formulários corrigidos para impedir recarregamento indevido da página.
- Ações internas de clientes, protocolos, anamneses e configurações revisadas.
- Salvamento duplicado dos dados da clínica removido.
- Cache do aplicativo atualizado para entregar a correção no GitHub Pages.


## Versão 1.1.0

- Modos de visualização em lista, colunas e cartões compactos para Clientes, Protocolos e Produtos.
- Filtros de atendimentos por histórico completo, dia ou mês.
- Financeiro corrigido para somar lançamentos pagos e alternar entre visão geral e mensal.
- Perfil ativo centralizado e com suporte a foto.
- Melhorias visuais nos pacotes e sessões.

## Publicação da versão modular

Substitua todo o conteúdo antigo do repositório por esta estrutura e mantenha as pastas `css/` e `js/` exatamente como estão. O aplicativo continua abrindo pelo `index.html`, funcionando no GitHub Pages e preservando os dados já salvos no navegador/Drive.
