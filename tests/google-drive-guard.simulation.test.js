const assert = require('node:assert/strict');
const test = require('node:test');
const { createSandbox } = require('./browser-sandbox');
const { makeFakeDrive } = require('./fake-drive-server');

function clinicState(counts = {}) {
  const data = {};
  ['clients', 'products', 'disposables', 'protocols', 'packages', 'appointments', 'attendances', 'anamneses', 'consents', 'photos', 'finance'].forEach(key => {
    data[key] = new Array(counts[key] || 0).fill(0).map((_, i) => ({ id: `${key}_${i}` }));
  });
  data.settings = { autosaveFolder: true, autosaveGoogle: true };
  data.audit = [];
  return {
    schemaVersion: 1,
    appId: 'amanda-clinica',
    updatedAt: new Date().toISOString(),
    profiles: [{ id: 'amanda', name: 'Amanda' }],
    activeProfileId: 'amanda',
    dataByProfile: { amanda: data }
  };
}

function setupConnectedSandbox() {
  const drive = makeFakeDrive();
  const sandbox = createSandbox({ fetchImpl: drive.fetch });
  sandbox.GoogleDriveClinic.__test.enableTestMode();
  sandbox.GoogleDriveClinic.__test.setToken();
  sandbox.GoogleDriveClinic.__test.setFolderIdForTests('ROOT_FOLDER');
  const now = new Date().toISOString();
  drive.files.set('ROOT_FOLDER', { id: 'ROOT_FOLDER', name: 'Amanda_Estetica', mimeType: 'application/vnd.google-apps.folder', parents: [], trashed: false, createdTime: now, modifiedTime: now, content: null });
  // Pré-cria as subpastas do app para não cair no laço de espera por
  // consistência eventual do Drive real (ensureFolderUncached), que não faz
  // sentido num Drive falso em memória e só deixaria os testes mais lentos.
  ['Backups', 'Borion_Integracoes', 'Fotos_Clientes'].forEach(name => drive.createFolder(name, ['ROOT_FOLDER']));
  return { drive, sandbox };
}

test('primeira sincronização: cria a base no Drive com revisão 1 e workspaceId', async () => {
  const { sandbox } = setupConnectedSandbox();
  const state = clinicState({ clients: 2 });
  const result = await sandbox.GoogleDriveClinic.sync(state, { backup: true });
  assert.equal(result.direction, 'local');
  assert.equal(result.created, true);
  assert.equal(result.revision, 1);
  assert.equal(sandbox.AppLifecycle.getRevision(), 1);
  assert.ok(sandbox.AppLifecycle.getWorkspaceId());
});

test('CENÁRIO DO INCIDENTE: cache local vazio nunca sobrescreve uma base preenchida no Drive', async () => {
  const { sandbox } = setupConnectedSandbox();

  // Uma base "real" já preenchida existe no Drive de uma sessão anterior.
  const populated = clinicState({ clients: 120, appointments: 840, finance: 1320 });
  const first = await sandbox.GoogleDriveClinic.sync(populated, { backup: true });
  assert.equal(first.created, true);

  // Simula reabrir o app com o IndexedDB/localStorage limpos: uma NOVA sessão,
  // sem nunca ter carregado revisão nenhuma (AppLifecycle do zero) e com STATE
  // vindo do seed vazio — exatamente o cenário relatado.
  const freshSandboxState = sandbox.AppLifecycleFactory.createLifecycle();
  sandbox.AppLifecycle = freshSandboxState; // nova sessão, sem revisão conhecida

  const emptySeed = clinicState({}); // base vazia (equivalente ao AMANDA_INITIAL_DATA)
  await assert.rejects(
    () => sandbox.GoogleDriveClinic.save(emptySeed, {}),
    (error) => {
      assert.equal(error.code, 'SUSPICIOUS_WRITE');
      return true;
    },
    'a gravação direta de uma base vazia sobre uma base preenchida deveria ser bloqueada'
  );

  // Confirma que o arquivo principal no Drive continua intacto.
  const reread = await sandbox.GoogleDriveClinic.load({});
  assert.equal(reread.counts.clients, 120);
  assert.equal(reread.counts.appointments, 840);
  assert.equal(reread.counts.finance, 1320);
});

test('sync() com sessão nova (revisão desconhecida) sempre prefere o remoto, nunca o local', async () => {
  const { sandbox } = setupConnectedSandbox();
  const populated = clinicState({ clients: 50 });
  await sandbox.GoogleDriveClinic.sync(populated, { backup: true });

  // Nova sessão "sem login" que nunca carregou nada do Drive.
  sandbox.AppLifecycle = sandbox.AppLifecycleFactory.createLifecycle();
  const emptySeed = clinicState({});
  const result = await sandbox.GoogleDriveClinic.sync(emptySeed, {});
  assert.equal(result.direction, 'remote');
  assert.equal(result.counts.clients, 50);
});

test('revisão obsoleta (outra aba salvou primeiro) bloqueia a segunda gravação', async () => {
  const { sandbox } = setupConnectedSandbox();
  const state = clinicState({ clients: 10 });
  await sandbox.GoogleDriveClinic.sync(state, {});
  assert.equal(sandbox.AppLifecycle.getRevision(), 1);

  // "Aba 2" com a mesma revisão carregada faz uma gravação válida primeiro.
  const revisionAfterFirstEdit = sandbox.AppLifecycle.getRevision();
  const stateFromTabTwo = clinicState({ clients: 11 });
  await sandbox.GoogleDriveClinic.save(stateFromTabTwo, { expectedRevision: revisionAfterFirstEdit });

  // "Aba 1" ainda pensa que a revisão é a 1 e tenta gravar por cima.
  const staleAttempt = clinicState({ clients: 12 });
  await assert.rejects(
    () => sandbox.GoogleDriveClinic.save(staleAttempt, { expectedRevision: revisionAfterFirstEdit }),
    (error) => { assert.equal(error.code, 'STALE_REVISION'); return true; }
  );
});

test('workspaceId incompatível bloqueia a gravação (pasta errada / clínica errada)', async () => {
  const { sandbox } = setupConnectedSandbox();
  const state = clinicState({ clients: 5 });
  await sandbox.GoogleDriveClinic.sync(state, {});

  const otherWorkspaceState = clinicState({ clients: 5 });
  otherWorkspaceState.workspaceId = 'workspace-de-outra-clinica';
  await assert.rejects(
    () => sandbox.GoogleDriveClinic.save(otherWorkspaceState, { expectedRevision: sandbox.AppLifecycle.getRevision(), skipSuspiciousCheck: true }),
    (error) => { assert.equal(error.code, 'WORKSPACE_MISMATCH'); return true; }
  );
});

test('gravação legítima com queda pequena (exclusão manual) é permitida', async () => {
  const { sandbox } = setupConnectedSandbox();
  const state = clinicState({ clients: 100 });
  await sandbox.GoogleDriveClinic.sync(state, {});

  const afterDeletingFew = clinicState({ clients: 95 });
  const result = await sandbox.GoogleDriveClinic.save(afterDeletingFew, { expectedRevision: sandbox.AppLifecycle.getRevision() });
  assert.ok(result.id);
  assert.equal(sandbox.AppLifecycle.getRevision(), 2);
});

test('gravação bem sucedida cria um snapshot do conteúdo anterior antes de sobrescrever', async () => {
  const { drive, sandbox } = setupConnectedSandbox();
  const state = clinicState({ clients: 3 });
  await sandbox.GoogleDriveClinic.sync(state, {});
  const nextState = clinicState({ clients: 4 });
  await sandbox.GoogleDriveClinic.save(nextState, { expectedRevision: sandbox.AppLifecycle.getRevision() });

  const snapshotFiles = [...drive.files.values()].filter(f => f.name.startsWith('prewrite-'));
  assert.ok(snapshotFiles.length >= 1, 'deveria existir ao menos um snapshot prewrite');
  const snapshotContent = JSON.parse(snapshotFiles[0].content);
  assert.equal(snapshotContent.dataByProfile.amanda.clients.length, 3, 'o snapshot deve conter a versão ANTERIOR (3 clientes), não a nova (4)');
});

test('gravação sem conexão nunca chega a acontecer (fetch falha -> nada é escrito)', async () => {
  const { drive, sandbox } = setupConnectedSandbox();
  const state = clinicState({ clients: 1 });
  await sandbox.GoogleDriveClinic.sync(state, {});
  const revisionBefore = sandbox.AppLifecycle.getRevision();

  drive.setNetworkFault({ match: () => true, throwNetworkError: true });
  const attemptDuringOutage = clinicState({ clients: 2 });
  await assert.rejects(() => sandbox.GoogleDriveClinic.save(attemptDuringOutage, { expectedRevision: revisionBefore }));

  drive.setNetworkFault(null);
  const reread = await sandbox.GoogleDriveClinic.load({});
  assert.equal(reread.revision, revisionBefore, 'a revisão remota não deve ter mudado durante a falha de rede');
});
