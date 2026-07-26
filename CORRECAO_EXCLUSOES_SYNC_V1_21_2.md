# Amanda Estética Clínica v1.21.2 — correção de exclusões e sincronização

## Problema corrigido

Exclusões legítimas de atendimentos e lançamentos financeiros podiam ser tratadas pelo Data Guard como uma queda suspeita quando a coleção chegava a zero. O salvamento principal no Google Drive era bloqueado, enquanto a ponte de integração podia publicar a exclusão antes da confirmação do banco oficial. Ao recarregar ou receber uma atualização do Drive, os registros antigos reapareciam.

## Correções aplicadas

- Exclusões confirmadas pelo usuário recebem autorização temporária e exata de contagem `antes → depois`.
- A autorização não libera uma queda diferente da que foi confirmada.
- Atendimento, lançamento financeiro e demais exclusões críticas capturam a contagem anterior antes de alterar a base.
- Alterações pendentes continuam marcadas até o Google Drive confirmar a gravação.
- Falhas transitórias de rede entram em nova tentativa automática, sem permitir que a atualização ao vivo sobrescreva a alteração local pendente.
- A ponte Amanda → Borion só publica depois que o arquivo principal da Amanda foi salvo com sucesso.
- O shadow e os tombstones da integração são preparados antes do salvamento principal, ficando duráveis no Google Drive.
- A ponte passou para a versão 1.1.0 e identifica a origem como Amanda Estética v1.21.2.

## Validações executadas

- Exclusão do último lançamento financeiro com gravação confirmada no Drive.
- Rejeição de autorização quando a queda real não corresponde à exclusão confirmada.
- Geração de tombstone quando um lançamento desaparece da origem.
- Bloqueio da publicação da ponte enquanto o banco principal ainda está pendente.
- Verificação de sintaxe de todos os arquivos JavaScript.
