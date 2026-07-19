require('./setup-crypto-shim');
const assert = require('node:assert/strict');
const test = require('node:test');
const DataGuard = require('../js/services/data-guard.js');

function stateWith(counts) {
  const data = {};
  DataGuard.CRITICAL_COLLECTIONS.forEach(key => {
    data[key] = new Array(counts[key] || 0).fill(0).map((_, i) => ({ id: `${key}_${i}` }));
  });
  data.settings = {};
  return {
    appId: 'amanda-clinica',
    dataByProfile: { amanda: data },
    profiles: [{ id: 'amanda' }]
  };
}

test('collectRecordCounts soma corretamente todas as coleções críticas', () => {
  const state = stateWith({ clients: 3, finance: 10 });
  const counts = DataGuard.collectRecordCounts(state);
  assert.equal(counts.clients, 3);
  assert.equal(counts.finance, 10);
  assert.equal(counts.products, 0);
  assert.equal(counts.__total, 13);
});

test('collectRecordCounts nunca quebra com estado vazio/ausente', () => {
  assert.doesNotThrow(() => DataGuard.collectRecordCounts(null));
  assert.doesNotThrow(() => DataGuard.collectRecordCounts({}));
  const counts = DataGuard.collectRecordCounts({});
  assert.equal(counts.__total, 0);
});

test('detectSuspiciousDrop NÃO acusa quando os números crescem ou ficam iguais', () => {
  const baseline = DataGuard.collectRecordCounts(stateWith({ clients: 120, finance: 800 }));
  const next = DataGuard.collectRecordCounts(stateWith({ clients: 121, finance: 800 }));
  const result = DataGuard.detectSuspiciousDrop(next, baseline);
  assert.equal(result.suspicious, false);
});

test('detectSuspiciousDrop ACUSA quando uma base preenchida vira zero — o bug relatado', () => {
  // Este é exatamente o cenário do incidente: cache do navegador vazio depois
  // de reabrir o app, tentando gravar por cima de uma base do Drive com dados.
  const baseline = DataGuard.collectRecordCounts(stateWith({ clients: 120, appointments: 840, finance: 1320 }));
  const next = DataGuard.collectRecordCounts(stateWith({})); // base local zerada
  const result = DataGuard.detectSuspiciousDrop(next, baseline);
  assert.equal(result.suspicious, true);
  const zeroedKeys = result.reasons.map(r => r.key);
  assert.ok(zeroedKeys.includes('clients'));
  assert.ok(zeroedKeys.includes('appointments'));
  assert.ok(zeroedKeys.includes('finance'));
  assert.ok(result.reasons.every(r => r.kind === 'zeroed'));
});

test('detectSuspiciousDrop ACUSA queda grande (>40%) mesmo sem zerar', () => {
  const baseline = DataGuard.collectRecordCounts(stateWith({ clients: 100 }));
  const next = DataGuard.collectRecordCounts(stateWith({ clients: 50 })); // caiu 50%
  const result = DataGuard.detectSuspiciousDrop(next, baseline);
  assert.equal(result.suspicious, true);
  assert.equal(result.reasons[0].kind, 'large-drop');
});

test('detectSuspiciousDrop tolera pequenas exclusões legítimas (queda pequena)', () => {
  const baseline = DataGuard.collectRecordCounts(stateWith({ clients: 100 }));
  const next = DataGuard.collectRecordCounts(stateWith({ clients: 92 })); // excluiu 8 clientes de propósito
  const result = DataGuard.detectSuspiciousDrop(next, baseline);
  assert.equal(result.suspicious, false);
});

test('detectSuspiciousDrop ignora coleções pequenas (<5) para a checagem de proporção', () => {
  const baseline = DataGuard.collectRecordCounts(stateWith({ clients: 3 }));
  const next = DataGuard.collectRecordCounts(stateWith({ clients: 1 })); // caiu 66%, mas base é minúscula
  const result = DataGuard.detectSuspiciousDrop(next, baseline);
  assert.equal(result.suspicious, false);
});

test('detectSuspiciousDrop sem baseline (primeira sincronização) nunca acusa', () => {
  const next = DataGuard.collectRecordCounts(stateWith({}));
  const result = DataGuard.detectSuspiciousDrop(next, null);
  assert.equal(result.suspicious, false);
});

test('isValidClinicSchema valida a forma mínima esperada do arquivo remoto', () => {
  assert.equal(DataGuard.isValidClinicSchema(stateWith({})), true);
  assert.equal(DataGuard.isValidClinicSchema({}), false);
  assert.equal(DataGuard.isValidClinicSchema({ appId: 'outro-app', dataByProfile: {}, profiles: [] }), false);
  assert.equal(DataGuard.isValidClinicSchema(null), false);
});

test('stateContentHash é estável independente da ordem das chaves', async () => {
  const a = { appId: 'amanda-clinica', profiles: [], dataByProfile: { amanda: { clients: [] } } };
  const b = { dataByProfile: { amanda: { clients: [] } }, profiles: [], appId: 'amanda-clinica' };
  const hashA = await DataGuard.stateContentHash(a);
  const hashB = await DataGuard.stateContentHash(b);
  assert.equal(hashA, hashB);
  assert.ok(hashA.length === 64);
});

test('stateContentHash ignora updatedAt e dataHash (campos que mudam por definição)', async () => {
  const base = { appId: 'amanda-clinica', profiles: [], dataByProfile: { amanda: { clients: [] } } };
  const withMeta = { ...base, updatedAt: '2026-01-01T00:00:00Z', dataHash: 'qualquer-coisa' };
  const hashBase = await DataGuard.stateContentHash(base);
  const hashWithMeta = await DataGuard.stateContentHash(withMeta);
  assert.equal(hashBase, hashWithMeta);
});

test('stateContentHash muda quando o conteúdo de negócio muda', async () => {
  const a = stateWith({ clients: 1 });
  const b = stateWith({ clients: 2 });
  const hashA = await DataGuard.stateContentHash(a);
  const hashB = await DataGuard.stateContentHash(b);
  assert.notEqual(hashA, hashB);
});
