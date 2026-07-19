const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');

function makeLocalStorage() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
    _dump() { return Object.fromEntries(store); }
  };
}

function createSandbox({ fetchImpl }) {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.console = console;
  sandbox.localStorage = makeLocalStorage();
  sandbox.sessionStorage = makeLocalStorage();
  sandbox.navigator = {}; // sem `.locks` -> cai no mutex por localStorage, que já testamos indiretamente
  sandbox.crypto = webcrypto;
  sandbox.TextEncoder = TextEncoder;
  sandbox.TextDecoder = TextDecoder;
  sandbox.fetch = fetchImpl;
  sandbox.document = {
    querySelector: () => null,
    createElement: () => ({ set src(_v) {}, addEventListener() {} }),
    head: { appendChild() {} }
  };
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;
  sandbox.setInterval = setInterval;
  sandbox.clearInterval = clearInterval;
  sandbox.URLSearchParams = URLSearchParams;
  sandbox.URL = URL;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);

  function loadFile(relativePath) {
    const fullPath = path.join(__dirname, '..', relativePath);
    const code = fs.readFileSync(fullPath, 'utf8');
    vm.runInContext(code, context, { filename: fullPath });
  }

  loadFile('js/services/data-guard.js');
  loadFile('js/services/app-lifecycle.js');
  sandbox.AppLifecycle = sandbox.AppLifecycleFactory.createLifecycle();
  loadFile('js/services/google-drive.js');

  return sandbox;
}

module.exports = { createSandbox, makeLocalStorage };
