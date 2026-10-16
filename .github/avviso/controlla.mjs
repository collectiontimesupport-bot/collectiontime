// Controlla le proposte "in attesa" su Firestore e, se ce ne sono, ti manda un messaggio su Telegram.
import crypto from 'node:crypto';

const chiave = JSON.parse(process.env.FIREBASE_CHIAVE);
const bot = process.env.TELEGRAM_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

async function token() {
  const ora = Math.floor(Date.now() / 1000);
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: chiave.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: ora, exp: ora + 3000 });
  const firma = crypto.createSign('RSA-SHA256').update(corpo).sign(chiave.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: corpo + '.' + firma }) });
  const d = await r.json(); if (!d.access_token) throw new Error('Accesso a Firebase non riuscito: ' + JSON.stringify(d));
  return d.access_token;
}

const r = await fetch(`https://firestore.googleapis.com/v1/projects/${chiave.project_id}/databases/(default)/documents:runQuery`, {
  method: 'POST', headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' },
  body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'proposte' }], where: { fieldFilter: { field: { fieldPath: 'stato' }, op: 'EQUAL', value: { stringValue: 'attesa' } } }, limit: 100 } })
});
const righe = (await r.json());
if (!Array.isArray(righe)) throw new Error('Lettura proposte non riuscita: ' + JSON.stringify(righe));
const proposte = righe.filter(x => x.document).map(x => x.document.fields || {});
console.log('Proposte in attesa:', proposte.length);
if (!proposte.length) process.exit(0);

const elenco = proposte.slice(0, 15).map(f => `• ${f.da?.stringValue || '?'} · ${f.tipo?.stringValue || ''} · ${f.serie?.stringValue || ''}`).join('\n');
const testo = `🔔 Collection Time: ${proposte.length} propost${proposte.length === 1 ? 'a' : 'e'} da controllare\n\n${elenco}\n\nApri l'admin → Proposte per approvarle o rifiutarle.`;
const t = await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: testo }) });
if (!t.ok) throw new Error('Telegram non ha accettato il messaggio: ' + t.status + ' ' + await t.text());
console.log('Messaggio inviato.');
