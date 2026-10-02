/* ==========================================================
   script.js — Collection Time
   1) carica header.html e footer.html nei segnaposto (Fetch);
      lo stile comune, sito.css, è richiamato nel <head> di ogni pagina
   2) fa funzionare la copia di sicurezza (i vecchi Esporta e Importa, ora nel menu Accedi / profilo):
      valgono per TUTTE le collezioni del sito insieme
      (+ "Accedi": carica comune/cloud.js solo quando serve)
   3) fa funzionare "Aggiungi alla Home" della banda in basso
   4) apre e chiude la ricerca (la lente) e filtra le card
   5) avviso(testo): l'avviso temporaneo in basso, usato anche da app.js
   6) la barra in basso delle categorie (Serie · Mi mancano · Doppioni · Cerca)
   7) le card divise per anno in tendine (solo le liste con data-per-anno)
   8) le statistiche delle visite (GoatCounter, senza cookie)
   9) il percorso in alto (Kinder Ferrero › Kinder Joy › One Piece)
  10) l'aspetto del sito: Automatico · Chiaro · Scuro (nella pagina Impostazioni)
  11) la barra "6 su 9" sulle card delle serie in cui hai segnato qualcosa
  12) le categorie fissate in alto nella Home (tenendo premuto, solo con l'account)
  13) il carosello delle Novità nella Home (frecce quando le Novità sono più di quelle visibili)
   Da richiamare in ogni pagina con una sola riga:
   <script src="script.js?v=2026-09-28d"></script>
   (dentro una sottocartella: <script src="../script.js?v=2026-09-28d"></script>,
    in una pagina di una serie: <script src="../../../script.js?v=…"></script>)
   Nelle pagine delle collezioni va PRIMA di comune/app.js.
   ========================================================== */

/* Cartella in cui si trova questo file: header.html, footer.html
   e i link vengono cercati da qui, quindi funzionano anche dalle
   pagine dentro le sottocartelle. */
const BASE = new URL('.', document.currentScript.src);
/* Versione (data) scritta nella pagina (script.js?v=2026-09-26): lo aggiungo anche
   a header.html e footer.html, così anche loro si aggiornano subito. */
const VERSIONE = new URL(document.currentScript.src).searchParams.get('v') || '';
const conVersione = file => { const u = new URL(file, BASE); if (VERSIONE) u.searchParams.set('v', VERSIONE); return u; };

/* ---------- Header e footer ---------- */

async function caricaParte(idSegnaposto, file) {
  const box = document.getElementById(idSegnaposto);
  if (!box) return;                         // la pagina non ha questo segnaposto
  try {
    const res = await fetch(conVersione(file));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    box.innerHTML = html;
    sistemaLink(box);
    nascondiHomeSeInstallato();
  } catch (e) {
    console.warn('Impossibile caricare ' + file + ':', e);
  }
}

/* Rende corretti i link relativi (anche da sottocartelle) */
function sistemaLink(box) {
  box.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (/^(https?:|mailto:|tel:|#)/i.test(href)) return;   // link esterni: non si toccano
    a.href = new URL(href, BASE).href;
  });
}

/* ---------- Copia di sicurezza: Esporta / Importa (tutte le collezioni) ----------
   Ogni collezione salva le spunte nel browser, in un archivio
   IndexedDB che si chiama "catalogo-…" (per le penne: "catalogo-penne"),
   il nome scritto in CONFIG.dbName della sua pagina.
   Esporta legge tutti questi archivi e salva UN solo file leggero con,
   per ogni collezione, solo:
     possedute → gli id di ciò che hai segnato "Ce l'ho"
     doppi     → quanti doppioni hai               (id → numero)
     hashtag   → gli hashtag che hai cambiato tu   (id → elenco)
   Niente foto, nomi o colori: quelli sono già nelle pagine del sito.
   Esempio:
   {"sito":"Collection Time","versione":1,"data":"2026-09-22",
    "collezioni":{"catalogo-penne":{"possedute":["seed-000","seed-005"],
    "doppi":{"seed-005":2},"hashtag":{"seed-011":["Natale"]}}}}
   Importa rimette tutto a posto, anche nelle collezioni che in
   questo browser non sono mai state aperte. */

const PREFISSO = 'catalogo-', STORE = 'penne';

/* avviso temporaneo in basso (sparisce dopo 4,5 secondi); l'aspetto è in sito.css.
   annulla (facoltativo) = funzione del pulsante "Annulla" dentro l'avviso (resta 7 secondi) */
let avvisoTimer;
function avviso(testo, annulla) {
  let el = document.querySelector('.st-avviso');
  if (!el) {
    el = document.createElement('div');
    el.className = 'st-avviso';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = testo;
  el.classList.toggle('con-azione', !!annulla);
  if (annulla) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Annulla';
    b.addEventListener('click', () => { el.classList.remove('show'); annulla(); });
    el.append(b);
  }
  el.classList.add('show');
  clearTimeout(avvisoTimer);
  avvisoTimer = setTimeout(() => el.classList.remove('show'), annulla ? 7000 : 4500);
}

const richiesta = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });

/* apre (o crea, se non c'è) l'archivio di una collezione */
function apriArchivio(nome) {
  const r = indexedDB.open(nome);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
  return richiesta(r);
}
function leggi(db) {
  if (!db.objectStoreNames.contains(STORE)) return Promise.resolve([]);
  return richiesta(db.transaction(STORE).objectStore(STORE).getAll());
}
function scrivi(db, elenco) {
  return new Promise((ok, ko) => {
    const t = db.transaction(STORE, 'readwrite');
    elenco.forEach(p => t.objectStore(STORE).put(p));
    t.oncomplete = ok;
    t.onerror = () => ko(t.error);
  });
}
async function archivi() {
  return (await indexedDB.databases()).map(d => d.name).filter(n => n && n.startsWith(PREFISSO));
}
const oggi = () => new Date().toISOString().slice(0, 10);

/* dalle schede salvate nel browser tiene solo spunte, doppioni e hashtag */
function riassumi(penne) {
  const c = {}, hashtag = {}, doppi = {};
  const possedute = penne.filter(p => p.owned === true).map(p => p.id);
  penne.forEach(p => {
    if (p.tagsTouched) hashtag[p.id] = p.tags || [];
    if (p.doppi > 0) doppi[p.id] = p.doppi;
  });
  if (possedute.length) c.possedute = possedute;
  if (Object.keys(doppi).length) c.doppi = doppi;
  if (Object.keys(hashtag).length) c.hashtag = hashtag;
  return c;
}

/* tutte le collezioni di questo browser, nel formato di Esporta
   (le usa anche comune/cloud.js per il salvataggio nel cloud) */
async function leggiTutto() {
  const collezioni = {};
  for (const n of await archivi()) {
    const db = await apriArchivio(n);
    const dati = riassumi(await leggi(db));
    db.close();
    if (Object.keys(dati).length) collezioni[n] = dati;
  }
  return collezioni;
}

async function esporta() {
  const collezioni = await leggiTutto();
  if (!Object.keys(collezioni).length) return avviso('Non c\'è ancora niente da esportare.');
  const blob = new Blob([JSON.stringify({ sito: 'Collection Time', versione: 1, data: oggi(), collezioni })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'collection-time-' + oggi() + '.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  avviso('File salvato nella cartella Download.');
}

/* scrive in un archivio i dati di una collezione presi dal file */
async function applica(db, dati) {
  const soloId = v => Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  const possedute = new Set(soloId(dati.possedute));
  const hashtag = dati.hashtag && typeof dati.hashtag === 'object' ? dati.hashtag : {};
  const doppi = dati.doppi && typeof dati.doppi === 'object' ? dati.doppi : {};
  const quanti = id => Number.isInteger(doppi[id]) && doppi[id] > 0 ? Math.min(doppi[id], 999) : 0;
  const ids = new Set([...possedute, ...Object.keys(hashtag), ...Object.keys(doppi)]);
  const penne = await leggi(db);
  const perId = new Map(penne.map(p => [p.id, p]));
  const cambiate = penne.filter(p => (p.owned || p.doppi) && !ids.has(p.id));   // non più segnate nel file
  cambiate.forEach(p => { p.owned = false; p.doppi = 0; });
  ids.forEach(id => {
    const p = perId.get(id) || { id };   // mai vista in questo browser: la completa la pagina della collezione
    p.owned = possedute.has(id);
    p.doppi = quanti(id);
    if (Array.isArray(hashtag[id])) { p.tags = hashtag[id].map(String).slice(0, 30); p.tagsTouched = true; }
    cambiate.push(p);
  });
  await scrivi(db, cambiate);
  return possedute.size;
}

async function importa(file) {
  let dati = null;
  try { dati = JSON.parse(await file.text()); } catch (e) { /* non è un file JSON */ }
  const collezioni = dati && dati.collezioni;
  if (!collezioni || typeof collezioni !== 'object') return avviso('Questo file non è un backup di Collection Time.');
  const tot = await scriviTutto(collezioni, false);
  segnalaModifica();                                    // col cloud attivo, anche il cloud si aggiorna
  avviso('Importato: ' + tot + (tot === 1 ? ' oggetto segnato' : ' oggetti segnati') + ' "Ce l\'ho".');
  /* nella pagina di una collezione ricarico, così le spunte si vedono subito */
  if (typeof CONFIG !== 'undefined') setTimeout(() => location.reload(), 1200);
}

/* scrive nel browser le collezioni (formato di Esporta).
   sostituisci = true: le collezioni che NON ci sono vengono svuotate
   (lo usa il cloud, che ha la collezione completa); Importa usa false.
   Restituisce quanti oggetti sono segnati "Ce l'ho". */
async function scriviTutto(collezioni, sostituisci) {
  let tot = 0;
  const nomi = new Set(Object.keys(collezioni));
  if (sostituisci) (await archivi()).forEach(n => nomi.add(n));
  for (const c of nomi) {
    const d = collezioni[c] || {};
    if (!c.startsWith(PREFISSO) || typeof d !== 'object') continue;
    const db = await apriArchivio(c);
    tot += await applica(db, d);
    db.close();
  }
  return tot;
}

/* ---------- Accedi (collezione nel cloud) ----------
   Il funzionamento è tutto in comune/cloud.js, che pesa circa 100 KB:
   lo scarico SOLO a chi preme "Accedi" o ha già fatto l'accesso su
   questo browser (ct-accesso = "1"). Per tutti gli altri il sito resta leggero.
   segnalaModifica(): la chiamano app.js e raccolta.js dopo ogni spunta,
   doppione o hashtag salvato; se il cloud è attivo, lui lo manda su. */
let cloud = null;
/* cloud.js prende la stessa versione (?v=) di script.js: se cambi cloud.js, cambia la versione di script.js in tutte le pagine */
const caricaCloud = () => cloud || (cloud = import(conVersione('comune/cloud.js').href));
/* ricorda nel browser se c'è l'accesso; quando cambia avvisa la pagina con l'evento "ct-accesso"
   (lo usa la pagina Impostazioni per mostrare le statistiche appena accedi) */
function segnaAccesso(si) {
  let prima = null;
  try { prima = localStorage.getItem('ct-accesso') === '1'; si ? localStorage.setItem('ct-accesso', '1') : localStorage.removeItem('ct-accesso'); } catch (e) {}
  if (prima !== !!si) window.dispatchEvent(new Event('ct-accesso'));
}
function segnalaModifica() { window.dispatchEvent(new Event('ct-modifica')); }
try { if (localStorage.getItem('ct-accesso') === '1') caricaCloud(); } catch (e) {}

/* Promemoria "Tieni al sicuro la tua collezione": compare in basso alla prima
   spunta di chi NON ha fatto l'accesso (non blocca niente). "Più tardi" lo
   nasconde per 7 giorni (ct-promemoria = quando è stato chiuso).
   L'aspetto è in sito.css (voce "promemoria accesso"). */
const SETTE_GIORNI = 7 * 24 * 60 * 60 * 1000;
window.addEventListener('ct-modifica', () => {
  try {
    if (localStorage.getItem('ct-accesso') === '1') return;                                   // ha già l'account
    if (Date.now() - Number(localStorage.getItem('ct-promemoria') || 0) < SETTE_GIORNI) return;  // "Più tardi" da poco
  } catch (e) { return; }
  if (document.querySelector('.st-promemoria')) return;
  const box = document.createElement('div');
  box.className = 'st-promemoria';
  box.setAttribute('role', 'status');
  box.innerHTML = '<p><b>Tieni al sicuro la tua collezione.</b> Se cambi telefono o cancelli i dati del browser la perderesti: accedi per salvarla e ritrovarla ovunque.</p>'
    + '<div><button type="button" data-p="dopo">Più tardi</button><button type="button" data-p="accedi">Accedi</button></div>';
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    try { localStorage.setItem('ct-promemoria', String(Date.now())); } catch (err) {}
    box.remove();
    if (b.dataset.p === 'accedi') caricaCloud().then(m => m.apriAccount(), () => avviso('Non riesco a collegarmi: controlla la connessione e riprova.'));
  });
  document.body.append(box);
});

/* i pulsanti arrivano con header.html: li ascolto dal documento */
function protetto(fn) {
  return (...args) => fn(...args).catch(e => {
    console.warn(e);
    avviso('Questo browser non permette di leggere o salvare le collezioni.');
  });
}
document.addEventListener('click', e => {
  /* "Copia di sicurezza" (menu del profilo e finestra Accedi): Scarica un file / Carica un file */
  if (e.target.closest('[data-backup="esporta"]')) protetto(esporta)();
  else if (e.target.closest('[data-backup="importa"]')) document.getElementById('stImportaFile').click();
  /* #stAccedi = pulsante in alto · data-accedi = pulsante "Accedi" della pagina Impostazioni */
  else if (e.target.closest('#stAccedi, [data-accedi]')) caricaCloud().then(m => m.apriAccount(), () => avviso('Non riesco a collegarmi: controlla la connessione e riprova.'));
});
document.addEventListener('change', e => {
  if (e.target.id !== 'stImportaFile') return;
  const file = e.target.files[0];
  e.target.value = '';
  if (file) protetto(importa)(file);
});

/* ---------- Aggiungi alla Home (banda in basso) ----------
   · Android, Chrome ed Edge: il browser avvisa che il sito si può
     installare ("beforeinstallprompt"); allora il pulsante apre
     direttamente la sua finestra di installazione.
   · iPhone, iPad, Safari sul Mac e gli altri browser: i siti non
     possono aggiungersi da soli, quindi mostro i passi da fare.
   · Se il sito è già aperto dall'icona sulla Home, il pulsante sparisce.
   Nome e icona usati sono quelli di site.webmanifest. */

let invitoInstalla = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); invitoInstalla = e; });
window.addEventListener('appinstalled', () => { invitoInstalla = null; nascondiHomeSeInstallato(true); });

const giaInstallato = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function nascondiHomeSeInstallato(forza) {
  const btn = document.getElementById('stHome');
  if (btn && (forza || giaInstallato())) btn.hidden = true;
}

/* passi da mostrare, in base al dispositivo */
const ICONA_CONDIVIDI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Condividi"><path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v9A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 17.5 9H16M12 3v11M8.5 6.5 12 3l3.5 3.5"/></svg>';
function passiHome() {
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const safariMac = /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua);
  if (iOS) return ['Tocca ' + ICONA_CONDIVIDI + ' <b>Condividi</b>', 'Scegli <b>Aggiungi alla schermata Home</b>', 'Tocca <b>Aggiungi</b>'];
  if (safariMac) return ['Apri il menu <b>File</b> di Safari', 'Scegli <b>Aggiungi al Dock</b>', 'Premi <b>Aggiungi</b>'];
  return ['Apri il menu del browser (i tre puntini ⋮ o le tre righe ☰)', 'Scegli <b>Installa</b> o <b>Aggiungi alla schermata Home</b>', 'Conferma'];
}

function guidaHome() {
  let d = document.querySelector('.st-guida');
  if (!d) {
    d = document.createElement('dialog');
    d.className = 'st-guida';
    d.setAttribute('aria-labelledby', 'stGuidaTitolo');
    /* il logo è lo stesso della banda in alto (header.html) */
    d.innerHTML = '<h2 id="stGuidaTitolo"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#F2A900"/><path d="M8.22 16.6 13.4 21.6" fill="none" stroke="#1A2140" stroke-width="4.6" stroke-linecap="round"/><path d="M13.4 21.6 24.52 11.23" fill="none" stroke="#1A2140" stroke-width="3.8" stroke-linecap="round"/></svg>Metti Collection Time sulla Home</h2>' +
      '<ol>' + passiHome().map(p => '<li>' + p + '</li>').join('') + '</ol>' +
      '<form method="dialog"><button>Ho capito</button></form>';
    d.addEventListener('click', e => {                                       // clic fuori dalla finestra: chiude
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
    document.body.append(d);
  }
  d.showModal();
}

async function aggiungiHome() {
  if (!invitoInstalla) return guidaHome();
  invitoInstalla.prompt();
  await invitoInstalla.userChoice;
  invitoInstalla = null;               // l'invito si può usare una volta sola
}
document.addEventListener('click', e => { if (e.target.closest('#stHome')) aggiungiHome(); });

/* ---------- Ricerca (la lente) ----------
   La lente apre il campo; lo apre anche la scritta accanto ("Cerca una serie",
   "Cerca una categoria"…), più comoda da toccare sul telefono.
   Con Esc o uscendo dal campo vuoto si richiude.
   Nelle pagine con le card (Home, Legami, LEGO, Kinder) scrivendo restano visibili
   solo le card che contengono quelle parole (nel testo della card o nel
   suo data-cerca="..."). Nelle pagine delle collezioni il filtro lo fa
   app.js, che ascolta lo stesso campo. */

function avviaCerca() {
  const box = document.getElementById('stCerca');
  if (!box) return;                          // la pagina non ha la ricerca
  const btn = box.querySelector('button'), campo = box.querySelector('input');
  const scritta = box.parentElement.querySelector('.st-sub > .sub');   // la frase accanto alla lente (se c'è)
  const card = [...document.querySelectorAll('.st-cards > li')];
  const nessuna = document.querySelector('.st-nessuna');
  const semplice = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');   // senza accenti

  function filtra() {
    const parole = semplice(campo.value).split(/\s+/).filter(Boolean);
    let visibili = 0;
    card.forEach(li => {
      const testo = semplice(li.textContent + ' ' + (li.dataset.cerca || ''));
      li.hidden = !parole.every(p => testo.includes(p));
      if (!li.hidden) visibili++;
    });
    if (nessuna) nessuna.hidden = visibili > 0;
    aggiornaAnni(parole.length > 0);
  }
  function apri() { box.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); campo.tabIndex = 0; campo.focus(); }
  function chiudi() {
    if (campo.value.trim()) return;          // se c'è scritto qualcosa resta aperto
    box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); campo.tabIndex = -1;
  }
  btn.addEventListener('click', () => box.classList.contains('open') && !campo.value.trim() ? chiudi() : apri());
  if (scritta) scritta.addEventListener('click', apri);
  campo.addEventListener('input', filtra);
  campo.addEventListener('blur', () => setTimeout(() => { if (!box.contains(document.activeElement)) chiudi(); }, 120));
  campo.addEventListener('keydown', e => {
    if (e.key === 'Escape') { campo.value = ''; campo.dispatchEvent(new Event('input')); chiudi(); btn.focus(); }
  });
}

/* ---------- Barra in basso delle categorie ----------
   In tutte le pagine che stanno DENTRO la cartella di una categoria
   (catalogo/legami, catalogo/lego, catalogo/kinder…) aggiunge in fondo allo schermo:
     Serie        → la pagina iniziale della categoria
     Mi mancano   → catalogo/<categoria>/la-mia-collezione/#/mancanti
     Doppioni     → catalogo/<categoria>/la-mia-collezione/#/doppioni
     Cerca        → catalogo/<categoria>/la-mia-collezione/#/cerca
   Così ogni categoria è come una piccola app, e la Home è l'indice delle app.
   Tutte le categorie stanno nella cartella "catalogo": fuori da lì (Home,
   FAQ, Contatti…) e nelle cartelle che iniziano con "_" la barra non c'è.
   L'aspetto è in sito.css (voce "barra in basso delle categorie"). */
const CATALOGO = new URL('catalogo/', BASE).href;   // cartella con tutte le categorie
/* percorso della pagina dentro "catalogo/" (es. "legami/legami-erasable/index.html"); '' fuori dal catalogo */
const dentroCatalogo = () => location.href.startsWith(CATALOGO) ? decodeURIComponent(location.href.slice(CATALOGO.length)) : '';
const ICONE_BARRA = {
  serie: '<path d="M3 5.5c3-1.3 6-1.3 9 .5 3-1.8 6-1.8 9-.5V19c-3-1.3-6-1.3-9 .5-3-1.8-6-1.8-9-.5z"/><path d="M12 6v13.5"/>',
  mancanti: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12h6"/>',
  doppioni: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  cerca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'
};
function barraCategoria() {
  const dentro = dentroCatalogo();
  const cat = dentro.split(/[/?#]/)[0];
  if (!dentro.includes('/') || !cat || cat.startsWith('_')) return;   // non siamo in una categoria
  const lista = new URL(cat + '/la-mia-collezione/index.html', CATALOGO).href;
  const voci = [['serie', 'Serie', new URL(cat + '/index.html', CATALOGO).href],
                ['mancanti', 'Mi mancano', lista + '#/mancanti'],
                ['doppioni', 'Doppioni', lista + '#/doppioni'],
                ['cerca', 'Cerca', lista + '#/cerca']];
  const nav = document.createElement('nav');
  nav.className = 'st-barra';
  nav.setAttribute('aria-label', 'Sezioni della categoria');
  nav.innerHTML = voci.map(([k, t, href]) => '<a href="' + href + '" data-voce="' + k + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONE_BARRA[k] + '</svg>' + t + '</a>').join('');
  document.body.append(nav);
  document.body.classList.add('con-barra');
  /* voce accesa: nella pagina "la mia collezione" dipende dalla parte dopo #, altrove è "Serie" */
  const accendi = () => {
    const attiva = dentro.includes('/la-mia-collezione/') ? (location.hash.replace(/^#\/?/, '') || 'mancanti') : 'serie';
    nav.querySelectorAll('a').forEach(a => a.dataset.voce === attiva ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  };
  accendi();
  window.addEventListener('hashchange', accendi);
}

/* ---------- Card divise per anno (tendine) ----------
   In una pagina con le card basta scrivere  data-per-anno  nella lista:
     <ul class="st-cards" data-per-anno>
   e le card vengono raccolte in tendine, una per anno, che si aprono al clic.
   L'anno è il primo numero tipo 1993 o 2010 scritto nel testo della card
   (nel <p>: "9 sorpresine<br>2010"). Le card si scrivono come sempre,
   dalla più recente; le tendine sono sempre ordinate dall'anno più recente al più vecchio.
   Le card SENZA anno (es. una cartella come "Squishmallows") restano
   normali, sopra le tendine.
   Mentre si cerca con la lente le tendine con risultati si aprono da sole
   e quelle senza risultati si nascondono.
   L'aspetto è in sito.css (voce "tendine degli anni"). */
function perAnno() {
  document.querySelectorAll('ul.st-cards[data-per-anno]').forEach(lista => {
    const anni = new Map();                     // anno → le sue card, nell'ordine della pagina
    const senzaAnno = [];
    [...lista.children].forEach(li => {
      const trovato = (li.querySelector('p') || li).textContent.match(/(?:^|\D)((?:19|20)\d{2})(?!\d)/);   // un numero di 4 cifre 19xx o 20xx
      if (!trovato) return senzaAnno.push(li);
      if (!anni.has(trovato[1])) anni.set(trovato[1], []);
      anni.get(trovato[1]).push(li);
    });
    const box = document.createElement('div');
    box.className = 'st-anni';
    /* tendine dall'anno più recente al più vecchio, qualunque sia l'ordine delle card
       (una serie nuova del 2023 messa in cima alla lista finisce sotto il 2026); dentro ogni anno l'ordine delle card resta quello della pagina */
    [...anni].sort((a, b) => b[0] - a[0]).forEach(([anno, card]) => {
      const d = document.createElement('details');
      d.className = 'st-anno';
      d.innerHTML = '<summary><span class="st-anno-num">' + anno + '</span><span class="st-anno-quante">' + card.length + ' serie</span></summary>';
      const ul = document.createElement('ul');
      ul.className = 'st-cards';
      ul.append(...card);
      d.append(ul);
      box.append(d);
    });
    lista.after(box);
    if (senzaAnno.length) lista.replaceChildren(...senzaAnno);   // la lista resta sopra, solo con le card senza anno
    else lista.remove();
  });
}
/* durante la ricerca: apre le tendine con risultati e nasconde le altre; a campo vuoto torna com'era */
function aggiornaAnni(cercando) {
  document.querySelectorAll('.st-anno').forEach(d => {
    const visibili = [...d.querySelectorAll('.st-cards > li')].some(li => !li.hidden);
    d.hidden = cercando && !visibili;
    if (cercando) { if (!('prima' in d.dataset)) d.dataset.prima = d.open ? '1' : ''; d.open = true; }
    else if ('prima' in d.dataset) { d.open = d.dataset.prima === '1'; delete d.dataset.prima; }
  });
}

/* ---------- Percorso in alto ----------
   Nelle pagine dentro una categoria il link "← Kinder Joy" diventa:
     Kinder Ferrero › Kinder Joy › One Piece
   (categoria › pagina di sopra › questa pagina). Nelle pagine scritte
   non cambia niente: basta il solito <a class="st-back" href="../index.html">← …</a>.
     categoria   → il nome qui sotto (NOMI_CATEGORIE)
     di sopra    → la scritta del link "←" della pagina
     questa      → il <title> della pagina, prima di " · Collection Time"
   ! MODIFICA: quando crei una categoria nuova aggiungi qui il suo nome
     (cartella: "Nome"); se manca, uso il nome della cartella. */
const NOMI_CATEGORIE = {
  'coolthings': 'Cool Things', 'eurospin': 'Eurospin', 'kinder': 'Kinder Ferrero', 'legami': 'Legami',
  'lego': 'LEGO Minifigures', 'lidl': 'Lidl', 'mcdonalds': "McDonald's", 'mulino-bianco': 'Mulino Bianco'
};
function percorso() {
  const back = document.querySelector('a.st-back');
  if (!back) return;
  const cartelle = dentroCatalogo().split(/[?#]/)[0].split('/').filter(c => c && c !== 'index.html');
  const cat = cartelle[0] || '';
  if (cartelle.length < 2 || cat.startsWith('_')) return;   // fuori dal catalogo, pagine della categoria stessa, strumenti
  const voci = [[NOMI_CATEGORIE[cat] || cat.charAt(0).toUpperCase() + cat.slice(1), new URL(cat + '/index.html', CATALOGO).href]];
  if (cartelle.length > 2) voci.push([back.textContent.replace(/^\s*\u2190\s*/, '').trim(), back.href]);
  const nav = document.createElement('nav');
  nav.className = 'st-percorso';
  nav.setAttribute('aria-label', 'Percorso');
  voci.forEach(([testo, href]) => {
    const a = document.createElement('a');
    a.href = href; a.textContent = testo;
    const sep = document.createElement('span');
    sep.className = 'sep'; sep.textContent = '\u203A'; sep.setAttribute('aria-hidden', 'true');
    nav.append(a, sep);
  });
  const qui = document.createElement('span');
  qui.setAttribute('aria-current', 'page');
  qui.textContent = document.title.split(' \u00B7 ')[0];
  nav.append(qui);
  back.replaceWith(nav);
}

/* ---------- Aspetto: Automatico · Chiaro · Scuro ----------
   I pulsanti sono nella pagina Impostazioni (impostazioni.html, class="st-aspetto").
   La scelta si ricorda nel browser (ct-tema) e si scrive in <html data-tema="…">;
   i colori scuri sono in sito.css (voce "TEMA SCURO"). La riga <script> nel <head>
   di ogni pagina la rimette subito, prima che la pagina si veda, senza lampi di bianco. */
function temaScelto() { try { return localStorage.getItem('ct-tema') || 'auto'; } catch (e) { return 'auto'; } }
function attivaAspetto() {
  const pulsanti = [...document.querySelectorAll('.st-aspetto button')];
  if (!pulsanti.length) return;                                // pagina senza i pulsanti
  const segna = t => pulsanti.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tema === t)));
  segna(temaScelto());
  pulsanti.forEach(b => b.addEventListener('click', () => {
    try { localStorage.setItem('ct-tema', b.dataset.tema); } catch (e) {}
    document.documentElement.dataset.tema = b.dataset.tema;
    segna(b.dataset.tema);
  }));
}

/* ---------- Barra sulle card delle serie ----------
   Nelle pagine con le card delle serie (es. Kinder Sorpresa), sulle serie in cui
   hai segnato almeno un pezzo compare, accanto ad "Apri", una barra ambra con
   "6 su 9" (numeri in grassetto quando la serie è completa).
   Chi non ha mai segnato niente non scarica niente in più. Gli altri caricano
   l'elenco della categoria (la-mia-collezione/indice.js, lo stesso di "Mi mancano")
   e l'archivio del browser di ogni serie. Le serie nuove si vedono da sole
   quando l'area amministratore rifà l'indice. L'aspetto è in sito.css. */
async function barreSerie() {
  const dentro = dentroCatalogo(), cat = dentro.split(/[/?#]/)[0];
  const card = [...document.querySelectorAll('a.st-card')];
  if (!cat || cat.startsWith('_') || dentro.includes('/la-mia-collezione/') || !card.length || !window.indexedDB || !indexedDB.databases) return;
  try {
    const miei = new Set(await archivi());                   // le serie in cui hai segnato qualcosa
    if (!miei.size) return;
    /* l'indice si carica come <script> (non con fetch), così funziona anche aprendo il sito dalla cartella del Mac */
    await new Promise((ok, ko) => {
      const js = document.createElement('script');
      js.src = new URL(cat + '/la-mia-collezione/indice.js?v=' + VERSIONE, CATALOGO).href;
      js.onload = ok; js.onerror = ko;
      document.head.append(js);
    });
    const I = INDICE;   // scritto da indice.js
    const perIndirizzo = new Map(I.serie.map(s => [new URL(cat + '/' + s.p + '/', CATALOGO).href, s]));
    for (const a of card) {
      const s = perIndirizzo.get(a.href.replace(/index\.html$/, '')), apri = a.querySelector('.st-apri');
      if (!s || !apri || !miei.has(s.db)) continue;
      const db = await apriArchivio(s.db), righe = await leggi(db);
      db.close();
      const ids = new Set(s.x.map(o => o[0]));
      const ce = righe.filter(r => ids.has(r.id) && (r.owned === true || r.doppi > 0)).length, tot = s.x.length;
      if (!ce) continue;
      const riga = document.createElement('div');
      riga.className = 'st-riga-apri' + (ce >= tot ? ' finita' : '');
      riga.innerHTML = '<span class="st-progresso"><i></i></span><span class="st-quanti"></span>';
      riga.querySelector('i').style.width = Math.round(ce * 100 / tot) + '%';
      riga.querySelector('.st-quanti').textContent = ce + ' su ' + tot;
      apri.replaceWith(riga);
      riga.prepend(apri);
    }
  } catch (e) { /* senza indice o archivio leggibile le card restano come sono */ }
}

/* ---------- Categorie fissate in alto (Home) ----------
   Chi ha fatto l'accesso può tenere premuto (mezzo secondo) su una categoria per fissarla in cima
   alla Home; tenendo premuto di nuovo la toglie. La scelta resta SOLO sul dispositivo (localStorage "ct-pin":
   non pesa sul cloud). Il massimo di categorie fissabili lo decidi tu dall'area amministratore
   (Impostazioni sito): sta in index.html, nella lista delle categorie, come data-pin-max="3".
   L'aspetto della categoria fissata è in sito.css (voce "categorie fissate"). */
function pinCategorie() {
  const lista = document.querySelector('ul.st-cards[data-pin-max]');
  if (!lista) return;
  const max = Math.max(0, parseInt(lista.dataset.pinMax, 10) || 3);
  const originali = [...lista.children];                                   // ordine scritto nella pagina
  const chiave = li => (li.querySelector('a.st-card') || {}).href || '';
  const leggiPin = () => { try { return JSON.parse(localStorage.getItem('ct-pin')) || []; } catch (e) { return []; } };
  const salvaPin = v => { try { localStorage.setItem('ct-pin', JSON.stringify(v)); } catch (e) {} };
  const loggato = () => { try { return localStorage.getItem('ct-accesso') === '1'; } catch (e) { return false; } };
  const suggerimento = document.createElement('p');
  suggerimento.className = 'st-pin-hint';
  suggerimento.textContent = 'Tieni premuta una categoria per fissarla in alto (al massimo ' + max + ').';
  lista.before(suggerimento);
  const disegna = () => {
    const si = loggato() && max > 0;
    const fissate = si ? leggiPin().map(h => originali.find(li => chiave(li) === h)).filter(Boolean).slice(0, max) : [];
    lista.replaceChildren(...fissate, ...originali.filter(li => !fissate.includes(li)));
    originali.forEach(li => li.classList.toggle('st-fissata', fissate.includes(li)));
    suggerimento.hidden = !si;
  };
  let timer = null, partito = null, lungo = false;
  const ferma = () => { clearTimeout(timer); timer = null; };
  lista.addEventListener('pointerdown', e => {
    const li = e.target.closest('li');
    if (!li || !loggato() || max < 1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    partito = { x: e.clientX, y: e.clientY }; lungo = false;
    timer = setTimeout(() => {
      lungo = true;
      const h = chiave(li), pin = leggiPin().filter(x => originali.some(o => chiave(o) === x));
      if (pin.includes(h)) { salvaPin(pin.filter(x => x !== h)); avviso('Categoria tolta dalle fissate'); }
      else if (pin.length >= max) { avviso('Puoi fissare al massimo ' + max + ' categorie: togline una tenendola premuta'); return; }
      else { salvaPin([...pin, h]); avviso('Categoria fissata in alto'); }
      disegna();
    }, 550);
  });
  lista.addEventListener('pointermove', e => { if (timer && partito && Math.hypot(e.clientX - partito.x, e.clientY - partito.y) > 8) ferma(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => lista.addEventListener(ev, ferma));
  lista.addEventListener('scroll', ferma, true);
  /* dopo una pressione lunga non apro la categoria, né il menu del telefono */
  lista.addEventListener('click', e => { if (lungo) { e.preventDefault(); e.stopPropagation(); lungo = false; } }, true);
  lista.addEventListener('contextmenu', e => { if (lungo || timer) e.preventDefault(); });
  window.addEventListener('ct-accesso', disegna);
  disegna();
}

/* ---------- Carosello delle Novità (Home) ----------
   Le Novità scorrono di lato (l'aspetto è in sito.css, voce "Novità"): si vedono 4 card per volta
   (4 in fila sul computer, 2 × 2 sul telefono) e le altre arrivano scorrendo, senza cambiare grandezza.
   Qui solo le frecce, che compaiono quando le Novità sono più di quelle visibili. */
function carosello() {
  const ul = document.querySelector('ul.st-novita');
  if (!ul) return;
  ul.parentElement.classList.add('st-car');
  const freccia = (verso, testo) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'st-car-freccia ' + (verso < 0 ? 'prima' : 'dopo'); b.textContent = verso < 0 ? '\u2039' : '\u203A'; b.setAttribute('aria-label', testo);
    b.addEventListener('click', () => ul.scrollBy({ left: verso * ul.clientWidth, behavior: 'smooth' }));
    return b;
  };
  const prima = freccia(-1, 'Novità precedenti'), dopo = freccia(1, 'Novità successive');
  ul.after(prima, dopo);
  const aggiorna = () => {
    const piu = ul.scrollWidth > ul.clientWidth + 2;
    prima.hidden = dopo.hidden = !piu;
    prima.disabled = ul.scrollLeft < 2;
    dopo.disabled = ul.scrollLeft + ul.clientWidth >= ul.scrollWidth - 2;
  };
  ul.addEventListener('scroll', aggiorna, { passive: true });
  window.addEventListener('resize', aggiorna);
  aggiorna();
}

/* ---------- Avvio ---------- */

caricaParte('header-placeholder', 'header.html');
caricaParte('footer-placeholder', 'footer.html');
percorso();
perAnno();          // prima della ricerca: le card vengono spostate nelle tendine
avviaCerca();
barraCategoria();
barreSerie();
attivaAspetto();
pinCategorie();
carosello();

/* ---------- Statistiche delle visite (GoatCounter) ----------
   Conta le pagine viste SENZA cookie e senza dati personali: i numeri si
   vedono su https://collectiontime.goatcounter.com (o dall'area admin).
   Solo sul sito vero (collectiontime.com): le prove sul Mac non contano.
   Per non contare le TUE visite: apri https://collectiontime.com/#toggle-goatcounter
   una volta su ogni tuo dispositivo e premi il pulsante che compare. */
if (/(^|\.)collectiontime\.com$/.test(location.hostname)) {
  const gc = document.createElement('script');
  gc.async = true;
  gc.dataset.goatcounter = 'https://collectiontime.goatcounter.com/count';
  gc.src = 'https://gc.zgo.at/count.js';
  document.head.append(gc);
}
