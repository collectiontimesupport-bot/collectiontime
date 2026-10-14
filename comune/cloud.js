
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, deleteUser,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-lite.js';

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
auth.languageCode = LINGUA;
const db = getFirestore(app);
const documento = uid => doc(db, 'collezioni', uid);

const leggiStato = () => { try { return JSON.parse(localStorage.getItem('ct-cloud')) || {}; } catch (e) { return {}; } };
const scriviStato = s => { try { localStorage.setItem('ct-cloud', JSON.stringify(s)); } catch (e) {} };

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
function impronta(collezioni) {
  const ordina = v => Array.isArray(v) ? v.map(ordina).sort() : v && typeof v === 'object'
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = ordina(v[k]), o), {}) : v;
  return JSON.stringify(ordina(collezioni || {}));
}

function paesePerCloud(nube) {
  const scelto = paeseScelto();
  if (scelto) return nube && nube.paese === scelto && !nube.paeseAuto ? null : { paese: scelto };
  if (nube && nube.paese && !nube.paeseAuto) { try { localStorage.setItem('ct-paese', nube.paese); } catch (e) {} return null; }
  return nube && nube.paese ? null : { paese: paeseRilevato(), paeseAuto: true };
}

function trofeiPerCloud(nube) {
  const leggi = (k, v) => { try { return JSON.parse(localStorage.getItem(k)) ?? v; } catch (e) { return v; } };
  const dataOk = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const pulisci = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, d]) => /^[a-z0-9]{1,12}$/.test(k) && dataOk(d)).slice(0, 100));
  const nt = pulisci(nube && nube.trofei), loc = pulisci(leggi('ct-trofei', {}));
  const t = Object.assign({}, nt);
  for (const [k, d] of Object.entries(loc)) if (!t[k] || d < t[k]) t[k] = d;
  const nb = nube && nube.badge && Array.isArray(nube.badge.s) ? { s: nube.badge.s.filter(x => typeof x === 'string').slice(0, 3), t: +nube.badge.t || 0 } : null;
  const bl = leggi('ct-badge', []), bt = +localStorage.getItem('ct-badge-t') || 0;
  const mio = bt ? { s: Array.isArray(bl) ? bl.slice(0, 3) : [], t: bt } : null;
  const badge = mio && (!nb || mio.t > nb.t) ? mio : nb;
  try {
    if (JSON.stringify(ordina(t)) !== JSON.stringify(ordina(loc))) localStorage.setItem('ct-trofei', JSON.stringify(t));
    if (badge && badge !== mio) { localStorage.setItem('ct-badge', JSON.stringify(badge.s)); localStorage.setItem('ct-badge-t', String(badge.t)); }
  } catch (e) {}
  const cambia = JSON.stringify(ordina(t)) !== JSON.stringify(ordina(nt)) || JSON.stringify(badge || null) !== JSON.stringify(nb);
  return { extra: Object.assign({}, Object.keys(t).length ? { trofei: t } : {}, badge ? { badge } : {}), cambia };
}
const ordina = v => Array.isArray(v) ? v.map(ordina) : v && typeof v === 'object'
  ? Object.keys(v).sort().reduce((o, k) => (o[k] = ordina(v[k]), o), {}) : v;

let inCorso = null, timer = null;
const ORE_RICONTROLLO = 12;
const controlloVecchio = () => { try { return Date.now() - (+sessionStorage.getItem('ct-cloud-controllo') || 0) > ORE_RICONTROLLO * 3600000; } catch (e) { return false; } };
let daConfermare = false, avvisatoConferma = false;
function sincronizza() {
  if (inCorso) return inCorso.then(() => sincronizza());
  inCorso = (async () => {
    const utente = auth.currentUser;
    if (!utente) return;
    try { sessionStorage.setItem('ct-cloud-controllo', Date.now()); } catch (e) {}
    const stato = leggiStato();
    const nube = (await getDoc(documento(utente.uid))).data();
    daConfermare = !nube && conPassword(utente) && !utente.emailVerified;
    if (daConfermare) {
      aggiornaVista();
      if (!avvisatoConferma) { avvisatoConferma = true; avviso('Il tuo account non ha ancora la conferma dell\'email: apri il link che ti abbiamo mandato (o rimandalo dal menu del profilo) e la collezione si salverà nel cloud.'); }
      return;
    }
    const locale = await leggiTutto();
    let finale = locale, daScrivereQui = false;
    if (!nube) finale = locale;
    else if (stato.uid !== utente.uid) {
      const haQui = Object.keys(locale).length > 0, haAccount = Object.keys(nube.collezioni || {}).length > 0;
      finale = haQui && haAccount && (await chiedi()) === 'unisci' ? unisci(locale, nube.collezioni)
        : haAccount ? (nube.collezioni || {}) : locale;
      daScrivereQui = true;
    }
    else if (nube.aggiornato === stato.ultimo) {
      if (!stato.sporco) {
        let r = null; try { r = trofeiPerCloud(nube); } catch (e) { console.warn('Trofei:', e); }
        if (!r || !r.cambia) return;
      }
    }
    else if (stato.sporco) { finale = unisci(locale, nube.collezioni); daScrivereQui = true; }
    else { finale = nube.collezioni || {}; daScrivereQui = true; }
    const cambiaQui = daScrivereQui && impronta(finale) !== impronta(locale);
    if (cambiaQui) await scriviTutto(finale, true);
    let aggiornato = nube && nube.aggiornato;
    const paese = paesePerCloud(nube);
    const paeseDoc = paese || (nube && nube.paese ? Object.assign({ paese: nube.paese }, nube.paeseAuto ? { paeseAuto: true } : {}) : {});
    let tro = { extra: {}, cambia: false };
    try { tro = trofeiPerCloud(nube); } catch (e) { console.warn('Trofei:', e); }
    const cambiaCollezioni = !nube || impronta(finale) !== impronta(nube.collezioni);
    if (cambiaCollezioni || paese || tro.cambia) {
      if (cambiaCollezioni) aggiornato = Date.now();
      let accettato = null;
      if (!nube) { try { accettato = JSON.parse(localStorage.getItem('ct-accettato')); } catch (e) {} }
      const base = { versione: 1, aggiornato, collezioni: finale };
      const prove = [Object.assign({}, base, paeseDoc, tro.extra, accettato ? { accettato } : {}), Object.assign({}, base, paeseDoc, tro.extra),
                     Object.assign({}, base, paeseDoc), base];
      let errore = null, fatto = false;
      for (const dati of prove) {
        try { await setDoc(documento(utente.uid), dati); fatto = true; break; } catch (e) { errore = e; }
      }
      if (!fatto) throw errore;
    }
    scriviStato({ uid: utente.uid, ultimo: aggiornato, sporco: false });
    aggiornaVista();
    if (cambiaQui && (typeof CONFIG !== 'undefined' || document.getElementById('raccolta'))) location.reload();
  })().catch(e => { console.warn('Cloud:', e); }).finally(() => { inCorso = null; });
  return inCorso;
}

const SECONDI_CALMA = 20;
window.addEventListener('ct-modifica', () => {
  const s = leggiStato();
  if (!auth.currentUser) return;
  if (daConfermare && !avvisatoConferma) { avvisatoConferma = true; avviso('Per salvare nel cloud conferma la tua email (menu del profilo).'); }
  scriviStato(Object.assign(s, { sporco: true }));
  clearTimeout(timer);
  timer = setTimeout(sincronizza, SECONDI_CALMA * 1000);
});
window.addEventListener('ct-trofei-cambiati', () => {
  if (!auth.currentUser) return;
  scriviStato(Object.assign(leggiStato(), { sporco: true }));
  clearTimeout(timer);
  timer = setTimeout(sincronizza, SECONDI_CALMA * 1000);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && leggiStato().sporco) { clearTimeout(timer); sincronizza(); }
  else if (document.visibilityState === 'visible' && auth.currentUser && controlloVecchio()) sincronizza();
});

onAuthStateChanged(auth, utente => {
  authPronto = true;
  segnaAccesso(!!utente);
  aggiornaPulsante(utente);
  aggiornaVista();
  controllaObbligo();
  if (utente) {
    let fatta = false;
    try { fatta = sessionStorage.getItem('ct-cloud-visita') === utente.uid; sessionStorage.setItem('ct-cloud-visita', utente.uid); } catch (e) {}
    if (!fatta || leggiStato().sporco || controlloVecchio()) sincronizza();
  }
});

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
    mostraErrore(e.code === 'auth/popup-blocked' ? 'Il browser ha bloccato la finestra di Google: permetti i pop-up per questo sito e riprova.' : e.code === 'auth/network-request-failed' ? ERRORI[e.code] : 'Accesso non riuscito. Riprova tra poco.');
  }
}
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
    if (c.corretta) {
      const campo = finestra && finestra.querySelector('form[data-modo="nuovo"] [name=email]');
      if (campo) campo.value = c.corretta;
      return mostraErrore('Ho corretto «' + c.da + '» in «' + c.a + '»: controlla e premi di nuovo "Crea account".');
    }
  }
  let paesePrima = null, paeseCambiato = false;
  try {
    if (modo === 'nuovo') {
      if (PAESI.includes(paese)) { try { paesePrima = localStorage.getItem('ct-paese'); localStorage.setItem('ct-paese', paese); paeseCambiato = true; } catch (e) {} }
      await createUserWithEmailAndPassword(auth, email, password);
      try { localStorage.setItem('ct-accettato', JSON.stringify({ versione: 1, data: Date.now() })); } catch (e) {}
      if (nick) { try { await updateProfile(auth.currentUser, { displayName: Array.from(nick).slice(0, 40).join('') }); aggiornaPulsante(auth.currentUser); } catch (e) {} }
    }
    else await signInWithEmailAndPassword(auth, email, password);
    finestra.close();
    if (modo === 'nuovo') {
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
  const el = finestra && finestra.open && (finestra.querySelector('.st-email .st-account-errore') || finestra.querySelector('.st-account-errore'));
  if (!el) return avviso(testo);
  el.textContent = testo;
  el.classList.toggle('ok', !!ok);
  el.hidden = false;
}

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
  await sincronizza();
  const nonNelCloud = daConfermare;
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

const nomeDi = u => u.displayName || (u.email || 'Profilo').split('@')[0];
const conPassword = u => u.providerData.some(p => p.providerId === 'password');
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COPIA = '<p class="st-ma-sezione">Copia di sicurezza</p>'
  + '<button type="button" data-backup="esporta" class="st-link">Scarica un file</button>'
  + '<button type="button" data-backup="importa" class="st-link">Carica un file</button>';
const PORTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l5-5-5-5"/><path d="M15 12H4"/></svg>';

function aggiornaPulsante(utente) {
  const b = document.getElementById('stAccedi');
  if (!b) return;
  if (utente) {
    b.innerHTML = '<span class="st-avatar" aria-hidden="true">' + esc(Array.from(nomeDi(utente))[0].toUpperCase()) + '</span>';
    b.setAttribute('aria-label', 'Il mio profilo: ' + nomeDi(utente));
    b.title = nomeDi(utente);
    b.classList.toggle('st-da-confermare', daConfermare);
  } else {
    b.classList.remove('st-da-confermare');
    b.textContent = 'Accedi';
    b.removeAttribute('aria-label');
    b.title = 'Accedi e salva la collezione nel cloud';
  }
}
function aggiornaVista() {
  if (auth.currentUser && finestra && finestra.open) finestra.close();
  aggiornaPulsante(auth.currentUser);
  if (menu && !menu.hidden) disegnaMenu();
  disegnaImpostazioni();
}
function notaCloud() {
  const s = leggiStato();
  const quando = s.ultimo ? new Date(s.ultimo).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  if (daConfermare) return 'Conferma la tua email per salvare nel cloud';
  return s.sporco ? 'Salvataggio nel cloud in corso…' : quando ? 'Salvata nel cloud · ' + quando : 'Salvata nel cloud';
}
const pulsantiConferma = () => daConfermare
  ? '<p class="st-ma-nota"><button type="button" data-m="conferma-invia" class="st-link">Invia di nuovo l\'email</button> · <button type="button" data-m="conferma-fatto" class="st-link">Ho confermato</button></p>' : '';
async function inviaConferma() {
  try { await sendEmailVerification(auth.currentUser); avviso('Email inviata di nuovo (guarda anche nello spam).'); }
  catch (e) { avviso('Non riesco a inviare l\'email adesso: riprova tra qualche minuto.'); }
}
async function controllaConferma(avvisa) {
  const u = auth.currentUser;
  if (!u || !daConfermare) return;
  try {
    await u.reload();
    if (u.emailVerified) { await u.getIdToken(true); avviso('Email confermata: la tua collezione ora si salva nel cloud.'); await sincronizza(); }
    else if (avvisa) avviso('Non vedo ancora la conferma: apri il link nell\'email e riprova.');
  } catch (e) { if (avvisa) avviso('Non riesco a controllare adesso: riprova tra poco.'); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') controllaConferma(false); });
async function azioneAccount(m) {
  if (m === 'conferma-invia') inviaConferma();
  else if (m === 'conferma-fatto') controllaConferma(true);
  else if (m === 'esci') esci();
  else if (m === 'elimina') confermaElimina();
  else if (m === 'password') {
    try { await sendPasswordResetEmail(auth, auth.currentUser.email); avviso('Ti ho mandato un\'email per scegliere la nuova password (guarda anche nello spam).'); }
    catch (err) { avviso(messaggioErrore(err)); }
  }
}

function opzioniPaese() {
  let nomi = null;
  try { nomi = new Intl.DisplayNames([LINGUA], { type: 'region' }); } catch (e) {}
  const mio = paeseVisitatore();
  const vuota = paeseIncerto() && !paeseScelto() ? '<option value="" selected>Scegli il tuo paese</option>' : '';
  return vuota + nomiPaesi().map(([c, n]) => [c, nomi ? nomi.of(c) : n]).sort((a, b) => a[1].localeCompare(b[1], LINGUA))
    .map(([c, n]) => '<option value="' + c + '"' + (!vuota && c === mio ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
}
let obbligo = false, authPronto = false, motivoObbligo = '';
function controllaObbligo() {
  if (!obbligo || !authPronto || auth.currentUser) return;
  if (finestra && finestra.open) return;
  apriFinestra();
}
export function richiediIscrizione(motivo) {
  obbligo = true; motivoObbligo = motivo || '';
  if (finestra && finestra.open) disegnaFinestra(); else controllaObbligo();
}
let finestra = null, nuovo = true;
let emailAperta = false;
function disegnaFinestra() {
  finestra.classList.toggle('st-obbligo', obbligo);
  finestra.querySelector('h2').textContent = !obbligo ? 'La tua collezione nel cloud' : motivoObbligo === 'spunte' ? 'La tua collezione sta crescendo' : motivoObbligo === 'giorni' ? 'Crea il tuo account gratuito' : 'Entra in Collection Time';
  finestra.querySelector('.st-account-testo').innerHTML =
    (obbligo && motivoObbligo === 'spunte' ? '<p>Hai già segnato tanti pezzi: per continuare crea il tuo account gratuito (o accedi se ce l\'hai già). Le tue spunte si salvano nel cloud e le ritrovi su telefono, computer e ogni nuovo dispositivo.</p>'
     : obbligo && motivoObbligo === 'giorni' ? '<p>Per continuare a usare Collection Time crea il tuo account gratuito (o accedi se ce l\'hai già). La tua collezione si salva nel cloud e la ritrovi su ogni dispositivo.</p>'
     : obbligo ? '<p>Collection Time è <b>gratuito</b>: per usarlo crea il tuo account (o accedi se ce l\'hai già). La tua collezione si salva nel cloud e la ritrovi su telefono, computer e ogni nuovo dispositivo.</p>'
     : '<p>Accedi per <b>salvare la collezione nel cloud</b> e ritrovarla sul telefono, sul computer e su un nuovo dispositivo.</p>')
    + '<button type="button" data-azione="accedi" class="st-google st-google-grande">Continua con Google</button>'
    + '<p class="st-google-nota"><small>Il modo più rapido: senza password e senza email da confermare.</small></p>'
    + (obbligo && nuovo && !emailAperta ? '<p class="st-account-errore st-errore-google" role="alert" hidden></p>' : '')
    + (nuovo && !emailAperta ? '<p class="st-privacy-riga"><small>Iscrivendoti accetti la </small><a href="' + new URL('privacy.html', BASE).href + '" target="_blank" rel="noopener"><small>Privacy</small></a><small>.</small></p>' : '')
    + (nuovo && !emailAperta ? '' : '<p class="st-oppure">oppure con la tua email</p>')
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
    + (nuovo && emailAperta ? '<p class="st-privacy-riga"><small>Iscrivendoti accetti la </small><a href="' + new URL('privacy.html', BASE).href + '" target="_blank" rel="noopener"><small>Privacy</small></a><small>.</small></p>' : '')
    + (obbligo ? '' : '<div class="st-account-copia"><small>Non vuoi un account?</small> ' + COPIA + '</div>');
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
      if (!b) {
        if (obbligo) return;
        const r = finestra.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) finestra.close();
        return;
      }
      if (b.dataset.backup) return finestra.close();
      const azione = b.dataset.azione;
      if (azione === 'accedi') { if (!obbligo) finestra.close(); accedi(); }
      else if (azione === 'cambia-modo') {
        const campo = finestra.querySelector('.st-email [name=email]'), email = campo ? campo.value : '';
        nuovo = !nuovo; if (nuovo && email) emailAperta = true; disegnaFinestra();
        const nuovoCampo = finestra.querySelector('.st-email [name=email]');
        if (nuovoCampo) nuovoCampo.value = email;
      }
      else if (azione === 'apri-email') {
        emailAperta = true; disegnaFinestra();
        finestra.querySelector('.st-email [name=email]').focus();
      }
      else if (azione === 'dimenticata') passwordDimenticata(finestra.querySelector('.st-email [name=email]').value.trim());
      else finestra.close();
    });
    finestra.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      conEmail(f.dataset.modo, f.email.value.trim(), f.password.value, f.nome ? f.nome.value.trim() : '', f.paese ? f.paese.value : '');
    });
    finestra.addEventListener('cancel', e => { if (obbligo && !auth.currentUser) e.preventDefault(); });
    finestra.addEventListener('close', () => { nuovo = true; emailAperta = false; if (obbligo) setTimeout(controllaObbligo, 0); });
    document.body.append(finestra);
  }
  disegnaFinestra();
  finestra.showModal();
}

let menu = null, numeri = null;
async function contaNumeri() {
  const tutte = await leggiTutto();
  let R = null;
  try { R = (await (await fetch(new URL('riepilogo.json', CATALOGO), { cache: 'no-cache' })).json()).serie; } catch (e) { R = null; }
  if (R) {
    numeri = { ce: 0, doppi: 0, collezioni: 0 };
    for (const [nome, c] of Object.entries(tutte)) {
      const s = R[nome];
      if (!s) continue;
      const esteri = s[4] || {}, fuori = id => !!esteri[id] && paeseEstero(esteri[id]);
      const doppi = c.doppi || {};
      const ids = new Set([...(c.possedute || []), ...Object.keys(doppi).filter(id => doppi[id] > 0)]);
      const tot = s[2] - Object.keys(esteri).filter(fuori).length;
      const ce = Math.min([...ids].filter(id => !fuori(id)).length, tot);
      if (!ce) continue;
      numeri.ce += ce;
      numeri.doppi += Object.values(doppi).reduce((a, n) => a + (n > 0 ? n : 0), 0);
      numeri.collezioni++;
    }
  } else {
    const v = Object.values(tutte);
    numeri = {
      ce: v.reduce((t, c) => t + (c.possedute || []).length, 0),
      doppi: v.reduce((t, c) => t + Object.values(c.doppi || {}).reduce((a, n) => a + n, 0), 0),
      collezioni: v.filter(c => (c.possedute || []).length).length
    };
  }
  if (menu && !menu.hidden) disegnaMenu();
}
let infoTrofei = null;
function bandaTrofei() {
  const leggi = (k, v) => { try { return JSON.parse(localStorage.getItem(k)) ?? v; } catch (e) { return v; } };
  const tot = infoTrofei ? infoTrofei.tot : 30, fatti = Math.min(Object.keys(leggi('ct-trofei', {})).length, tot);
  const scelti = infoTrofei ? leggi('ct-badge', []).map(id => infoTrofei.badge.find(b => b[0] === id)).filter(Boolean) : [];
  return '<a class="st-ma-trofei" href="' + new URL('impostazioni.html#trofei', BASE).href + '">'
    + '<span class="st-ma-trofei-t"><b>Trofei</b><span>' + fatti + ' su ' + tot + '</span></span>'
    + '<span class="st-progresso"><i style="width:' + Math.round(fatti * 100 / tot) + '%"></i></span>'
    + (scelti.length ? '<span class="st-ma-badge-riga">' + scelti.map(b => '<span class="st-ma-badge" style="--col:' + b[2] + '">♥ ' + esc(b[1]) + '</span>').join('') + '</span>' : '')
    + '</a>';
}
function disegnaMenu() {
  const u = auth.currentUser;
  if (!u) return chiudiMenu();
  const n = numeri || { ce: '…', doppi: '…', collezioni: '…' };
  menu.innerHTML =
    '<div class="st-ma-testa"><span class="st-avatar grande" aria-hidden="true">' + esc(Array.from(nomeDi(u))[0].toUpperCase()) + '</span>'
    + '<div><b>' + esc(nomeDi(u)) + '</b><small>' + esc(u.email || '') + '</small></div></div>'
    + '<a class="st-ma-stat" href="' + new URL('impostazioni.html#statistiche', BASE).href + '">'
    +   '<span class="st-ma-numeri"><span><b>' + n.ce + '</b><small>Ce l\'ho</small></span><span><b>' + n.doppi + '</b><small>Doppioni</small></span><span><b>' + n.collezioni + '</b><small>Collezioni</small></span></span>'
    +   '<small>Le mie statistiche ›</small></a>'
    + bandaTrofei()
    + '<p class="st-ma-nota">' + notaCloud() + '</p>' + pulsantiConferma()
    + '<a class="st-link st-ma-imp" href="' + new URL('impostazioni.html', BASE).href + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>Impostazioni</a>'
    + COPIA
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
      chiudiMenu();
      if (b.dataset.m) azioneAccount(b.dataset.m);
    });
    document.addEventListener('click', e => { if (!menu.hidden && !e.composedPath().includes(menu) && !e.target.closest('#stAccedi')) chiudiMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) chiudiMenu(); });
    document.body.append(menu);
  }
  const barra = document.querySelector('.st-top');
  menu.style.top = (barra ? barra.getBoundingClientRect().bottom + 6 : 70) + 'px';
  menu.hidden = false;
  disegnaMenu();
  contaNumeri();
  if (!infoTrofei) caricaTrofei().then(m => { infoTrofei = { tot: m._TROFEI.length, badge: m._BADGE }; if (!menu.hidden) disegnaMenu(); }, e => console.warn(e));
}
function chiudiMenu() { if (menu) menu.hidden = true; }

let cambioNome = false;
function disegnaImpostazioni() {
  const box = document.getElementById('stImpAccount'), u = auth.currentUser;
  if (!box || !u) return;
  if (!box.dataset.pronto) {
    box.dataset.pronto = '1';
    box.addEventListener('click', e => {
      const m = (e.target.closest('button[data-m]') || {}).dataset?.m;
      if (m === 'nome' || m === 'annulla') { cambioNome = m === 'nome'; disegnaImpostazioni(); }
      else if (m) azioneAccount(m);
    });
    box.addEventListener('submit', async e => {
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

export function apriAccount() {
  if (!auth.currentUser) return apriFinestra();
  if (menu && !menu.hidden) chiudiMenu(); else apriMenu();
}
