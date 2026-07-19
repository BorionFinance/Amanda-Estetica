// Servidor falso do Google Drive, só em memória, para os testes de simulação.
// Implementa apenas as poucas chamadas da API v3 que js/services/google-drive.js
// realmente usa: listar filhos de uma pasta, criar pasta, criar arquivo
// (multipart), atualizar conteúdo (media), ler conteúdo (alt=media) e ler
// metadados. Isso permite rodar o CÓDIGO REAL do serviço (não uma reimplementação
// da lógica) contra um "Drive" que vive só na memória do processo de teste.
const crypto = require('crypto');

function makeFakeDrive() {
  let counter = 0;
  const files = new Map(); // id -> { id, name, mimeType, parents, trashed, createdTime, modifiedTime, content }

  function nextId(prefix) { counter += 1; return `${prefix}_${counter}`; }

  function metaOf(file) {
    return { id: file.id, name: file.name, mimeType: file.mimeType, parents: file.parents, trashed: file.trashed, createdTime: file.createdTime, modifiedTime: file.modifiedTime, size: String(file.content ? file.content.length : 0) };
  }

  function createFolder(name, parents) {
    const id = nextId('folder');
    const now = new Date().toISOString();
    const file = { id, name, mimeType: 'application/vnd.google-apps.folder', parents, trashed: false, createdTime: now, modifiedTime: now, content: null };
    files.set(id, file);
    return file;
  }

  function createFile(name, parents, mimeType, content) {
    const id = nextId('file');
    const now = new Date().toISOString();
    const file = { id, name, mimeType, parents, trashed: false, createdTime: now, modifiedTime: now, content };
    files.set(id, file);
    return file;
  }

  function listChildren(parentId, name, mimeType) {
    return [...files.values()].filter(f =>
      !f.trashed && f.parents?.includes(parentId) && f.name === name && (!mimeType || f.mimeType === mimeType)
    );
  }

  // Ponto de falha injetável pelos testes: quando definido, a próxima
  // chamada de fetch cujo padrão bata falha com o erro/atraso indicado.
  let networkFault = null;
  function setNetworkFault(fault) { networkFault = fault; }

  async function fakeFetch(url, init = {}) {
    if (networkFault && networkFault.match(url, init)) {
      const fault = networkFault;
      if (typeof fault.times === 'number') {
        fault.times -= 1;
        if (fault.times <= 0) networkFault = null;
      }
      if (fault.throwNetworkError) throw new Error('Falha de rede simulada');
      return { ok: false, status: fault.status || 500, json: async () => ({ error: fault.message || 'Erro simulado' }) };
    }

    const method = (init.method || 'GET').toUpperCase();
    const u = new URL(url);

    // GET /drive/v3/files?q=...  (listar filhos)
    if (u.pathname === '/drive/v3/files' && method === 'GET') {
      const q = u.searchParams.get('q') || '';
      const parentMatch = q.match(/'([^']+)' in parents/);
      const nameMatch = q.match(/name='([^']*)'/);
      const mimeMatch = q.match(/mimeType='([^']*)'/);
      const parentId = parentMatch ? parentMatch[1] : null;
      const name = nameMatch ? nameMatch[1].replace(/\\'/g, "'") : null;
      const mimeType = mimeMatch ? mimeMatch[1] : '';
      const result = listChildren(parentId, name, mimeType).map(metaOf);
      return { ok: true, json: async () => ({ files: result }) };
    }

    // POST /drive/v3/files?fields=...  (criar pasta)
    if (u.pathname === '/drive/v3/files' && method === 'POST') {
      const body = JSON.parse(init.body);
      const file = createFolder(body.name, body.parents || []);
      return { ok: true, json: async () => metaOf(file) };
    }

    // POST /upload/drive/v3/files?uploadType=multipart  (criar arquivo com conteúdo)
    if (u.pathname === '/upload/drive/v3/files' && method === 'POST') {
      const boundary = String(init.headers['Content-Type'] || init.headers['content-type']).split('boundary=')[1];
      const raw = init.body;
      const parts = raw.split(`--${boundary}`).filter(p => p.trim() && p.trim() !== '--');
      const metaPart = parts[0];
      const contentPart = parts[1];
      const metaJsonText = metaPart.slice(metaPart.indexOf('{'), metaPart.lastIndexOf('}') + 1);
      const metadata = JSON.parse(metaJsonText);
      const contentText = contentPart.slice(contentPart.indexOf('{'), contentPart.lastIndexOf('}') + 1);
      const file = createFile(metadata.name, metadata.parents || [], metadata.mimeType, contentText);
      return { ok: true, json: async () => metaOf(file) };
    }

    // PATCH /upload/drive/v3/files/{id}?uploadType=media  (atualizar conteúdo)
    const patchMatch = u.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
    if (patchMatch && method === 'PATCH') {
      const file = files.get(patchMatch[1]);
      if (!file) return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
      file.content = init.body;
      file.modifiedTime = new Date().toISOString();
      return { ok: true, json: async () => metaOf(file) };
    }

    // GET /drive/v3/files/{id}?alt=media  (ler conteúdo)
    const mediaMatch = u.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (mediaMatch && method === 'GET' && u.searchParams.get('alt') === 'media') {
      const file = files.get(mediaMatch[1]);
      if (!file) return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
      return { ok: true, json: async () => JSON.parse(file.content) };
    }

    // GET /drive/v3/files/{id}?fields=...  (ler metadados)
    if (mediaMatch && method === 'GET') {
      const file = files.get(mediaMatch[1]);
      if (!file) { const err = { ok: false, status: 404, json: async () => ({ error: 'not found' }) }; return err; }
      return { ok: true, json: async () => metaOf(file) };
    }

    // GET userinfo (não deveria ser chamado em TEST_MODE, mas cobrimos por segurança)
    if (u.pathname === '/oauth2/v3/userinfo') {
      return { ok: true, json: async () => ({ sub: 'test-user', email: 'test@example.invalid', name: 'Teste' }) };
    }

    throw new Error(`[fake-drive] Rota não simulada: ${method} ${url}`);
  }

  return { fetch: fakeFetch, files, createFolder, createFile, listChildren, setNetworkFault, _crypto: crypto };
}

module.exports = { makeFakeDrive };
