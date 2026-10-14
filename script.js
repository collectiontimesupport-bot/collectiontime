
const BASE = new URL('.', document.currentScript.src);
const VERSIONE = new URL(document.currentScript.src).searchParams.get('v') || '';
const conVersione = file => { const u = new URL(file, BASE); if (VERSIONE) u.searchParams.set('v', VERSIONE); return u; };
const scaricaDati = file => fetch(new URL(file, BASE), { cache: 'no-cache' });
let _versioneDati;
const versioneDati = () => _versioneDati || (_versioneDati = (async () => {
  try {
    const r = await fetch(new URL('versione-dati.json', BASE), { cache: 'no-store' });
    if (r.ok) { const v = (await r.json()).indici || {}; try { localStorage.setItem('ct-vdati', JSON.stringify(v)); } catch (e) {} return v; }
  } catch (e) {}
  console.warn('Collection Time: non riesco a leggere versione-dati.json, uso gli ultimi numeri di versione conosciuti: i dati potrebbero non essere aggiornati.');
  try { return JSON.parse(localStorage.getItem('ct-vdati')) || {}; } catch (e) {}
  return {};
})());

if (window.parent !== window) {
  const dillo = () => parent.postMessage({ anteprimaUrl: location.href, titolo: document.title }, '*');
  dillo(); addEventListener('load', dillo);
}

const LINGUA = (() => { try { return localStorage.getItem('ct-lingua') === 'en' ? 'en' : 'it'; } catch (e) { return 'it'; } })();
if (LINGUA === 'en') document.head.append(Object.assign(document.createElement('script'), { src: conVersione('comune/lingua-en.js').href }));


async function caricaParte(idSegnaposto, file) {
  const box = document.getElementById(idSegnaposto);
  if (!box) return;
  try {
    const res = await scaricaDati(file);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    box.innerHTML = html;
    sistemaLink(box);
    nascondiHomeSeInstallato();
    if (file === 'header.html') controllaIscrizione();
  } catch (e) {
    console.warn('Impossibile caricare ' + file + ':', e);
  }
}

function sistemaLink(box) {
  box.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (/^(https?:|mailto:|tel:|#)/i.test(href)) return;
    a.href = new URL(href, BASE).href;
  });
}


const PREFISSO = 'catalogo-', STORE = 'penne';

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

async function applica(db, dati) {
  const soloId = v => Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  const possedute = new Set(soloId(dati.possedute));
  const hashtag = dati.hashtag && typeof dati.hashtag === 'object' ? dati.hashtag : {};
  const doppi = dati.doppi && typeof dati.doppi === 'object' ? dati.doppi : {};
  const quanti = id => Number.isInteger(doppi[id]) && doppi[id] > 0 ? Math.min(doppi[id], 999) : 0;
  const ids = new Set([...possedute, ...Object.keys(hashtag), ...Object.keys(doppi)]);
  const penne = await leggi(db);
  const perId = new Map(penne.map(p => [p.id, p]));
  const cambiate = penne.filter(p => (p.owned || p.doppi) && !ids.has(p.id));
  cambiate.forEach(p => { p.owned = false; p.doppi = 0; });
  ids.forEach(id => {
    const p = perId.get(id) || { id };
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
  try { dati = JSON.parse(await file.text()); } catch (e) {  }
  const collezioni = dati && dati.collezioni;
  if (!collezioni || typeof collezioni !== 'object') return avviso('Questo file non è un backup di Collection Time.');
  const tot = await scriviTutto(collezioni, false);
  segnalaModifica();
  avviso('Importato: ' + tot + (tot === 1 ? ' oggetto segnato' : ' oggetti segnati') + ' "Ce l\'ho".');
  if (typeof CONFIG !== 'undefined') setTimeout(() => location.reload(), 1200);
}

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

let cloud = null;
const caricaCloud = () => cloud || (cloud = import(conVersione('comune/cloud.js').href));
function segnaAccesso(si) {
  let prima = null;
  try { prima = localStorage.getItem('ct-accesso') === '1'; si ? localStorage.setItem('ct-accesso', '1') : localStorage.removeItem('ct-accesso'); } catch (e) {}
  if (prima !== !!si) window.dispatchEvent(new Event('ct-accesso'));
}
function segnalaModifica() { window.dispatchEvent(new Event('ct-modifica')); }
try { if (localStorage.getItem('ct-accesso') === '1') caricaCloud(); } catch (e) {}

let trofei = null;
const caricaTrofei = () => trofei || (trofei = import(conVersione('comune/trofei.js').href));
window.addEventListener('ct-modifica', () => { caricaTrofei().then(m => m.alTocco(), e => console.warn(e)); });

const PAGINE_LIBERE = /(^|\/)(privacy|note-legali|faq|contatti)(\.html)?\/?$/;
const chiediIscrizione = motivo => caricaCloud().then(c => c.richiediIscrizione(motivo), e => console.warn('Iscrizione: cloud.js non caricato', e));
async function contaSpunte() {
  const tutte = await leggiTutto();
  const n = Object.values(tutte).reduce((t, c) => t + (c.possedute || []).length, 0);
  try { localStorage.setItem('ct-prova-spunte', String(n)); } catch (e) {}
  return n;
}
function controllaIscrizione() {
  const m = document.querySelector('meta[name="ct-iscrizione"]');
  const modo = m && m.content;
  if (modo !== 'obbligatoria' && modo !== 'uso') return;
  if (PAGINE_LIBERE.test(location.pathname)) return;
  let prova = false;
  try {
    if (/[?&]iscrizione=prova\b/.test(location.search)) sessionStorage.setItem('ct-iscrizione-prova', '1');
    prova = sessionStorage.getItem('ct-iscrizione-prova') === '1';
  } catch (e) {}
  if (!prova && !/(^|\.)collectiontime\.com$/.test(location.hostname)) return;
  if (modo === 'obbligatoria') return chiediIscrizione('');
  try { if (localStorage.getItem('ct-accesso') === '1') return; } catch (e) { return; }
  const maxSpunte = Math.max(1, +m.dataset.spunte || 30), maxGiorni = Math.max(1, +m.dataset.giorni || 7);
  let inizio = 0, spunte = null, scattata = false;
  try {
    inizio = +localStorage.getItem('ct-prova-inizio') || 0;
    if (!inizio) { inizio = Date.now(); localStorage.setItem('ct-prova-inizio', String(inizio)); }
    const c = localStorage.getItem('ct-prova-spunte'); spunte = c === null ? null : +c;
    scattata = localStorage.getItem('ct-prova-scattata') === '1';
  } catch (e) { return; }
  if (Date.now() - inizio > maxGiorni * 86400000) return chiediIscrizione('giorni');
  if (scattata && spunte !== null && spunte >= maxSpunte) return chiediIscrizione('spunte');
  const verifica = () => contaSpunte().then(n => { if (n >= maxSpunte) { try { localStorage.setItem('ct-prova-scattata', '1'); } catch (e) {} chiediIscrizione('spunte'); } }, e => console.warn(e));
  if (spunte === null) contaSpunte().catch(e => console.warn(e));
  let t = null;
  window.addEventListener('ct-modifica', () => {
    try { if (localStorage.getItem('ct-accesso') === '1') return; } catch (e) { return; }
    clearTimeout(t); t = setTimeout(verifica, 1000);
  });
}

const SETTE_GIORNI = 7 * 24 * 60 * 60 * 1000;
window.addEventListener('ct-modifica', () => {
  try {
    if (localStorage.getItem('ct-accesso') === '1') return;
    if (Date.now() - Number(localStorage.getItem('ct-promemoria') || 0) < SETTE_GIORNI) return;
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

function protetto(fn) {
  return (...args) => fn(...args).catch(e => {
    console.warn(e);
    avviso('Questo browser non permette di leggere o salvare le collezioni.');
  });
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-backup="esporta"]')) protetto(esporta)();
  else if (e.target.closest('[data-backup="importa"]')) document.getElementById('stImportaFile').click();
  else if (e.target.closest('#stAccedi, [data-accedi]')) caricaCloud().then(m => m.apriAccount(), () => avviso('Non riesco a collegarmi: controlla la connessione e riprova.'));
});
document.addEventListener('change', e => {
  if (e.target.id !== 'stImportaFile') return;
  const file = e.target.files[0];
  e.target.value = '';
  if (file) protetto(importa)(file);
});


let invitoInstalla = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); invitoInstalla = e; });
window.addEventListener('appinstalled', () => { invitoInstalla = null; nascondiHomeSeInstallato(true); });

const giaInstallato = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function nascondiHomeSeInstallato(forza) {
  const btn = document.getElementById('stHome');
  if (btn && (forza || giaInstallato())) btn.hidden = true;
}

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
    d.innerHTML = '<h2 id="stGuidaTitolo"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#F2A900"/><path d="M8.22 16.6 13.4 21.6" fill="none" stroke="#1A2140" stroke-width="4.6" stroke-linecap="round"/><path d="M13.4 21.6 24.52 11.23" fill="none" stroke="#1A2140" stroke-width="3.8" stroke-linecap="round"/></svg>Metti Collection Time sulla Home</h2>' +
      '<ol>' + passiHome().map(p => '<li>' + p + '</li>').join('') + '</ol>' +
      '<form method="dialog"><button>Ho capito</button></form>';
    d.addEventListener('click', e => {
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
  invitoInstalla = null;
}
document.addEventListener('click', e => { if (e.target.closest('#stHome')) aggiungiHome(); });


function avviaCerca() {
  const box = document.getElementById('stCerca');
  if (!box) return;
  const btn = box.querySelector('button'), campo = box.querySelector('input');
  const scritta = box.parentElement.querySelector('.st-sub > .sub');
  const card = [...document.querySelectorAll('.st-cards > li')];
  const nessuna = document.querySelector('.st-nessuna');
  const semplice = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function filtra() {
    const parole = semplice(campo.value).split(/\s+/).filter(Boolean);
    let visibili = 0;
    card.forEach(li => {
      const testo = semplice(li.textContent + ' ' + (li.dataset.cerca || ''));
      li.hidden = !parole.every(p => testo.includes(p));
      if (!li.hidden) visibili++;
    });
    if (nessuna) nessuna.hidden = visibili > 0;
    document.querySelectorAll('.st-estero').forEach(s => { s.hidden = ![...s.querySelectorAll('li')].some(li => !li.hidden); });
    aggiornaAnni(parole.length > 0);
  }
  function apri() { box.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); campo.tabIndex = 0; campo.focus(); }
  function chiudi() {
    if (campo.value.trim()) return;
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

const CATALOGO = new URL('catalogo/', BASE).href;
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
  if (!dentro.includes('/') || !cat || cat.startsWith('_')) return;
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
  const accendi = () => {
    const attiva = dentro.includes('/la-mia-collezione/') ? (location.hash.replace(/^#\/?/, '') || 'mancanti') : 'serie';
    nav.querySelectorAll('a').forEach(a => a.dataset.voce === attiva ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  };
  accendi();
  window.addEventListener('hashchange', accendi);
}

function perAnno() {
  document.querySelectorAll('ul.st-cards[data-per-anno]').forEach(lista => {
    const anni = new Map();
    const senzaAnno = [];
    [...lista.children].forEach(li => {
      const trovato = (li.querySelector('p') || li).textContent.match(/(?:^|\D)((?:19|20)\d{2})(?!\d)/);
      if (!trovato) return senzaAnno.push(li);
      if (!anni.has(trovato[1])) anni.set(trovato[1], []);
      anni.get(trovato[1]).push(li);
    });
    const box = document.createElement('div');
    box.className = 'st-anni';
    [...anni].sort((a, b) => b[0] - a[0]).forEach(([anno, card]) => {
      const d = document.createElement('details');
      d.className = 'st-anno';
      d.innerHTML = '<summary><span class="st-anno-num">' + anno + '</span><span class="st-anno-quante">' + card.length + ' serie</span></summary>';
      const ul = document.createElement('ul');
      ul.className = 'st-cards';
      ul.append(...card.filter(li => !eEstera(li)));
      if (ul.children.length) d.append(ul);
      const estere = card.filter(eEstera);
      if (estere.length) d.append(sezioneEstere(estere));
      box.append(d);
    });
    lista.after(box);
    if (anni.size > 1) {
      const tutte = document.createElement('button');
      tutte.type = 'button';
      tutte.className = 'st-anni-tutte';
      const visibili = () => [...box.querySelectorAll('.st-anno')].filter(d => !d.hidden);
      const aggiorna = () => {
        const aperte = visibili().every(d => d.open);
        tutte.setAttribute('aria-pressed', aperte);
        tutte.textContent = aperte ? 'Chiudi tutte le tendine' : 'Apri tutte le tendine';
      };
      tutte.addEventListener('click', () => { const apri = tutte.getAttribute('aria-pressed') !== 'true'; visibili().forEach(d => { d.open = apri; }); aggiorna(); });
      box.addEventListener('toggle', aggiorna, true);
      aggiorna();
      box.before(tutte);
    }
    if (senzaAnno.length) lista.replaceChildren(...senzaAnno);
    else lista.remove();
  });
}
function aggiornaAnni(cercando) {
  document.querySelectorAll('.st-anno').forEach(d => {
    const visibili = [...d.querySelectorAll('.st-cards > li')].some(li => !li.hidden);
    d.hidden = cercando && !visibili;
    if (cercando) { if (!('prima' in d.dataset)) d.dataset.prima = d.open ? '1' : ''; d.open = true; }
    else if ('prima' in d.dataset) { d.open = d.dataset.prima === '1'; delete d.dataset.prima; }
  });
}

const NOMI_CATEGORIE = {
  'burger-king': 'Burger King', 'coolthings': 'Cool Things', 'eurospin': 'Eurospin', 'granterre': 'GranTerre', 'kinder': 'Kinder Ferrero', 'legami': 'Legami',
  'lego': 'LEGO Minifigures', 'lidl': 'Lidl', 'mcdonalds': "McDonald's", 'mulino-bianco': 'Mulino Bianco'
};
function percorso() {
  const back = document.querySelector('a.st-back');
  if (!back) return;
  const cartelle = dentroCatalogo().split(/[?#]/)[0].split('/').filter(c => c && c !== 'index.html');
  const cat = cartelle[0] || '';
  if (cartelle.length < 2 || cat.startsWith('_')) return;
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

function temaScelto() { try { return localStorage.getItem('ct-tema') || 'auto'; } catch (e) { return 'auto'; } }
function attivaAspetto() {
  const pulsanti = [...document.querySelectorAll('.st-aspetto button')];
  if (!pulsanti.length) return;
  const segna = t => pulsanti.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tema === t)));
  segna(temaScelto());
  pulsanti.forEach(b => b.addEventListener('click', () => {
    try { localStorage.setItem('ct-tema', b.dataset.tema); } catch (e) {}
    document.documentElement.dataset.tema = b.dataset.tema;
    segna(b.dataset.tema);
  }));
}

async function barreSerie() {
  const dentro = dentroCatalogo(), cat = dentro.split(/[/?#]/)[0];
  const card = [...document.querySelectorAll('a.st-card')];
  if (!cat || cat.startsWith('_') || dentro.includes('/la-mia-collezione/') || !card.length || !window.indexedDB || !indexedDB.databases) return;
  try {
    const miei = new Set(await archivi());
    if (!miei.size) return;
    const vd = (await versioneDati())[cat] || VERSIONE;
    await new Promise((ok, ko) => {
      const js = document.createElement('script');
      js.src = new URL(cat + '/la-mia-collezione/indice.js?v=' + vd, CATALOGO).href;
      js.onload = ok; js.onerror = ko;
      document.head.append(js);
    });
    const I = INDICE;
    const perIndirizzo = new Map(I.serie.map(s => [new URL(cat + '/' + s.p + '/', CATALOGO).href, s]));
    for (const a of card) {
      const s = perIndirizzo.get(a.href.replace(/index\.html$/, '')), apri = a.querySelector('.st-apri');
      if (!s || !apri || !miei.has(s.db)) continue;
      const db = await apriArchivio(s.db), righe = await leggi(db);
      db.close();
      const ids = new Set(s.x.filter(o => !paeseEstero(o[5])).map(o => o[0]));
      const ce = righe.filter(r => ids.has(r.id) && (r.owned === true || r.doppi > 0)).length, tot = ids.size;
      if (!ce) continue;
      const riga = document.createElement('div');
      riga.className = 'st-riga-apri' + (ce >= tot ? ' finita' : '');
      riga.innerHTML = '<span class="st-progresso"><i></i></span><span class="st-quanti"></span>';
      riga.querySelector('i').style.width = Math.round(ce * 100 / tot) + '%';
      riga.querySelector('.st-quanti').textContent = ce + ' su ' + tot;
      apri.replaceWith(riga);
      riga.prepend(apri);
    }
  } catch (e) {  }
}

function pinCategorie() {
  const lista = document.querySelector('ul.st-cards[data-pin-max]');
  if (!lista) return;
  const max = Math.max(0, parseInt(lista.dataset.pinMax, 10) || 3);
  const originali = [...lista.children];
  const chiave = li => (li.querySelector('a.st-card') || {}).href || '';
  const leggiPin = () => { try { return JSON.parse(localStorage.getItem('ct-pin')) || []; } catch (e) { return []; } };
  const salvaPin = v => { try { localStorage.setItem('ct-pin', JSON.stringify(v)); } catch (e) {} };
  const inLocale = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const loggato = () => { if (inLocale) return true; try { return localStorage.getItem('ct-accesso') === '1'; } catch (e) { return false; } };
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
    originali.forEach(li => { const d = li.querySelector('.st-pin-dots'); if (d) d.hidden = !si; });
  };

  originali.forEach(li => {
    const d = document.createElement('button');
    d.type = 'button'; d.className = 'st-pin-dots'; d.hidden = true;
    d.setAttribute('aria-label', 'Altre azioni'); d.setAttribute('aria-haspopup', 'menu');
    d.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="19" r="2" fill="currentColor"/></svg>';
    d.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (menu && menuLi === li) { chiudi(false); return; }
      const r = d.getBoundingClientRect();
      apriMenu(li, r.left + r.width / 2, r.top, r);
    });
    li.append(d);
  });

  let menu = null, menuLi = null, apertoAlle = 0;
  const chiudi = (ridaiFuoco) => {
    if (!menu) return;
    const li = menuLi;
    menu.remove(); menu = null; menuLi = null;
    if (li) li.classList.remove('st-premendo', 'st-menu-aperto');
    document.removeEventListener('pointerdown', fuori, true);
    document.removeEventListener('keydown', tasto, true);
    window.removeEventListener('scroll', chiudiSubito, true);
    window.removeEventListener('resize', chiudiSubito);
    if (ridaiFuoco && li) { const a = li.querySelector('a.st-card'); if (a) a.focus({ preventScroll: true }); }
  };
  const chiudiSubito = () => { if (Date.now() - apertoAlle > 400) chiudi(false); };
  const fuori = e => { if (menu && !menu.contains(e.target) && !(menuLi && menuLi.querySelector('.st-pin-dots').contains(e.target))) chiudi(false); };
  const tasto = e => { if (e.key === 'Escape') { e.preventDefault(); chiudi(true); } };
  const apriMenu = (li, x, y, ancora) => {
    if (menu && menuLi === li) return;
    chiudi(false);
    const h = chiave(li), pin = leggiPin().filter(k => originali.some(o => chiave(o) === k));
    const giaFissata = pin.includes(h), pieno = !giaFissata && pin.length >= max;
    menu = document.createElement('div');
    menu.className = 'st-pin-menu';
    menu.setAttribute('role', 'menu');
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem');
    b.innerHTML = '<span class="st-pin-ico" aria-hidden="true"></span><span></span>';
    b.lastChild.textContent = giaFissata ? 'Togli dai fissati' : 'Fissa in alto';
    if (giaFissata) b.classList.add('toglie');
    if (pieno) {
      b.disabled = true;
      const nota = document.createElement('p');
      nota.className = 'st-pin-nota';
      nota.textContent = 'Hai già fissato il massimo (' + max + '): togline una prima';
      menu.append(b, nota);
    } else menu.append(b);
    b.addEventListener('click', () => {
      if (Date.now() - apertoAlle < 350) return;
      if (giaFissata) { salvaPin(pin.filter(k => k !== h)); avviso('Categoria tolta dalle fissate'); }
      else { salvaPin([...pin, h]); avviso('Categoria fissata in alto'); }
      chiudi(false);
      disegna();
    });
    document.body.append(menu);
    menuLi = li; apertoAlle = Date.now();
    li.classList.add('st-menu-aperto');
    const r = li.getBoundingClientRect();
    if (!(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) { x = r.left + 24; y = r.top + r.height / 2; }
    const w = menu.offsetWidth, hh = menu.offsetHeight, m = 8;
    const sx = Math.min(Math.max(m, x - w / 2), window.innerWidth - w - m);
    let sy = y + 18;
    if (sy + hh > window.innerHeight - m) sy = y - hh - 18;
    if (ancora) {
      const sxA = Math.min(Math.max(m, ancora.right - w), window.innerWidth - w - m);
      const syA = ancora.top - hh - 6 >= m ? ancora.top - hh - 6 : ancora.bottom + 6;
      menu.style.left = sxA + 'px'; menu.style.top = syA + 'px';
    } else { menu.style.left = sx + 'px'; menu.style.top = Math.max(m, sy) + 'px'; }
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    document.addEventListener('pointerdown', fuori, true);
    document.addEventListener('keydown', tasto, true);
    window.addEventListener('scroll', chiudiSubito, true);
    window.addEventListener('resize', chiudiSubito);
  };

  let timer = null, partito = null, lungo = false, premuto = null;
  const ferma = () => {
    clearTimeout(timer); timer = null;
    if (premuto && premuto !== menuLi) premuto.classList.remove('st-premendo');
    premuto = null;
  };
  lista.addEventListener('pointerdown', e => {
    const li = e.target.closest('li');
    if (!li || e.target.closest('.st-pin-dots') || !loggato() || max < 1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    partito = { x: e.clientX, y: e.clientY }; lungo = false;
    premuto = li; li.classList.add('st-premendo');
    const x = e.clientX, y = e.clientY;
    timer = setTimeout(() => { timer = null; lungo = true; apriMenu(li, x, y); }, 550);
  });
  lista.addEventListener('pointermove', e => { if (timer && partito && Math.hypot(e.clientX - partito.x, e.clientY - partito.y) > 8) ferma(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => lista.addEventListener(ev, ferma));
  lista.addEventListener('scroll', ferma, true);
  lista.addEventListener('click', e => { if (lungo) { e.preventDefault(); e.stopPropagation(); lungo = false; } }, true);
  lista.addEventListener('contextmenu', e => {
    const li = e.target.closest('li');
    if (!li || !loggato() || max < 1) { if (lungo || timer) e.preventDefault(); return; }
    e.preventDefault();
    ferma(); lungo = true;
    apriMenu(li, e.clientX, e.clientY);
  });
  window.addEventListener('ct-accesso', () => { chiudi(false); disegna(); });
  disegna();
}

function carosello() {
  const PER_BLOCCO = 4, SECONDI_AUTO = 8, PAUSA_TOCCO = 10;
  const ul = document.querySelector('ul.st-novita');
  if (!ul) return;
  const riquadro = ul.parentElement;
  riquadro.classList.add('st-car');
  const originali = [...ul.children];
  const blocchi = Math.ceil(originali.length / PER_BLOCCO);
  if (blocchi < 2) return;
  const giro = Array.from({ length: blocchi * PER_BLOCCO }, (_, i) => i < originali.length ? originali[i] : originali[i % originali.length].cloneNode(true));
  const copie = giro.map(li => li.cloneNode(true));
  [...giro.slice(originali.length), ...copie].forEach(li => {
    if (!originali.includes(li)) { li.setAttribute('aria-hidden', 'true'); li.querySelectorAll('a').forEach(a => a.tabIndex = -1); }
  });
  ul.append(...giro.slice(originali.length), ...copie);
  const card = [...ul.children];

  const freccia = (verso, testo) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'st-car-freccia ' + (verso < 0 ? 'prima' : 'dopo');
    b.textContent = verso < 0 ? '‹' : '›'; b.setAttribute('aria-label', testo);
    b.addEventListener('click', () => vai(attuale() + verso));
    return b;
  };
  const pallini = document.createElement('div');
  pallini.className = 'st-car-pallini';
  const punti = Array.from({ length: blocchi }, (_, k) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', 'Novità, blocco ' + (k + 1) + ' di ' + blocchi);
    b.addEventListener('click', () => vai(k));
    pallini.append(b);
    return b;
  });
  ul.after(freccia(-1, 'Novità precedenti'), freccia(1, 'Novità successive'), pallini);

  const inizio = k => card[k * PER_BLOCCO].offsetLeft - card[0].offsetLeft;
  const massimo = () => ul.scrollWidth - ul.clientWidth;
  const periodo = () => inizio(blocchi);
  const salta = px => { ul.style.scrollSnapType = 'none'; ul.scrollLeft += px; ul.style.scrollSnapType = ''; };
  const attuale = () => {
    let meglio = 0, dist = Infinity;
    for (let k = 0; k <= blocchi; k++) { const d = Math.abs(Math.min(inizio(k), massimo()) - ul.scrollLeft); if (d < dist) { dist = d; meglio = k; } }
    return meglio % blocchi;
  };
  const vai = k => {
    if (k < 0) { salta(periodo()); k = blocchi - 1; }
    k = Math.min(k, blocchi);
    ul.scrollTo({ left: Math.min(inizio(k), massimo()), behavior: 'smooth' });
  };
  let tocco = false, rientro;
  const riavvolgi = () => { if (!tocco && ul.scrollLeft >= periodo() - 2) salta(-periodo()); };
  const aggiorna = () => { const a = attuale(); punti.forEach((b, k) => b.classList.toggle('attivo', k === a)); clearTimeout(rientro); rientro = setTimeout(riavvolgi, 150); };
  ul.addEventListener('scroll', aggiorna, { passive: true });
  ul.addEventListener('touchstart', () => { tocco = true; }, { passive: true });
  ul.addEventListener('touchend', () => { tocco = false; clearTimeout(rientro); rientro = setTimeout(riavvolgi, 150); }, { passive: true });
  window.addEventListener('resize', aggiorna);
  aggiorna();

  if (!SECONDI_AUTO) return;
  let fermo = false, ripresa;
  const ferma = () => { clearTimeout(ripresa); fermo = true; };
  const riparti = (dopo = 0) => { clearTimeout(ripresa); ripresa = setTimeout(() => { fermo = false; }, dopo * 1000); };
  riquadro.addEventListener('mouseenter', ferma);
  riquadro.addEventListener('mouseleave', () => riparti());
  riquadro.addEventListener('focusin', ferma);
  riquadro.addEventListener('focusout', () => riparti());
  riquadro.addEventListener('touchstart', ferma, { passive: true });
  riquadro.addEventListener('touchend', () => riparti(PAUSA_TOCCO), { passive: true });
  setInterval(() => { if (!fermo && !document.hidden) vai(attuale() + 1); }, SECONDI_AUTO * 1000);
}

const PAESI = ('AE AL AR AT AU BA BE BG BR BY CA CH CL CN CO CY CZ DE DK EE EG ES FI FR GB GR HK HR HU ID IE IL IN IS IT JP KR LT LU LV MA ME MK MT MX MY NL NO NZ PE PH PL PT RO RS RU SA SE SG SI SK TH TR TW UA US UY VN ZA').split(' ');
const TZ_PAESE = {
  'Europe/Rome': 'IT', 'Europe/Vatican': 'IT', 'Europe/San_Marino': 'IT', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES', 'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Lisbon': 'PT', 'Europe/Brussels': 'BE', 'Europe/Amsterdam': 'NL',
  'Europe/Vienna': 'AT', 'Europe/Zurich': 'CH', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO',
  'Europe/Athens': 'GR', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Istanbul': 'TR',
  'Europe/Kiev': 'UA', 'Europe/Kyiv': 'UA', 'Europe/Moscow': 'RU', 'Europe/Belgrade': 'RS', 'Europe/Zagreb': 'HR', 'Europe/Ljubljana': 'SI',
  'Europe/Bratislava': 'SK', 'Europe/Sofia': 'BG', 'Europe/Luxembourg': 'LU', 'Europe/Malta': 'MT',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Phoenix': 'US',
  'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Mexico_City': 'MX',
  'America/Sao_Paulo': 'BR', 'America/Argentina/Buenos_Aires': 'AR', 'America/Santiago': 'CL', 'America/Bogota': 'CO', 'America/Lima': 'PE',
  'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Singapore': 'SG', 'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN', 'Asia/Dubai': 'AE', 'Asia/Jerusalem': 'IL', 'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU',
  'Pacific/Auckland': 'NZ', 'Africa/Johannesburg': 'ZA', 'Africa/Casablanca': 'MA', 'Africa/Cairo': 'EG',
  'Europe/Tirane': 'AL', 'Europe/Sarajevo': 'BA', 'Europe/Skopje': 'MK', 'Europe/Podgorica': 'ME', 'Europe/Riga': 'LV', 'Europe/Vilnius': 'LT', 'Europe/Tallinn': 'EE',
  'Europe/Minsk': 'BY', 'Asia/Nicosia': 'CY', 'Europe/Nicosia': 'CY', 'Atlantic/Reykjavik': 'IS', 'Atlantic/Madeira': 'PT', 'Atlantic/Azores': 'PT', 'Europe/Busingen': 'CH',
  'Asia/Bangkok': 'TH', 'Asia/Manila': 'PH', 'Asia/Jakarta': 'ID', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN', 'Asia/Taipei': 'TW', 'Asia/Riyadh': 'SA',
  'America/Montevideo': 'UY', 'America/Halifax': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Detroit': 'US', 'America/Boise': 'US',
  'America/Argentina/Cordoba': 'AR', 'America/Monterrey': 'MX', 'America/Tijuana': 'MX', 'Australia/Perth': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Adelaide': 'AU', 'Australia/Hobart': 'AU'
};
const ALIAS_PAESI = { 'usa': 'US', 'u.s.a.': 'US', 'stati uniti': 'US', 'stati uniti d\'america': 'US', 'uk': 'GB', 'inghilterra': 'GB', 'gran bretagna': 'GB',
  'regno unito': 'GB', 'corea': 'KR', 'corea del sud': 'KR', 'emirati': 'AE', 'repubblica ceca': 'CZ', 'olanda': 'NL' };
const senzaAccenti = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function paeseRilevato() {
  let fuso = '';
  try { fuso = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
  if (TZ_PAESE[fuso]) return TZ_PAESE[fuso];
  for (const l of (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])) {
    const r = /-([A-Za-z]{2})$/.exec(l || '');
    if (r && PAESI.includes(r[1].toUpperCase())) return r[1].toUpperCase();
  }
  return 'IT';
}
function paeseIncerto() {
  let fuso = '';
  try { fuso = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
  if (TZ_PAESE[fuso]) return false;
  for (const l of (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])) {
    const r = /-([A-Za-z]{2})$/.exec(l || '');
    if (r && PAESI.includes(r[1].toUpperCase())) return false;
  }
  return true;
}
function paeseScelto() { try { const c = localStorage.getItem('ct-paese'); return PAESI.includes(c) ? c : ''; } catch (e) { return ''; } }
function paeseVisitatore() { return paeseScelto() || paeseRilevato(); }
let nomiPaesiCache = null;
function nomiPaesi() {
  if (!nomiPaesiCache) {
    let nomi = null;
    try { nomi = new Intl.DisplayNames(['it'], { type: 'region' }); } catch (e) {}
    nomiPaesiCache = PAESI.map(c => [c, nomi ? nomi.of(c) : c]).sort((a, b) => a[1].localeCompare(b[1], 'it'));
  }
  return nomiPaesiCache;
}
function codicePaese(testo) {
  const t = senzaAccenti(testo || '');
  if (!t) return '';
  if (ALIAS_PAESI[t]) return ALIAS_PAESI[t];
  const trovato = nomiPaesi().find(([c, n]) => senzaAccenti(n) === t || c.toLowerCase() === t);
  return trovato ? trovato[0] : '';
}
const GRUPPI_PAESI = {
  'europa': 'AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LT LU LV ME MK MT NL NO PL PT RO RS RU SE SI SK TR UA',
  'asia': 'AE CN HK ID IL IN JP KR MY PH SA SG TH TW VN',
  'america del nord': 'CA MX US',
  'america latina': 'AR BR CL CO MX PE UY',
  'oceania': 'AU NZ',
  'africa': 'EG MA ZA',
  'occidente': 'AT AU BE BG CA CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LT LU LV MT NL NO NZ PL PT RO SE SI SK US'
};
function paeseCoincide(testo) {
  const mio = paeseVisitatore();
  return String(testo).split(/[,;]/).some(p => (GRUPPI_PAESI[senzaAccenti(p)] || '').split(' ').includes(mio) || codicePaese(p) === mio);
}
function paeseEstero(testo) { return !!testo && !paeseCoincide(testo); }

const eEstera = li => paeseEstero(li.dataset.paese);
function sezioneEstere(card) {
  const box = document.createElement('section');
  box.className = 'st-estero';
  box.innerHTML = '<h2 class="st-estero-titolo">Estero</h2><ul class="st-cards"></ul>';
  box.querySelector('ul').append(...card);
  return box;
}
function serieEstere() {
  document.querySelectorAll('ul.st-cards').forEach(lista => {
    if (lista.closest('.st-anno, .st-estero')) return;
    const estere = [...lista.children].filter(eEstera);
    if (estere.length) lista.after(sezioneEstere(estere));
  });
}

function attivaPaese() {
  const m = document.getElementById('stPaese');
  if (!m) return;
  let nomi = null;
  try { nomi = new Intl.DisplayNames([LINGUA], { type: 'region' }); } catch (e) {}
  const voci = nomiPaesi().map(([c, n]) => [c, nomi ? nomi.of(c) : n]).sort((a, b) => a[1].localeCompare(b[1], LINGUA));
  m.innerHTML = voci.map(([c, n]) => '<option value="' + c + '">' + n + '</option>').join('');
  m.value = paeseVisitatore();
  m.addEventListener('change', () => {
    try { localStorage.setItem('ct-paese', m.value); } catch (e) {}
    segnalaModifica();
    avviso('Paese salvato.');
  });
}

function scegliLingua(l) { try { localStorage.setItem('ct-lingua', l); } catch (e) {} location.reload(); }
function attivaLingua() {
  const m = document.getElementById('stLinguaMenu');
  if (m) { m.value = LINGUA; m.addEventListener('change', () => scegliLingua(m.value)); }
  document.addEventListener('click', e => {
    if (e.target.closest('#stLingua')) { e.preventDefault(); scegliLingua(LINGUA === 'en' ? 'it' : 'en'); }
  });
}


caricaParte('header-placeholder', 'header.html');
caricaParte('footer-placeholder', 'footer.html');
percorso();
perAnno();
serieEstere();
avviaCerca();
barraCategoria();
barreSerie();
attivaAspetto();
attivaPaese();
attivaLingua();
pinCategorie();
carosello();

if (/(^|\.)collectiontime\.com$/.test(location.hostname)) {
  const gc = document.createElement('script');
  gc.async = true;
  gc.dataset.goatcounter = 'https://collectiontime.goatcounter.com/count';
  gc.src = 'https://gc.zgo.at/count.js';
  document.head.append(gc);
}

document.querySelectorAll('a[data-proponi]').forEach(a => {
  const cat = a.dataset.proponi;
  a.href = 'mailto:' + 'collectiontime.support' + '@' + 'gmail.com'
    + '?subject=' + encodeURIComponent('Il mio gruppo su ' + cat + ' · Collection Time')
    + '&body=' + encodeURIComponent('Ciao! Ho un gruppo dedicato a ' + cat + ' e vorrei proporlo.\n\nNome del gruppo:\nSocial (Facebook, WhatsApp, Telegram…):\nLink per entrare:\nDi cosa si parla:\n');
});


document.addEventListener('contextmenu', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
document.addEventListener('dragstart', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
