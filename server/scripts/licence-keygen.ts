/**
 * Make the key pair for signed licences (src/utils/licenceToken.ts):
 *
 *   npm run licence:keygen -- <private-key-file>
 *
 * Writes the private key (PKCS#8 PEM) to <private-key-file>, which must not
 * exist yet and must be outside both repositories, and prints:
 * - the value for Render's LICENSE_SIGNING_KEY (the PEM on one line, with \n);
 * - the key id and public key for the desktop app
 *   (nesi-pharma backend/src/constants/licencePublicKeys.js).
 *
 * Keep the private key file safe: anyone who has it can sign licences. The
 * desktop's packaging check signs its test licence with it
 * (ADUROFIE_LICENCE_SIGNING_KEY_FILE).
 */
import fs from 'fs';
import path from 'path';
import { generateKeyPairSync } from 'crypto';
import { keyId, publicKeyText } from '../src/utils/licenceToken';

const target = process.argv[2];
if (!target) {
  console.error('Usage: npm run licence:keygen -- <private-key-file>');
  process.exit(1);
}
const file = path.resolve(target);
const repos = path.resolve(__dirname, '..', '..', '..');
if (file.startsWith(path.join(repos, 'nesi-pharma-admin') + path.sep) || file.startsWith(path.join(repos, 'nesi-pharma') + path.sep)) {
  console.error('Put the private key outside both repositories.');
  process.exit(1);
}
if (fs.existsSync(file)) {
  console.error(`${file} already exists: it may be the key installed apps trust. Choose another file.`);
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, pem, { mode: 0o600, flag: 'wx' });

console.log(`Private key written to ${file}`);
console.log('');
console.log('Desktop app (backend/src/constants/licencePublicKeys.js):');
console.log(`  '${keyId(publicKey)}': '${publicKeyText(publicKey)}',`);
console.log('');
console.log('Render: set LICENSE_SIGNING_KEY to the contents of the private key file');
console.log('(paste it as it is; or on one line with \\n between the lines).');
