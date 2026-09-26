/* =====================================================================
   cloud.js — "Accedi" (con Google o con email e password)
   e collezione salvata nel cloud
   (Collection Time)
   ---------------------------------------------------------------------
   È l'UNICO file del sito che parla con Firebase (Google).
   Se un giorno si cambia servizio (Supabase, un proprio server…) basta
   riscrivere questo file: il resto del sito non sa che Firebase esiste.

   Quando si carica? Solo quando serve, così il sito resta leggero:
     • chi preme "Accedi" nella banda in alto
     • chi ha già fatto l'accesso su questo browser (per tenere il cloud aggiornato)
   Lo carica script.js (funzione caricaCloud); pesa circa 100 KB.

   Come funziona il salvataggio:
     • le spunte, i doppioni e gli hashtag restano SEMPRE anche nel browser
       (il sito funziona come prima, anche senza rete)
     • nel cloud c'è UN documento per persona: collezioni/<codice utente>
       { versione: 1, aggiornato: <ora>, collezioni: { … } }
       "collezioni" ha lo stesso formato del file di Esporta
     • quando cambi qualcosa, qualche secondo dopo il cloud si aggiorna
     • aprendo il sito (una volta per visita) si scarica quello che hai
       cambiato su un altro dispositivo
     • al primo accesso su un dispositivo, quello che c'è nel browser e
       quello che c'è nel cloud si UNISCONO (non si perde niente)
   Leggere, unire e scrivere i dati del browser lo fanno le funzioni di
   script.js leggiTutto() e scriviTutto(), le stesse di Esporta / Importa.

   Le regole di sicurezza (nella console di Firebase, Firestore → Regole)
   permettono a ognuno di leggere e scrivere solo il proprio documento.
   ===================================================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, deleteUser,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-lite.js';

/* Dati del progetto Firebase "Collection-Time" (console di Firebase →
   Impostazioni progetto → Le tue app → Sito C.T.). Sono dati PUBBLICI:
   stanno nel sito apposta, la protezione la fanno le regole di sicurezza.
   (measurementId non c'è apposta: Google Analytics non si usa) */
const FIREBASE = {
  apiKey: 'AIzaSyCgch5N04Z8YBprYCyJiMj_cYoXfz32b7c',
  authDomain: 'collection-time-dd8fe.firebaseapp.com',
  projectId: 'collection-time-dd8fe',
  storageBucket: 'collection-time-dd8fe.firebasestorage.app',
  messagingSenderId: '1017812174787',
  appId: '1:1017812174787:web:ec1b01b93047e387861f76'
};

const app = initializeApp(FIREBASE);
const auth = getAuth(app);
auth.languageCode = 'it';                                    // email di Firebase (es. reimposta password) in italiano
const db = getFirestore(app);
const documento = uid => doc(db, 'collezioni', uid);

/* ---------- memoria di questo browser ----------
   ct-cloud (localStorage): { uid, ultimo, sporco }
     uid    = chi ha fatto l'accesso qui
     ultimo = "aggiornato" del cloud all'ultima sincronizzazione
     sporco = ci sono modifiche fatte qui e non ancora mandate al cloud
   ct-cloud-visita (sessionStorage): la sincronizzazione di inizio visita è già fatta */
const leggiStato = () => { try { return JSON.parse(localStorage.getItem('ct-cloud')) || {}; } catch (e) { return {}; } };
const scriviStato = s => { try { localStorage.setItem('ct-cloud', JSON.stringify(s)); } catch (e) {} };

/* ---------- unire due collezioni (browser + cloud) ----------
   "Ce l'ho": vale se è segnato in almeno uno dei due
   doppioni: il numero più alto · hashtag: quelli di questo browser, se ci sono */
function unisci(a, b) {
  const tutto = {};
  for (const nome of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const x = (a || {})[nome] || {}, y = (b || {})[nome] || {}, c = {};
    const possedute = [...new Set([...(x.possedute || []), ...(y.possedute || [])])];
    const doppi = Object.assign({}, y.doppi);
    Object.entries(x.doppi || {}).forEach(([id, n]) => { doppi[id] = Math.max(n, doppi[id] || 0); });
    const hashtag = Object.assign({}, y.hashtag, x.hashtag);
    if (possedute.length) c.possedute = possedute;
    if (Object.keys(doppi).length) c.doppi = doppi;
    if (Object.keys(hashtag).length) c.hashtag = hashtag;
    if (Object.keys(c).length) tutto[nome] = c;
  }
  return tutto;
}
/* "impronta" di una collezione, per capire se è cambiata (l'ordine non conta) */
function impronta(collezioni) {
  const ordina = v => Array.isArray(v) ? v.map(ordina).sort() : v && typeof v === 'object'
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = ordina(v[k]), o), {}) : v;
  return JSON.stringify(ordina(collezioni || {}));
}

/* ---------- sincronizzazione ---------- */
let inCorso = null, timer = null;
function sincronizza() {
  if (inCorso) return inCorso.then(() => sincronizza());
  inCorso = (async () => {
    const utente = auth.currentUser;
    if (!utente) return;
    const stato = leggiStato();
    const nube = (await getDoc(documento(utente.uid))).data();
    const locale = await leggiTutto();
    let finale = locale, daScrivereQui = false;
    if (!nube) finale = locale;                                              // primo salvataggio in assoluto
    else if (stato.uid !== utente.uid) { finale = unisci(locale, nube.collezioni); daScrivereQui = true; }   // primo accesso su questo browser
    else if (nube.aggiornato === stato.ultimo) { if (!stato.sporco) return; }  // il cloud non è cambiato: mando solo le mie modifiche
    else if (stato.sporco) { finale = unisci(locale, nube.collezioni); daScrivereQui = true; }                // cambiato qui e altrove: unisco
    else { finale = nube.collezioni || {}; daScrivereQui = true; }            // cambiato solo altrove: prendo il cloud
    const cambiaQui = daScrivereQui && impronta(finale) !== impronta(locale);
    if (cambiaQui) await scriviTutto(finale, true);
    let aggiornato = nube && nube.aggiornato;
    if (!nube || impronta(finale) !== impronta(nube.collezioni)) {
      aggiornato = Date.now();
      await setDoc(documento(utente.uid), { versione: 1, aggiornato, collezioni: finale });
    }
    scriviStato({ uid: utente.uid, ultimo: aggiornato, sporco: false });
    aggiornaFinestra();
    /* se sono arrivate spunte da un altro dispositivo, ridisegno la pagina */
    if (cambiaQui && (typeof CONFIG !== 'undefined' || document.getElementById('raccolta'))) location.reload();
  })().catch(e => { console.warn('Cloud:', e); }).finally(() => { inCorso = null; });
  return inCorso;
}

/* ogni modifica (spunta, doppione, hashtag, Importa) arriva qui da script.js:
   segno "sporco" e mando al cloud dopo qualche secondo di calma */
window.addEventListener('ct-modifica', () => {
  const s = leggiStato();
  if (!auth.currentUser) return;
  scriviStato(Object.assign(s, { sporco: true }));
  clearTimeout(timer);
  timer = setTimeout(sincronizza, 4000);
});
/* chiudendo o nascondendo la pagina mando subito quello che manca */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && leggiStato().sporco) { clearTimeout(timer); sincronizza(); }
});

/* ---------- accesso ---------- */
onAuthStateChanged(auth, utente => {
  segnaAccesso(!!utente);                                     // funzione di script.js: ricorda l'accesso e cambia il pulsante
  aggiornaPulsante(utente);
  aggiornaFinestra();
  if (utente) {
    let fatta = false;
    try { fatta = sessionStorage.getItem('ct-cloud-visita') === utente.uid; sessionStorage.setItem('ct-cloud-visita', utente.uid); } catch (e) {}
    if (!fatta || leggiStato().sporco) sincronizza();
  }
});

async function accedi() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    avviso('Accesso fatto: la tua collezione si salva anche nel cloud.');
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    console.warn(e);
    avviso(e.code === 'auth/popup-blocked' ? 'Il browser ha bloccato la finestra di Google: permetti i pop-up per questo sito e riprova.' : 'Accesso non riuscito. Riprova tra poco.');
  }
}
/* ---------- accesso con email e password ----------
   modo: 'entra' (ha già l'account) o 'nuovo' (crea l'account) */
const ERRORI = {
  'auth/invalid-email': 'L\'indirizzo email non è scritto bene.',
  'auth/missing-password': 'Scrivi la password.',
  'auth/weak-password': 'La password deve avere almeno 6 caratteri.',
  'auth/email-already-in-use': 'Esiste già un account con questa email: premi "Accedi".',
  'auth/invalid-credential': 'Email o password sbagliate. Se non hai ancora un account, premi "Crea account".',
  'auth/user-not-found': 'Non c\'è nessun account con questa email: premi "Crea account".',
  'auth/wrong-password': 'Password sbagliata.',
  'auth/too-many-requests': 'Troppi tentativi: aspetta qualche minuto e riprova.',
  'auth/network-request-failed': 'Connessione assente: riprova quando sei online.',
  'auth/operation-not-allowed': 'L\'accesso con email non è ancora attivo. Riprova più tardi.',
  'auth/configuration-not-found': 'L\'accesso non è ancora attivo. Riprova più tardi.'
};
const messaggioErrore = e => ERRORI[e.code] || 'Qualcosa non ha funzionato. Riprova tra poco.';
async function conEmail(modo, email, password) {
  try {
    if (modo === 'nuovo') await createUserWithEmailAndPassword(auth, email, password);
    else await signInWithEmailAndPassword(auth, email, password);
    finestra.close();
    avviso(modo === 'nuovo' ? 'Account creato: la tua collezione si salva anche nel cloud.' : 'Accesso fatto: la tua collezione si salva anche nel cloud.');
  } catch (e) { mostraErrore(messaggioErrore(e)); }
}
async function passwordDimenticata(email) {
  if (!email) return mostraErrore('Scrivi la tua email qui sopra, poi premi di nuovo "Password dimenticata?".');
  try {
    await sendPasswordResetEmail(auth, email);
    mostraErrore('Ti ho mandato un\'email per scegliere una nuova password (guarda anche nello spam).', true);
  } catch (e) { mostraErrore(messaggioErrore(e)); }
}
function mostraErrore(testo, ok) {
  const el = finestra && finestra.querySelector('.st-account-errore');
  if (!el) return avviso(testo);
  el.textContent = testo;
  el.classList.toggle('ok', !!ok);
  el.hidden = false;
}

async function esci() {
  await sincronizza();                                         // prima mando le ultime modifiche
  await signOut(auth);
  try { localStorage.removeItem('ct-cloud'); sessionStorage.removeItem('ct-cloud-visita'); } catch (e) {}
  avviso('Sei uscito. La collezione resta anche in questo browser.');
}
async function eliminaDati() {
  const utente = auth.currentUser;
  if (!utente) return;
  await deleteDoc(documento(utente.uid));
  try { localStorage.removeItem('ct-cloud'); } catch (e) {}
  try { await deleteUser(utente); avviso('Account e dati nel cloud eliminati. La collezione resta in questo browser.'); }
  catch (e) {
    await signOut(auth);
    avviso('Dati nel cloud eliminati. Per eliminare anche l\'account, accedi di nuovo e ripeti subito.');
  }
}

/* ---------- pulsante nella banda in alto e finestra "Account" ----------
   Il pulsante (id stAccedi) è in header.html; l'aspetto della finestra
   è quello della finestra "Aggiungi alla Home" (.st-guida in sito.css). */
function aggiornaPulsante(utente) {
  const b = document.getElementById('stAccedi');
  if (b) b.textContent = utente ? (utente.displayName ? utente.displayName.split(' ')[0] : (utente.email || 'Account').split('@')[0]) : 'Accedi';
}
let finestra = null, conferma = false;
function aggiornaFinestra() {
  if (!finestra) return;
  const u = auth.currentUser, s = leggiStato();
  const quando = s.ultimo ? new Date(s.ultimo).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  finestra.querySelector('.st-account-testo').innerHTML = u
    ? '<p>Accesso fatto come <b>' + esc(u.displayName || u.email || '') + '</b>' + (u.displayName ? '<br><small>' + esc(u.email || '') + '</small>' : '') + '</p>'
      + '<p>La tua collezione si salva nel cloud e la ritrovi su tutti i dispositivi in cui fai l\'accesso.'
      + (s.sporco ? ' <b>Salvataggio in corso…</b>' : quando ? ' Ultimo salvataggio: ' + quando + '.' : '') + '</p>'
    : '<p>Accedi per <b>salvare la collezione nel cloud</b> e ritrovarla sul telefono, sul computer e su un nuovo dispositivo.</p>'
      + '<button type="button" data-azione="accedi" class="st-google">Accedi con Google</button>'
      + '<p class="st-oppure">oppure con la tua email</p>'
      + '<form class="st-email" novalidate>'
      +   '<input type="email" name="email" placeholder="Email" autocomplete="email" required>'
      +   '<input type="password" name="password" placeholder="Password (almeno 6 caratteri)" autocomplete="current-password" required>'
      +   '<p class="st-account-errore" role="alert" hidden></p>'
      +   '<div class="st-email-azioni"><button type="submit" data-modo="entra">Accedi</button><button type="submit" data-modo="nuovo" class="st-secondario">Crea account</button></div>'
      +   '<button type="button" data-azione="dimenticata" class="st-link">Password dimenticata?</button>'
      + '</form>'
      + '<p><small>Salviamo solo il tuo nome, la tua email e quello che segni sul sito (spunte, doppioni, hashtag). Dettagli nella pagina Privacy.</small></p>';
  finestra.querySelector('.st-account-azioni').innerHTML = u
    ? '<button type="button" data-azione="elimina" class="st-secondario">' + (conferma ? 'Sicuro? Premi di nuovo' : 'Elimina i miei dati') + '</button><button type="button" data-azione="esci" class="st-secondario">Esci</button><button type="button" data-azione="chiudi">Chiudi</button>'
    : '<button type="button" data-azione="chiudi" class="st-secondario">Chiudi</button>';
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function apriAccount() {
  if (!finestra) {
    finestra = document.createElement('dialog');
    finestra.className = 'st-guida st-account';
    finestra.setAttribute('aria-labelledby', 'stAccountTitolo');
    finestra.innerHTML = '<h2 id="stAccountTitolo">La tua collezione nel cloud</h2><div class="st-account-testo"></div><div class="st-account-azioni"></div>';
    finestra.addEventListener('click', e => {
      const b = e.target.closest('button[data-azione]');
      if (!b) {                                                // clic fuori dalla finestra: chiude
        const r = finestra.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) finestra.close();
        return;
      }
      const azione = b.dataset.azione;
      if (azione === 'accedi') { finestra.close(); accedi(); }  // il clic apre subito la finestra di Google (se no il browser la blocca)
      else if (azione === 'dimenticata') passwordDimenticata(finestra.querySelector('.st-email [name=email]').value.trim());
      else if (azione === 'esci') { finestra.close(); esci(); }
      else if (azione === 'elimina') {
        if (!conferma) { conferma = true; aggiornaFinestra(); return; }
        finestra.close(); eliminaDati();
      }
      else finestra.close();
    });
    /* modulo email: "Accedi" o "Crea account" (anche premendo Invio = Accedi) */
    finestra.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target, modo = (e.submitter && e.submitter.dataset.modo) || 'entra';
      conEmail(modo, f.email.value.trim(), f.password.value);
    });
    finestra.addEventListener('close', () => { conferma = false; });
    document.body.append(finestra);
  }
  aggiornaFinestra();
  finestra.showModal();
}
