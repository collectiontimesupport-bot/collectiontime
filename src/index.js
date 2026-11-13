/* =====================================================================
   Collection Time — programma "collection-time-prova"
   API per le collezioni degli utenti (tappa 2 del trasloco), su D1.

     GET    /api/collezione   -> { dati: {...} }  oppure 404 se non esiste
     PUT    /api/collezione   -> salva il documento (corpo = JSON)
     DELETE /api/collezione   -> elimina il documento
     OPTIONS /api/collezione  -> permesso CORS per collectiontime.com (e localhost)
     GET    /api/statistiche  -> SOLO l'admin (uid = ADMIN_UID in wrangler.jsonc), SOLA LETTURA: righe di tutti gli iscritti, a pagine

   Ognuno legge/scrive SOLO il proprio uid (preso dal token Firebase,
   mai dal corpo della richiesta). Tutto il resto del sito resta file statici.
   ===================================================================== */

const PROGETTO = 'collection-time-dd8fe';
const CHIAVI = 'https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com';
const MAX_BYTE = 512 * 1024;                       // limite dimensione documento
/* come hasOnly([...]) delle regole di Firestore: solo questi campi */
const CAMPI = ['versione', 'aggiornato', 'collezioni', 'paese', 'paeseAuto', 'trofei', 'badge', 'preferenze', 'accettato'];

/* CORS: il sito vero (collectiontime.com, GitHub Pages) chiama l'API da un altro indirizzo, quindi il browser
   chiede il permesso (OPTIONS). Ammessi: il sito vero, e localhost/127.0.0.1 (anteprima "Prova il sito" dell'admin e prove sul Mac).
   Non è la protezione dei dati: quella la fa il token Firebase (nessun cookie, nessun accesso senza token). */
const ORIGINI = ['https://collectiontime.com', 'https://www.collectiontime.com'];
const origineOk = o => !!o && (ORIGINI.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o));
function conCors(request, res) {
  const o = request.headers.get('origin');
  const r = new Response(res.body, res);
  r.headers.append('vary', 'Origin');
  if (origineOk(o)) {
    r.headers.set('access-control-allow-origin', o);
    r.headers.set('access-control-allow-methods', 'GET, PUT, DELETE, OPTIONS');
    r.headers.set('access-control-allow-headers', 'authorization, content-type');
    r.headers.set('access-control-max-age', '86400');
  }
  return r;
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const b64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const testo = s => JSON.parse(new TextDecoder().decode(b64(s)));

/* chiavi pubbliche di Google: in cache (nella memoria del programma) finché valide */
let cacheChiavi = null;
async function chiavi(forza) {
  if (!forza && cacheChiavi && cacheChiavi.scade > Date.now()) return cacheChiavi.keys;
  const r = await fetch(CHIAVI);
  if (!r.ok) throw new Error('chiavi non disponibili');
  const m = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
  const keys = (await r.json()).keys;
  cacheChiavi = { keys, scade: Date.now() + (m ? +m[1] : 3600) * 1000 };
  return keys;
}

/* verifica il token Firebase (JWT RS256) e restituisce i dati dell'utente */
export async function verificaToken(token, adesso = Date.now()) {
  const parti = String(token || '').split('.');
  if (parti.length !== 3) throw new Error('token');
  const intest = testo(parti[0]), dati = testo(parti[1]);
  if (intest.alg !== 'RS256' || !intest.kid) throw new Error('token');
  let jwk = (await chiavi(false)).find(k => k.kid === intest.kid);
  if (!jwk) jwk = (await chiavi(true)).find(k => k.kid === intest.kid);   // chiavi ruotate
  if (!jwk) throw new Error('chiave');
  const chiave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', chiave, b64(parti[2]), new TextEncoder().encode(parti[0] + '.' + parti[1]));
  if (!ok) throw new Error('firma');
  const s = Math.floor(adesso / 1000);
  if (dati.aud !== PROGETTO || dati.iss !== 'https://securetoken.google.com/' + PROGETTO) throw new Error('progetto');
  if (!dati.sub || dati.sub.length > 128) throw new Error('uid');
  if (!(dati.exp > s) || !(dati.iat <= s + 60)) throw new Error('scaduto');
  return { uid: dati.sub, emailVerificata: dati.email_verified === true };
}

async function gestisci(request, env) {
  const m = request.method;
  if (!['GET', 'PUT', 'DELETE'].includes(m)) return json({ errore: 'metodo' }, 405);
  const h = request.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ')) return json({ errore: 'accesso' }, 401);
  let utente;
  try { utente = await verificaToken(h.slice(7)); } catch (e) { return json({ errore: 'accesso' }, 401); }

  if (m === 'GET') {
    const r = await env.DB.prepare('SELECT dati FROM collezioni WHERE uid = ?').bind(utente.uid).first();
    return r ? json({ dati: JSON.parse(r.dati) }) : json({ errore: 'non trovato' }, 404);
  }
  if (m === 'DELETE') {
    await env.DB.prepare('DELETE FROM collezioni WHERE uid = ?').bind(utente.uid).run();
    return json({ ok: true });
  }
  /* PUT */
  const corpo = await request.text();
  if (corpo.length > MAX_BYTE) return json({ errore: 'troppo grande' }, 413);
  let dati;
  try { dati = JSON.parse(corpo); } catch (e) { return json({ errore: 'json' }, 400); }
  if (!dati || typeof dati !== 'object' || Array.isArray(dati)) return json({ errore: 'formato' }, 400);
  if (Object.keys(dati).some(k => !CAMPI.includes(k))) return json({ errore: 'campo non ammesso' }, 400);
  if (typeof dati.aggiornato !== 'number' || !dati.collezioni || typeof dati.collezioni !== 'object') return json({ errore: 'formato' }, 400);
  const esiste = await env.DB.prepare('SELECT 1 AS x FROM collezioni WHERE uid = ?').bind(utente.uid).first();
  if (!esiste && !utente.emailVerificata) return json({ errore: 'email non verificata' }, 403);   // creazione solo con email verificata
  const ora = Date.now();
  await env.DB.prepare(
    'INSERT INTO collezioni (uid, dati, aggiornato, creato, paese) VALUES (?1, ?2, ?3, ?4, ?5) ' +
    'ON CONFLICT(uid) DO UPDATE SET dati = ?2, aggiornato = ?3, paese = ?5'
  ).bind(utente.uid, JSON.stringify(dati), dati.aggiornato, ora, typeof dati.paese === 'string' ? dati.paese.slice(0, 8) : null).run();
  return json({ ok: true });
}

/* STATISTICHE dell'admin (app sul Mac): GET /api/statistiche?dopo=<uid>
   Solo l'account admin (uid del token Firebase = env.ADMIN_UID; se ADMIN_UID manca, nessuno entra).
   SOLA LETTURA: una sola SELECT, nessuna scrittura. Risponde a pagine di PAGINA iscritti, in ordine di uid:
   { righe: [{ uid, creato, aggiornato, paese, peso, dati }], prossimo: <ultimo uid> | null }.
   "dati" resta TESTO (il JSON dell'iscritto): il programma non lo apre (poca CPU) e una riga rotta non rovina le altre.
   "peso" = byte del documento (il limite del sito è MAX_BYTE). */
const PAGINA = 200;
async function statistiche(request, env) {
  if (request.method !== 'GET') return json({ errore: 'metodo' }, 405);
  const h = request.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ')) return json({ errore: 'accesso' }, 401);
  let utente;
  try { utente = await verificaToken(h.slice(7)); } catch (e) { return json({ errore: 'accesso' }, 401); }
  if (!env.ADMIN_UID || utente.uid !== env.ADMIN_UID) return json({ errore: 'non autorizzato' }, 403);
  const dopo = (new URL(request.url).searchParams.get('dopo') || '').slice(0, 128);
  const { results } = await env.DB.prepare(
    'SELECT uid, dati, aggiornato, creato, paese, length(CAST(dati AS BLOB)) AS peso FROM collezioni WHERE uid > ?1 ORDER BY uid LIMIT ?2'
  ).bind(dopo, PAGINA + 1).all();
  const righe = results.slice(0, PAGINA);
  return json({
    righe: righe.map(r => ({ uid: r.uid, creato: r.creato, aggiornato: r.aggiornato, paese: r.paese, peso: r.peso, dati: r.dati })),
    prossimo: results.length > PAGINA ? righe[righe.length - 1].uid : null
  });
}

/* IMPORTAZIONE (trasloco): POST /api/importa con l'intestazione x-chiave-importa = segreto CHIAVE_IMPORTA.
   Attiva SOLO mentre il segreto esiste (si crea per importare e si cancella subito dopo).
   Stessa regola dello script: se in D1 c'è un documento più recente, non si tocca. */
async function importa(request, env) {
  if (!env.CHIAVE_IMPORTA || request.method !== 'POST') return json({ errore: 'non trovato' }, 404);
  const data = new TextEncoder().encode(request.headers.get('x-chiave-importa') || ''), vera = new TextEncoder().encode(env.CHIAVE_IMPORTA);
  let diverso = data.length !== vera.length ? 1 : 0;
  for (let i = 0; i < vera.length; i++) diverso |= (data[i] || 0) ^ vera[i];
  if (diverso) return json({ errore: 'non trovato' }, 404);
  const { documenti } = await request.json();
  if (!Array.isArray(documenti) || documenti.length > 100) return json({ errore: 'formato' }, 400);
  const st = env.DB.prepare(
    'INSERT INTO collezioni (uid, dati, aggiornato, creato, paese) VALUES (?1, ?2, ?3, ?4, ?5) ' +
    'ON CONFLICT(uid) DO UPDATE SET dati = excluded.dati, aggiornato = excluded.aggiornato, paese = excluded.paese, creato = MIN(collezioni.creato, excluded.creato) ' +
    'WHERE excluded.aggiornato > collezioni.aggiornato');
  const ris = await env.DB.batch(documenti.map(d => st.bind(d.uid, d.dati, d.aggiornato, d.creato, d.paese ?? null)));
  return json({ ok: true, scritti: ris.reduce((t, r) => t + (r.meta.changes || 0), 0) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/importa') {
      try { return await importa(request, env); } catch (e) { return json({ errore: 'server' }, 500); }
    }
    if (url.pathname === '/api/collezione') {
      let res;
      if (request.method === 'OPTIONS') res = new Response(null, { status: 204 });      // permesso CORS (senza token: lo chiede il browser)
      else { try { res = await gestisci(request, env); } catch (e) { res = json({ errore: 'server' }, 500); } }
      return conCors(request, res);
    }
    if (url.pathname === '/api/statistiche') {
      let res;
      if (request.method === 'OPTIONS') res = new Response(null, { status: 204 });
      else { try { res = await statistiche(request, env); } catch (e) { res = json({ errore: 'server' }, 500); } }
      return conCors(request, res);
    }
    return env.ASSETS.fetch(request);
  }
};
