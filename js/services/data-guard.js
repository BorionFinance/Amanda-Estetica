(() => {
  'use strict';

  /**
   * Amanda Estética — Guarda de integridade de dados.
   *
   * Módulo puro (sem depender de DOM, IndexedDB ou rede) responsável por:
   *   1) contar registros críticos da base;
   *   2) decidir se uma gravação parece destrutiva (base nova muito menor
   *      que a base atual do Google Drive);
   *   3) gerar hash estável do conteúdo, para detectar corrupção/alteração
   *      inesperada entre gravar e reler um arquivo.
   *
   * Por ser puro, este arquivo é testado diretamente em Node
   * (ver /tests/data-guard.test.js) sem precisar simular navegador.
   */

  // Coleções que, se caírem para zero (ou caírem muito) de uma hora para
  // outra sem uma exclusão explícita, indicam quase sempre uma base vazia
  // ou antiga sendo usada por engano — nunca uma limpeza intencional.
  const CRITICAL_COLLECTIONS = Object.freeze([
    'clients', 'products', 'disposables', 'protocols', 'packages',
    'appointments', 'attendances', 'anamneses', 'consents', 'photos', 'finance'
  ]);

  function collectionArray(dataByProfile, profileId, key) {
    const profileData = dataByProfile && dataByProfile[profileId];
    return profileData && Array.isArray(profileData[key]) ? profileData[key] : [];
  }

  /**
   * Soma as contagens de todas as coleções críticas, agregando todos os
   * perfis existentes no estado (hoje só existe "amanda", mas a checagem
   * continua correta se um dia existirem múltiplos perfis).
   */
  function collectRecordCounts(state) {
    const counts = {};
    CRITICAL_COLLECTIONS.forEach(key => { counts[key] = 0; });
    const dataByProfile = state && typeof state === 'object' ? state.dataByProfile : null;
    if (dataByProfile && typeof dataByProfile === 'object') {
      Object.keys(dataByProfile).forEach(profileId => {
        CRITICAL_COLLECTIONS.forEach(key => {
          counts[key] += collectionArray(dataByProfile, profileId, key).length;
        });
      });
    }
    counts.__total = CRITICAL_COLLECTIONS.reduce((sum, key) => sum + counts[key], 0);
    return counts;
  }

  /**
   * Compara a base que está prestes a ser gravada (`nextCounts`) com a última
   * base confiável conhecida (`baselineCounts` — normalmente a base que foi
   * carregada e validada do Google Drive nesta sessão). Retorna os motivos
   * encontrados; a decisão de bloquear ou não a gravação é de quem chama.
   *
   * Duas condições disparam o alerta:
   *   - "zeroed": a coleção tinha registros e foi para zero.
   *   - "large-drop": a coleção tinha 5+ registros e caiu mais que `dropRatio`
   *     (40% por padrão) em uma única gravação.
   */
  function detectSuspiciousDrop(nextCounts, baselineCounts, options = {}) {
    const dropRatio = typeof options.dropRatio === 'number' ? options.dropRatio : 0.4;
    const minForRatioCheck = typeof options.minForRatioCheck === 'number' ? options.minForRatioCheck : 5;
    const reasons = [];
    if (!nextCounts || !baselineCounts) return { suspicious: false, reasons };
    CRITICAL_COLLECTIONS.forEach(key => {
      const before = Number(baselineCounts[key]) || 0;
      const after = Number(nextCounts[key]) || 0;
      if (before > 0 && after === 0) {
        reasons.push({ key, before, after, kind: 'zeroed' });
      } else if (before >= minForRatioCheck && after < before * (1 - dropRatio)) {
        reasons.push({ key, before, after, kind: 'large-drop' });
      }
    });
    return { suspicious: reasons.length > 0, reasons };
  }

  function humanCollectionName(key) {
    const names = {
      clients: 'clientes', products: 'produtos', disposables: 'descartáveis',
      protocols: 'protocolos', packages: 'pacotes', appointments: 'agendamentos',
      attendances: 'atendimentos', anamneses: 'anamneses', consents: 'consentimentos',
      photos: 'fotos', finance: 'lançamentos financeiros'
    };
    return names[key] || key;
  }

  function describeSuspiciousReasons(reasons) {
    return (reasons || []).map(reason => {
      const label = humanCollectionName(reason.key);
      if (reason.kind === 'zeroed') return `${label}: ${reason.before} → 0`;
      return `${label}: ${reason.before} → ${reason.after}`;
    }).join(' · ');
  }

  // Serialização com chaves ordenadas: o hash não pode variar só porque as
  // propriedades foram inseridas em outra ordem no objeto.
  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  async function sha256Hex(text) {
    if (!globalThis.crypto || !globalThis.crypto.subtle) return '';
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Hash do conteúdo "de negócio" do estado, ignorando campos que mudam a
  // cada gravação por definição (o próprio hash e a data de atualização) —
  // senão o hash nunca serviria para comparar duas gravações do mesmo dado.
  async function stateContentHash(state) {
    if (!state || typeof state !== 'object') return '';
    const { dataHash, updatedAt, ...rest } = state;
    return await sha256Hex(stableStringify(rest));
  }

  function isValidClinicSchema(candidate) {
    return !!candidate && typeof candidate === 'object' &&
      candidate.appId === 'amanda-clinica' &&
      candidate.dataByProfile && typeof candidate.dataByProfile === 'object' &&
      Array.isArray(candidate.profiles);
  }

  const AmandaDataGuard = {
    CRITICAL_COLLECTIONS,
    collectRecordCounts,
    detectSuspiciousDrop,
    describeSuspiciousReasons,
    humanCollectionName,
    stableStringify,
    sha256Hex,
    stateContentHash,
    isValidClinicSchema
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AmandaDataGuard;
  if (typeof window !== 'undefined') window.DataGuard = AmandaDataGuard;
})();
