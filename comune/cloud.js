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
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
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
auth.languageCode = LINGUA;                                  // email di Firebase (conferma email, reimposta password) nella lingua del sito: 'it' o 'en' (LINGUA è di script.js)
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

/* ---------- paese dell'utente (nel documento del cloud) ----------
   Il documento ha anche  paese: "IT"  (e paeseAuto: true se l'ha indovinato il sito e non l'ha scelto lui).
   Serve alle statistiche dell'area amministratore (mappa degli iscritti) e a far seguire lo stesso paese
   su ogni dispositivo. Si scrive al PROSSIMO salvataggio:
     • se l'utente l'ha scelto in Impostazioni (paeseScelto) → si salva quello;
     • se non l'ha scelto e il cloud ha già un paese scelto da lui → lo adotto anche su questo dispositivo;
     • se non c'è niente → si salva quello indovinato (paeseRilevato), con paeseAuto.
   Restituisce i campi da scrivere, oppure null se il cloud è già a posto. paeseScelto e paeseRilevato sono in script.js. */
function paesePerCloud(nube) {
  const scelto = paeseScelto();
  if (scelto) return nube && nube.paese === scelto && !nube.paeseAuto ? null : { paese: scelto };
  if (nube && nube.paese && !nube.paeseAuto) { try { localStorage.setItem('ct-paese', nube.paese); } catch (e) {} return null; }
  return nube && nube.paese ? null : { paese: paeseRilevato(), paeseAuto: true };
}

/* ---------- sincronizzazione ---------- */
let inCorso = null, timer = null;
/* daConfermare = account NUOVO con email e password che non ha ancora confermato l'email: finché non lo fa, la collezione NON va nel cloud
   (resta sul dispositivo). Chi si è iscritto prima (ha già il suo documento nel cloud) e chi entra con Google non è toccato. */
let daConfermare = false, avvisatoConferma = false;
function sincronizza() {
  if (inCorso) return inCorso.then(() => sincronizza());
  inCorso = (async () => {
    const utente = auth.currentUser;
    if (!utente) return;
    const stato = leggiStato();
    const nube = (await getDoc(documento(utente.uid))).data();
    daConfermare = !nube && conPassword(utente) && !utente.emailVerified;
    if (daConfermare) {
      aggiornaVista();
      /* chi entra (anche da un altro dispositivo) con un account non ancora confermato: gli dico perché non vede la sua collezione */
      if (!avvisatoConferma) { avvisatoConferma = true; avviso('Il tuo account non ha ancora la conferma dell\'email: apri il link che ti abbiamo mandato (o rimandalo dal menu del profilo) e la collezione si salverà nel cloud.'); }
      return;
    }
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
    const paese = paesePerCloud(nube);                                       // null = il paese nel cloud è già giusto
    const paeseDoc = paese || (nube && nube.paese ? Object.assign({ paese: nube.paese }, nube.paeseAuto ? { paeseAuto: true } : {}) : {});
    const cambiaCollezioni = !nube || impronta(finale) !== impronta(nube.collezioni);
    if (cambiaCollezioni || paese) {
      if (cambiaCollezioni) aggiornato = Date.now();                         // se cambia solo il paese, "aggiornato" resta com'è (gli altri dispositivi non riscaricano niente)
      /* Le regole di Firestore ammettono SOLO i campi elencati in hasOnly([...]) (console di Firebase → Firestore → Regole).
         Se "paese" e "paeseAuto" non ci sono ancora, Google rifiuta il salvataggio: in quel caso riprovo SENZA il paese,
         così la collezione si salva comunque. Per salvare anche il paese aggiungi 'paese' e 'paeseAuto' a quella lista. */
      /* "accettato" (Privacy accettata all'iscrizione) si scrive solo nel PRIMO documento. Se le regole di Firestore non lo ammettono
         (hasOnly), riprovo senza di lui, poi anche senza paese: la collezione si salva comunque. */
      let accettato = null;
      if (!nube) { try { accettato = JSON.parse(localStorage.getItem('ct-accettato')); } catch (e) {} }
      const base = { versione: 1, aggiornato, collezioni: finale };
      try { await setDoc(documento(utente.uid), Object.assign({}, base, paeseDoc, accettato ? { accettato } : {})); }
      catch (e) {
        try { await setDoc(documento(utente.uid), Object.assign({}, base, paeseDoc)); }
        catch (e2) {
          if (!paeseDoc.paese) throw e2;
          await setDoc(documento(utente.uid), base);
        }
      }
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
  if (daConfermare && !avvisatoConferma) { avvisatoConferma = true; avviso('Per salvare nel cloud conferma la tua email (menu del profilo).'); }
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
  'auth/email-already-in-use': 'Esiste già un account con questa email: premi "Accedi" (se l\'hai creato con Google, usa "Continua con Google").',
  'auth/invalid-credential': 'Email o password sbagliate. Se non hai ancora un account premi "Crea account"; se ti sei iscritto con Google usa "Continua con Google".',
  'auth/user-not-found': 'Non c\'è nessun account con questa email: premi "Crea account".',
  'auth/wrong-password': 'Password sbagliata.',
  'auth/too-many-requests': 'Troppi tentativi: aspetta qualche minuto e riprova.',
  'auth/network-request-failed': 'Connessione assente: riprova quando sei online.',
  'auth/operation-not-allowed': 'L\'accesso con email non è ancora attivo. Riprova più tardi.',
  'auth/configuration-not-found': 'L\'accesso non è ancora attivo. Riprova più tardi.'
};
const messaggioErrore = e => ERRORI[e.code] || 'Qualcosa non ha funzionato. Riprova tra poco.';
/* ---------- controllo dell'email prima di creare l'account ----------
   1) errori di battitura comuni nel dominio (gnail.com, gmial.com…): metto io quello giusto e chiedo di riprovare;
   2) email "usa e getta" (mailinator, 10minutemail…) e indirizzi di prova (example.com): non accettate.
   Non è una protezione assoluta (si aggira): la vera conferma è l'email di verifica qui sotto.
   ! MODIFICA: per bloccare un altro servizio usa e getta aggiungi il suo dominio a USA_E_GETTA; per un altro errore comune aggiungilo a REFUSI. */
const USA_E_GETTA = new Set(('mailinator.com guerrillamail.com guerrillamail.net guerrillamail.org guerrillamail.biz guerrillamail.de sharklasers.com grr.la 10minutemail.com 10minutemail.net '
  + '10minemail.com temp-mail.org temp-mail.io tempmail.com tempmail.net tempmailo.com tempail.com throwawaymail.com yopmail.com yopmail.fr yopmail.net getnada.com nada.email dispostable.com '
  + 'trashmail.com trashmail.net trashmail.de mailnesia.com maildrop.cc mohmal.com fakeinbox.com fakemail.net mintemail.com mytemp.email emailondeck.com spamgourmet.com moakt.com mailcatch.com '
  + 'tmpmail.org tmpmail.net tmail.ws burnermail.io discard.email discardmail.com spambox.us spam4.me harakirimail.com inboxkitten.com mailforspam.com jetable.org emailfake.com fake-mail.net '
  + 'generator.email email-fake.com gmailnator.com tempinbox.com owlymail.com 1secmail.com 1secmail.org 1secmail.net kzccv.com qiott.com wuuvo.com icznn.com vjuum.com laafd.com txcct.com '
  + 'rteet.com cevipsa.com example.com example.org example.net').split(' '));
const REFUSI = { 'gnail.com': 'gmail.com', 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.it': 'gmail.com', 'hotmal.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'hotmail.co': 'hotmail.com', 'hotmail.cm': 'hotmail.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com',
  'iclod.com': 'icloud.com', 'icloud.con': 'icloud.com', 'libero.i': 'libero.it', 'virgilio.i': 'virgilio.it', 'tiscali.i': 'tiscali.it' };
function controllaEmail(email) {
  const m = /^[^\s@]+@([^\s@]+\.[^\s@.]{2,})$/.exec(email);
  if (!m) return { errore: 'Controlla l\'email: sembra incompleta.' };
  const dominio = m[1].toLowerCase();
  if (REFUSI[dominio]) return { corretta: email.slice(0, email.lastIndexOf('@') + 1) + REFUSI[dominio], da: dominio, a: REFUSI[dominio] };
  if ([...USA_E_GETTA].some(d => dominio === d || dominio.endsWith('.' + d))) return { errore: 'Questo indirizzo email non è accettato: usa la tua email vera.' };
  return {};
}
async function conEmail(modo, email, password, nick, paese) {
  if (modo === 'nuovo') {
    const c = controllaEmail(email);
    if (c.errore) return mostraErrore(c.errore);
    if (c.corretta) {                                          // errore di battitura: correggo il campo e aspetto che la persona riprovi
      const campo = finestra && finestra.querySelector('form[data-modo="nuovo"] [name=email]');
      if (campo) campo.value = c.corretta;
      return mostraErrore('Ho corretto «' + c.da + '» in «' + c.a + '»: controlla e premi di nuovo "Crea account".');
    }
  }
  let paesePrima = null, paeseCambiato = false;
  try {
    if (modo === 'nuovo') {
      /* il paese scelto nel modulo si salva PRIMA di creare l'account: al primo salvataggio nel cloud (comune/cloud.js, paesePerCloud)
         viene scritto come "scelto da lui". Se l'iscrizione non riesce (es. email già usata) torna com'era. */
      if (PAESI.includes(paese)) { try { paesePrima = localStorage.getItem('ct-paese'); localStorage.setItem('ct-paese', paese); paeseCambiato = true; } catch (e) {} }
      await createUserWithEmailAndPassword(auth, email, password);
      /* ricordo che ha accettato la Privacy (versione 1): finisce nel documento al primo salvataggio nel cloud */
      try { localStorage.setItem('ct-accettato', JSON.stringify({ versione: 1, data: Date.now() })); } catch (e) {}
      /* nickname scelto al momento dell'iscrizione (facoltativo): diventa il nome mostrato nel profilo; se è vuoto resta quello di prima */
      if (nick) { try { await updateProfile(auth.currentUser, { displayName: Array.from(nick).slice(0, 40).join('') }); aggiornaPulsante(auth.currentUser); } catch (e) {} }
    }
    else await signInWithEmailAndPassword(auth, email, password);
    finestra.close();
    if (modo === 'nuovo') {
      /* conferma dell'email: arriva un'email con un link; finché non lo apre la collezione resta sul dispositivo (vedi daConfermare) */
      let inviata = true;
      try { await sendEmailVerification(auth.currentUser); } catch (e) { inviata = false; }
      avvisatoConferma = true;
      avviso(inviata ? 'Account creato. Ti ho mandato un\'email: apri il link per confermarla e salvare la collezione nel cloud (guarda anche nello spam).'
                     : 'Account creato. Apri il menu del profilo per confermare l\'email e salvare la collezione nel cloud.');
    } else avviso('Accesso fatto: la tua collezione si salva anche nel cloud.');
  } catch (e) {
    if (paeseCambiato) { try { paesePrima === null ? localStorage.removeItem('ct-paese') : localStorage.setItem('ct-paese', paesePrima); } catch (x) {} }
    mostraErrore(messaggioErrore(e));
  }
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
  const nonNelCloud = daConfermare;                            // email non confermata: la collezione NON è nel cloud, quindi non si toglie da questo dispositivo
  await signOut(auth);
  if (nonNelCloud) {
    try { localStorage.removeItem('ct-cloud'); sessionStorage.removeItem('ct-cloud-visita'); } catch (e) {}
    daConfermare = false; aggiornaVista();
    avviso('Sei uscito. La collezione è rimasta su questo dispositivo perché l\'email non era ancora confermata.');
    return;
  }
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
    b.innerHTML = '<span class="st-avatar" aria-hidden="true">' + esc(Array.from(nomeDi(utente))[0].toUpperCase()) + '</span>';
    b.setAttribute('aria-label', 'Il mio profilo: ' + nomeDi(utente));
    b.title = nomeDi(utente);
    b.classList.toggle('st-da-confermare', daConfermare);        // puntino ambra: email da confermare
  } else {
    b.classList.remove('st-da-confermare');
    b.textContent = 'Accedi';
    b.removeAttribute('aria-label');
    b.title = 'Accedi e salva la collezione nel cloud';
  }
}
/* chiamata quando cambia qualcosa (accesso, uscita, salvataggio): aggiorna ciò che è aperto */
function aggiornaVista() {
  if (auth.currentUser && finestra && finestra.open) finestra.close();   // accesso appena fatto: chiudo la finestra
  aggiornaPulsante(auth.currentUser);
  if (menu && !menu.hidden) disegnaMenu();
  disegnaImpostazioni();
}
/* "Salvata nel cloud · 28 settembre, 10:40" (menu del profilo e Impostazioni) */
function notaCloud() {
  const s = leggiStato();
  const quando = s.ultimo ? new Date(s.ultimo).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  if (daConfermare) return 'Conferma la tua email per salvare nel cloud';
  return s.sporco ? 'Salvataggio nel cloud in corso…' : quando ? 'Salvata nel cloud · ' + quando : 'Salvata nel cloud';
}
/* i due pulsanti sotto la nota "Conferma la tua email…" (menu del profilo e Impostazioni); vuoto se non serve */
const pulsantiConferma = () => daConfermare
  ? '<p class="st-ma-nota"><button type="button" data-m="conferma-invia" class="st-link">Invia di nuovo l\'email</button> · <button type="button" data-m="conferma-fatto" class="st-link">Ho confermato</button></p>' : '';
async function inviaConferma() {
  try { await sendEmailVerification(auth.currentUser); avviso('Email inviata di nuovo (guarda anche nello spam).'); }
  catch (e) { avviso('Non riesco a inviare l\'email adesso: riprova tra qualche minuto.'); }
}
/* controlla se la persona ha aperto il link: ricarico l'utente da Firebase; se ha confermato, parte il primo salvataggio nel cloud */
async function controllaConferma(avvisa) {
  const u = auth.currentUser;
  if (!u || !daConfermare) return;
  try {
    await u.reload();
    if (u.emailVerified) { await u.getIdToken(true); avviso('Email confermata: la tua collezione ora si salva nel cloud.'); await sincronizza(); }
    else if (avvisa) avviso('Non vedo ancora la conferma: apri il link nell\'email e riprova.');
  } catch (e) { if (avvisa) avviso('Non riesco a controllare adesso: riprova tra poco.'); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') controllaConferma(false); });   // tornando sulla pagina dopo aver aperto il link
/* le azioni sull'account, usate dal menu del profilo e dalla pagina Impostazioni */
async function azioneAccount(m) {
  if (m === 'conferma-invia') inviaConferma();
  else if (m === 'conferma-fatto') controllaConferma(true);
  else if (m === 'esci') esci();
  else if (m === 'elimina') confermaElimina();
  else if (m === 'password') {                                 // il modo più sicuro: un'email per sceglierne una nuova
    try { await sendPasswordResetEmail(auth, auth.currentUser.email); avviso('Ti ho mandato un\'email per scegliere la nuova password (guarda anche nello spam).'); }
    catch (err) { avviso(messaggioErrore(err)); }
  }
}

/* ===== FINESTRA "Accedi" (solo per chi non ha fatto l'accesso) ===== */
/* le voci del menu "Il tuo paese" del modulo "Crea account": tutti i paesi (nella lingua del sito), con già scelto quello indovinato o scelto in precedenza */
function opzioniPaese() {
  let nomi = null;
  try { nomi = new Intl.DisplayNames([LINGUA], { type: 'region' }); } catch (e) {}
  const mio = paeseVisitatore();
  /* se il sito non capisce dove sei (paeseIncerto) non preseleziono l'Italia: voce vuota "Scegli il tuo paese", e se la lasci così il paese non si salva come scelto */
  const vuota = paeseIncerto() && !paeseScelto() ? '<option value="" selected>Scegli il tuo paese</option>' : '';
  return vuota + nomiPaesi().map(([c, n]) => [c, nomi ? nomi.of(c) : n]).sort((a, b) => a[1].localeCompare(b[1], LINGUA))
    .map(([c, n]) => '<option value="' + c + '"' + (!vuota && c === mio ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
}
let finestra = null, nuovo = true;    // nuovo = vista "Crea account" (di partenza); false = vista "Accedi"
let emailAperta = false;              // nella vista "Crea account": false = solo Google grande + link "registrati con l'email"; true = anche il modulo email
function disegnaFinestra() {
  finestra.querySelector('.st-account-testo').innerHTML =
    '<p>Accedi per <b>salvare la collezione nel cloud</b> e ritrovarla sul telefono, sul computer e su un nuovo dispositivo.</p>'
    + '<button type="button" data-azione="accedi" class="st-google st-google-grande">Continua con Google</button>'
    + '<p class="st-google-nota"><small>Il modo più rapido: senza password e senza email da confermare.</small></p>'
    + (nuovo && !emailAperta ? '<p class="st-privacy-riga"><small>Iscrivendoti accetti la </small><a href="' + new URL('privacy.html', BASE).href + '" target="_blank" rel="noopener"><small>Privacy</small></a><small>.</small></p>' : '')
    + (nuovo && !emailAperta ? '' : '<p class="st-oppure">oppure con la tua email</p>')
    /* un modo alla volta ("entra" o "nuovo"), così il Portachiavi / gestore password
       capisce se compilare una password salvata o proporne e salvarne una nuova */
    + (nuovo && !emailAperta
      ? '<button type="button" data-azione="apri-email" class="st-link st-apri-email">Oppure registrati con l\'email →</button>'
        + '<button type="button" data-azione="cambia-modo" class="st-link">Hai già un account? Accedi</button>'
      : nuovo
      ? '<form class="st-email" data-modo="nuovo" novalidate>'
        +   '<input type="email" name="email" placeholder="Email" autocomplete="username" required>'
        +   '<input type="password" name="password" placeholder="Nuova password (min. 6 caratteri)" autocomplete="new-password" minlength="6" required>'
        +   '<input type="text" name="nome" maxlength="40" placeholder="Nickname (facoltativo)" autocomplete="nickname">'
        +   '<label class="st-campo-paese"><small>Il tuo paese</small><select name="paese" autocomplete="off">' + opzioniPaese() + '</select></label>'
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
    /* iscrivendosi si accetta la Privacy: nella vista iniziale sta subito sotto Google, nel modulo email sta in fondo */
    + (nuovo && emailAperta ? '<p class="st-privacy-riga"><small>Iscrivendoti accetti la </small><a href="' + new URL('privacy.html', BASE).href + '" target="_blank" rel="noopener"><small>Privacy</small></a><small>.</small></p>' : '')
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
        const campo = finestra.querySelector('.st-email [name=email]'), email = campo ? campo.value : '';
        nuovo = !nuovo; if (nuovo && email) emailAperta = true; disegnaFinestra();
        const nuovoCampo = finestra.querySelector('.st-email [name=email]');
        if (nuovoCampo) nuovoCampo.value = email;
      }
      else if (azione === 'apri-email') {                      // mostro il modulo email della vista "Crea account"
        emailAperta = true; disegnaFinestra();
        finestra.querySelector('.st-email [name=email]').focus();
      }
      else if (azione === 'dimenticata') passwordDimenticata(finestra.querySelector('.st-email [name=email]').value.trim());
      else finestra.close();
    });
    /* modulo email: "Accedi" o "Crea account" (anche premendo Invio) */
    finestra.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      conEmail(f.dataset.modo, f.email.value.trim(), f.password.value, f.nome ? f.nome.value.trim() : '', f.paese ? f.paese.value : '');
    });
    finestra.addEventListener('close', () => { nuovo = true; emailAperta = false; });
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
    '<div class="st-ma-testa"><span class="st-avatar grande" aria-hidden="true">' + esc(Array.from(nomeDi(u))[0].toUpperCase()) + '</span>'
    + '<div><b>' + esc(nomeDi(u)) + '</b><small>' + esc(u.email || '') + '</small></div></div>'
    /* i numeri sono un link alle statistiche (pagina Impostazioni) */
    + '<a class="st-ma-stat" href="' + new URL('impostazioni.html#statistiche', BASE).href + '">'
    +   '<span class="st-ma-numeri"><span><b>' + n.ce + '</b><small>Ce l\'ho</small></span><span><b>' + n.doppi + '</b><small>Doppioni</small></span><span><b>' + n.collezioni + '</b><small>Collezioni</small></span></span>'
    +   '<small>Le mie statistiche ›</small></a>'
    + '<p class="st-ma-nota">' + notaCloud() + '</p>' + pulsantiConferma()
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
    '<div class="st-ma-testa"><span class="st-avatar grande" aria-hidden="true">' + esc(Array.from(nomeDi(u))[0].toUpperCase()) + '</span>'
    + '<div><b>' + esc(nomeDi(u)) + '</b><small>' + esc(u.email || '') + '</small></div></div>'
    + '<p class="st-imp-nota">' + notaCloud() + '</p>' + pulsantiConferma()
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
