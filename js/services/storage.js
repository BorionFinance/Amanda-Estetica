(() => {
  'use strict';

  /*
   * Amanda Estetica Cloud-Only Storage
   * ----------------------------------
   * Dados clinicos, financeiros, fotos e perfis existem apenas em memoria
   * durante a sessao e no Google Drive criptografado. O navegador conserva
   * somente identificadores tecnicos de autenticacao e da pasta escolhida.
   */
  const DATA_FILE = 'Amanda_Clinica_Dados.json';
  const LEGACY_DB = 'amanda_clinica_db_v1';
  const LEGACY_DATA_KEYS = new Set([
    'amanda_clinica_snapshot_v1',
    'amanda_clinica_last_folder_save'
  ]);
  const Vault = window.SecureJsonVault.forApp({
    appId: 'amanda-clinica',
    appName: 'Amanda Estetica',
    dialogTheme: 'amanda',
    isSensitive: value => !!(value && typeof value === 'object' && value.appId === 'amanda-clinica' && value.dataByProfile)
  });

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  async function deleteLegacyDatabase() {
    if (!globalThis.indexedDB) return false;
    return await new Promise(resolve => {
      const request = indexedDB.deleteDatabase(LEGACY_DB);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    });
  }

  async function purgeLegacyData() {
    await deleteLegacyDatabase();
    for (const key of LEGACY_DATA_KEYS) localStorage.removeItem(key);
    return true;
  }

  async function load() {
    await purgeLegacyData();
    return clone(window.AMANDA_INITIAL_DATA);
  }

  async function save(state, { touch = true } = {}) {
    if (touch && state) state.updatedAt = new Date().toISOString();
    return state;
  }

  async function createLocalBackup(state, reason = 'manual') {
    if (!navigator.onLine) throw new Error('Internet obrigatoria para criar backup no Google Drive.');
    if (!window.GoogleDriveClinic?.isConfigured?.()) throw new Error('Conecte o Google Drive antes de criar backup.');
    await window.GoogleDriveClinic.save(state, { backup: true, reason, thorough: true });
    return { id: `drive_${Date.now()}`, createdAt: new Date().toISOString(), reason, cloud: true };
  }

  async function listLocalBackups() {
    return [];
  }

  async function restoreLocalBackup() {
    return null;
  }

  async function connectFolder() {
    throw new Error('O Amanda Estetica usa somente o Google Drive criptografado.');
  }

  async function getFolderHandle() {
    return null;
  }

  async function forgetFolderHandle() {
    return true;
  }

  async function ensurePermission() {
    return false;
  }

  async function saveToFolder() {
    throw new Error('O modo cloud-only nao grava a base em pastas locais.');
  }

  async function readFromFolder() {
    throw new Error('O modo cloud-only carrega a base somente do Google Drive.');
  }

  function stamp(date = new Date()) {
    const part = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}_${part(date.getHours())}-${part(date.getMinutes())}-${part(date.getSeconds())}`;
  }

  async function downloadJson(state, filename = `Amanda_Clinica_Backup_CRIPTOGRAFADO_${stamp()}.json`) {
    const protectedState = await Vault.protect(state);
    const blob = new Blob([JSON.stringify(protectedState, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function readUploadedJson(file) {
    if (!file) throw new Error('Selecione um arquivo JSON.');
    const state = await Vault.open(JSON.parse(await file.text()));
    if (!state || state.appId !== 'amanda-clinica' || !state.dataByProfile) {
      throw new Error('Este arquivo nao e um backup valido do Amanda Estetica.');
    }
    return state;
  }

  window.ClinicStorage = {
    load,
    save,
    connectFolder,
    getFolderHandle,
    forgetFolderHandle,
    ensurePermission,
    saveToFolder,
    readFromFolder,
    createLocalBackup,
    listLocalBackups,
    restoreLocalBackup,
    downloadJson,
    readUploadedJson,
    purgeLegacyData,
    wipeAll: purgeLegacyData,
    DATA_FILE,
    DB_NAME: 'cloud-only-no-indexeddb',
    cloudOnly: true
  };
})();
