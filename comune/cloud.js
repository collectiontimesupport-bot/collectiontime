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
     • quando cambi qualcosa, 20 secondi dopo (o subito se chiudi la pagina) il cloud si aggiorna
     • aprendo il sito (una volta per visita) si scarica quello che hai
       cambiato su un altro dispositivo
     • al primo accesso su un dispositivo che ha GIÀ delle spunte (e anche
       l'account ne ha), si chiede se unirle all'account o usare solo quelle
       dell'account (funzione chiedi)
     • uscendo (Esci) o eliminando i dati, la collezione sparisce da questo
       dispositivo (funzione svuotaQui): resta solo nell'account
   Leggere, unire e scrivere i dati del browser lo fanno le funzioni di
   script.js leggiTutto() e scriviTutto(), le stesse di Esporta / Importa.

   Le regole di sicurezza (nella console di Firebase, Firestore → Regole)
   permettono a ognuno di leggere e scrivere solo il proprio documento.
   ===================================================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, deleteUser,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-lite.js';

/* Dati del progetto Firebase "Collection-Time" (console di Firebase →
   Impostazioni progetto → Le tue app → Sito C.T.). Sono dati PUBBLICI:
   stanno nel sito apposta, la protezione la fanno le regole di sicurezza.
   (measurementId non c'è apposta: Google Analytics non si usa)
   authDomain = collectiontime.com (e non ...firebaseapp.com): l'accesso con
   Google passa dal NOSTRO dominio, se no Safari su iPhone lo blocca
   ("Unable to process request due to missing initial state").
   Per questo nel sito c'è la cartella __/auth con i file di accesso di Firebase
   (copiati da https://collection-time-dd8fe.firebaseapp.com/__/auth/handler,
   handler.js, experiments.js, iframe, iframe.js) e _config.yml la rende visibile.
   Nella console di Google Cloud (API e servizi → Credenziali → client web)
   sono autorizzati DUE indirizzi: https://collectiontime.com/__/auth/handler
   e https://collectiontime.com/__/auth/handler/ (con la barra finale: GitHub
   aggiunge la barra perché "handler" è una cartella; senza questo indirizzo
   Google risponde "Errore 400: redirect_uri_mismatch"). */
const FIREBASE = {
  apiKey: 'AIzaSyCgch5N04Z8YBprYCyJiMj_cYoXfz32b7c',
  authDomain: 'collectiontime.com',
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
    else if (stato.uid !== utente.uid) {                                     // primo accesso su questo browser
      const haQui = Object.keys(locale).length > 0, haAccount = Object.keys(nube.collezioni || {}).length > 0;
      finale = haQui && haAccount && (await chiedi()) === 'unisci' ? unisci(locale, nube.collezioni)
        : haAccount ? (nube.collezioni || {}) : locale;
      daScrivereQui = true;
    }
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
    aggiornaVista();
    /* se sono arrivate spunte da un altro dispositivo, ridisegno la pagina */
    if (cambiaQui && (typeof CONFIG !== 'undefined' || document.getElementById('raccolta'))) location.reload();
  })().catch(e => { console.warn('Cloud:', e); }).finally(() => { inCorso = null; });
  return inCorso;
}

/* ogni modifica (spunta, doppione, hashtag, Importa) arriva qui da script.js:
   segno "sporco" e mando al cloud dopo SECONDI_CALMA secondi senza altre modifiche.
   Più secondi = meno salvataggi (il piano gratuito di Firebase ne permette 20.000 al giorno):
   chi spunta 50 penne di fila fa UN salvataggio invece di tanti. Non si perde niente:
   chiudendo o nascondendo la pagina salvo subito (vedi sotto).
   ! MODIFICA: SECONDI_CALMA (prima erano 4) */
const SECONDI_CALMA = 20;
window.addEventListener('ct-modifica', () => {
  const s = leggiStato();
  if (!auth.currentUser) return;
  scriviStato(Object.assign(s, { sporco: true }));
  clearTimeout(timer);
  timer = setTimeout(sincronizza, SECONDI_CALMA * 1000);
});
/* chiudendo o nascondendo la pagina mando subito quello che manca */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && leggiStato().sporco) { clearTimeout(timer); sincronizza(); }
});

/* ---------- accesso ---------- */
onAuthStateChanged(auth, utente => {
  segnaAccesso(!!utente);                                     // funzione di script.js: ricorda l'accesso e cambia il pulsante
  aggiornaPulsante(utente);
  aggiornaVista();
  if (utente) {
    let fatta = false;
    try { fatta = sessionStorage.getItem('ct-cloud-visita') === utente.uid; sessionStorage.setItem('ct-cloud-visita', utente.uid); } catch (e) {}
    if (!fatta || leggiStato().sporco) sincronizza();
  }
});

/* Accedi con Google: di solito in una finestrella (popup).
   Dal sito aperto con l'icona sulla schermata Home (come un'app) le finestrelle
   non funzionano bene: lì si va sulla pagina di Google e poi si torna qui. */
const comeApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
getRedirectResult(auth).then(r => { if (r) avviso('Accesso fatto: la tua collezione si salva anche nel cloud.'); }).catch(e => console.warn(e));
async function accedi() {
  try {
    if (comeApp()) return await signInWithRedirect(auth, new GoogleAuthProvider());
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
  'auth/email-already-in-use': 'Esiste già un account con questa email: premi "Accedi" (se l\'hai creato con Google, usa "Accedi con Google").',
  'auth/invalid-credential': 'Email o password sbagliate. Se non hai ancora un account premi "Crea account"; se ti sei iscritto con Google usa "Accedi con Google".',
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

/* toglie da QUESTO dispositivo spunte, doppioni e hashtag di tutte le collezioni
   (usando le funzioni di script.js); poi ridisegna la pagina */
async function svuotaQui() {
  for (const n of await archivi()) {
    const a = await apriArchivio(n);
    const righe = await leggi(a);
    await scrivi(a, righe.map(r => Object.assign(r, { owned: false, doppi: 0, tags: [], tagsTouched: false })));
    a.close();
  }
  try { localStorage.removeItem('ct-cloud'); sessionStorage.removeItem('ct-cloud-visita'); } catch (e) {}
  setTimeout(() => location.reload(), 1500);
}
async function esci() {
  await sincronizza();                                         // prima mando le ultime modifiche
  await signOut(auth);
  await svuotaQui();
  avviso('Sei uscito: la collezione è al sicuro nel tuo account e non è più su questo dispositivo.');
}
/* primo accesso su un dispositivo che ha già delle spunte: cosa farne?
   Risponde 'unisci' o 'account' (anche chiudendo la finestra: è la scelta più sicura) */
function chiedi() {
  return new Promise(risposta => {
    const d = document.createElement('dialog');
    d.className = 'st-guida st-account';
    d.innerHTML = '<h2>Spunte già presenti</h2>'
      + '<p>Su questo dispositivo ci sono già delle spunte che non sono nel tuo account.</p>'
      + '<p><small>Se sono prove o non sono tue, usa solo quelle del tuo account.</small></p>'
      + '<div class="st-account-azioni"><button type="button" value="unisci" class="st-secondario">Aggiungile al mio account</button><button type="button" value="account">Usa solo quelle del mio account</button></div>';
    d.addEventListener('click', e => { const b = e.target.closest('button'); if (b) d.close(b.value); });
    d.addEventListener('close', () => { risposta(d.returnValue === 'unisci' ? 'unisci' : 'account'); d.remove(); });
    document.body.append(d);
    d.showModal();
  });
}
async function eliminaDati() {
  const utente = auth.currentUser;
  if (!utente) return;
  await deleteDoc(documento(utente.uid));
  try { await deleteUser(utente); avviso('Account e collezione eliminati.'); }
  catch (e) {
    await signOut(auth);
    avviso('Collezione eliminata. Per eliminare anche l\'account, accedi di nuovo e ripeti subito.');
  }
  await svuotaQui();
}

/* ---------- pulsante nella banda in alto, finestra "Accedi", menu del profilo e Impostazioni ----------
   Il pulsante (id stAccedi) è in header.html:
     • senza accesso dice "Accedi" e apre la FINESTRA di accesso (Google o email)
     • dopo l'accesso diventa un cerchietto con l'iniziale e apre il MENU DEL PROFILO
       (nome, email, numeri della collezione, Impostazioni, copia di sicurezza, esci), come nelle app.
   Cambia nome, cambia password ed Elimina account sono nella pagina Impostazioni
   (impostazioni.html, parte "Account e dati"), che si riempie qui sotto.
   "Copia di sicurezza" (Scarica / Carica un file) sono i vecchi Esporta / Importa:
   i pulsanti hanno data-backup="esporta" / "importa" e li fa funzionare script.js.
   Aspetto: sito.css, voci "finestra Account" e "menu del profilo". */
const nomeDi = u => u.displayName || (u.email || 'Profilo').split('@')[0];
const conPassword = u => u.providerData.some(p => p.providerId === 'password');
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COPIA = '<p class="st-ma-sezione">Copia di sicurezza</p>'
  + '<button type="button" data-backup="esporta" class="st-link">Scarica un file</button>'
  + '<button type="button" data-backup="importa" class="st-link">Carica un file</button>';
const PORTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l5-5-5-5"/><path d="M15 12H4"/></svg>';   // icona di "Esci"

function aggiornaPulsante(utente) {
  const b = document.getElementById('stAccedi');
  if (!b) return;
  if (utente) {
    b.innerHTML = '<span class="st-avatar" aria-hidden="true">' + esc(nomeDi(utente).charAt(0).toUpperCase()) + '</span>';
    b.setAttribute('aria-label', 'Il mio profilo: ' + nomeDi(utente));
    b.title = nomeDi(utente);
  } else {
    b.textContent = 'Accedi';
    b.removeAttribute('aria-label');
    b.title = 'Accedi e salva la collezione nel cloud';
  }
}
/* chiamata quando cambia qualcosa (accesso, uscita, salvataggio): aggiorna ciò che è aperto */
function aggiornaVista() {
  if (auth.currentUser && finestra && finestra.open) finestra.close();   // accesso appena fatto: chiudo la finestra
  if (menu && !menu.hidden) disegnaMenu();
  disegnaImpostazioni();
}
/* "Salvata nel cloud · 28 settembre, 10:40" (menu del profilo e Impostazioni) */
function notaCloud() {
  const s = leggiStato();
  const quando = s.ultimo ? new Date(s.ultimo).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  return s.sporco ? 'Salvataggio nel cloud in corso…' : quando ? 'Salvata nel cloud · ' + quando : 'Salvata nel cloud';
}
/* le azioni sull'account, usate dal menu del profilo e dalla pagina Impostazioni */
async function azioneAccount(m) {
  if (m === 'esci') esci();
  else if (m === 'elimina') confermaElimina();
  else if (m === 'password') {                                 // il modo più sicuro: un'email per sceglierne una nuova
    try { await sendPasswordResetEmail(auth, auth.currentUser.email); avviso('Ti ho mandato un\'email per scegliere la nuova password (guarda anche nello spam).'); }
    catch (err) { avviso(messaggioErrore(err)); }
  }
}

/* ===== FINESTRA "Accedi" (solo per chi non ha fatto l'accesso) ===== */
let finestra = null, nuovo = false;   // nuovo = modulo "Crea account" invece di "Accedi"
function disegnaFinestra() {
  finestra.querySelector('.st-account-testo').innerHTML =
    '<p>Accedi per <b>salvare la collezione nel cloud</b> e ritrovarla sul telefono, sul computer e su un nuovo dispositivo.</p>'
    + '<button type="button" data-azione="accedi" class="st-google">Accedi con Google</button>'
    + '<p class="st-oppure">oppure con la tua email</p>'
    /* un modo alla volta ("entra" o "nuovo"), così il Portachiavi / gestore password
       capisce se compilare una password salvata o proporne e salvarne una nuova */
    + (nuovo
      ? '<form class="st-email" data-modo="nuovo" novalidate>'
        +   '<input type="email" name="email" placeholder="Email" autocomplete="username" required>'
        +   '<input type="password" name="password" placeholder="Nuova password (min. 6 caratteri)" autocomplete="new-password" minlength="6" required>'
        +   '<p class="st-account-errore" role="alert" hidden></p>'
        +   '<div class="st-email-azioni"><button type="submit">Crea account</button></div>'
        +   '<button type="button" data-azione="cambia-modo" class="st-link">Hai già un account? Accedi</button>'
        + '</form>'
      : '<form class="st-email" data-modo="entra" novalidate>'
        +   '<input type="email" name="email" placeholder="Email" autocomplete="username" required>'
        +   '<input type="password" name="password" placeholder="Password" autocomplete="current-password" required>'
        +   '<p class="st-account-errore" role="alert" hidden></p>'
        +   '<div class="st-email-azioni"><button type="submit">Accedi</button></div>'
        +   '<button type="button" data-azione="dimenticata" class="st-link">Password dimenticata?</button>'
        +   '<button type="button" data-azione="cambia-modo" class="st-link">Non hai un account? Crea account</button>'
        + '</form>')
    + '<p><small>Salviamo solo il tuo nome, la tua email e quello che segni sul sito (spunte, doppioni, hashtag). Dettagli nella pagina Privacy.</small></p>'
    + '<div class="st-account-copia"><small>Non vuoi un account?</small> ' + COPIA + '</div>';
}
function apriFinestra() {
  if (!finestra) {
    finestra = document.createElement('dialog');
    finestra.className = 'st-guida st-account';
    finestra.setAttribute('aria-labelledby', 'stAccountTitolo');
    finestra.innerHTML = '<h2 id="stAccountTitolo">La tua collezione nel cloud</h2><div class="st-account-testo"></div>'
      + '<div class="st-account-azioni"><button type="button" data-azione="chiudi" class="st-secondario">Chiudi</button></div>';
    finestra.addEventListener('click', e => {
      const b = e.target.closest('button[data-azione], button[data-backup]');
      if (!b) {                                                // clic fuori dalla finestra: chiude
        const r = finestra.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) finestra.close();
        return;
      }
      if (b.dataset.backup) return finestra.close();           // Scarica / Carica un file: li gestisce script.js
      const azione = b.dataset.azione;
      if (azione === 'accedi') { finestra.close(); accedi(); }  // il clic apre subito la finestra di Google (se no il browser la blocca)
      else if (azione === 'cambia-modo') {                     // Accedi ⇄ Crea account (l'email scritta resta)
        const email = finestra.querySelector('.st-email [name=email]').value;
        nuovo = !nuovo; disegnaFinestra();
        finestra.querySelector('.st-email [name=email]').value = email;
      }
      else if (azione === 'dimenticata') passwordDimenticata(finestra.querySelector('.st-email [name=email]').value.trim());
      else finestra.close();
    });
    /* modulo email: "Accedi" o "Crea account" (anche premendo Invio) */
    finestra.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      conEmail(f.dataset.modo, f.email.value.trim(), f.password.value);
    });
    finestra.addEventListener('close', () => { nuovo = false; });
    document.body.append(finestra);
  }
  disegnaFinestra();
  finestra.showModal();
}

/* ===== MENU DEL PROFILO (dopo l'accesso) =====
   Corto apposta: le altre voci dell'account sono nella pagina Impostazioni. */
let menu = null, numeri = null;
async function contaNumeri() {
  const tutte = await leggiTutto();
  const v = Object.values(tutte);
  numeri = {
    ce: v.reduce((t, c) => t + (c.possedute || []).length, 0),
    doppi: v.reduce((t, c) => t + Object.values(c.doppi || {}).reduce((a, n) => a + n, 0), 0),
    collezioni: v.filter(c => (c.possedute || []).length).length
  };
  if (menu && !menu.hidden) disegnaMenu();
}
function disegnaMenu() {
  const u = auth.currentUser;
  if (!u) return chiudiMenu();
  const n = numeri || { ce: '…', doppi: '…', collezioni: '…' };
  menu.innerHTML =
    '<div class="st-ma-testa"><span class="st-avatar grande" aria-hidden="true">' + esc(nomeDi(u).charAt(0).toUpperCase()) + '</span>'
    + '<div><b>' + esc(nomeDi(u)) + '</b><small>' + esc(u.email || '') + '</small></div></div>'
    /* i numeri sono un link alle statistiche (pagina Impostazioni) */
    + '<a class="st-ma-stat" href="' + new URL('impostazioni.html#statistiche', BASE).href + '">'
    +   '<span class="st-ma-numeri"><span><b>' + n.ce + '</b><small>Ce l\'ho</small></span><span><b>' + n.doppi + '</b><small>Doppioni</small></span><span><b>' + n.collezioni + '</b><small>Collezioni</small></span></span>'
    +   '<small>Le mie statistiche ›</small></a>'
    + '<p class="st-ma-nota">' + notaCloud() + '</p>'
    /* "Impostazioni": pagina impostazioni.html nella cartella principale (BASE è di script.js) */
    + '<a class="st-link st-ma-imp" href="' + new URL('impostazioni.html', BASE).href + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>Impostazioni</a>'
    + COPIA
    /* "Esci": pulsante rosso pieno, largo quanto il menu, con l'icona della porta */
    + '<div class="st-ma-fondo"><button type="button" data-m="esci" class="st-esci">' + PORTA + 'Esci</button></div>';
}
function apriMenu() {
  if (!menu) {
    menu = document.createElement('div');
    menu.className = 'st-profilo';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'Il mio profilo');
    menu.hidden = true;
    menu.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      chiudiMenu();                                            // Scarica / Carica un file li gestisce script.js
      if (b.dataset.m) azioneAccount(b.dataset.m);
    });
    /* clic fuori dal menu o tasto Esc: si chiude */
    document.addEventListener('click', e => { if (!menu.hidden && !e.composedPath().includes(menu) && !e.target.closest('#stAccedi')) chiudiMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) chiudiMenu(); });
    document.body.append(menu);
  }
  const barra = document.querySelector('.st-top');
  menu.style.top = (barra ? barra.getBoundingClientRect().bottom + 6 : 70) + 'px';   // subito sotto la banda in alto
  menu.hidden = false;
  disegnaMenu();
  contaNumeri();
}
function chiudiMenu() { if (menu) menu.hidden = true; }

/* ===== IMPOSTAZIONI: Account e dati (solo nella pagina impostazioni.html) =====
   Dopo l'accesso sostituisce il testo per chi non ha l'account (scritto in impostazioni.html) con:
   nome e email, Cambia nome, Cambia password (solo account con email), copia di sicurezza,
   Esci ed "Elimina account…" (piccolo e lontano da Esci, con una finestra di conferma).
   cambioNome = true mentre si scrive il nuovo nome. Aspetto: sito.css, voce "pagina Impostazioni". */
let cambioNome = false;
function disegnaImpostazioni() {
  const box = document.getElementById('stImpAccount'), u = auth.currentUser;
  if (!box || !u) return;
  if (!box.dataset.pronto) {                                   // una volta sola: clic e modulo del nome
    box.dataset.pronto = '1';
    box.addEventListener('click', e => {
      const m = (e.target.closest('button[data-m]') || {}).dataset?.m;
      if (m === 'nome' || m === 'annulla') { cambioNome = m === 'nome'; disegnaImpostazioni(); }
      else if (m) azioneAccount(m);
    });
    box.addEventListener('submit', async e => {                // salva il nuovo nome
      e.preventDefault();
      const nome = e.target.nome.value.trim().slice(0, 40);
      if (!nome) return;
      try { await updateProfile(auth.currentUser, { displayName: nome }); aggiornaPulsante(auth.currentUser); avviso('Nome cambiato.'); }
      catch (err) { avviso('Non sono riuscito a cambiare il nome. Riprova.'); }
      cambioNome = false; disegnaImpostazioni();
    });
  }
  box.innerHTML =
    '<div class="st-ma-testa"><span class="st-avatar grande" aria-hidden="true">' + esc(nomeDi(u).charAt(0).toUpperCase()) + '</span>'
    + '<div><b>' + esc(nomeDi(u)) + '</b><small>' + esc(u.email || '') + '</small></div></div>'
    + '<p class="st-imp-nota">' + notaCloud() + '</p>'
    + (cambioNome
      ? '<form class="st-imp-nome"><input name="nome" maxlength="40" value="' + esc(u.displayName || '') + '" placeholder="Il tuo nome" autocomplete="nickname" required>'
        + '<button type="button" data-m="annulla" class="st-link">Annulla</button><button type="submit" class="st-btn">Salva</button></form>'
      : '<p class="st-imp-voce"><b>Nome</b><span><button type="button" data-m="nome" class="st-link">Cambia nome</button></span></p>')
    + '<p class="st-imp-voce"><b>Accesso</b><span>' + (conPassword(u) ? '<button type="button" data-m="password" class="st-link">Cambia password</button>' : 'con Google') + '</span></p>'
    + '<p class="st-imp-voce"><b>Copia di sicurezza</b><span><button type="button" data-backup="esporta" class="st-link">Scarica un file</button> <button type="button" data-backup="importa" class="st-link">Carica un file</button></span></p>'
    + '<p><button type="button" data-m="esci" class="st-esci">' + PORTA + 'Esci</button></p>'
    + '<p class="st-imp-elimina"><button type="button" data-m="elimina" class="st-link">Elimina account…</button></p>';
  if (cambioNome) { const i = box.querySelector('input'); i.focus(); i.select(); }
}

/* finestra di conferma per eliminare l'account: "Annulla" è il pulsante evidenziato */
function confermaElimina() {
  const d = document.createElement('dialog');
  d.className = 'st-guida st-account';
  d.innerHTML = '<h2>Eliminare l\'account?</h2>'
    + '<p>Vengono cancellati <b>per sempre</b> il tuo account e la collezione salvata nel cloud: spunte, doppioni e hashtag di tutte le collezioni. Non si può tornare indietro.</p>'
    + '<p><small>Se vuoi solo uscire da questo dispositivo, usa <b>Esci</b>: la collezione resta nel tuo account.</small></p>'
    + '<div class="st-account-azioni st-elimina-azioni"><button type="button" value="si" class="st-secondario st-rosso">Elimina per sempre</button><button type="button" value="no" autofocus>Annulla</button></div>';
  d.addEventListener('click', e => { const b = e.target.closest('button'); if (b) d.close(b.value); });
  d.addEventListener('close', () => { if (d.returnValue === 'si') eliminaDati(); d.remove(); });
  document.body.append(d);
  d.showModal();
}

/* il pulsante in alto (script.js chiama questa funzione) */
export function apriAccount() {
  if (!auth.currentUser) return apriFinestra();
  if (menu && !menu.hidden) chiudiMenu(); else apriMenu();
}
