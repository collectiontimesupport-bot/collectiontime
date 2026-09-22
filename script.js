/* ==========================================================
   script.js — Collection Time
   1) carica lo stile comune (sito.css), header.html e
      footer.html nei segnaposto (Fetch)
   2) fa funzionare Esporta e Importa della banda in alto:
      valgono per TUTTE le collezioni del sito insieme
   3) in ogni pagina "hub" (Home, Legami, e in futuro altre
      sezioni): mostra l'elenco delle schede definito in un
      file .json, così da poter aggiungere nuove sezioni o
      nuovi oggetti senza toccare il codice.
   Da richiamare in ogni pagina con una sola riga:
   <script src="script.js"></script>
   (dentro una sottocartella: <script src="../script.js"></script>)
   ========================================================== */

/* Cartella in cui si trova questo file: sito.css, header.html, footer.html
   e i link vengono cercati da qui, quindi funzionano anche dalle
   pagine dentro le sottocartelle. */
const BASE = new URL('.', document.currentScript.src);

/* ---------- Stile, header e footer ---------- */

/* sito.css: aspetto di header, footer e avvisi, uguale in tutte le pagine */
const stileCaricato = new Promise(fine => {
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('sito.css', BASE);
  l.onload = l.onerror = fine;
  document.head.append(l);
});

async function caricaParte(idSegnaposto, file) {
  const box = document.getElementById(idSegnaposto);
  if (!box) return;                         // la pagina non ha questo segnaposto
  try {
    const res = await fetch(new URL(file, BASE));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    await stileCaricato;                    // così la banda non compare mai senza stile
    box.innerHTML = html;
    sistemaLink(box);
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
   IndexedDB che si chiama "catalogo-…" (per le penne: "catalogo-penne";
   aperto dal tuo computer: "catalogo-penne-anteprima").
   Esporta legge tutti questi archivi e salva UN solo file leggero con,
   per ogni collezione, solo:
     possedute → gli id di ciò che hai segnato "Ce l'ho"
     note      → le note che hai scritto tu        (id → testo)
     hashtag   → gli hashtag che hai cambiato tu   (id → elenco)
   Niente foto, nomi o colori: quelli sono già nelle pagine del sito.
   Esempio:
   {"sito":"Collection Time","versione":1,"data":"2026-09-22",
    "collezioni":{"catalogo-penne":{"possedute":["seed-000","seed-005"],
    "note":{"seed-011":"Comprata a Roma"},"hashtag":{"seed-011":["Natale"]}}}}
   Importa rimette tutto a posto, anche nelle collezioni che in
   questo browser non sono mai state aperte. */

const PREFISSO = 'catalogo-', ANTEPRIMA = '-anteprima', STORE = 'penne';
const sulMioComputer = location.protocol === 'file:' || /\.local$/.test(location.hostname) ||
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);

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
const nomeCollezione = n => n.endsWith(ANTEPRIMA) ? n.slice(0, -ANTEPRIMA.length) : n;
const oggi = () => new Date().toISOString().slice(0, 10);

/* dalle schede salvate nel browser tiene solo spunte, note e hashtag */
function riassumi(penne) {
  const c = {}, note = {}, hashtag = {};
  const possedute = penne.filter(p => p.owned === true).map(p => p.id);
  penne.forEach(p => {
    if (p.notesTouched) note[p.id] = p.notes || '';
    if (p.tagsTouched) hashtag[p.id] = p.tags || [];
  });
  if (possedute.length) c.possedute = possedute;
  if (Object.keys(note).length) c.note = note;
  if (Object.keys(hashtag).length) c.hashtag = hashtag;
  return c;
}

async function esporta() {
  /* per ogni collezione uso l'archivio di questo browser (quello "-anteprima" se c'è) */
  const scelti = new Map();
  (await archivi()).forEach(n => {
    const c = nomeCollezione(n);
    if (!scelti.has(c) || n.endsWith(ANTEPRIMA)) scelti.set(c, n);
  });
  const collezioni = {};
  for (const [c, n] of scelti) {
    const db = await apriArchivio(n);
    const dati = riassumi(await leggi(db));
    db.close();
    if (Object.keys(dati).length) collezioni[c] = dati;
  }
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
  const note = dati.note && typeof dati.note === 'object' ? dati.note : {};
  const hashtag = dati.hashtag && typeof dati.hashtag === 'object' ? dati.hashtag : {};
  const ids = new Set([...possedute, ...Object.keys(note), ...Object.keys(hashtag)]);
  const penne = await leggi(db);
  const perId = new Map(penne.map(p => [p.id, p]));
  const cambiate = penne.filter(p => p.owned && !ids.has(p.id));   // non più segnate nel file
  cambiate.forEach(p => { p.owned = false; });
  ids.forEach(id => {
    const p = perId.get(id) || { id };   // mai vista in questo browser: la completa la pagina della collezione
    p.owned = possedute.has(id);
    if (typeof note[id] === 'string') { p.notes = note[id].slice(0, 2000); p.notesTouched = true; }
    if (Array.isArray(hashtag[id])) { p.tags = hashtag[id].map(String).slice(0, 30); p.tagsTouched = true; }
    cambiate.push(p);
  });
  await scrivi(db, cambiate);
  return possedute.size;
}

async function importa(file) {
  let dati = null;
  try { dati = JSON.parse(await file.text()); } catch (e) { /* non è un file JSON */ }
  let collezioni = dati && dati.collezioni;
  /* vecchi file salvati dalla pagina delle penne ("mie-legami-erasable-….json") */
  if (!collezioni && dati && dati.mode === 'visitor' && Array.isArray(dati.pens)) {
    collezioni = { 'catalogo-penne': riassumi(dati.pens.filter(p => p && typeof p.id === 'string')) };
  }
  if (!collezioni || typeof collezioni !== 'object') return avviso('Questo file non è un backup di Collection Time.');
  const esistenti = new Set(await archivi());
  let tot = 0;
  for (const [c, d] of Object.entries(collezioni)) {
    if (!c.startsWith(PREFISSO) || c.endsWith(ANTEPRIMA) || !d || typeof d !== 'object') continue;
    let nomi = [c, c + ANTEPRIMA].filter(n => esistenti.has(n));
    if (!nomi.length) nomi = sulMioComputer ? [c, c + ANTEPRIMA] : [c];
    let n = 0;
    for (const nome of nomi) {
      const db = await apriArchivio(nome);
      n = await applica(db, d);
      db.close();
    }
    tot += n;
  }
  avviso('Importato: ' + tot + (tot === 1 ? ' oggetto segnato' : ' oggetti segnati') + ' "Ce l\'ho".');
  /* nella pagina di una collezione ricarico, così le spunte si vedono subito */
  if (typeof CONFIG !== 'undefined') setTimeout(() => location.reload(), 1200);
}

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
});
document.addEventListener('change', e => {
  if (e.target.id !== 'stImportaFile') return;
  const file = e.target.files[0];
  e.target.value = '';
  if (file) protetto(importa)(file);
});

/* ---------- Elenco schede (Home, Legami, e future pagine "hub") ----------
   Ogni pagina hub ha un <ul id="cards" data-src="NOMEFILE.json"></ul>.
   Il file json (nella stessa cartella della pagina) ha questa forma:
   {"titolo": "...", "sottotitolo": "...", "schede": [
     {"titolo": "...", "cartella": "...", "descrizione": "...", "immagine": "..."}
   ]}
   "cartella" è il percorso (relativo alla pagina) della sottopagina/sezione:
   per una sezione allo stesso livello: "legami-lampada"
   per risalire e poi scendere in un'altra cartella: "../legami-righello"
*/

async function caricaSchede() {
  const ul = document.getElementById('cards');
  if (!ul) return;                          // questa pagina non è un hub
  const src = ul.dataset.src;
  if (!src) return;
  let data = null;
  if (/^https?:$/.test(location.protocol)) {
    try {
      const res = await fetch(src + '?v=' + Date.now(), { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); if (Array.isArray(d.schede)) data = d; }
    } catch (e) { /* uso i valori già scritti nell'HTML, se ci sono */ }
  }
  if (!data) return;                        // niente file (es. aperto in locale): resta il contenuto di base
  if (data.titolo) document.getElementById('titolo').textContent = data.titolo;
  if (data.sottotitolo) document.getElementById('sottotitolo').textContent = data.sottotitolo;
  const list = data.schede || [];
  const local = location.protocol === 'file:';
  ul.replaceChildren();
  list.forEach(c => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'card';
    const local_suffix = local ? '/index.html' : '/';
    a.href = /\.html?$/i.test(c.cartella) ? c.cartella : c.cartella + local_suffix;
    if (c.immagine) {
      const t = document.createElement('div'); t.className = 'thumb';
      const img = document.createElement('img'); img.src = c.immagine; img.alt = ''; t.append(img); a.append(t);
    }
    const h = document.createElement('h2'); h.textContent = c.titolo; a.append(h);
    if (c.descrizione) { const p = document.createElement('p'); p.textContent = c.descrizione; a.append(p); }
    const o = document.createElement('span'); o.className = 'open'; o.textContent = 'Apri'; a.append(o);
    li.append(a); ul.append(li);
  });
  const vuoto = document.getElementById('empty');
  if (vuoto) vuoto.hidden = list.length > 0;
}

/* ---------- Avvio ---------- */

caricaParte('header-placeholder', 'header.html');
caricaParte('footer-placeholder', 'footer.html');
caricaSchede();
