
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
  const FOLDER_PREFIX = 'amanda_clinica_gdrive_folder_';

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

  async function findChild(parentId, name, mimeType = '') {
    const safe = String(name).replace(/'/g, "\\'");
    let q = `'${parentId}' in parents and name='${safe}' and trashed=false`;
    if (mimeType) q += ` and mimeType='${mimeType}'`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent('files(id,name,modifiedTime,mimeType,size)')}`;
    const response = await fetch(url, { headers: await headers() });
    if (!response.ok) throw new Error('Falha ao consultar o Google Drive.');
    const result = await response.json();
    return result.files?.[0] || null;
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
      await Auth.ensureToken(interactive);
      const user = await Auth.fetchUser();
      let folderId = getFolderId();
      if (!folderId) {
        const picked = await openFolderPicker();
        folderId = picked.id;
        setFolderId(folderId);
      }
      return { user, folderId };
    },

    async ensureConnection(interactive = false) {
      if (!this.isConfigured()) return await this.connect(interactive);
      await Auth.ensureToken(interactive);
      if (!Auth.cachedUser()) await Auth.fetchUser();
      return { user: Auth.cachedUser(), folderId: getFolderId() };
    },

    async findDataFile() {
      const { folderId } = await this.ensureConnection(false);
      this.currentFile = await findChild(folderId, DATA_FILE, 'application/json');
      return this.currentFile;
    },

    async save(state, options = {}) {
      const { folderId } = await this.ensureConnection(options.interactive === true);
      let file = this.currentFile || await findChild(folderId, DATA_FILE, 'application/json');
      file = file ? await updateJsonFile(file.id, state) : await createJsonFile(folderId, DATA_FILE, state);
      this.currentFile = file;
      localStorage.setItem('amanda_clinica_last_google_save', new Date().toISOString());

      if (options.backup) {
        let backups = await findChild(folderId, 'Backups', 'application/vnd.google-apps.folder');
        if (!backups) backups = await createFolder(folderId, 'Backups');
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
      let folder = await findChild(folderId, 'Borion_Integracoes', 'application/vnd.google-apps.folder');
      if (!folder) folder = await createFolder(folderId, 'Borion_Integracoes');
      return folder.id;
    },
    async writeIntegrationJson(name, object) {
      const folderId = await this.integrationFolderId();
      const existing = await findChild(folderId, name, 'application/json');
      return existing ? await updateJsonFile(existing.id, object) : await createJsonFile(folderId, name, object);
    },
    async readIntegrationJson(name) {
      const folderId = await this.integrationFolderId();
      const existing = await findChild(folderId, name, 'application/json');
      return existing ? await readJsonFile(existing.id) : null;
    },

    disconnect() {
      const user = Auth.cachedUser();
      if (user) localStorage.removeItem(folderKey(user.sub));
      this.currentFile = null;
      Auth.signOut();
    }
  };

  window.GoogleDriveClinic = GoogleDriveClinic;
})();
