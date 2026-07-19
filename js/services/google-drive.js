
(() => {
  'use strict';

  /*
    Credenciais do mesmo projeto Google já usado pelo Borion.
    Como OAuth web autoriza por ORIGEM, um novo repositório no mesmo
    https://borionfinance.github.io pode reutilizar a configuração.
  */
  const CLIENT_ID = '946105310952-gp143h81mm3704lrq3877hsie49njgak.apps.googleusercontent.com';
  const API_KEY = 'AIzaSyAMm_8CtFg_YP2ssG4XaiBbOc7wuJFq7xs';
  const PROJECT_NUMBER = '946105310952';
  const SCOPES = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file';
  const ALLOWED_ACCOUNT_HASHES = new Set(['8593d642f79e2a03a8a75ae91096d00d77e4f82f5149283684b6605fc9821a9e','db9c91e0d2956a89a70d9683b4a2a4d048b9cde255f861425342fe877b48339c']);
  const DATA_FILE = 'Amanda_Clinica_Dados.json';
  const USER_KEY = 'amanda_clinica_gdrive_user';
  const DATA_FILE_ID_PREFIX = 'amanda_clinica_gdrive_data_file_';
  const FOLDER_PREFIX = 'amanda_clinica_gdrive_folder_';
  const SUBFOLDER_PREFIX = 'amanda_clinica_gdrive_subfolder_';
  const INTEGRATION_FILE_PREFIX = 'amanda_clinica_gdrive_integration_file_';
  const STRUCTURE_PREFIX = 'amanda_clinica_gdrive_structure_';
  const APP_FOLDERS = Object.freeze({ backups: 'Backups', integration: 'Borion_Integracoes', photos: 'Fotos_Clientes' });
  /* V1.16.0 — mecânica de backup copiada do Borion Finance: em vez de um arquivo
     novo e único a cada ação (que crescia pra sempre), dois rodízios de slots
     fixos, cada um sobrescrevendo o mais antigo quando dá a volta:
     - autosave-1.json ... autosave-20.json: 1 gravação por minuto, só quando algo
       mudou desde a última vez (ver markAutosaveDirty/runAutosaveTick).
     - forcesave-1.json ... forcesave-40.json: um rodízio à parte, usado nos
       momentos em que a própria pessoa pede um salvamento (conectar pela
       primeira vez, "Salvar agora", sincronizar manualmente). */
  const AUTOSAVE_INTERVAL_MS = 60 * 1000;
  const AUTOSAVE_SLOTS = 20;
  const FORCESAVE_SLOTS = 40;
  const ROTATING_FILE_ID_PREFIX = 'amanda_clinica_gdrive_rotating_file_';
  const ROTATING_SLOT_INDEX_PREFIX = 'amanda_clinica_gdrive_rotating_slot_';

  /* ================================================================
     V1.20.0 — CORREÇÃO CRÍTICA DE PROTEÇÃO DE DADOS
     A partir daqui: Google Drive é a fonte oficial da verdade. Nenhuma
     gravação no arquivo principal acontece sem reconferir, na hora, a
     revisão remota e sem comparar a contagem de registros com a última
     base confiável conhecida. Ver AppLifecycle (app-lifecycle.js) e
     DataGuard (data-guard.js).
     ================================================================ */
  const PRESAVE_SNAPSHOT_SLOTS = 30; // "Snapshots/prewrite-N.json" — cópia do arquivo principal
                                      // tirada IMEDIATAMENTE ANTES de cada gravação que o substitui.
  const WORKSPACE_KEY_PREFIX = 'amanda_clinica_gdrive_workspace_';
  const LAST_GOOD_COUNTS_PREFIX = 'amanda_clinica_last_known_good_counts_';

  class DriveGuardError extends Error {
    constructor(code, message, details = {}) {
      super(message);
      this.name = 'DriveGuardError';
      this.code = code;
      this.details = details;
    }
  }

  function workspaceStorageKey(folderId) { return `${WORKSPACE_KEY_PREFIX}${folderId}`; }
  function readStoredWorkspaceId(folderId) { return localStorage.getItem(workspaceStorageKey(folderId)) || null; }
  function writeStoredWorkspaceId(folderId, workspaceId) { if (workspaceId) localStorage.setItem(workspaceStorageKey(folderId), workspaceId); }

  function lastGoodCountsKey(workspaceId) { return `${LAST_GOOD_COUNTS_PREFIX}${workspaceId}`; }
  function readLastKnownGoodCounts(workspaceId) {
    if (!workspaceId) return null;
    try { return JSON.parse(localStorage.getItem(lastGoodCountsKey(workspaceId)) || 'null'); }
    catch (_) { return null; }
  }
  function writeLastKnownGoodCounts(workspaceId, counts) {
    if (!workspaceId || !counts) return;
    try { localStorage.setItem(lastGoodCountsKey(workspaceId), JSON.stringify(counts)); } catch (_) {}
  }

  function newUuid() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }

  const resolvedFolders = new Map();
  const resolvedIntegrationFiles = new Map();
  const folderInflight = new Map();
  const integrationFileInflight = new Map();
  const structureInflight = new Map();
  const dataFileInflight = new Map();
  const resolvedStructures = new Map();
  let connectionInflight = null;
  let autosaveTimer = null;
  let autosaveDirty = false;
  let autosaveInFlight = false;
  let autosaveStateGetter = null;

  // Ativado SOMENTE pelos testes automatizados em /tests (ver __test abaixo).
  // Nunca é ligado por nenhum caminho do próprio aplicativo em produção —
  // existe só para permitir testar o pipeline de gravação/leitura guardado
  // (saveAuthoritative/loadAuthoritative) contra um Google Drive simulado,
  // sem depender de um fluxo real de login OAuth dentro do teste.
  let TEST_MODE = false;

  const Auth = {
    token: '',
    expiresAt: 0,
    user: null,
    gisLoaded: false,
    pickerLoaded: false,
    tokenClient: null,

    loadScript(src) {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Não foi possível carregar os serviços do Google.'));
        document.head.appendChild(script);
      });
    },

    async ensureLibraries() {
      if (!this.gisLoaded) {
        await this.loadScript('https://accounts.google.com/gsi/client');
        this.gisLoaded = true;
      }
      if (!this.pickerLoaded) {
        await this.loadScript('https://apis.google.com/js/api.js');
        await new Promise(resolve => gapi.load('picker', resolve));
        this.pickerLoaded = true;
      }
    },

    requestToken(interactive = false) {
      return new Promise((resolve, reject) => {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: response => {
            if (response.error) {
              reject(new Error(`O Google recusou o acesso: ${response.error}`));
              return;
            }
            this.token = response.access_token;
            this.expiresAt = Date.now() + ((response.expires_in || 3300) * 1000);
            resolve(this.token);
          },
          error_callback: error => reject(new Error(error?.message || 'Login com Google cancelado.'))
        });
        this.tokenClient.requestAccessToken({ prompt: interactive ? 'select_account' : '' });
      });
    },

    async ensureToken(interactive = false) {
      if (this.token && Date.now() < this.expiresAt - 60000) return this.token;
      await this.ensureLibraries();
      return await this.requestToken(interactive);
    },

    async fetchUser() {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      if (!response.ok) throw new Error('Não foi possível confirmar a conta Google.');
      const info = await response.json();
      this.user = { sub: info.sub, email: info.email, name: info.name || info.email, picture: info.picture || '' };
      localStorage.setItem(USER_KEY, JSON.stringify(this.user));
      return this.user;
    },

    cachedUser() {
      if (this.user) return this.user;
      try { this.user = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
      catch (_) { this.user = null; }
      return this.user;
    },

    signOut() {
      if (this.token) {
        try { google.accounts.oauth2.revoke(this.token, () => {}); } catch (_) {}
      }
      this.token = '';
      this.expiresAt = 0;
      this.user = null;
      localStorage.removeItem(USER_KEY);
    }
  };

  async function accountHash(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !globalThis.crypto?.subtle) return '';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function assertAuthorizedUser(user) {
    const hash = await accountHash(user?.email);
    if (!hash || !ALLOWED_ACCOUNT_HASHES.has(hash)) {
      Auth.signOut();
      throw new Error('Esta conta Google não está autorizada a acessar o Amanda Estética.');
    }
    return user;
  }

  async function authenticateGoogle(interactive = true) {
    await Auth.ensureToken(interactive);
    return await assertAuthorizedUser(await Auth.fetchUser());
  }

  async function headers(json = false) {
    const token = await Auth.ensureToken(false);
    return json
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { Authorization: `Bearer ${token}` };
  }

  async function findChildren(parentId, name, mimeType = '') {
    const safe = String(name).replace(/'/g, "\\'");
    let q = `'${parentId}' in parents and name='${safe}' and trashed=false`;
    if (mimeType) q += ` and mimeType='${mimeType}'`;
    const params = new URLSearchParams({
      q,
      orderBy: 'createdTime asc',
      pageSize: '100',
      fields: 'files(id,name,createdTime,modifiedTime,mimeType,size,parents,trashed)'
    });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: await headers() });
    if (!response.ok) throw new Error('Falha ao consultar o Google Drive.');
    const result = await response.json();
    return Array.isArray(result.files) ? result.files : [];
  }

  async function findChild(parentId, name, mimeType = '') {
    const matches = await findChildren(parentId, name, mimeType);
    if (matches.length > 1) console.warn(`[GOOGLE_DRIVE] Existem ${matches.length} itens chamados “${name}”. O mais antigo será reutilizado.`);
    return matches[0] || null;
  }

  function scopedStorageKey(prefix, parentId, name) {
    return `${prefix}${parentId}_${encodeURIComponent(name)}`;
  }

  function dataFileStorageKey(rootId) { return `${DATA_FILE_ID_PREFIX}${rootId}`; }
  function rememberDataFile(rootId, file) {
    if (!file?.id) return file || null;
    localStorage.setItem(dataFileStorageKey(rootId), file.id);
    return file;
  }
  function forgetDataFile(rootId) {
    localStorage.removeItem(dataFileStorageKey(rootId));
  }
  function isExpectedDataFile(meta, parentId) {
    return !!meta && !meta.trashed && meta.name === DATA_FILE &&
      meta.mimeType === 'application/json' && (meta.parents || []).includes(parentId);
  }

  function structureStorageKey(rootId) { return `${STRUCTURE_PREFIX}${rootId}`; }
  function readStoredStructure(rootId) {
    try { return JSON.parse(localStorage.getItem(structureStorageKey(rootId)) || 'null'); }
    catch (_) { return null; }
  }
  function writeStoredStructure(rootId, structure) {
    localStorage.setItem(structureStorageKey(rootId), JSON.stringify(structure));
    resolvedStructures.set(rootId, structure);
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async function getDriveObjectMeta(fileId) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,parents,trashed,createdTime,modifiedTime`, {
      headers: await headers()
    });
    if (!response.ok) {
      const error = new Error('Falha ao validar um item do Google Drive.');
      error.status = response.status;
      throw error;
    }
    return await response.json();
  }

  async function withCrossTabLock(name, task) {
    if (navigator?.locks?.request) return await navigator.locks.request(name, task);
    const key = `amanda_clinica_mutex_${encodeURIComponent(name)}`;
    const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      let current = null;
      try { current = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) {}
      if (!current || Number(current.expiresAt) < Date.now()) {
        localStorage.setItem(key, JSON.stringify({ token, expiresAt: Date.now() + 30000 }));
        let confirmed = null;
        try { confirmed = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) {}
        if (confirmed?.token === token) {
          try { return await task(); }
          finally {
            try {
              const latest = JSON.parse(localStorage.getItem(key) || 'null');
              if (latest?.token === token) localStorage.removeItem(key);
            } catch (_) { localStorage.removeItem(key); }
          }
        }
      }
      await sleep(120 + Math.floor(Math.random() * 120));
    }
    throw new Error('Outra aba ainda está preparando as pastas do Google Drive. Feche as abas duplicadas e tente novamente.');
  }

  function isExpectedFolder(meta, parentId, name) {
    return !!meta && !meta.trashed && meta.mimeType === 'application/vnd.google-apps.folder' &&
      meta.name === name && (meta.parents || []).includes(parentId);
  }

  async function ensureFolderUncached(parentId, name) {
    const cacheKey = scopedStorageKey(SUBFOLDER_PREFIX, parentId, name);
    const memoryKey = `${parentId}:${name}`;
    const cachedId = localStorage.getItem(cacheKey);
    if (cachedId) {
      try {
        const meta = await getDriveObjectMeta(cachedId);
        if (isExpectedFolder(meta, parentId, name)) {
          const folder = { id: meta.id, name: meta.name, mimeType: meta.mimeType, createdTime: meta.createdTime, modifiedTime: meta.modifiedTime };
          resolvedFolders.set(memoryKey, folder);
          return folder;
        }
      } catch (error) {
        if (![403, 404].includes(error.status)) console.warn('[GOOGLE_DRIVE] Pasta em cache inválida:', error);
      }
      localStorage.removeItem(cacheKey);
    }

    let folder = await findChild(parentId, name, 'application/vnd.google-apps.folder');
    if (!folder) {
      for (const delay of [600, 1400, 2600]) {
        await sleep(delay);
        folder = await findChild(parentId, name, 'application/vnd.google-apps.folder');
        if (folder) break;
      }
    }
    if (!folder) folder = await createFolder(parentId, name);
    localStorage.setItem(cacheKey, folder.id);
    resolvedFolders.set(memoryKey, folder);
    return folder;
  }

  async function ensureFolder(parentId, name) {
    const memoryKey = `${parentId}:${name}`;
    if (resolvedFolders.has(memoryKey)) return resolvedFolders.get(memoryKey);
    if (folderInflight.has(memoryKey)) return await folderInflight.get(memoryKey);
    const promise = withCrossTabLock(`amanda-drive-folder:${parentId}:${name}`, () => ensureFolderUncached(parentId, name))
      .finally(() => folderInflight.delete(memoryKey));
    folderInflight.set(memoryKey, promise);
    return await promise;
  }

  async function validateStoredStructure(rootId, structure) {
    if (!structure || structure.rootId !== rootId) return null;
    const normalized = { rootId };
    for (const [key, name] of Object.entries(APP_FOLDERS)) {
      const id = structure[key];
      if (!id) return null;
      try {
        const meta = await getDriveObjectMeta(id);
        if (!isExpectedFolder(meta, rootId, name)) return null;
        normalized[key] = id;
        resolvedFolders.set(`${rootId}:${name}`, { id, name, mimeType: meta.mimeType, createdTime: meta.createdTime, modifiedTime: meta.modifiedTime });
        localStorage.setItem(scopedStorageKey(SUBFOLDER_PREFIX, rootId, name), id);
      } catch (_) { return null; }
    }
    return normalized;
  }

  async function ensureAppFolders(rootId) {
    if (resolvedStructures.has(rootId)) return resolvedStructures.get(rootId);
    if (structureInflight.has(rootId)) return await structureInflight.get(rootId);
    const promise = withCrossTabLock(`amanda-drive-structure:${rootId}`, async () => {
      const stored = await validateStoredStructure(rootId, readStoredStructure(rootId));
      if (stored) {
        resolvedStructures.set(rootId, stored);
        return stored;
      }
      const structure = { rootId };
      for (const [key, name] of Object.entries(APP_FOLDERS)) {
        structure[key] = (await ensureFolder(rootId, name)).id;
        writeStoredStructure(rootId, structure);
      }
      writeStoredStructure(rootId, structure);
      return structure;
    }).finally(() => structureInflight.delete(rootId));
    structureInflight.set(rootId, promise);
    return await promise;
  }

  async function resolveDataFileUncached(folderId) {
    const cachedId = localStorage.getItem(dataFileStorageKey(folderId));
    if (cachedId) {
      try {
        const meta = await getDriveObjectMeta(cachedId);
        if (isExpectedDataFile(meta, folderId)) return rememberDataFile(folderId, meta);
      } catch (error) {
        if (![403, 404].includes(error.status)) console.warn('[GOOGLE_DRIVE] Arquivo principal em cache inválido:', error);
      }
      forgetDataFile(folderId);
    }

    const matches = await findChildren(folderId, DATA_FILE, 'application/json');
    if (!matches.length) return null;
    const ordered = [...matches].sort((a, b) => {
      const modified = new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0);
      if (modified) return modified;
      return new Date(a.createdTime || 0) - new Date(b.createdTime || 0);
    });
    if (ordered.length > 1) {
      console.warn(`[GOOGLE_DRIVE] Existem ${ordered.length} arquivos principais chamados “${DATA_FILE}”. O mais recentemente modificado será reutilizado.`);
    }
    return rememberDataFile(folderId, ordered[0]);
  }

  async function resolveDataFile(folderId) {
    if (dataFileInflight.has(folderId)) return await dataFileInflight.get(folderId);
    const promise = withCrossTabLock(`amanda-drive-main-file-resolve:${folderId}`, () => resolveDataFileUncached(folderId))
      .finally(() => dataFileInflight.delete(folderId));
    dataFileInflight.set(folderId, promise);
    return await promise;
  }

  async function saveDataFile(folderId, state) {
    return await withCrossTabLock(`amanda-drive-main-file-save:${folderId}`, async () => {
      let file = await resolveDataFileUncached(folderId);
      if (!file) {
        for (const delay of [500, 1200, 2400]) {
          await sleep(delay);
          file = await resolveDataFileUncached(folderId);
          if (file) break;
        }
      }
      file = file ? await updateJsonFile(file.id, state) : await createJsonFile(folderId, DATA_FILE, state);
      return rememberDataFile(folderId, file);
    });
  }

  async function resolveIntegrationFileUncached(folderId, name, createObject = null) {
    const memoryKey = `${folderId}:${name}`;
    const cacheKey = scopedStorageKey(INTEGRATION_FILE_PREFIX, folderId, name);
    const cachedId = resolvedIntegrationFiles.get(memoryKey) || localStorage.getItem(cacheKey);
    if (cachedId) {
      try {
        const meta = await getDriveObjectMeta(cachedId);
        if (!meta.trashed && meta.name === name && meta.mimeType === 'application/json' && (meta.parents || []).includes(folderId)) {
          resolvedIntegrationFiles.set(memoryKey, meta.id);
          localStorage.setItem(cacheKey, meta.id);
          return { id: meta.id, name: meta.name };
        }
      } catch (error) {
        if (error.status !== 404) console.warn('[GOOGLE_DRIVE] Arquivo de integração em cache inválido:', error);
      }
      resolvedIntegrationFiles.delete(memoryKey);
      localStorage.removeItem(cacheKey);
    }

    let file = await findChild(folderId, name, 'application/json');
    if (!file && createObject !== null) {
      await sleep(450);
      file = await findChild(folderId, name, 'application/json');
      if (!file) file = await createJsonFile(folderId, name, createObject);
    }
    if (file) {
      resolvedIntegrationFiles.set(memoryKey, file.id);
      localStorage.setItem(cacheKey, file.id);
    }
    return file || null;
  }

  async function resolveIntegrationFile(folderId, name, createObject = null) {
    const memoryKey = `${folderId}:${name}`;
    if (integrationFileInflight.has(memoryKey)) return await integrationFileInflight.get(memoryKey);
    const promise = withCrossTabLock(`amanda-drive-file:${folderId}:${name}`, () => resolveIntegrationFileUncached(folderId, name, createObject))
      .finally(() => integrationFileInflight.delete(memoryKey));
    integrationFileInflight.set(memoryKey, promise);
    return await promise;
  }

  async function createFolder(parentId, name) {
    const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,modifiedTime', {
      method: 'POST',
      headers: await headers(true),
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
    });
    if (!response.ok) throw new Error(`Falha ao criar a pasta “${name}” no Google Drive.`);
    return await response.json();
  }

  async function createJsonFile(parentId, name, object) {
    const boundary = `amanda_${Date.now()}`;
    const metadata = JSON.stringify({ name, parents: [parentId], mimeType: 'application/json' });
    const content = JSON.stringify(object, null, 2);
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size', {
      method: 'POST',
      headers: { ...(await headers()), 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    });
    if (!response.ok) throw new Error(`Falha ao criar “${name}” no Google Drive.`);
    return await response.json();
  }

  async function updateJsonFile(fileId, object) {
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,modifiedTime,size`, {
      method: 'PATCH',
      headers: await headers(true),
      body: JSON.stringify(object, null, 2)
    });
    if (!response.ok) throw new Error('Falha ao salvar os dados no Google Drive.');
    return await response.json();
  }

  async function readJsonFile(fileId) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: await headers()
    });
    if (!response.ok) throw new Error('Falha ao carregar o arquivo do Google Drive.');
    return await response.json();
  }

  async function getMeta(fileId) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,modifiedTime,size`, {
      headers: await headers()
    });
    if (!response.ok) throw new Error('Falha ao consultar o arquivo do Google Drive.');
    return await response.json();
  }

  function folderKey(sub) { return `${FOLDER_PREFIX}${sub}`; }
  function getFolderId() {
    const user = Auth.cachedUser();
    return user ? localStorage.getItem(folderKey(user.sub)) : '';
  }
  function setFolderId(id) {
    const user = Auth.cachedUser();
    if (user) localStorage.setItem(folderKey(user.sub), id);
  }

  function openFolderPicker() {
    return new Promise((resolve, reject) => {
      const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setIncludeFolders(true)
        .setMimeTypes('application/vnd.google-apps.folder');
      const picker = new google.picker.PickerBuilder()
        .setTitle('Escolha a pasta da clínica da Amanda')
        .addView(view)
        .setOAuthToken(Auth.token)
        .setDeveloperKey(API_KEY)
        .setAppId(PROJECT_NUMBER)
        .setCallback(data => {
          if (data.action === google.picker.Action.PICKED) resolve(data.docs[0]);
          else if (data.action === google.picker.Action.CANCEL) reject(new Error('Nenhuma pasta foi selecionada.'));
        })
        .build();
      picker.setVisible(true);
    });
  }

  function stamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  }

  /* ---- V1.16.0 — rodízio de backups (mesma mecânica do Borion Finance) ---- */
  function rotatingFileKey(folderId, kind, slot) { return `${ROTATING_FILE_ID_PREFIX}${kind}_${folderId}_${slot}`; }
  function readRotatingFileId(folderId, kind, slot) { return localStorage.getItem(rotatingFileKey(folderId, kind, slot)) || null; }
  function writeRotatingFileId(folderId, kind, slot, id) { localStorage.setItem(rotatingFileKey(folderId, kind, slot), id); }

  function rotatingIndexKey(folderId, kind) { return `${ROTATING_SLOT_INDEX_PREFIX}${kind}_${folderId}`; }
  function readRotatingSlotIndex(folderId, kind) {
    const raw = localStorage.getItem(rotatingIndexKey(folderId, kind));
    const n = raw != null ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  function writeRotatingSlotIndex(folderId, kind, index) {
    try { localStorage.setItem(rotatingIndexKey(folderId, kind), String(index)); } catch (_) {}
  }

  /* Grava `state` no próximo slot do rodízio `kind` (dentro da pasta Backups),
     sempre reaproveitando o índice persistido desta pasta — nunca reseta pro
     slot 1 sozinho por causa de um F5 no meio do caminho. Quando o rodízio dá a
     volta, o slot mais antigo é sobrescrito (upload substitui o conteúdo do
     mesmo arquivo, não cria um novo) — é isso que mantém o total sempre no teto
     (20 para autosave, 40 para forcesave), nunca crescendo além disso. */
  async function writeRotatingSnapshot(folderId, kind, totalSlots, state) {
    const backups = await ensureFolder(folderId, APP_FOLDERS.backups);
    const slotIndex = readRotatingSlotIndex(backups.id, kind);
    const slot = (slotIndex % totalSlots) + 1;
    const name = `${kind}-${slot}.json`;
    let fileId = readRotatingFileId(backups.id, kind, slot);
    if (fileId) {
      try {
        const meta = await getDriveObjectMeta(fileId);
        if (meta.trashed) fileId = null;
      } catch (error) {
        if (error.status === 404) fileId = null; else throw error;
      }
    }
    if (fileId) {
      await updateJsonFile(fileId, state);
    } else {
      const existing = await findChild(backups.id, name, 'application/json');
      if (existing) { fileId = existing.id; await updateJsonFile(fileId, state); }
      else { fileId = (await createJsonFile(backups.id, name, state)).id; }
      writeRotatingFileId(backups.id, kind, slot, fileId);
    }
    writeRotatingSlotIndex(backups.id, kind, slotIndex + 1);
  }

  /* ----------------------------------------------------------------
     Leitura "oficial" do arquivo principal: sempre busca o conteúdo mais
     recente do Drive (nunca confia em cache de memória para essa decisão),
     valida o formato mínimo esperado e devolve também a contagem de
     registros e a revisão, para quem chamou decidir o que fazer.
     ---------------------------------------------------------------- */
  async function readRemoteAuthoritative(folderId) {
    const file = await resolveDataFile(folderId);
    if (!file) return { exists: false, state: null, meta: null, revision: 0, workspaceId: null, counts: null };
    const state = await readJsonFile(file.id);
    if (!window.DataGuard?.isValidClinicSchema(state)) {
      throw new DriveGuardError('INVALID_REMOTE_SCHEMA', 'O arquivo principal da clínica no Google Drive não tem o formato esperado. Nada foi alterado.', { file });
    }
    return {
      exists: true,
      state,
      meta: file,
      revision: Number(state.databaseRevision) || 0,
      workspaceId: state.workspaceId || null,
      counts: window.DataGuard.collectRecordCounts(state)
    };
  }

  /* ----------------------------------------------------------------
     Carregamento autoritativo usado no boot e no login: autentica,
     resolve a pasta, lê o arquivo principal e valida o schema. Não grava
     nada — só leitura. Quem chama registra o resultado no AppLifecycle.
     ---------------------------------------------------------------- */
  async function loadAuthoritative(options = {}) {
    const { folderId } = await GoogleDriveClinic.ensureConnection(options.interactive === true);
    const remote = await readRemoteAuthoritative(folderId);
    if (remote.exists) writeStoredWorkspaceId(folderId, remote.workspaceId || readStoredWorkspaceId(folderId));
    return { ...remote, folderId };
  }

  /* ----------------------------------------------------------------
     Gravação autoritativa do arquivo principal. É o ÚNICO caminho que
     pode escrever em Amanda_Clinica_Dados.json — autosave, salvamento
     manual e primeira conexão passam todos por aqui. Nunca escreve sem:
       1) reconferir a revisão remota agora mesmo (evita gravar por cima
          de uma alteração feita por outra aba/dispositivo);
       2) checar se a contagem de registros caiu de forma suspeita;
       3) tirar um snapshot do conteúdo anterior;
       4) reler o que foi gravado para confirmar revisão e hash.
     ---------------------------------------------------------------- */
  async function saveAuthoritative(state, options = {}) {
    const { allowCreate = false, expectedRevision = null, skipSuspiciousCheck = false, reason = 'salvamento', backupSlot = null } = options;
    const { folderId } = await GoogleDriveClinic.ensureConnection(options.interactive === true);

    return await withCrossTabLock(`amanda-drive-authoritative-save:${folderId}`, async () => {
      const remote = await readRemoteAuthoritative(folderId);

      if (!remote.exists && !allowCreate) {
        throw new DriveGuardError('MISSING_REMOTE', 'Ainda não existe uma base da clínica nesta pasta do Google Drive. Use a opção de criar uma base nova antes de continuar.', {});
      }

      if (remote.exists) {
        if (expectedRevision !== null && expectedRevision !== undefined && remote.revision !== expectedRevision) {
          throw new DriveGuardError('STALE_REVISION', 'O Google Drive foi atualizado por outro dispositivo ou aba desde que esta sessão carregou os dados. Nada foi substituído — recarregue antes de salvar de novo.', {
            expectedRevision, remoteRevision: remote.revision, remoteState: remote.state, remoteCounts: remote.counts
          });
        }
        if (state.workspaceId && remote.workspaceId && state.workspaceId !== remote.workspaceId) {
          throw new DriveGuardError('WORKSPACE_MISMATCH', 'Esta pasta do Google Drive pertence a outra base de dados (workspace diferente). Nada foi substituído.', {
            localWorkspaceId: state.workspaceId, remoteWorkspaceId: remote.workspaceId
          });
        }
        if (!skipSuspiciousCheck) {
          const nextCounts = window.DataGuard.collectRecordCounts(state);
          const check = window.DataGuard.detectSuspiciousDrop(nextCounts, remote.counts);
          if (check.suspicious) {
            throw new DriveGuardError('SUSPICIOUS_WRITE', `Salvamento bloqueado por segurança: ${window.DataGuard.describeSuspiciousReasons(check.reasons)}. Os dados desta sessão parecem vazios ou incompletos, enquanto o Google Drive tem uma base maior. Nenhuma informação foi substituída.`, {
              reasons: check.reasons, nextCounts, remoteCounts: remote.counts
            });
          }
        }
      }

      // Snapshot do conteúdo anterior ANTES de sobrescrever — só existe algo
      // para guardar quando já havia um arquivo principal.
      if (remote.exists) {
        try { await writeRotatingSnapshot(folderId, backupSlot || 'prewrite', PRESAVE_SNAPSHOT_SLOTS, remote.state); }
        catch (error) { console.warn('[GoogleDriveClinic] Não foi possível criar o snapshot de segurança antes de gravar (a gravação continua):', error); }
      }

      const workspaceId = state.workspaceId || remote.workspaceId || readStoredWorkspaceId(folderId) || newUuid();
      const nextRevision = (remote.exists ? remote.revision : 0) + 1;
      const nextCounts = window.DataGuard.collectRecordCounts(state);
      const payload = { ...state, workspaceId, databaseRevision: nextRevision, recordCounts: nextCounts };
      payload.dataHash = await window.DataGuard.stateContentHash(payload);

      const file = await saveDataFile(folderId, payload);
      writeStoredWorkspaceId(folderId, workspaceId);

      // Relê o que acabou de ser gravado para confirmar que a revisão e o
      // hash batem — proteção extra contra respostas parciais/corrompidas
      // da própria API do Drive.
      const verify = await readJsonFile(file.id);
      if (Number(verify.databaseRevision) !== nextRevision) {
        throw new DriveGuardError('VERIFY_FAILED', 'O Google Drive confirmou a gravação, mas o conteúdo relido não bate com o que foi enviado. Verifique a conexão e tente novamente.', { expected: nextRevision, got: verify.databaseRevision });
      }

      // Cópia extra opcional no rodízio "forcesave" (mesmo papel de antes:
      // pontos de restauração pedidos explicitamente pela pessoa — conectar
      // pela primeira vez, "Salvar agora", sincronizar manualmente).
      if (options.alsoBackupNewContent) {
        try { await writeRotatingSnapshot(folderId, 'forcesave', FORCESAVE_SLOTS, payload); }
        catch (error) { console.warn('[GoogleDriveClinic] Cópia adicional em forcesave falhou (gravação principal já está segura):', error); }
      }

      writeLastKnownGoodCounts(workspaceId, nextCounts);
      GoogleDriveClinic.currentFile = file;
      localStorage.setItem('amanda_clinica_last_google_save', new Date().toISOString());
      return { file, revision: nextRevision, counts: nextCounts, workspaceId, payload };
    });
  }

  async function listAllChildren(parentId, mimeType = '') {
    let q = `'${parentId}' in parents and trashed=false`;
    if (mimeType) q += ` and mimeType='${mimeType}'`;
    const params = new URLSearchParams({ q, orderBy: 'modifiedTime desc', pageSize: '200', fields: 'files(id,name,createdTime,modifiedTime,mimeType,size,parents,trashed)' });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: await headers() });
    if (!response.ok) throw new Error('Falha ao listar os backups do Google Drive.');
    const result = await response.json();
    return Array.isArray(result.files) ? result.files : [];
  }

  /* Seção 12 — recuperação: lista TODOS os arquivos da pasta "Backups" (os
     três rodízios: autosave, forcesave e prewrite) para a pessoa escolher um
     ponto de restauração, com data e nome visíveis antes de abrir qualquer
     um deles. A contagem de registros só é lida quando a pessoa escolhe
     pré-visualizar um arquivo específico — listar todos de uma vez seria
     lento e desnecessário (podem existir até ~90 arquivos no rodízio). */
  async function listBackupSnapshots() {
    const { folderId } = await GoogleDriveClinic.ensureConnection(false);
    const backups = await ensureFolder(folderId, APP_FOLDERS.backups);
    const files = await listAllChildren(backups.id, 'application/json');
    return files
      .map(f => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime, size: Number(f.size) || 0 }))
      .sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));
  }

  async function previewSnapshot(fileId) {
    const state = await readJsonFile(fileId);
    if (!window.DataGuard?.isValidClinicSchema(state)) {
      throw new DriveGuardError('INVALID_REMOTE_SCHEMA', 'Este arquivo não parece ser um backup válido do Amanda Estética.', {});
    }
    return { state, counts: window.DataGuard.collectRecordCounts(state), revision: Number(state.databaseRevision) || 0 };
  }

  /* Restaurar um snapshot é uma ação EXPLÍCITA da pessoa (ela já viu a
     contagem de registros antes de confirmar) — por isso pula a checagem de
     queda suspeita, mas continua tirando um snapshot de segurança do
     conteúdo atual antes de substituir e continua conferindo a revisão para
     não perder uma gravação concorrente de outra aba/dispositivo. */
  async function restoreSnapshot(fileId, options = {}) {
    const state = await readJsonFile(fileId);
    if (!window.DataGuard?.isValidClinicSchema(state)) {
      throw new DriveGuardError('INVALID_REMOTE_SCHEMA', 'Este arquivo não parece ser um backup válido do Amanda Estética.', {});
    }
    return await saveAuthoritative(state, {
      interactive: options.interactive === true,
      expectedRevision: options.expectedRevision,
      skipSuspiciousCheck: true,
      reason: 'restauracao-snapshot-drive',
      alsoBackupNewContent: true
    });
  }

  const GoogleDriveClinic = {
    currentFile: null,
    DriveGuardError,
    loadAuthoritative,
    saveAuthoritative,
    readLastKnownGoodCounts,
    recordKnownGoodCounts: writeLastKnownGoodCounts,
    listBackupSnapshots,
    previewSnapshot,
    restoreSnapshot,

    cachedUser() { return Auth.cachedUser(); },
    folderId() { return getFolderId(); },
    isConfigured() { return !!(Auth.cachedUser() && getFolderId()); },

    /* V1.16.0 — autosave rotativo (20 slots, 1x por minuto), mesma mecânica do
       Borion Finance. `stateGetter` é uma função tipo `() => STATE`, passada uma
       vez ao iniciar o loop (login com Google ou boot já conectado); o tick só
       grava de fato quando algo mudou desde a última vez (markAutosaveDirty).
       V1.20.0 — o loop NUNCA roda antes do AppLifecycle liberar a gravação
       (base do Drive carregada, validada e hidratada). */
    startAutosaveLoop(stateGetter) {
      if (typeof stateGetter === 'function') autosaveStateGetter = stateGetter;
      this.stopAutosaveLoop();
      if (!this.isConfigured()) return;
      autosaveTimer = setInterval(() => { this.runAutosaveTick(); }, AUTOSAVE_INTERVAL_MS);
    },
    stopAutosaveLoop() {
      if (autosaveTimer) { clearInterval(autosaveTimer); autosaveTimer = null; }
    },
    markAutosaveDirty() { autosaveDirty = true; },
    async runAutosaveTick() {
      if (!this.isConfigured() || !autosaveDirty || !autosaveStateGetter) return false;
      if (window.AppLifecycle && !window.AppLifecycle.canWrite()) return false; // base ainda não validada/hidratada
      if (autosaveInFlight) return false;
      autosaveInFlight = true;
      try {
        const state = autosaveStateGetter();
        if (!state) return false;
        // Mesmo sendo só uma cópia rotativa (não é o arquivo principal), não
        // deixa uma base suspeita entrar no rodízio de backups — senão os
        // próprios backups acabam contaminados.
        const baseline = window.AppLifecycle?.getLastKnownGoodCounts() || readLastKnownGoodCounts(state.workspaceId || window.AppLifecycle?.getWorkspaceId());
        const nextCounts = window.DataGuard.collectRecordCounts(state);
        const check = window.DataGuard.detectSuspiciousDrop(nextCounts, baseline);
        if (check.suspicious) {
          console.warn('[GoogleDriveClinic] Autosave rotativo pulado por segurança (contagem suspeita):', window.DataGuard.describeSuspiciousReasons(check.reasons));
          window.onSuspiciousAutosaveBlocked?.(check.reasons);
          return false;
        }
        await writeRotatingSnapshot(getFolderId(), 'autosave', AUTOSAVE_SLOTS, state);
        autosaveDirty = false;
        return true;
      } catch (error) {
        console.warn('[GoogleDriveClinic] autosave rotativo falhou (tenta de novo no próximo minuto):', error);
        return false;
      } finally {
        autosaveInFlight = false;
      }
    },
    async authenticate(interactive = true) {
      return await authenticateGoogle(interactive);
    },

    async connect(interactive = true) {
      if (connectionInflight) return await connectionInflight;
      connectionInflight = (async () => {
        const user = await authenticateGoogle(interactive);
        let folderId = getFolderId();
        if (!folderId) {
          const picked = await openFolderPicker();
          folderId = picked.id;
          setFolderId(folderId);
        }
        await ensureAppFolders(folderId);
        return { user, folderId };
      })().finally(() => { connectionInflight = null; });
      return await connectionInflight;
    },

    async ensureConnection(interactive = false) {
      if (!this.isConfigured()) return await this.connect(interactive);
      await Auth.ensureToken(interactive);
      const user = TEST_MODE ? (Auth.user || { sub: 'test-user', email: 'test@example.invalid' }) : await assertAuthorizedUser(await Auth.fetchUser());
      const folderId = getFolderId();
      await ensureAppFolders(folderId);
      return { user, folderId };
    },

    async findDataFile() {
      const { folderId } = await this.ensureConnection(false);
      this.currentFile = await resolveDataFile(folderId);
      return this.currentFile;
    },

    /* V1.20.0 — este método público continua existindo para não quebrar quem
       já chama GoogleDriveClinic.save(...), mas agora delega inteiramente
       para saveAuthoritative: revisão remota é reconferida na hora, contagem
       de registros é comparada com a última base confiável e o conteúdo
       anterior é salvo em snapshot antes de ser substituído. */
    async save(state, options = {}) {
      const result = await saveAuthoritative(state, {
        interactive: options.interactive === true,
        allowCreate: options.allowCreate === true,
        expectedRevision: options.expectedRevision !== undefined ? options.expectedRevision : (window.AppLifecycle ? window.AppLifecycle.getRevision() : null),
        skipSuspiciousCheck: options.skipSuspiciousCheck === true,
        reason: options.reason,
        alsoBackupNewContent: options.backup === true
      });
      if (window.AppLifecycle) {
        window.AppLifecycle.setRevision(result.revision);
        window.AppLifecycle.setWorkspaceId(result.workspaceId);
        window.AppLifecycle.setLastKnownGoodCounts(result.counts);
      }
      return result.file;
    },

    /* V1.20.0 — leitura sempre autoritativa (busca o arquivo mais recente do
       Drive agora, nunca de cache em memória) e com validação de schema. */
    async load(options = {}) {
      const remote = await loadAuthoritative(options);
      if (!remote.exists) throw new Error('Ainda não existe um arquivo da clínica nesta pasta.');
      return { state: remote.state, meta: remote.meta, revision: remote.revision, counts: remote.counts, workspaceId: remote.workspaceId };
    },

    /* V1.20.0 — decide com base na REVISÃO que esta sessão efetivamente
       carregou (AppLifecycle.getRevision()), não mais em comparar relógios
       (`updatedAt`). Isso fecha a falha em que um estado local recém-criado
       (com `updatedAt` "agora") parecia mais novo que uma base remota
       preenchida só porque acabara de ser salvo localmente. Se esta sessão
       nunca carregou nenhuma revisão confirmada do Drive, o remoto sempre
       vence — nunca o contrário. */
    async sync(state, options = {}) {
      const remote = await loadAuthoritative({ interactive: options.interactive === true });
      if (!remote.exists) {
        const result = await saveAuthoritative(state, {
          interactive: options.interactive === true, allowCreate: true,
          reason: options.reason || 'primeira-sincronizacao', alsoBackupNewContent: true
        });
        if (window.AppLifecycle) { window.AppLifecycle.setRevision(result.revision); window.AppLifecycle.setWorkspaceId(result.workspaceId); window.AppLifecycle.setLastKnownGoodCounts(result.counts); }
        return { direction: 'local', created: true, revision: result.revision };
      }
      const sessionRevision = window.AppLifecycle ? window.AppLifecycle.getRevision() : null;
      if (sessionRevision === null || sessionRevision === undefined || remote.revision > sessionRevision) {
        return { direction: 'remote', state: remote.state, meta: remote.meta, revision: remote.revision, counts: remote.counts };
      }
      const result = await saveAuthoritative(state, {
        interactive: options.interactive === true, expectedRevision: remote.revision,
        reason: options.reason || 'sincronizacao', alsoBackupNewContent: options.backup === true
      });
      if (window.AppLifecycle) { window.AppLifecycle.setRevision(result.revision); window.AppLifecycle.setWorkspaceId(result.workspaceId); window.AppLifecycle.setLastKnownGoodCounts(result.counts); }
      return { direction: 'local', meta: this.currentFile, revision: result.revision };
    },

    /* BORION INTEROP v1.0.0 — protected transport seam. */
    async integrationFolderId() {
      const { folderId } = await this.ensureConnection(false);
      return (await ensureFolder(folderId, APP_FOLDERS.integration)).id;
    },
    async writeIntegrationJson(name, object) {
      const folderId = await this.integrationFolderId();
      const existing = await resolveIntegrationFile(folderId, name, object);
      return await updateJsonFile(existing.id, object);
    },
    async readIntegrationJson(name) {
      const folderId = await this.integrationFolderId();
      const existing = await resolveIntegrationFile(folderId, name, null);
      return existing ? await readJsonFile(existing.id) : null;
    },

    disconnect() {
      const user = Auth.cachedUser();
      if (user) localStorage.removeItem(folderKey(user.sub));
      this.currentFile = null;
      this.stopAutosaveLoop();
      resolvedFolders.clear();
      resolvedIntegrationFiles.clear();
      integrationFileInflight.clear();
      structureInflight.clear();
      resolvedStructures.clear();
      dataFileInflight.clear();
      connectionInflight = null;
      window.AppLifecycle?.resetForReconnect();
      Auth.signOut();
    },

    // Somente para os testes automatizados em /tests — nunca chamado por
    // nenhum caminho do próprio aplicativo em produção.
    __test: {
      enableTestMode() { TEST_MODE = true; },
      setToken(token = 'test-token', user = { sub: 'test-user', email: 'test@example.invalid' }) {
        Auth.token = token;
        Auth.expiresAt = Date.now() + 3600000;
        Auth.user = user;
      },
      resetCaches() {
        resolvedFolders.clear();
        resolvedIntegrationFiles.clear();
        integrationFileInflight.clear();
        structureInflight.clear();
        resolvedStructures.clear();
        dataFileInflight.clear();
      },
      readRemoteAuthoritative,
      DriveGuardError,
      setFolderIdForTests(id) { setFolderId(id); }
    }
  };

  window.GoogleDriveClinic = GoogleDriveClinic;
})();
