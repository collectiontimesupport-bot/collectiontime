/* ==========================================================
   script.js — Collection Time
   1) carica header.html e footer.html nei segnaposto (Fetch);
      lo stile comune, sito.css, è richiamato nel <head> di ogni pagina
   2) fa funzionare Esporta e Importa della banda in alto:
      valgono per TUTTE le collezioni del sito insieme
      (+ "Accedi": carica comune/cloud.js solo quando serve)
   3) fa funzionare "Aggiungi alla Home" della banda in basso
   4) apre e chiude la ricerca (la lente) e filtra le card
   5) avviso(testo): l'avviso temporaneo in basso, usato anche da app.js
   6) la barra in basso delle categorie (Serie · Mi mancano · Doppioni · Cerca)
   7) le card divise per anno in tendine (solo le liste con data-per-anno)
   Da richiamare in ogni pagina con una sola riga:
   <script src="script.js?v=2026-09-26"></script>
   (dentro una sottocartella: <script src="../script.js?v=2026-09-26"></script>)
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

/* ---------- Esporta / Importa (tutte le collezioni) ----------
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

/* avviso temporaneo in basso (sparisce dopo 4,5 secondi); l'aspetto è in sito.css */
let avvisoTimer;
function avviso(testo) {
  let el = document.querySelector('.st-avviso');
  if (!el) {
    el = document.createElement('div');
    el.className = 'st-avviso';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = testo;
  el.classList.add('show');
  clearTimeout(avvisoTimer);
  avvisoTimer = setTimeout(() => el.classList.remove('show'), 4500);
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
function segnaAccesso(si) { try { si ? localStorage.setItem('ct-accesso', '1') : localStorage.removeItem('ct-accesso'); } catch (e) {} }
function segnalaModifica() { window.dispatchEvent(new Event('ct-modifica')); }
try { if (localStorage.getItem('ct-accesso') === '1') caricaCloud(); } catch (e) {}

/* i pulsanti arrivano con header.html: li ascolto dal documento */
function protetto(fn) {
  return (...args) => fn(...args).catch(e => {
    console.warn(e);
    avviso('Questo browser non permette di leggere o salvare le collezioni.');
  });
}
document.addEventListener('click', e => {
  if (e.target.closest('#stEsporta')) protetto(esporta)();
  else if (e.target.closest('#stImporta')) document.getElementById('stImportaFile').click();
  else if (e.target.closest('#stAccedi')) caricaCloud().then(m => m.apriAccount(), () => avviso('Non riesco a collegarmi: controlla la connessione e riprova.'));
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
   (legami, lego, kinder, mcdonalds…) aggiunge in fondo allo schermo:
     Serie        → la pagina iniziale della categoria
     Mi mancano   → <categoria>/la-mia-collezione/#/mancanti
     Doppioni     → <categoria>/la-mia-collezione/#/doppioni
     Cerca        → <categoria>/la-mia-collezione/#/cerca
   Così ogni categoria è come una piccola app, e la Home è l'indice delle app.
   Non compare nella Home, nelle pagine di testo (FAQ, Contatti…) e nelle
   cartelle qui sotto, che non sono categorie.
   L'aspetto è in sito.css (voce "barra in basso delle categorie"). */
const NON_CATEGORIE = ['comune', 'icone', 'immagini per mc'];   // cartelle che non sono categorie (e quelle che iniziano con "_")
const ICONE_BARRA = {
  serie: '<path d="M3 5.5c3-1.3 6-1.3 9 .5 3-1.8 6-1.8 9-.5V19c-3-1.3-6-1.3-9 .5-3-1.8-6-1.8-9-.5z"/><path d="M12 6v13.5"/>',
  mancanti: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12h6"/>',
  doppioni: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  cerca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'
};
function barraCategoria() {
  const dentro = location.href.startsWith(BASE.href) ? decodeURIComponent(location.href.slice(BASE.href.length)) : '';
  const cat = dentro.split(/[/?#]/)[0];
  if (!dentro.includes('/') || !cat || cat.startsWith('_') || NON_CATEGORIE.includes(cat)) return;   // non siamo in una categoria
  const lista = new URL(cat + '/la-mia-collezione/index.html', BASE).href;
  const voci = [['serie', 'Serie', new URL(cat + '/index.html', BASE).href],
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
   dalla più recente: l'ordine delle tendine segue l'ordine delle card.
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
    anni.forEach((card, anno) => {
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

/* ---------- Avvio ---------- */

caricaParte('header-placeholder', 'header.html');
caricaParte('footer-placeholder', 'footer.html');
perAnno();          // prima della ricerca: le card vengono spostate nelle tendine
avviaCerca();
barraCategoria();
