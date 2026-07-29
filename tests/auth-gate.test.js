'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('a tela clinica nao oferece entrada sem autenticacao', () => {
  const login = read('js/core/03-shell-navigation.js');
  const actions = read('js/core/04-actions.js');

  assert.doesNotMatch(login, /enter-profile-offline|Entrar sem login/);
  assert.doesNotMatch(actions, /enter-profile-offline|enterProfileOffline/);
});

test('uma sessao local antiga nao libera o shell sem Google Drive', () => {
  const boot = read('js/core/05-events-boot.js');
  const noDriveBranch = boot.slice(
    boot.indexOf('if (!driveConfigured)'),
    boot.indexOf('} else {', boot.indexOf('if (!driveConfigured)'))
  );

  assert.match(noDriveBranch, /removeItem\('amanda_clinica_unlocked'\)/);
  assert.match(noDriveBranch, /renderLogin\(\)/);
  assert.doesNotMatch(noDriveBranch, /renderShell\(\)|finalizeSessionReady\(\)/);
});
