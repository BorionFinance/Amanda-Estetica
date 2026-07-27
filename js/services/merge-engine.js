(() => {
  'use strict';

  /**
   * Amanda Estética — Conciliação de três vias (v1.22.0).
   *
   * Antes desta versão, `saveAuthoritative` (ver google-drive.js) gravava a
   * base inteira desta sessão por cima do que estava no Google Drive sempre
   * que a revisão remota mudava — bastava dois dispositivos salvarem em uma
   * janela de tempo curta (o autosave roda sozinho a cada poucos segundos)
   * para o segundo a gravar apagar silenciosamente o que o primeiro tinha
   * acabado de salvar, mesmo sendo registros diferentes.
   *
   * Este módulo é a mesma lógica de conciliação (base -> local -> remoto)
   * já usada e comprovada no Marco Iris Tecnologia (rebaseLocalChanges /
   * mergeObjectDelta / mergeArrayDelta), adaptada aqui de forma genérica:
   * funciona em qualquer coleção do estado da clínica (clientes, agenda,
   * atendimentos, financeiro, etc.) porque decide por registro usando o
   * `id` de cada item, não por nome de coleção.
   *
   * Regra por registro:
   *   - Removido localmente (estava na base, sumiu do local) -> some do
   *     resultado, mesmo que o remoto ainda tenha uma versão dele.
   *   - Novo só localmente ou só remotamente -> entra no resultado.
   *   - Editado só de um lado -> vale a edição de quem mudou.
   *   - Editado dos dois lados -> vale a edição LOCAL (é a sessão que está
   *     gravando agora — o outro dispositivo já teve a vez dele quando
   *     gravou por último e virou a base usada aqui).
   *
   * Módulo puro (sem I/O), testável isoladamente como o data-guard.js.
   */

  function jsonClone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).sort().forEach(k => { out[k] = canonical(value[k]); });
      return out;
    }
    return value;
  }

  function valueEqual(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }

  function itemKey(item, index = 0) {
    return String(item?.id || item?.code || item?.key || `__index_${index}`);
  }

  function mergeArrayDelta(baseArr, localArr, remoteArr) {
    const base = Array.isArray(baseArr) ? baseArr : [];
    const local = Array.isArray(localArr) ? localArr : [];
    const remote = Array.isArray(remoteArr) ? remoteArr : [];
    const bm = new Map(base.map((item, index) => [itemKey(item, index), item]));
    const lm = new Map(local.map((item, index) => [itemKey(item, index), item]));
    const rm = new Map(remote.map((item, index) => [itemKey(item, index), jsonClone(item)]));
    const order = remote.map((item, index) => itemKey(item, index));
    for (const [key, baseItem] of bm) {
      if (!lm.has(key)) { rm.delete(key); continue; } // exclusão local é definitiva
      const localItem = lm.get(key);
      if (!valueEqual(localItem, baseItem)) rm.set(key, jsonClone(localItem));
    }
    for (const [key, localItem] of lm) {
      if (!bm.has(key)) { rm.set(key, jsonClone(localItem)); if (!order.includes(key)) order.push(key); }
    }
    return [
      ...order.filter((key, index) => order.indexOf(key) === index && rm.has(key)).map(key => rm.get(key)),
      ...[...rm.entries()].filter(([key]) => !order.includes(key)).map(([, item]) => item)
    ];
  }

  function mergeObjectDelta(base, local, remote) {
    if (Array.isArray(base) || Array.isArray(local) || Array.isArray(remote)) return mergeArrayDelta(base, local, remote);
    if (!local || typeof local !== 'object' || !remote || typeof remote !== 'object' || !base || typeof base !== 'object') {
      return !valueEqual(local, base) ? jsonClone(local) : jsonClone(remote);
    }
    const out = jsonClone(remote);
    for (const key of new Set([...Object.keys(base), ...Object.keys(local)])) {
      if (!(key in local)) { delete out[key]; continue; }
      if (!(key in base)) { out[key] = jsonClone(local[key]); continue; }
      if (valueEqual(local[key], base[key])) continue;
      if (local[key] && typeof local[key] === 'object' && base[key] && typeof base[key] === 'object' && remote[key] && typeof remote[key] === 'object') {
        out[key] = mergeObjectDelta(base[key], local[key], remote[key]);
      } else {
        out[key] = jsonClone(local[key]);
      }
    }
    return out;
  }

  /**
   * Concilia o estado local (o que esta aba está prestes a gravar) com o
   * estado remoto atual do Google Drive, usando `baseState` (a última base
   * que esta sessão carregou ou confirmou) como ponto comum. Preserva
   * sempre os campos de controle do remoto (workspaceId, databaseRevision,
   * recordCounts, dataHash) — quem decide esses é sempre saveAuthoritative,
   * depois de chamar esta função.
   */
  function mergeClinicState(baseState, localState, remoteState) {
    if (!baseState || !localState || !remoteState) {
      throw new Error('Não foi possível conciliar: faltou a base, o estado local ou o estado remoto.');
    }
    const merged = mergeObjectDelta(baseState, localState, remoteState);
    return merged;
  }

  window.AmandaMergeEngine = { mergeClinicState, mergeObjectDelta, mergeArrayDelta, valueEqual, jsonClone, itemKey };
})();
