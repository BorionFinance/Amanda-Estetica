# Amanda Estética v1.8.9 — trava do arquivo principal no Google Drive

Correção isolada no transporte do arquivo `Amanda_Clinica_Dados.json`.

- guarda e valida o ID permanente do JSON principal;
- serializa salvamentos automático e manual;
- impede duas criações concorrentes na mesma origem/abas;
- repete a consulta antes da primeira criação;
- reutiliza o arquivo principal mais recentemente modificado quando já existem duplicatas;
- bloqueia cliques repetidos em Conectar, Salvar agora e Sincronizar enquanto a operação anterior está em andamento;
- não altera agenda, clientes, protocolos, estética ou a camada protegida de interconexão com o Borion.
