// Sombra mínima do WebCrypto (subtle.digest) usando o módulo nativo `crypto`
// do Node, só para os testes automatizados rodarem fora do navegador.
const nodeCrypto = require('crypto');

if (!global.crypto) global.crypto = {};
if (!global.crypto.subtle) {
  global.crypto.subtle = {
    async digest(algorithm, data) {
      const hash = nodeCrypto.createHash(String(algorithm).replace('-', '').toLowerCase() === 'sha256' ? 'sha256' : 'sha256');
      hash.update(Buffer.from(data));
      return hash.digest().buffer;
    }
  };
}
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () => nodeCrypto.randomUUID();
}
