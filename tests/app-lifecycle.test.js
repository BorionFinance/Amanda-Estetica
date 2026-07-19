const assert = require('node:assert/strict');
const test = require('node:test');
const { createLifecycle, STATES } = require('../js/services/app-lifecycle.js');

test('começa em BOOTING e não permite gravação', () => {
  const lc = createLifecycle();
  assert.equal(lc.get(), 'BOOTING');
  assert.equal(lc.canWrite(), false);
  assert.equal(lc.canEdit(), false);
});

test('só permite gravar depois de TODAS as travas + estado READY', () => {
  const lc = createLifecycle();
  lc.set('AUTHENTICATING');
  lc.set('CONNECTING_TO_DRIVE');
  lc.set('LOADING_REMOTE_DATABASE');
  assert.equal(lc.canWrite(), false, 'ainda carregando, não pode gravar');

  lc.markRemoteLoaded(184, 'workspace-1');
  assert.equal(lc.canWrite(), false, 'faltam as outras travas');

  lc.set('VALIDATING_REMOTE_DATABASE');
  lc.markRemoteValidated();
  assert.equal(lc.canWrite(), false, 'estado ainda não é READY');

  lc.set('READY');
  assert.equal(lc.canWrite(), false, 'hidratação ainda não concluída');

  lc.markHydrationFinished();
  assert.equal(lc.canWrite(), false, 'permissão de escrita ainda não concedida');

  lc.grantWritePermission();
  assert.equal(lc.canWrite(), true, 'todas as travas liberadas + READY = pode gravar');
});

test('qualquer trava que caia bloqueia a gravação de novo (ex.: token expirou)', () => {
  const lc = createLifecycle();
  lc.markRemoteLoaded(1, 'w');
  lc.markRemoteValidated();
  lc.markHydrationFinished();
  lc.grantWritePermission();
  lc.set('READY');
  assert.equal(lc.canWrite(), true);

  lc.revokeWritePermission();
  assert.equal(lc.canWrite(), false);
});

test('estados de erro/offline nunca permitem gravação mesmo com travas ligadas', () => {
  const lc = createLifecycle();
  lc.markRemoteLoaded(1, 'w');
  lc.markRemoteValidated();
  lc.markHydrationFinished();
  lc.grantWritePermission();
  ['SYNC_ERROR', 'ACCESS_DENIED', 'OFFLINE', 'RECOVERY_REQUIRED', 'BOOTING'].forEach(errorState => {
    lc.set(errorState);
    assert.equal(lc.canWrite(), false, `não deveria poder gravar em ${errorState}`);
  });
});

test('canEdit permanece true durante SAVING mas canWrite não reabre uma segunda gravação concorrente por si só', () => {
  const lc = createLifecycle();
  lc.markRemoteLoaded(1, 'w');
  lc.markRemoteValidated();
  lc.markHydrationFinished();
  lc.grantWritePermission();
  lc.set('READY');
  lc.set('SAVING');
  assert.equal(lc.canEdit(), true);
});

test('resetForReconnect derruba todas as travas (usado ao trocar de conta/pasta)', () => {
  const lc = createLifecycle();
  lc.markRemoteLoaded(1, 'w');
  lc.markRemoteValidated();
  lc.markHydrationFinished();
  lc.grantWritePermission();
  lc.set('READY');
  assert.equal(lc.canWrite(), true);

  lc.resetForReconnect();
  lc.set('CONNECTING_TO_DRIVE');
  assert.equal(lc.canWrite(), false);
});

test('rejeita nomes de estado desconhecidos (erro de digitação no código)', () => {
  const lc = createLifecycle();
  assert.throws(() => lc.set('READYY'));
});

test('listeners são notificados a cada transição, com estado e detalhe', () => {
  const lc = createLifecycle();
  const seen = [];
  lc.on((state, detail) => seen.push([state, detail]));
  lc.set('AUTHENTICATING', 'tentando token silencioso');
  lc.set('OFFLINE', 'sem internet');
  assert.deepEqual(seen, [
    ['AUTHENTICATING', 'tentando token silencioso'],
    ['OFFLINE', 'sem internet']
  ]);
});

test('STATES cobre exatamente os 11 estados exigidos pela especificação', () => {
  assert.deepEqual([...STATES].sort(), [
    'ACCESS_DENIED', 'AUTHENTICATING', 'BOOTING', 'CONNECTING_TO_DRIVE',
    'LOADING_REMOTE_DATABASE', 'OFFLINE', 'READY', 'RECOVERY_REQUIRED',
    'SAVING', 'SYNC_ERROR', 'VALIDATING_REMOTE_DATABASE'
  ].sort());
});
