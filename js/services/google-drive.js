
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
  const DATA_FILE = 'Amanda_Clinica_Dados.json';
  const USER_KEY = 'amanda_clinica_gdrive_user';
  const DATA_FILE_ID_PREFIX = 'amanda_clinica_gdrive_data_file_';
  const FOLDER_PREFIX = 'amanda_clinica_gdrive_folder_';
  const SUBFOLDER_PREFIX = 'amanda_clinica_gdrive_subfolder_';
  const INTEGRATION_FILE_PREFIX = 'amanda_clinica_gdrive_integration_file_';
  const STRUCTURE_PREFIX = 'amanda_clinica_gdrive_structure_';
  const APP_FOLDERS = Object.freeze({ backups: 'Backups', integration: 'Borion_Integracoes', photos: 'Fotos_Clientes' });
  const resolvedFolders = new Map();
  const resolvedIntegrationFiles = new Map();
  const folderInflight = new Map();
  const integrationFileInflight = new Map();
  const structureInflight = new Map();
  const dataFileInflight = new Map();
  const resolvedStructures = new Map();
  let connectionInflight = null;

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
        this.tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
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

  const GoogleDriveClinic = {
    currentFile: null,

    cachedUser() { return Auth.cachedUser(); },
    folderId() { return getFolderId(); },
    isConfigured() { return !!(Auth.cachedUser() && getFolderId()); },

    async connect(interactive = true) {
      if (connectionInflight) return await connectionInflight;
      connectionInflight = (async () => {
        await Auth.ensureToken(interactive);
        const user = await Auth.fetchUser();
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
      if (!Auth.cachedUser()) await Auth.fetchUser();
      const folderId = getFolderId();
      await ensureAppFolders(folderId);
      return { user: Auth.cachedUser(), folderId };
    },

    async findDataFile() {
      const { folderId } = await this.ensureConnection(false);
      this.currentFile = await resolveDataFile(folderId);
      return this.currentFile;
    },

    async save(state, options = {}) {
      const { folderId } = await this.ensureConnection(options.interactive === true);
      const file = await saveDataFile(folderId, state);
      this.currentFile = file;
      localStorage.setItem('amanda_clinica_last_google_save', new Date().toISOString());

      if (options.backup) {
        const backups = await ensureFolder(folderId, APP_FOLDERS.backups);
        const reason = String(options.reason || 'manual').replace(/[^a-zA-Z0-9_-]/g, '-');
        await createJsonFile(backups.id, `Amanda_Clinica_${reason}_${stamp()}.json`, state);
      }
      return file;
    },

    async load(options = {}) {
      await this.ensureConnection(options.interactive === true);
      const file = this.currentFile || await this.findDataFile();
      if (!file) throw new Error('Ainda não existe um arquivo da clínica nesta pasta.');
      const [state, meta] = await Promise.all([readJsonFile(file.id), getMeta(file.id)]);
      this.currentFile = meta;
      return { state, meta };
    },

    async sync(state, options = {}) {
      await this.ensureConnection(options.interactive === true);
      const file = this.currentFile || await this.findDataFile();
      if (!file) {
        await this.save(state, { backup: true, reason: 'primeira-sincronizacao' });
        return { direction: 'local', created: true };
      }
      const remote = await this.load();
      if (remote.state?.updatedAt && new Date(remote.state.updatedAt) > new Date(state.updatedAt || 0)) {
        return { direction: 'remote', state: remote.state, meta: remote.meta };
      }
      await this.save(state, { backup: options.backup === true, reason: options.reason || 'sincronizacao' });
      return { direction: 'local', meta: this.currentFile };
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
      resolvedFolders.clear();
      resolvedIntegrationFiles.clear();
      integrationFileInflight.clear();
      structureInflight.clear();
      resolvedStructures.clear();
      dataFileInflight.clear();
      connectionInflight = null;
      Auth.signOut();
    }
  };

  window.GoogleDriveClinic = GoogleDriveClinic;
})();
