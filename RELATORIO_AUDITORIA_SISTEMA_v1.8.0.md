# Relatório de auditoria do sistema — Amanda Estética v1.8.0

## Objetivo

Esta versão foi tratada como uma auditoria funcional completa, não apenas como uma correção visual. O sistema foi percorrido como se estivesse em uso real: cadastro, alteração, vínculo, conclusão, cancelamento, exclusão, estoque, sessões, financeiro, backup e restauração.

Foram revisadas 12 telas, 12 formulários, 79 ações de interface, 21 módulos JavaScript e 16 módulos CSS.

## Resultado geral

A base ficou com uma camada central de integridade responsável por manter os dados relacionados sincronizados. O aplicativo agora verifica automaticamente cliente, protocolo, pacote, atendimento, estoque e financeiro ao abrir, importar ou restaurar uma base.

A nova função fica disponível também em **Configurações → Verificar integridade**.

## Matriz de vínculos revisada

| Origem | Registros sincronizados ou protegidos |
|---|---|
| Cliente | Agenda, pacotes, atendimentos, anamneses, consentimentos, fotos e financeiro |
| Protocolo | Agenda, pacotes, atendimentos, consentimentos, fotos, produtos e custos |
| Produto | Protocolos, quantidade usada por sessão, estoque e histórico de movimentação |
| Pacote | Cliente, protocolo, sessões realizadas, sessões restantes, valor recebido, saldo pendente e financeiro |
| Atendimento | Cliente, protocolo, pacote, agenda de origem, produtos consumidos, estoque, custo, lucro e financeiro |
| Consentimento | Cliente, protocolo, assinatura, aceite, impressão/PDF e exclusão |
| Perfil | Base exclusiva, configurações, backup e exclusão protegida quando existe outro perfil |

## Correções e melhorias executadas

### Clientes

- Edição do nome e telefone agora atualiza os registros vinculados.
- CPF duplicado é bloqueado.
- WhatsApp aceita telefone com ou sem o código 55, sem duplicar o país.
- A ficha mostra atendimentos, pacotes, anamneses, fotos, consentimentos e agenda.
- Foram adicionados atalhos para agendar, registrar atendimento, anamnese, pacote, foto e consentimento.
- A exclusão informa a quantidade de vínculos e trata os registros relacionados de forma explícita.
- O total pago da cliente agora vem dos lançamentos financeiros quitados, incluindo pacotes, em vez de somar apenas atendimentos.

### Agenda

- Agendamentos cancelados ou concluídos não exibem ações incompatíveis de confirmar ou registrar novamente.
- Um atendimento criado a partir de um agendamento fica ligado ao agendamento original.
- O mesmo agendamento não cria dois atendimentos: se já existir, o atendimento existente é aberto.
- Ao concluir um atendimento, o agendamento vira concluído.
- Ao excluir o atendimento, o agendamento volta para confirmado ou agendado.
- Agendamento de sessão de pacote usa valor zero para não duplicar receita.
- Exclusão de agendamento foi adicionada.

### Protocolos e produtos

- Produtos vinculados ao protocolo agora possuem ID, nome, unidade, quantidade, custo unitário e custo total.
- Não é mais possível salvar produto inexistente, arquivado ou com quantidade zero no protocolo.
- O custo do protocolo nunca fica abaixo do custo dos produtos vinculados.
- Alterar código ou nome de protocolo atualiza agenda, pacotes, atendimentos, consentimentos, fotos e financeiro.
- Alterar código, nome ou custo de produto atualiza os vínculos dos protocolos.
- Produto ou protocolo com histórico não é apagado silenciosamente: é arquivado para preservar os registros.
- Produto arquivado ligado a protocolo é apontado pelo verificador de integridade e bloqueia novas sessões até ser corrigido.
- Ajustes manuais de estoque por `+` e `−` agora entram no histórico de auditoria.

### Pacotes e sessões

- Sessões realizadas são calculadas pelos atendimentos realmente vinculados ao pacote.
- Sessões anteriores ao uso do sistema continuam suportadas por um campo de saldo inicial.
- O sistema impede saldo inicial maior que a quantidade comprada.
- O sistema impede registrar sessões além do total contratado.
- Cliente e protocolo do pacote não podem ser trocados depois que já existem sessões registradas.
- Pacotes cancelados ou concluídos não aceitam novas sessões.
- Valor recebido maior que o valor total do pacote é bloqueado.
- O pacote gera dois lançamentos automáticos quando necessário: valor recebido e saldo pendente.
- Cancelar um pacote encerra o saldo pendente, mas preserva o valor já recebido.
- Pacote com histórico clínico ou financeiro não é apagado: é cancelado e preservado.
- Pacote vazio e sem financeiro pode ser excluído.

### Atendimentos, estoque e lucro

- Atendimento realizado desconta automaticamente os produtos definidos no protocolo.
- Editar o atendimento restaura primeiro o movimento anterior e aplica o novo, evitando desconto duplicado.
- Cancelar ou excluir atendimento devolve os produtos ao estoque.
- Estoque insuficiente bloqueia o salvamento antes de alterar a base.
- A prévia do formulário mostra o saldo projetado, inclusive ao editar uma sessão existente.
- O custo do atendimento considera o maior valor entre o custo-base do protocolo e o custo real dos produtos consumidos.
- O lucro é recalculado com base no valor cobrado e no custo.
- Sessões pré-pagas de pacote usam valor zero e forma de pagamento “Pacote”.
- Cobranças adicionais dentro de pacote continuam permitidas e entram no financeiro.
- Atendimento pago gera entrada quitada; atendimento não pago gera entrada pendente.
- Cancelamento ou exclusão remove o lançamento financeiro automático correspondente.

### Financeiro

- Lançamentos automáticos guardam a origem: atendimento ou pacote.
- Entradas automáticas ficam bloqueadas para edição direta; a alteração deve ser feita no atendimento ou pacote de origem.
- Isso evita divergência entre a tela clínica e o financeiro.
- Lançamentos manuais continuam editáveis e excluíveis.
- Pacotes antigos sem financeiro automático são identificados, mas não recebem lançamentos retroativos sem autorização implícita da própria edição do pacote. Isso evita duplicar valores importados manualmente.
- A reconciliação em lote foi otimizada com índices, evitando processamento quadrático em bases grandes.
- O campo de atualização dos lançamentos automáticos só muda quando algum dado realmente mudou, impedindo salvamentos repetidos em toda abertura.

### Anamneses, consentimentos e fotos

- Anamneses podem ser excluídas tanto na lista quanto na visualização.
- Consentimentos agora possuem botão de exclusão.
- Um consentimento não pode ser marcado como aceito sem nome de assinatura.
- Texto personalizado não é sobrescrito automaticamente depois de editado.
- Impressão/PDF avisa quando o navegador bloqueia pop-ups.
- Fotos continuam editáveis e excluíveis.
- Compressão de foto clínica e foto do perfil ganhou compatibilidade alternativa para navegadores que não suportam `createImageBitmap`, incluindo versões do Safari/iPhone.

### Perfis e base

- Perfil extra pode ser excluído quando existe pelo menos outro perfil.
- Antes da exclusão é criado backup local.
- O único perfil do aplicativo não pode ser apagado.
- Perfil ativo inválido em backup antigo é corrigido automaticamente.
- Bases carregadas do Google Drive, pasta local, importação JSON ou backup local passam pela mesma auditoria antes de serem usadas.

### Datas, offline e estabilidade

- A data atual deixou de usar UTC. Isso corrige o risco de o sistema considerar o dia seguinte durante a noite no Brasil.
- O service worker só retorna `index.html` como fallback em navegação. Arquivos ausentes não recebem HTML incorreto no lugar de JavaScript, CSS ou imagem.
- A versão do cache foi atualizada para `v1.8.0-integridade-total`.

## Política de exclusão aplicada

| Registro | Comportamento |
|---|---|
| Agendamento | Exclui e remove o vínculo do atendimento, caso exista |
| Atendimento | Exclui, devolve estoque, remove financeiro automático e recalcula pacote |
| Consentimento | Exclui após confirmação |
| Anamnese | Exclui após confirmação |
| Foto | Exclui após confirmação |
| Lançamento manual | Exclui após confirmação |
| Lançamento automático | Bloqueia exclusão direta; exige alterar a origem |
| Protocolo com histórico | Arquiva |
| Produto com histórico | Arquiva |
| Pacote com histórico/financeiro | Cancela e preserva valores recebidos |
| Pacote vazio | Exclui |
| Cliente | Exibe todos os vínculos e executa exclusão em cascata somente após confirmação explícita |
| Perfil extra | Cria backup e exclui a base exclusiva do perfil |

## Verificador de integridade

O relatório interno confere:

- vínculos órfãos de cliente;
- vínculos órfãos de protocolo;
- produtos de protocolo sem cadastro;
- produtos vinculados sem quantidade;
- produtos arquivados ainda usados em protocolos;
- protocolos com custo inferior ao custo dos insumos;
- IDs duplicados;
- estoque negativo;
- pacotes com sessões acima do contratado;
- pacotes antigos sem financeiro automático;
- quantidade de pacotes recalculados;
- reconciliação do financeiro automático.

## Testes executados

Foram executadas três suítes automatizadas em Chromium, totalizando 52 verificações:

- abertura das 12 telas;
- abertura dos 12 formulários;
- ausência de erros JavaScript;
- desktop e mobile sem estouro lateral;
- tela de senha integrada;
- pacote gerando valor recebido e saldo pendente;
- sessão de pacote descontando estoque sem duplicar receita;
- atendimento avulso gerando financeiro;
- cancelamento devolvendo estoque e removendo financeiro;
- atualização do nome da cliente em registros vinculados;
- exclusão de consentimento e agendamento;
- arquivamento de protocolo com histórico;
- bloqueio de sessão acima do contratado;
- bloqueio de produto inexistente no protocolo;
- preservação do valor recebido ao cancelar pacote;
- preservação de pacote com histórico;
- manutenção de itens arquivados em formulários antigos;
- exclusão segura de perfil adicional;
- links de WhatsApp com e sem código do país;
- data local em formato correto.

Também foi feito um teste sintético com:

- 1.000 clientes;
- 200 produtos;
- 200 protocolos;
- 1.000 pacotes;
- 5.000 atendimentos.

A auditoria completa levou aproximadamente **48,2 ms** na primeira reconciliação e **43,7 ms** na segunda execução no ambiente de teste. Na segunda passagem, nenhum reparo falso foi gerado.

## Limites que dependem do ambiente real

A lógica interna, a interface e os vínculos foram testados localmente. A autenticação real do Google Drive, permissões da pasta, impressão em impressoras específicas e comportamento do PWA instalado precisam ser confirmados no endereço publicado e na conta Google autorizada da Amanda. Esses pontos dependem do navegador, do domínio e das permissões externas, não apenas do código do aplicativo.

## Conclusão

A v1.8.0 deixa de ser apenas um conjunto de telas conectadas por nomes e passa a funcionar como uma base relacional protegida por regras. O foco principal foi impedir os erros mais perigosos: receita duplicada, sessão acima do pacote, estoque descontado duas vezes, histórico apagado, valor recebido perdido, cadastro órfão e divergência entre atendimento e financeiro.
