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

function setupReadySandbox() {
  const drive = makeFakeDrive();
  const sandbox = createSandbox({ fetchImpl: drive.fetch });
  sandbox.GoogleDriveClinic.__test.enableTestMode();
  sandbox.GoogleDriveClinic.__test.setToken();
  sandbox.GoogleDriveClinic.__test.setFolderIdForTests('ROOT_FOLDER');
  const now = new Date().toISOString();
  drive.files.set('ROOT_FOLDER', { id: 'ROOT_FOLDER', name: 'Amanda_Estetica', mimeType: 'application/vnd.google-apps.folder', parents: [], trashed: false, createdTime: now, modifiedTime: now, content: null });
  ['Backups', 'Borion_Integracoes', 'Fotos_Clientes'].forEach(name => drive.createFolder(name, ['ROOT_FOLDER']));
  // Sessão pronta (READY) simulada diretamente, sem passar pelo boot inteiro —
  // é exatamente o que canWrite() exige antes do live-poll fazer qualquer coisa.
  sandbox.AppLifecycle.markRemoteLoaded(0, null);
  sandbox.AppLifecycle.markRemoteValidated();
  sandbox.AppLifecycle.markHydrationFinished();
  sandbox.AppLifecycle.grantWritePermission();
  sandbox.AppLifecycle.set('READY');
  sandbox.sessionStorage.setItem('amanda_clinica_unlocked', '1');
  return { drive, sandbox };
}

test('nada mudou remotamente -> checkForRemoteUpdate não faz nada', async () => {
  const { sandbox } = setupReadySandbox();
  const state = clinicState({ clients: 3 });
  await sandbox.GoogleDriveClinic.sync(state, {}); // cria a base, revisão 1
  let renderCalls = 0;
  sandbox.renderView = () => { renderCalls++; };
  const changed = await sandbox.GoogleDriveClinic.checkForRemoteUpdate();
  assert.equal(changed, false);
  assert.equal(renderCalls, 0);
});

test('outro dispositivo salvou -> checkForRemoteUpdate busca o conteúdo novo e atualiza a tela', async () => {
  const { sandbox } = setupReadySandbox();
  const state = clinicState({ clients: 3 });
  await sandbox.GoogleDriveClinic.sync(state, {});

  // Simula "outro dispositivo": salva de novo por fora desta sessão (revisão sobe pra 2).
  const otherDeviceState = clinicState({ clients: 4 });
  await sandbox.GoogleDriveClinic.saveAuthoritative(otherDeviceState, { expectedRevision: 1, thorough: true });

  let renderCalls = 0;
  let toastMessages = [];
  sandbox.renderView = () => { renderCalls++; };
  sandbox.toast = (msg) => { toastMessages.push(msg); };
  sandbox.data = () => {};
  sandbox.runIntegrityAudit = async () => ({});

  const changed = await sandbox.GoogleDriveClinic.checkForRemoteUpdate();
  assert.equal(changed, true);
  assert.equal(renderCalls, 1, 'deveria ter chamado renderView() uma vez');
  assert.equal(sandbox.STATE.dataByProfile.amanda.clients.length, 4, 'STATE deveria refletir os dados do outro dispositivo');
  assert.equal(sandbox.AppLifecycle.getRevision(), 2, 'a revisão da sessão deveria avançar para a mais recente');
  assert.equal(toastMessages.length, 1);
});

test('sessão que nunca carregou nenhuma revisão -> live-poll não faz nada (não é papel dele decidir isso)', async () => {
  const { sandbox } = setupReadySandbox();
  const state = clinicState({ clients: 3 });
  await sandbox.GoogleDriveClinic.sync(state, {});
  // Nova sessão sem revisão conhecida (equivalente a um AppLifecycle recém-criado).
  sandbox.AppLifecycle.setRevision(null);
  const changed = await sandbox.GoogleDriveClinic.checkForRemoteUpdate();
  assert.equal(changed, false);
});

test('existe uma gravação local pendente (hasPendingGoogleDriveSave) -> nunca aplica', async () => {
  const { sandbox } = setupReadySandbox();
  const state = clinicState({ clients: 3 });
  await sandbox.GoogleDriveClinic.sync(state, {});
  await sandbox.GoogleDriveClinic.saveAuthoritative(clinicState({ clients: 4 }), { expectedRevision: 1, thorough: true });
  sandbox.hasPendingGoogleDriveSave = () => true;
  let renderCalls = 0;
  sandbox.renderView = () => { renderCalls++; };
  const changed = await sandbox.GoogleDriveClinic.checkForRemoteUpdate();
  assert.equal(changed, false);
  assert.equal(renderCalls, 0);
});

test('aba em segundo plano (document.hidden) -> não faz nada', async () => {
  const { sandbox } = setupReadySandbox();
  const state = clinicState({ clients: 3 });
  await sandbox.GoogleDriveClinic.sync(state, {});
  await sandbox.GoogleDriveClinic.saveAuthoritative(clinicState({ clients: 4 }), { expectedRevision: 1, thorough: true });
  sandbox.document.hidden = true;
  const changed = await sandbox.GoogleDriveClinic.checkForRemoteUpdate();
  assert.equal(changed, false);
});

test('modal aberto -> adia a atualização (não aplica agora, mas não descarta o sinal)', async () => {
  const { sandbox } = setupReadySandbox();
  const state = clinicState({ clients: 3 });
  await sandbox.GoogleDriveClinic.sync(state, {});
  await sandbox.GoogleDriveClinic.saveAuthoritative(clinicState({ clients: 4 }), { expectedRevision: 1, thorough: true });
  sandbox.document.body.classList.add('modal-open');
  let renderCalls = 0;
  sandbox.renderView = () => { renderCalls++; };
  const changed = await sandbox.GoogleDriveClinic.checkForRemoteUpdate();
  assert.equal(changed, false);
  assert.equal(renderCalls, 0);
  assert.equal(sandbox.AppLifecycle.getRevision(), 1, 'a revisão local não deveria avançar enquanto adiado — a próxima checagem tenta de novo');
});

test('campo de texto focado -> adia a atualização', async () => {
  const { sandbox } = setupReadySandbox();
  const state = clinicState({ clients: 3 });
  await sandbox.GoogleDriveClinic.sync(state, {});
  await sandbox.GoogleDriveClinic.saveAuthoritative(clinicState({ clients: 4 }), { expectedRevision: 1, thorough: true });
  sandbox.document.activeElement = { tagName: 'INPUT', isContentEditable: false };
  const changed = await sandbox.GoogleDriveClinic.checkForRemoteUpdate();
  assert.equal(changed, false);
});

test('checkForRemoteUpdate nunca roda antes de AppLifecycle.canWrite() (sessão ainda não pronta)', async () => {
  const { sandbox } = setupReadySandbox();
  sandbox.AppLifecycle.set('LOADING_REMOTE_DATABASE');
  const changed = await sandbox.GoogleDriveClinic.checkForRemoteUpdate();
  assert.equal(changed, false);
});
