
(() => {
  const DB_NAME = 'amanda_clinica_db_v1';
  const DB_VERSION = 1;
  const STATE_STORE = 'state';
  const HANDLE_STORE = 'handles';
  const BACKUP_STORE = 'backups';
  const LS_SNAPSHOT = 'amanda_clinica_snapshot_v1';
  const DATA_FILE = 'Amanda_Clinica_Dados.json';
  let dbPromise = null;
  let snapshotTimer = 0;
  let snapshotIdleHandle = 0;
  let pendingSnapshotState = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB não está disponível neste navegador.'));
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
        if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE);
        if (!db.objectStoreNames.contains(BACKUP_STORE)) {
          const store = db.createObjectStore(BACKUP_STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error || new Error('Falha ao abrir o armazenamento local.'));
      };
      req.onblocked = () => console.warn('[Amanda Clínica] Atualização do banco local aguardando outra aba fechar.');
    });
    return dbPromise;
  }

  async function idbGet(storeName, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(storeName, value, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      key === undefined ? store.put(value) : store.put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbDelete(storeName, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGetAll(storeName) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function stringifyLightSnapshot(state) {
    // Uma única serialização, sem clonar toda a base duas vezes. Imagens muito
    // grandes continuam no IndexedDB e são omitidas apenas do fallback de
    // localStorage, exatamente para evitar travamentos e estouro de quota.
    return JSON.stringify(state, (key, value) => {
      if (key === 'imageData' && typeof value === 'string' && value.length > 120000) return '';
      return value;
    });
  }

  function writePendingSnapshot() {
    snapshotTimer = 0;
    snapshotIdleHandle = 0;
    const state = pendingSnapshotState;
    pendingSnapshotState = null;
    if (!state) return;
    try {
      const snapshot = stringifyLightSnapshot(state);
      if (snapshot.length < 4_500_000) localStorage.setItem(LS_SNAPSHOT, snapshot);
    } catch (error) {
      console.warn('[Amanda Clínica] Não foi possível criar snapshot local:', error);
    }
  }

  function scheduleLocalSnapshot(state) {
    pendingSnapshotState = state;
    clearTimeout(snapshotTimer);
    if (snapshotIdleHandle && 'cancelIdleCallback' in window) {
      cancelIdleCallback(snapshotIdleHandle);
      snapshotIdleHandle = 0;
    }
    snapshotTimer = setTimeout(() => {
      snapshotTimer = 0;
      if ('requestIdleCallback' in window) {
        snapshotIdleHandle = requestIdleCallback(writePendingSnapshot, { timeout: 1800 });
      } else {
        snapshotTimer = setTimeout(writePendingSnapshot, 120);
      }
    }, 320);
  }

  async function load() {
    try {
      const state = await idbGet(STATE_STORE, 'main');
      if (state) return state;
    } catch (error) {
      console.warn('[Amanda Clínica] IndexedDB indisponível:', error);
    }
    try {
      const raw = localStorage.getItem(LS_SNAPSHOT);
      if (raw) return JSON.parse(raw);
    } catch (error) {
      console.warn('[Amanda Clínica] Snapshot local inválido:', error);
    }
    return clone(window.AMANDA_INITIAL_DATA);
  }

  async function save(state) {
    state.updatedAt = new Date().toISOString();
    try {
      await idbPut(STATE_STORE, state, 'main');
    } catch (error) {
      console.error('[Amanda Clínica] Falha no IndexedDB:', error);
    }
    // O IndexedDB continua sendo salvo imediatamente. O snapshot redundante do
    // localStorage é consolidado e gravado quando a thread principal estiver
    // ociosa, evitando congelar botões, modais e rolagem após cada operação.
    scheduleLocalSnapshot(state);
    return true;
  }

  async function getFolderHandle() {
    try { return await idbGet(HANDLE_STORE, 'drive-folder'); }
    catch (_) { return null; }
  }

  async function rememberFolderHandle(handle) {
    await idbPut(HANDLE_STORE, handle, 'drive-folder');
  }

  async function forgetFolderHandle() {
    await idbDelete(HANDLE_STORE, 'drive-folder');
  }

  async function ensurePermission(handle, request = false) {
    if (!handle) return false;
    const opts = { mode: 'readwrite' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if (request && (await handle.requestPermission(opts)) === 'granted') return true;
    return false;
  }

  async function connectFolder() {
    if (!window.showDirectoryPicker) {
      throw new Error('Este navegador não permite conectar uma pasta. Use Chrome ou Edge no computador.');
    }
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    if (!(await ensurePermission(handle, true))) throw new Error('A permissão da pasta não foi concedida.');
    await rememberFolderHandle(handle);
    return handle;
  }

  async function writeTextFile(dirHandle, filename, text) {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();
    return true;
  }

  async function readJsonFile(dirHandle, filename = DATA_FILE) {
    const fileHandle = await dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const state = JSON.parse(text);
    return { state, file, fileHandle };
  }

  function stamp(date = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
  }

  async function saveToFolder(state, options = {}) {
    const handle = options.handle || await getFolderHandle();
    if (!handle) throw new Error('Nenhuma pasta está conectada.');
    if (!(await ensurePermission(handle, options.requestPermission === true))) {
      throw new Error('Clique em “Sincronizar agora” para autorizar novamente a pasta.');
    }
    const payload = JSON.stringify(state, null, 2);
    await writeTextFile(handle, DATA_FILE, payload);
    if (options.backup) {
      const backups = await handle.getDirectoryHandle('Backups', { create: true });
      const reason = String(options.reason || 'manual').replace(/[^a-zA-Z0-9_-]/g, '-');
      await writeTextFile(backups, `Amanda_Clinica_${reason}_${stamp()}.json`, payload);
    }
    localStorage.setItem('amanda_clinica_last_folder_save', new Date().toISOString());
    return true;
  }

  async function readFromFolder(options = {}) {
    const handle = options.handle || await getFolderHandle();
    if (!handle) throw new Error('Nenhuma pasta está conectada.');
    if (!(await ensurePermission(handle, options.requestPermission === true))) {
      throw new Error('Autorize novamente a pasta para carregar os dados.');
    }
    return await readJsonFile(handle, DATA_FILE);
  }

  async function createLocalBackup(state, reason = 'manual') {
    const backup = {
      id: `bkp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      createdAt: new Date().toISOString(),
      reason,
      state: clone(state)
    };
    await idbPut(BACKUP_STORE, backup);
    const all = (await idbGetAll(BACKUP_STORE)).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
    for (const old of all.slice(25)) await idbDelete(BACKUP_STORE, old.id);
    return backup;
  }

  async function listLocalBackups() {
    return (await idbGetAll(BACKUP_STORE)).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  }

  async function restoreLocalBackup(id) {
    const backup = await idbGet(BACKUP_STORE, id);
    return backup ? clone(backup.state) : null;
  }

  function downloadJson(state, filename = `Amanda_Clinica_Backup_${stamp()}.json`) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function readUploadedJson(file) {
    if (!file) throw new Error('Selecione um arquivo JSON.');
    const text = await file.text();
    const state = JSON.parse(text);
    if (!state || state.appId !== 'amanda-clinica' || !state.dataByProfile) {
      throw new Error('Este arquivo não parece ser um backup válido do Amanda Clínica.');
    }
    return state;
  }


  window.addEventListener('pagehide', () => {
    if (pendingSnapshotState) writePendingSnapshot();
  });

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
    DATA_FILE
  };
})();
