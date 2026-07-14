# Amanda Estética v1.8.7 — correção de pastas no Google Drive

- Corrige criação repetida de `Borion_Integracoes` e `Backups`.
- Armazena e valida os IDs reais das subpastas.
- Serializa a criação entre abas com Web Locks quando disponível.
- Faz segunda consulta antes de criar para tolerar consistência eventual da API do Drive.
- Reserva e gerencia `Fotos_Clientes` sem alterar a integração financeira.
- A camada de interconexão com o Borion permanece protegida.
