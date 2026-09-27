/* =====================================================================
   admin.js — i pulsanti dell'area amministratore (Collection Time)
   ---------------------------------------------------------------------
   Le parti, nell'ordine:
     0) aiuti, cartella del sito (collegarla e ricordarla), file e copie
     1) foto: ritaglio, misure, WebP (le stesse misure degli altri strumenti)
     2) lettura di tutto il sito (categorie → gruppi → serie)
     3) schede: Inizio · Pagine e card · Modifica serie · Nuova serie ·
        Aggiorna catalogo · Strumenti   (Statistiche è in statistiche.js)
   Il testo delle pagine lo legge e riscrive motore.js (Motore.…).
   ===================================================================== */

const $ = id => document.getElementById(id);
const M = Motore;

/* ---------- misure delle foto (uguali allo strumento LEGO) ---------- */
const GRANDE = 560;        // foto di un pezzo: 560 × 560
const PICCOLA = 160;       // copia piccola per le pagine "Vedi tutti": 160 × 160
const COP_ALTA = 360;      // copertina della card: alta al massimo 360…
const COP_LARGA = 760;     // …e larga al massimo 760 (nella card è alta 170: così è nitida anche sui telefoni)
const QUALITA = 0.84;      // qualità WebP (0–1)

/* =====================================================================
   0) AIUTI, CARTELLA, FILE
   ===================================================================== */
let cartella = null;        // la cartella del sito (collection time website)
let sito = null;            // tutto il sito letto: { categorie, liste, serie }
let versioni = null;        // Strumenti: file .js/.css → { v: date trovate, pagine }

function messaggio(el, testo, tipo) { el.hidden = false; el.className = 'msg' + (tipo ? ' ' + tipo : ''); el.textContent = testo; }
function esc(t) { return M.codifica(t ?? ''); }
const senzaV = p => String(p || '').replace(/\?.*$/, '');
const pad = (n, cifre) => String(n).padStart(cifre, '0');

/* la cartella scelta la ricordo nel browser (IndexedDB), così la volta dopo basta un clic */
function memoria() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('ct-admin', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('cose');
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  });
}
async function ricorda(chiave, valore) {
  try { const d = await memoria(); d.transaction('cose', 'readwrite').objectStore('cose').put(valore, chiave); } catch (e) {}
}
async function ricordato(chiave) {
  try {
    const d = await memoria();
    return await new Promise(ok => { const g = d.transaction('cose').objectStore('cose').get(chiave); g.onsuccess = () => ok(g.result); g.onerror = () => ok(null); });
  } catch (e) { return null; }
}

async function dir(percorso, crea = false) {
  let d = cartella;
  for (const nome of String(percorso).split('/').filter(Boolean)) d = await d.getDirectoryHandle(nome, { create: crea });
  return d;
}
function dividi(percorso) { const i = percorso.lastIndexOf('/'); return [percorso.slice(0, Math.max(i, 0)), percorso.slice(i + 1)]; }
async function prendiFile(percorso) {
  try { const [c, n] = dividi(senzaV(percorso)); return await (await (await dir(c)).getFileHandle(n)).getFile(); } catch (e) { return null; }
}
async function leggi(percorso) { const f = await prendiFile(percorso); return f ? f.text() : null; }
async function esisteCartella(percorso) { try { await dir(percorso); return true; } catch (e) { return false; } }
/* scrive un file; se c'era già, prima ne salva una copia in _backup/admin/<oggi>/…
   (una sola copia al giorno per file: resta la versione di stamattina) */
async function scrivi(percorso, dati) {
  percorso = senzaV(percorso);
  const [c, n] = dividi(percorso);
  const vecchio = await prendiFile(percorso);
  if (vecchio) {
    const dove = await dir('_backup/admin/' + M.oggi() + '/' + c, true);
    let gia = true; try { await dove.getFileHandle(n); } catch (e) { gia = false; }
    if (!gia) { const w = await (await dove.getFileHandle(n, { create: true })).createWritable(); await w.write(vecchio); await w.close(); }
  }
  const w = await (await (await dir(c, true)).getFileHandle(n, { create: true })).createWritable();
  await w.write(dati); await w.close();
}
/* anteprima di una foto del sito (senza "?v=") */
const cacheFoto = new Map();
async function urlFoto(percorso) {
  percorso = senzaV(percorso);
  if (!cacheFoto.has(percorso)) {
    const f = await prendiFile(percorso);
    cacheFoto.set(percorso, f ? URL.createObjectURL(f) : '');
  }
  return cacheFoto.get(percorso);
}
/* riempie le <img data-foto="percorso"> dopo averle disegnate */
async function caricaAnteprime(box) {
  for (const img of box.querySelectorAll('img[data-foto]')) {
    const u = await urlFoto(img.dataset.foto);
    if (u) img.src = u; else img.replaceWith(Object.assign(document.createElement('span'), { className: 'senza-foto', textContent: 'manca la foto' }));
  }
}

/* ---------- collegare la cartella ---------- */
if (!window.showDirectoryPicker) { $('noChrome').hidden = false; $('btnCartella').disabled = true; }
async function usaCartella(d) {
  let ok = false;
  try { await d.getFileHandle('index.html'); await d.getDirectoryHandle('comune'); ok = true; } catch (e) {}
  if (!ok) { alert('Questa non sembra la cartella del sito: dentro devono esserci index.html e la cartella "comune". Scegli "collection time website".'); return false; }
  cartella = d;
  ricorda('cartella', d);
  $('statoCartella').textContent = '✓ ' + d.name;
  $('btnCartella').textContent = 'Cambia cartella';
  $('primoPasso').hidden = true;
  await rileggiSito();
  return true;
}
$('btnCartella').addEventListener('click', async () => {
  const vecchia = !cartella && await ricordato('cartella');
  if (vecchia) {
    try { if ((await vecchia.requestPermission({ mode: 'readwrite' })) === 'granted' && await usaCartella(vecchia)) return; } catch (e) {}
  }
  try { const d = await showDirectoryPicker({ id: 'collectiontime', mode: 'readwrite' }); await usaCartella(d); }
  catch (e) { if (e.name !== 'AbortError') alert('Non riesco ad aprire la cartella: ' + e.message); }
});
/* all'apertura: se la cartella è già permessa la uso subito, se no il pulsante dice "Riapri" */
(async () => {
  const vecchia = await ricordato('cartella');
  if (!vecchia) return;
  try {
    if ((await vecchia.queryPermission({ mode: 'readwrite' })) === 'granted') { await usaCartella(vecchia); return; }
  } catch (e) {}
  $('btnCartella').textContent = 'Riapri la cartella “' + vecchia.name + '”';
})();

/* =====================================================================
   1) FOTO
   ===================================================================== */
function caricaImmagine(blob) {
  return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Immagine non leggibile')); i.src = URL.createObjectURL(blob); });
}
function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function aWebp(c, q = QUALITA) {
  return new Promise((ok, ko) => c.toBlob(b => (b && b.type === 'image/webp') ? ok(b) : ko(new Error('Questo browser non sa creare WebP: usa Chrome.')), 'image/webp', q));
}
/* bordi della parte visibile (non trasparente); se la foto non ha trasparenza, tutta la foto */
function bordi(img) {
  const c = tela(img.naturalWidth, img.naturalHeight), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let k = 0; k < c.width; k++) {
    if (d[(y * c.width + k) * 4 + 3] > 30) { if (k < x0) x0 = k; if (k > x1) x1 = k; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}
/* foto di un pezzo: la parte visibile al 92% di un quadrato 560 × 560, al centro (+ copia piccola 160) */
async function fotoPezzo(file) {
  const img = await caricaImmagine(file);
  const b = bordi(img); if (!b) throw new Error('La foto è tutta trasparente.');
  const w = b.x1 - b.x0, h = b.y1 - b.y0, S = Math.max(w, h) / 0.92;
  const g = tela(GRANDE, GRANDE), gx = g.getContext('2d');
  gx.imageSmoothingQuality = 'high';
  gx.drawImage(img, b.x0 - (S - w) / 2, b.y0 - (S - h) / 2, S, S, 0, 0, GRANDE, GRANDE);
  const p = tela(PICCOLA, PICCOLA), px = p.getContext('2d');
  px.imageSmoothingQuality = 'high';
  px.drawImage(g, 0, 0, PICCOLA, PICCOLA);
  return { grande: await aWebp(g), piccola: await aWebp(p, 0.8) };
}
/* copertina: tolgo i bordi trasparenti e la rimpicciolisco */
async function fotoCopertina(file) {
  const img = await caricaImmagine(file);
  const b = bordi(img); if (!b) throw new Error('La foto è tutta trasparente.');
  const w = b.x1 - b.x0, h = b.y1 - b.y0, s = Math.min(1, COP_ALTA / h, COP_LARGA / w);
  const c = tela(Math.round(w * s), Math.round(h * s)), x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, b.x0, b.y0, w, h, 0, 0, c.width, c.height);
  return aWebp(c, 0.82);
}
/* scrive la foto di un pezzo: immagini/NN.webp e immagini/mini/NN.webp */
async function salvaFotoPezzo(cartellaSerie, percorsoFoto, foto) {
  const p = senzaV(percorsoFoto);
  await scrivi(cartellaSerie + '/' + p, foto.grande);
  const [c, n] = dividi(p);
  await scrivi(cartellaSerie + '/' + (c ? c + '/' : '') + 'mini/' + n, foto.piccola);
  cacheFoto.delete(cartellaSerie + '/' + p);
}

/* =====================================================================
   2) LETTURA DI TUTTO IL SITO
   ===================================================================== */
async function rileggiSito() {
  const home = await leggi('index.html');
  const categorie = [];
  for (const m of home.matchAll(/<a class="st-card" href="([^"\/]+)\/index\.html"(?: aria-label="([^"]*)")?/g)) {
    const nodo = await M.albero(leggi, m[1]);
    if (!nodo) continue;
    nodo.nome = m[2] ? M.decodifica(m[2]) : nodo.titolo;
    categorie.push(nodo);
  }
  const liste = [], serie = [];
  const visita = (nodo, etichetta, categoria, genitore) => {
    nodo.etichetta = etichetta; nodo.categoria = categoria; nodo.genitore = genitore;
    if (nodo.tipo === 'serie') { serie.push(nodo); return; }
    if (nodo.lista && !nodo.lista.multiriga) liste.push(nodo);
    for (const f of nodo.figli) visita(f, etichetta + ' › ' + f.card.titolo + (f.card.nascosta ? ' (nascosta)' : ''), categoria, nodo);
  };
  categorie.forEach(c => visita(c, c.nome, c, null));
  sito = { categorie, liste, serie };
  $('riepilogo').hidden = false;
  disegnaInizio();
  riempiSelect();
  mostraScheda();
}

/* rifà l'indice (Mi mancano / Doppioni / Cerca) di una categoria; restituisce una riga di resoconto */
async function aggiornaIndice(categoria) {
  if (!(await esisteCartella(categoria + '/la-mia-collezione'))) return null;
  const r = await M.creaIndice(leggi, categoria);
  const percorso = categoria + '/la-mia-collezione/indice.js';
  const vecchio = await leggi(percorso);
  const togliData = t => String(t).replace(/"creato":"[^"]*"/, '');
  const cambiato = togliData(vecchio) !== togliData(r.testo);
  if (cambiato) await scrivi(percorso, r.testo);
  return { categoria, serie: r.serie.length, pezzi: r.serie.reduce((t, s) => t + s.x.length, 0), cambiato, problemi: r.problemi };
}
const categoriaDi = cartellaNodo => cartellaNodo.split('/')[0];

/* =====================================================================
   3) SCHEDE
   ===================================================================== */
function mostraScheda() {
  const nome = (location.hash || '#inizio').slice(1).split('/')[0];
  document.querySelectorAll('[data-scheda]').forEach(s => { s.hidden = s.dataset.scheda !== nome; });
  document.querySelectorAll('nav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + nome ? 'page' : 'false'));
  const serveCartella = ['pagine', 'serie', 'nuova', 'catalogo', 'strumenti'].includes(nome);
  document.querySelector('[data-scheda="' + nome + '"]')?.classList.toggle('bloccato', serveCartella && !cartella);
  if (serveCartella && !cartella) $('primoPasso').hidden = false;
  if (nome === 'strumenti' && cartella && !versioni) riempiFileVersione();
}
addEventListener('hashchange', mostraScheda);
mostraScheda();

function riempiSelect() {
  const opzLista = sito.liste.map((n, i) => `<option value="${i}">${esc(n.etichetta)}</option>`).join('');
  $('pgScegli').innerHTML = '<option value="">— scegli —</option>' + opzLista;
  $('nvDove').innerHTML = '<option value="">— scegli —</option>' + opzLista;
  $('srScegli').innerHTML = '<option value="">— scegli —</option>' + sito.serie.map((n, i) => `<option value="${i}">${esc(n.etichetta)}</option>`).join('');
  versioni = null;          // l'elenco dei file .js/.css lo rileggo quando apri "Strumenti"
}

/* ---------------- INIZIO ---------------- */
function disegnaInizio() {
  const pezzi = sito.serie.reduce((t, s) => t + (s.serie.elenco ? s.serie.elenco.length : 0), 0);
  const riquadro = (n, testo) => `<div class="numero"><b>${n}</b><span>${esc(testo)}</span></div>`;
  $('numeri').innerHTML = riquadro(sito.categorie.length, 'categorie') + riquadro(sito.serie.length, 'serie') + riquadro(pezzi.toLocaleString('it-IT'), 'pezzi in tutto') +
    sito.categorie.map(c => {
      const s = sito.serie.filter(x => x.categoria === c);
      return riquadro(s.length, c.nome + ' · ' + s.reduce((t, x) => t + (x.serie.elenco ? x.serie.elenco.length : 0), 0) + ' pezzi');
    }).join('');
}

/* ---------------- PAGINE E CARD ---------------- */
let pg = null;   // la pagina aperta: { nodo, lettura, card:[…], perAnno, tutti }

$('pgScegli').addEventListener('change', () => apriPagina($('pgScegli').value));
async function apriPagina(i) {
  $('pgMsg').hidden = true;
  if (i === '') { $('pgLavoro').hidden = true; pg = null; return; }
  const nodo = sito.liste[+i];
  const html = await leggi(nodo.cartella + '/index.html');
  const lettura = M.leggiCard(html);
  pg = {
    nodo, html, lettura,
    perAnno: lettura.perAnno,
    tutti: lettura.tutti ? { acceso: lettura.tutti.acceso, testo: lettura.tutti.testo } : null,
    card: lettura.card.map(c => ({
      orig: c, nascosta: c.nascosta, titolo: c.titolo, righe: M.righeDaTesto(c.testoHtml), cerca: c.cerca, nuovaCop: null, aperta: false,
      figlio: nodo.figli.find(f => f.card && f.card.li === c.li) || null
    }))
  };
  $('pgLavoro').hidden = false;
  disegnaPagina();
}
function pgCambiata(c) {
  return c.nascosta !== c.orig.nascosta || c.titolo !== c.orig.titolo || M.testoDaRighe(c.righe) !== M.testoDaRighe(M.righeDaTesto(c.orig.testoHtml)) || c.cerca !== c.orig.cerca || !!c.nuovaCop;
}
function pgSporca() {
  const ordine = pg.card.some((c, i) => c.orig !== pg.lettura.card[i]);
  const n = pg.card.filter(pgCambiata).length;
  const altro = pg.perAnno !== pg.lettura.perAnno || (pg.tutti && (pg.tutti.acceso !== pg.lettura.tutti.acceso || pg.tutti.testo !== pg.lettura.tutti.testo));
  const sporca = ordine || n > 0 || altro;
  $('pgSalva').disabled = !sporca;
  $('pgStato').textContent = sporca ? 'Ci sono modifiche da salvare' + (n ? ' (' + n + (n === 1 ? ' card' : ' card') + ')' : '') + '.' : '';
  return sporca;
}
function disegnaPagina() {
  $('pgPerAnno').checked = pg.perAnno;
  /* pulsante "Vedi tutti" */
  const box = $('pgTutti');
  if (pg.tutti) {
    box.innerHTML = `<div class="riga"><label class="spunta"><input type="checkbox" id="pgTuttiSi" ${pg.tutti.acceso ? 'checked' : ''}> Mostra il pulsante “Vedi tutti”</label></div>
      <label class="campo">Scritta del pulsante<input type="text" id="pgTuttiTesto" value="${esc(pg.tutti.testo)}"></label>`;
    $('pgTuttiSi').addEventListener('change', e => { pg.tutti.acceso = e.target.checked; pgSporca(); });
    $('pgTuttiTesto').addEventListener('input', e => { pg.tutti.testo = e.target.value; pgSporca(); });
  } else if (pg.nodo.figli.length && pg.nodo.figli.every(f => f.tipo === 'serie')) {
    box.innerHTML = `<p class="muted">Questa pagina non ha ancora il pulsante “Vedi tutti” (la pagina con tutti i pezzi di tutte le serie insieme).</p>
      <div class="griglia">
        <label class="campo">Scritta del pulsante<input type="text" id="pgNuovoTesto" value="Vedi tutti i pezzi insieme"></label>
        <label class="campo">Titolo della pagina<input type="text" id="pgNuovoTitolo" value="Tutti i pezzi"></label>
        <label class="campo">Come si dice “tocca …” (es. una sorpresina)<input type="text" id="pgNuovaParola" value="un pezzo"></label>
      </div>
      <div class="riga"><button type="button" class="ambra" id="pgCreaTutti">Crea la pagina e il pulsante</button></div>`;
    $('pgCreaTutti').addEventListener('click', creaTutti);
  } else box.innerHTML = '<p class="muted">Il pulsante “Vedi tutti” si può creare solo nelle pagine che contengono direttamente le serie.</p>';

  const ul = $('pgCard');
  ul.innerHTML = pg.card.map((c, i) => {
    const foto = c.nuovaCop ? `<img class="foto" src="${c.nuovaCop.url}" alt="">` : c.orig.img ? `<img class="foto" data-foto="${esc(pg.nodo.cartella + '/' + c.orig.img)}" alt="">` : '<span class="senza-foto">senza foto</span>';
    const tipo = c.figlio ? (c.figlio.tipo === 'serie' ? 'serie · ' + (c.figlio.serie.elenco ? c.figlio.serie.elenco.length : '?') + ' pezzi' : 'gruppo · ' + c.figlio.figli.length + ' card') : 'link';
    return `<li class="${c.nascosta ? 'nascosta' : ''} ${pgCambiata(c) ? 'cambiata' : ''}" data-i="${i}">
      ${foto}
      <div class="testi"><b>${esc(c.titolo)}</b><span class="muted">${esc(c.righe.join(' · '))}</span> <span class="pill">${esc(tipo)}</span>${c.nascosta ? ' <span class="pill giallo">nascosta</span>' : ''}</div>
      <div class="azioni">
        <button type="button" class="piccolo" data-a="su" title="Sposta su" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="piccolo" data-a="giu" title="Sposta giù" ${i === pg.card.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="piccolo" data-a="nascondi">${c.nascosta ? 'Mostra' : 'Nascondi'}</button>
        <button type="button" class="piccolo" data-a="copertina">Copertina…</button>
        <button type="button" class="piccolo" data-a="modifica">${c.aperta ? 'Chiudi' : 'Modifica'}</button>
      </div>
      ${c.aperta ? `<div class="modifica">
        <div class="griglia">
          <label class="campo">Titolo<input type="text" data-c="titolo" value="${esc(c.titolo)}"></label>
          <label class="campo">Testo, 1ª riga<input type="text" data-c="r0" value="${esc(c.righe[0] || '')}"></label>
          <label class="campo">Testo, 2ª riga (anno per le tendine)<input type="text" data-c="r1" value="${esc(c.righe[1] || '')}"></label>
        </div>
        <label class="campo">Parole che trova la ricerca (nomi dei pezzi, codici, anno…)<textarea data-c="cerca" style="min-height:70px">${esc(c.cerca)}</textarea></label>
        ${c.figlio && c.figlio.tipo === 'serie' ? '<div><button type="button" class="piccolo" data-a="serie">Modifica i pezzi di questa serie →</button></div>' : ''}
      </div>` : ''}
    </li>`;
  }).join('');
  caricaAnteprime(ul);
  pgSporca();
}
$('pgPerAnno').addEventListener('change', e => { pg.perAnno = e.target.checked; pgSporca(); });
$('pgCard').addEventListener('input', e => {
  const li = e.target.closest('li'), c = pg.card[li.dataset.i], k = e.target.dataset.c;
  if (k === 'titolo') c.titolo = e.target.value;
  else if (k === 'r0') c.righe[0] = e.target.value;
  else if (k === 'r1') c.righe[1] = e.target.value;
  else if (k === 'cerca') c.cerca = e.target.value.replace(/\s+/g, ' ');
  li.classList.toggle('cambiata', pgCambiata(c));
  li.querySelector('.testi b').textContent = c.titolo;
  pgSporca();
});
$('pgCard').addEventListener('click', e => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const i = +b.closest('li').dataset.i, c = pg.card[i];
  const a = b.dataset.a;
  if (a === 'su' || a === 'giu') { const j = a === 'su' ? i - 1 : i + 1; [pg.card[i], pg.card[j]] = [pg.card[j], pg.card[i]]; }
  else if (a === 'nascondi') c.nascosta = !c.nascosta;
  else if (a === 'modifica') c.aperta = !c.aperta;
  else if (a === 'serie') { location.hash = '#serie'; const k = sito.serie.indexOf(c.figlio); $('srScegli').value = k; apriSerie(k); return; }
  else if (a === 'copertina') {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
    inp.onchange = async () => {
      try { const blob = await fotoCopertina(inp.files[0]); c.nuovaCop = { blob, url: URL.createObjectURL(blob) }; disegnaPagina(); }
      catch (err) { alert(err.message); }
    };
    inp.click(); return;
  }
  disegnaPagina();
});
$('pgAnnulla').addEventListener('click', () => apriPagina($('pgScegli').value));
$('pgSalva').addEventListener('click', async () => {
  const b = $('pgSalva'); b.disabled = true;
  try {
    const cartellaPg = pg.nodo.cartella;
    const nuove = [];
    for (const c of pg.card) {
      const cambi = {};
      if (c.titolo !== c.orig.titolo) cambi.titolo = c.titolo;
      const testo = M.testoDaRighe(c.righe);
      if (testo !== M.testoDaRighe(M.righeDaTesto(c.orig.testoHtml))) cambi.testoHtml = testo;
      if (c.cerca !== c.orig.cerca) cambi.cerca = c.cerca;
      if (c.nuovaCop) {
        /* la copertina è sempre <cartella della card>/immagini/copertina.webp */
        const p = senzaV(c.orig.img) || M.cartellaCard(c.orig) + '/immagini/copertina.webp';
        await scrivi(cartellaPg + '/' + p, c.nuovaCop.blob);
        cacheFoto.delete(cartellaPg + '/' + p);
        cambi.img = M.conVersione(p);
      }
      nuove.push({ li: Object.keys(cambi).length ? M.cambiaCard(c.orig.li, cambi) : c.orig.li, nascosta: c.nascosta });
    }
    let html = M.scriviCard(pg.html, pg.lettura, nuove);
    if (pg.perAnno !== pg.lettura.perAnno) html = M.impostaPerAnno(html, pg.perAnno);
    if (pg.tutti) {
      const v = M.leggiVediTutti(html);
      if (pg.tutti.testo !== pg.lettura.tutti.testo) html = html.replace(v.riga, v.riga.replace(/(<a [^>]*>)[\s\S]*?(<\/a>)/, '$1' + esc(pg.tutti.testo) + ' &rarr;$2'));
      html = M.impostaVediTutti(html, pg.tutti.acceso);
    }
    await scrivi(cartellaPg + '/index.html', html);
    const r = await aggiornaIndice(categoriaDi(cartellaPg));
    const scelta = $('pgScegli').value;
    await rileggiSito();
    $('pgScegli').value = scelta; await apriPagina(scelta);
    messaggio($('pgMsg'), '✓ Salvato. ' + (r && r.cambiato ? 'Catalogo di “Mi mancano / Doppioni / Cerca” aggiornato.' : '') + '\nUna copia della versione di prima è in _backup/admin/' + M.oggi() + '.', 'ok');
  } catch (e) { messaggio($('pgMsg'), 'Non sono riuscito a salvare: ' + e.message, 'err'); b.disabled = false; }
});
/* crea la pagina tutti/ copiandola da una che c'è già, e il pulsante nella pagina */
async function creaTutti() {
  try {
    const modello = await leggi('lidl/stikeez/tutti/index.html') || await leggi('coolthings/charm-portachiavi/tutti/index.html');
    if (!modello) throw new Error('non trovo una pagina "tutti" da copiare (lidl/stikeez/tutti).');
    const c = pg.nodo.cartella;
    if (await esisteCartella(c + '/tutti')) throw new Error('la cartella "tutti" c\'è già in ' + c + '.');
    const titolo = $('pgNuovoTitolo').value.trim() || 'Tutti i pezzi';
    const gruppo = pg.nodo.card ? pg.nodo.card.titolo : pg.nodo.nome || pg.nodo.titolo;
    const pagina = M.creaPaginaTutti(modello, { gruppo, titolo, parola: $('pgNuovaParola').value.trim() || 'un pezzo', url: c + '/tutti/', profondita: c.split('/').length + 1 });
    await scrivi(c + '/tutti/index.html', pagina);
    const html = M.aggiungiVediTutti(await leggi(c + '/index.html'), $('pgNuovoTesto').value.trim() || 'Vedi tutti i pezzi insieme');
    await scrivi(c + '/index.html', html);
    await apriPagina($('pgScegli').value);
    messaggio($('pgMsg'), '✓ Creati la pagina ' + c + '/tutti/ e il pulsante. Le foto piccole (più leggere per il telefono) le fa lo strumento “Copie piccole (mini)”: senza, usa le foto grandi.', 'ok');
  } catch (e) { messaggio($('pgMsg'), 'Non ho creato la pagina: ' + e.message, 'err'); }
}

/* ---------------- MODIFICA SERIE ---------------- */
let sr = null;   // { nodo, html, lettura, righe:[{ o, orig, foto }], titolo, titoloGrande }

$('srScegli').addEventListener('change', () => apriSerie($('srScegli').value));
async function apriSerie(i) {
  $('srMsg').hidden = true;
  if (i === '' || i == null) { $('srLavoro').hidden = true; sr = null; return; }
  const nodo = sito.serie[+i];
  const html = await leggi(nodo.cartella + '/index.html');
  const lettura = M.leggiSerie(html);
  sr = {
    nodo, html, lettura,
    titolo: lettura.config.titolo, titoloGrande: lettura.titoloPagina,
    righe: lettura.elenco.map(o => ({ o: structuredClone(o), orig: o, foto: null })),
    tolti: 0
  };
  $('srTitolo').value = sr.titolo; $('srTitoloGrande').value = sr.titoloGrande;
  $('srLblCodice').textContent = (/id="lblCodice">([^<]*)</.exec(html) || [])[1] || 'Codice';
  const pr = lettura.config.proporzione || 1;
  $('srInfo').innerHTML = `Cartella <code>${esc(nodo.cartella)}</code> · archivio <code>${esc(lettura.config.dbName)}</code>` +
    (pr !== 1 ? ` · <b>foto non quadrate</b> (${pr}): per cambiare le foto usa lo <a href="../legami/_strumenti/strumento-legami.html" target="_blank">strumento Legami</a>.` : '');
  $('srApri').href = '../' + nodo.cartella + '/index.html';
  $('srLavoro').hidden = false;
  disegnaSerie();
}
const srCambiata = r => !r.orig || !!r.foto || JSON.stringify(r.o) !== JSON.stringify(r.orig);
function srSporca() {
  const ordine = sr.righe.some((r, i) => r.orig !== sr.lettura.elenco[i]) || sr.righe.length !== sr.lettura.elenco.length;
  const n = sr.righe.filter(srCambiata).length;
  const sporca = ordine || n > 0 || sr.titolo !== sr.lettura.config.titolo || sr.titoloGrande !== sr.lettura.titoloPagina;
  $('srSalva').disabled = !sporca;
  $('srStato').textContent = sporca ? 'Ci sono modifiche da salvare.' : '';
}
function disegnaSerie() {
  const quadrate = (sr.lettura.config.proporzione || 1) === 1;
  $('srRighe').innerHTML = sr.righe.map((r, i) => {
    const o = r.o;
    const foto = r.foto ? `<img class="foto" src="${r.foto.url}" alt="" data-a="foto">`
      : o.foto ? `<img class="foto" data-foto="${esc(sr.nodo.cartella + '/' + o.foto)}" alt="" data-a="foto">` : '<span class="senza-foto" data-a="foto">aggiungi foto</span>';
    return `<tr data-i="${i}" class="${!r.orig ? 'nuova' : srCambiata(r) ? 'cambiata' : ''}">
      <td>${foto}</td>
      <td class="n"><input type="text" data-k="numero" value="${esc(o.numero)}"></td>
      <td><input type="text" data-k="nome" value="${esc(o.nome)}"></td>
      <td><input type="text" data-k="codice" value="${esc(o.codice ?? '')}"></td>
      <td><input type="text" data-k="info" value="${esc(o.info ?? '')}"></td>
      <td><input type="text" data-k="hashtag" value="${esc((o.hashtag || []).join(', '))}"></td>
      <td style="white-space:nowrap">
        <button type="button" class="piccolo" data-a="su" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="piccolo" data-a="giu" ${i === sr.righe.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="piccolo" data-a="togli" title="Togli questo pezzo">✕</button>
      </td></tr>`;
  }).join('');
  if (!quadrate) $('srRighe').querySelectorAll('[data-a="foto"]').forEach(x => { x.removeAttribute('data-a'); x.style.cursor = 'default'; });
  caricaAnteprime($('srRighe'));
  srSporca();
}
$('srTitolo').addEventListener('input', e => { const vecchio = sr.titolo; sr.titolo = e.target.value;
  if ($('srTitoloGrande').value === vecchio.toUpperCase()) { sr.titoloGrande = sr.titolo.toUpperCase(); $('srTitoloGrande').value = sr.titoloGrande; }
  srSporca(); });
$('srTitoloGrande').addEventListener('input', e => { sr.titoloGrande = e.target.value; srSporca(); });
$('srRighe').addEventListener('input', e => {
  const tr = e.target.closest('tr'), r = sr.righe[tr.dataset.i], k = e.target.dataset.k;
  const v = e.target.value;
  if (k === 'hashtag') { const h = v.split(',').map(s => s.trim()).filter(Boolean); if (h.length) r.o.hashtag = h; else delete r.o.hashtag; }
  else if ((k === 'info' || k === 'codice') && !v.trim() && !(r.orig && r.orig[k])) delete r.o[k];
  else r.o[k] = v;
  tr.className = !r.orig ? 'nuova' : srCambiata(r) ? 'cambiata' : '';
  srSporca();
});
let srFotoPer = null;
$('srRighe').addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const i = +el.closest('tr').dataset.i, a = el.dataset.a;
  if (a === 'foto') { srFotoPer = i; $('srFile').value = ''; $('srFile').click(); return; }
  if (a === 'su' || a === 'giu') { const j = a === 'su' ? i - 1 : i + 1; [sr.righe[i], sr.righe[j]] = [sr.righe[j], sr.righe[i]]; }
  if (a === 'togli') {
    const r = sr.righe[i];
    if (r.orig && !confirm('Togliere “' + r.o.nome + '” (n° ' + r.o.numero + ')?\nChi l\'aveva segnato “Ce l\'ho” non lo vedrà più. La foto resta nella cartella.')) return;
    sr.righe.splice(i, 1);
  }
  disegnaSerie();
});
$('srFile').addEventListener('change', async () => {
  const f = $('srFile').files[0]; if (!f || srFotoPer == null) return;
  try { const foto = await fotoPezzo(f); foto.url = URL.createObjectURL(foto.grande); sr.righe[srFotoPer].foto = foto; disegnaSerie(); }
  catch (e) { alert(e.message); }
});
/* id per un pezzo nuovo: stesso inizio degli altri + numero dopo l'ultimo */
function nuovoId(righe) {
  const ids = righe.map(r => r.o.id);
  const m = ids.map(id => /^(.*?)(\d+)$/.exec(id)).filter(Boolean);
  const prefisso = m.length ? m[m.length - 1][1] : (sr.nodo.cartella.split('/').pop() + '-');
  const cifre = m.length ? m[m.length - 1][2].length : 2;
  let n = Math.max(0, ...m.filter(x => x[1] === prefisso).map(x => +x[2])) + 1;
  while (ids.includes(prefisso + pad(n, cifre))) n++;
  return prefisso + pad(n, cifre);
}
$('srAggiungi').addEventListener('click', () => {
  const ultimo = sr.righe[sr.righe.length - 1];
  const numeri = sr.righe.map(r => parseInt(r.o.numero, 10)).filter(n => !isNaN(n));
  const cifre = ultimo ? String(ultimo.o.numero).replace(/\D.*$/, '').length || 2 : 2;
  const o = { id: nuovoId(sr.righe), numero: pad((numeri.length ? Math.max(...numeri) : 0) + 1, cifre), codice: ultimo ? ultimo.o.codice : '', nome: '' };
  if (!o.codice) delete o.codice;
  sr.righe.push({ o, orig: null, foto: null });
  disegnaSerie();
  $('srRighe').querySelector('tr:last-child input[data-k="nome"]').focus();
});
$('srAnnulla').addEventListener('click', () => apriSerie($('srScegli').value));
$('srSalva').addEventListener('click', async () => {
  const b = $('srSalva'); b.disabled = true;
  try {
    const nodo = sr.nodo, c = nodo.cartella;
    const vuoti = sr.righe.filter(r => !String(r.o.nome).trim());
    if (vuoti.length && !confirm(vuoti.length + ' pezzi senza nome. Salvo lo stesso?')) { b.disabled = false; return; }
    const ids = sr.righe.map(r => r.o.id);
    if (new Set(ids).size !== ids.length) throw new Error('due pezzi hanno lo stesso id.');
    /* foto nuove */
    for (const r of sr.righe) {
      if (!r.foto) continue;
      const p = senzaV(r.o.foto) || 'immagini/' + String(r.o.numero).replace(/[^\w-]/g, '') + '.webp';
      await salvaFotoPezzo(c, p, r.foto);
      r.o.foto = M.conVersione(p);
    }
    let html = M.scriviElenco(sr.html, sr.lettura, sr.righe.map(r => r.o));
    if (sr.titolo !== sr.lettura.config.titolo || sr.titoloGrande !== sr.lettura.titoloPagina) html = M.cambiaTitoloSerie(html, sr.titolo, sr.titoloGrande);
    await scrivi(c + '/index.html', html);
    /* se la card aveva lo stesso titolo della pagina, cambio anche lei */
    let anche = '';
    if (sr.titolo !== sr.lettura.config.titolo && nodo.card && nodo.card.titolo === sr.lettura.config.titolo && nodo.genitore) {
      const lp = nodo.genitore.cartella + '/index.html', t = await leggi(lp), l = M.leggiCard(t);
      await scrivi(lp, M.scriviCard(t, l, l.card.map(x => ({ li: x.li === nodo.card.li ? M.cambiaCard(x.li, { titolo: sr.titolo }) : x.li, nascosta: x.nascosta }))));
      anche = ' Cambiato anche il titolo della card.';
    }
    const r = await aggiornaIndice(categoriaDi(c));
    const scelta = sito.serie.indexOf(nodo);
    await rileggiSito();
    const k = sito.serie.findIndex(s => s.cartella === c);
    $('srScegli').value = k; await apriSerie(k);
    messaggio($('srMsg'), '✓ Salvato.' + anche + (r && r.cambiato ? ' Catalogo aggiornato.' : '') + '\nUna copia della versione di prima è in _backup/admin/' + M.oggi() + '.', 'ok');
    void scelta;
  } catch (e) { messaggio($('srMsg'), 'Non sono riuscito a salvare: ' + e.message, 'err'); b.disabled = false; }
});

/* ---------------- NUOVA SERIE ---------------- */
const nv = { foto: [], cop: null, toccati: new Set() };   // toccati = campi scritti a mano (non li riempio più da solo)
$('nvDove').addEventListener('change', () => {
  const lista = sito.liste[$('nvDove').value];
  if (!lista) { $('nvModello').innerHTML = ''; return; }
  let modelli = lista.figli.filter(f => f.tipo === 'serie');
  if (!modelli.length) modelli = sito.serie.filter(s => s.categoria === lista.categoria);
  if (!modelli.length) modelli = sito.serie;
  $('nvModello').innerHTML = modelli.map(s => `<option value="${sito.serie.indexOf(s)}">${esc(s.etichetta)}</option>`).join('');
  riempiDaModello();
});
$('nvModello').addEventListener('change', riempiDaModello);
function modello() { return sito.serie[$('nvModello').value]; }
function nvRighe() {
  return $('nvNomi').value.split('\n').map(s => s.trim()).filter(Boolean).map(s => { const [nome, ...info] = s.split('|'); return { nome: nome.trim(), info: info.join('|').trim() }; });
}
function riempiDaModello() {
  const m = modello(); if (!m) return;
  const primo = m.serie.elenco && m.serie.elenco[0];
  if (!nv.toccati.has('nvCodice')) $('nvCodice').value = primo && primo.codice ? primo.codice : '';
  aggiornaNuova();
}
function aggiornaNuova() {
  const m = modello(), n = nvRighe().length;
  const t = $('nvTitolo').value.trim();
  if (!nv.toccati.has('nvCartella')) $('nvCartella').value = M.cartellaDa(t);
  if (!nv.toccati.has('nvTitoloGrande')) $('nvTitoloGrande').value = t.toUpperCase();
  if (m && m.card) {
    const righe = M.righeDaTesto(m.card.testoHtml);
    if (!nv.toccati.has('nvTesto1')) $('nvTesto1').value = /^\d+/.test(righe[0] || '') ? righe[0].replace(/^\d+/, n) : (righe[0] || '');
    if (!nv.toccati.has('nvTesto2')) $('nvTesto2').value = righe[1] !== undefined ? ($('nvCodice').value.match(/\b(19|20)\d\d\b/) || [righe[1]])[0] : '';
  }
  $('nvConta').textContent = n ? n + ' pezzi · ' + nv.foto.length + ' foto' + (nv.foto.length && nv.foto.length !== n ? ' ⚠️ il numero di foto è diverso da quello dei pezzi' : '') : '';
}
['nvTitolo', 'nvNomi', 'nvCodice'].forEach(id => $(id).addEventListener('input', aggiornaNuova));
['nvCartella', 'nvTitoloGrande', 'nvTesto1', 'nvTesto2', 'nvCodice'].forEach(id => $(id).addEventListener('input', () => nv.toccati.add(id)));
/* foto: trascinate o scelte, in ordine di nome del file */
function prendiFoto(files) {
  nv.foto = [...files].filter(f => f.type.startsWith('image/')).sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true }));
  $('nvAnteprime').innerHTML = nv.foto.map((f, i) => `<figure><img class="foto" src="${URL.createObjectURL(f)}" alt=""><figcaption>${pad(i + 1, 2)} · ${esc((nvRighe()[i] || {}).nome || f.name)}</figcaption></figure>`).join('');
  aggiornaNuova();
}
$('nvDrop').addEventListener('click', () => $('nvFoto').click());
$('nvFoto').addEventListener('change', () => prendiFoto($('nvFoto').files));
$('nvDrop').addEventListener('dragover', e => { e.preventDefault(); $('nvDrop').classList.add('sopra'); });
$('nvDrop').addEventListener('dragleave', () => $('nvDrop').classList.remove('sopra'));
$('nvDrop').addEventListener('drop', e => { e.preventDefault(); $('nvDrop').classList.remove('sopra'); prendiFoto(e.dataTransfer.files); });
$('nvBtnCop').addEventListener('click', () => $('nvCop').click());
$('nvCop').addEventListener('change', async () => {
  const f = $('nvCop').files[0]; if (!f) return;
  try { nv.cop = await fotoCopertina(f); $('nvCopImg').src = URL.createObjectURL(nv.cop); $('nvCopImg').hidden = false; $('nvCopNome').textContent = f.name; }
  catch (e) { alert(e.message); }
});
/* i link verso i file del sito (../../sito.css…) giusti per la nuova cartella */
function riposiziona(html, da, a) {
  const assoluto = rel => { const parti = da.split('/'); for (const p of rel.split('/')) { if (p === '..') parti.pop(); else if (p !== '.') parti.push(p); } return parti; };
  const relativo = parti => { const qui = a.split('/'); let k = 0; while (k < qui.length && k < parti.length - 1 && qui[k] === parti[k]) k++; return '../'.repeat(qui.length - k) + parti.slice(k).join('/'); };
  return html.replace(/\b(href|src)="(\.\.\/[^"]*)"/g, (m, attr, rel) => attr + '="' + relativo(assoluto(rel)) + '"');
}
$('nvCrea').addEventListener('click', async () => {
  const msg = $('nvMsg'), b = $('nvCrea');
  try {
    const lista = sito.liste[$('nvDove').value], m = modello();
    const titolo = $('nvTitolo').value.trim(), slug = $('nvCartella').value.trim(), righe = nvRighe();
    if (!lista || !m) throw new Error('scegli la pagina in cui va la card.');
    if (!titolo) throw new Error('scrivi il titolo.');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error('il nome della cartella può avere solo lettere minuscole, numeri e trattini.');
    if (!righe.length) throw new Error('scrivi almeno un pezzo.');
    const c = lista.cartella + '/' + slug;
    if (await esisteCartella(c)) throw new Error('la cartella ' + c + ' esiste già.');
    b.disabled = true;
    messaggio(msg, 'Creo la serie…');
    const cat = categoriaDi(c), vecchioSlug = m.cartella.split('/').pop();
    /* archivio nel browser (dbName) e id: come il modello, con il nome nuovo; mai uguali a un'altra serie */
    const dal = (v, riserva) => v && v.includes(vecchioSlug) ? v.split(vecchioSlug).join(slug) : riserva;
    let dbName = dal(m.serie.config.dbName, 'catalogo-' + cat + '-' + slug);
    const usati = new Set(sito.serie.map(s => s.serie.config && s.serie.config.dbName));
    for (let k = 2; usati.has(dbName); k++) dbName = 'catalogo-' + cat + '-' + slug + '-' + k;
    const cifre = righe.length > 99 ? 3 : 2, codice = $('nvCodice').value.trim();
    /* foto */
    const elenco = [];
    for (let i = 0; i < righe.length; i++) {
      const numero = pad(i + 1, cifre), o = { id: slug + '-' + numero, numero, codice, nome: righe[i].nome, foto: '' };
      if (nv.foto[i]) {
        messaggio(msg, 'Preparo la foto ' + (i + 1) + ' di ' + nv.foto.length + '…');
        await salvaFotoPezzo(c, 'immagini/' + numero + '.webp', await fotoPezzo(nv.foto[i]));
        o.foto = 'immagini/' + numero + '.webp?v=' + M.oggi();
      }
      if (righe[i].info) o.info = righe[i].info;
      elenco.push(o);
    }
    if (nv.cop) await scrivi(c + '/immagini/copertina.webp', nv.cop);
    /* pagina: copiata dal modello */
    let pagina = M.creaPaginaSerie(await leggi(m.cartella + '/index.html'), {
      url: c + '/', titolo, titoloGrande: $('nvTitoloGrande').value.trim() || titolo.toUpperCase(),
      descrizione: titolo + ': ' + $('nvTesto1').value.trim() + ', con quelli che ho e quelli che mi mancano.',
      id: dal(m.serie.config.id, cat + '-' + slug), dbName, elenco,
      backTesto: lista.card ? lista.card.titolo : lista.nome
    });
    pagina = riposiziona(pagina, m.cartella, c).replace(/(<a class="st-back" href=")[^"]*"/, '$1../index.html"');
    await scrivi(c + '/index.html', pagina);
    /* card in cima alla pagina scelta */
    const lp = lista.cartella + '/index.html', t = await leggi(lp), l = M.leggiCard(t);
    const cerca = [...new Set([...righe.map(r => r.nome), codice, $('nvTesto2').value.trim()].filter(Boolean))].join(' ');
    const card = M.nuovaCard({ cartella: slug, titolo, testoHtml: M.testoDaRighe([$('nvTesto1').value, $('nvTesto2').value]), cerca, copertina: nv.cop ? slug + '/immagini/copertina.webp?v=' + M.oggi() : '' });
    await scrivi(lp, M.scriviCard(t, l, [{ li: card, nascosta: false }, ...l.card]));
    const r = await aggiornaIndice(cat);
    await rileggiSito();
    msg.innerHTML = '';
    messaggio(msg, '✓ Serie creata in ' + c + ' (' + righe.length + ' pezzi, ' + nv.foto.length + ' foto).' + (r ? ' Catalogo aggiornato.' : '') +
      '\nControllala: “Modifica una serie” per ritoccare nomi e info, “Pagine e card” per la copertina.', 'ok');
    const a = Object.assign(document.createElement('a'), { href: '../' + c + '/index.html', target: '_blank', textContent: ' Apri la pagina nuova ↗' });
    msg.append(a);
    /* pulisco il modulo */
    ['nvTitolo', 'nvTitoloGrande', 'nvCartella', 'nvNomi', 'nvTesto1', 'nvTesto2'].forEach(id => { $(id).value = ''; });
    nv.foto = []; nv.cop = null; nv.toccati.clear(); $('nvAnteprime').innerHTML = ''; $('nvCopImg').hidden = true; $('nvCopNome').textContent = '';
  } catch (e) { messaggio(msg, 'Non ho creato la serie: ' + e.message, 'err'); }
  b.disabled = false;
});

/* ---------------- AGGIORNA CATALOGO ---------------- */
$('ctVai').addEventListener('click', async () => {
  const b = $('ctVai'); b.disabled = true;
  messaggio($('ctMsg'), 'Leggo tutte le serie…');
  try {
    await rileggiSito();
    const righe = [];
    for (const c of sito.categorie) {
      const r = await aggiornaIndice(c.cartella);
      if (!r) continue;
      righe.push((r.cambiato ? '✓ aggiornato  ' : '= già giusto  ') + c.nome + ': ' + r.serie + ' serie, ' + r.pezzi + ' pezzi' + (r.problemi.length ? '\n   ⚠️ ' + r.problemi.join('\n   ⚠️ ') : ''));
    }
    messaggio($('ctMsg'), righe.join('\n'), 'ok');
  } catch (e) { messaggio($('ctMsg'), 'Errore: ' + e.message, 'err'); }
  b.disabled = false;
});

/* ---------------- STRUMENTI ---------------- */
/* tutte le pagine .html del sito (senza le cartelle che iniziano con "_") */
async function tuttePagine(d = cartella, percorso = '', fuori = []) {
  for await (const [nome, h] of d.entries()) {
    if (nome.startsWith('_') || nome.startsWith('.')) continue;
    if (h.kind === 'directory') { if (nome !== 'immagini' && nome !== 'icone' && nome !== 'caratteri') await tuttePagine(h, percorso + nome + '/', fuori); }
    else if (nome.endsWith('.html')) fuori.push(percorso + nome);
  }
  return fuori;
}
function risolvi(pagina, rel) {
  const parti = pagina.split('/').slice(0, -1);
  for (const p of rel.split('/')) { if (p === '..') parti.pop(); else if (p && p !== '.') parti.push(p); }
  return parti.join('/');
}
async function riempiFileVersione() {
  $('tlFile').innerHTML = '<option>Leggo le pagine…</option>';
  const trovate = {};
  for (const p of await tuttePagine()) {
    const t = await leggi(p);
    for (const m of t.matchAll(/\b(?:href|src)="([^"?#]+\.(?:js|css))\?v=([^"]*)"/g)) {
      const f = risolvi(p, m[1]);
      (trovate[f] = trovate[f] || { v: new Set(), pagine: new Set() }).v.add(m[2]);
      trovate[f].pagine.add(p);
    }
  }
  versioni = trovate;
  const nomi = Object.keys(versioni).sort((a, b) => versioni[b].pagine.size - versioni[a].pagine.size);
  $('tlFile').innerHTML = nomi.map(f => `<option value="${esc(f)}">${esc(f)} — ${versioni[f].pagine.size} pagine (ora: ${esc([...versioni[f].v].join(', '))})</option>`).join('');
}
$('tlVersione').addEventListener('click', async () => {
  const f = $('tlFile').value; if (!f || !versioni[f]) return;
  const b = $('tlVersione'); b.disabled = true;
  let n = 0;
  try {
    for (const p of versioni[f].pagine) {
      const t = await leggi(p);
      const nuovo = t.replace(/\b(href|src)="([^"?#]+\.(?:js|css))\?v=([^"]*)"/g, (m, a, rel, v) => risolvi(p, rel) === f ? a + '="' + rel + '?v=' + M.oggi() + '"' : m);
      if (nuovo !== t) { await scrivi(p, nuovo); n++; }
    }
    messaggio($('tlVersioneMsg'), '✓ ' + f + ': data di oggi (' + M.oggi() + ') in ' + n + ' pagine.', 'ok');
    await riempiFileVersione(); $('tlFile').value = f;
  } catch (e) { messaggio($('tlVersioneMsg'), 'Errore: ' + e.message, 'err'); }
  b.disabled = false;
});
$('tlControlla').addEventListener('click', async () => {
  const b = $('tlControlla'); b.disabled = true;
  const out = $('tlControlloMsg');
  try {
    await rileggiSito();
    const problemi = [], db = {};
    let i = 0;
    for (const s of sito.serie) {
      messaggio(out, 'Controllo ' + (++i) + ' di ' + sito.serie.length + ': ' + s.etichetta);
      if (s.serie.errore) { problemi.push('❌ ' + s.cartella + ': la pagina ha un errore nell\'elenco (' + s.serie.errore + ')'); continue; }
      (db[s.serie.config.dbName] = db[s.serie.config.dbName] || []).push(s.cartella);
      const ids = new Set();
      for (const o of s.serie.elenco) {
        if (ids.has(o.id)) problemi.push('⚠️ ' + s.cartella + ': id ripetuto “' + o.id + '”');
        ids.add(o.id);
        if (!o.foto) problemi.push('· ' + s.cartella + ': n° ' + o.numero + ' ' + o.nome + ' senza foto');
        else if (!(await prendiFile(s.cartella + '/' + o.foto))) problemi.push('❌ ' + s.cartella + ': manca il file ' + senzaV(o.foto) + ' (n° ' + o.numero + ')');
      }
      if (s.card && s.card.img && !(await prendiFile(s.genitore.cartella + '/' + s.card.img))) problemi.push('❌ ' + s.cartella + ': manca la copertina ' + senzaV(s.card.img));
      if (s.card && !s.card.img) problemi.push('· ' + s.cartella + ': card senza copertina');
    }
    Object.entries(db).filter(([, v]) => v.length > 1).forEach(([k, v]) => problemi.push('❌ stesso archivio “' + k + '” in: ' + v.join(', ')));
    const gravi = problemi.filter(p => p.startsWith('❌')).length;
    messaggio(out, (problemi.length ? problemi.join('\n') : '✓ Tutto a posto: nessuna foto mancante.') +
      '\n\n' + sito.serie.length + ' serie controllate · ❌ ' + gravi + ' da sistemare · ' + (problemi.length - gravi) + ' avvisi', gravi ? 'err' : 'ok');
  } catch (e) { messaggio(out, 'Errore: ' + e.message, 'err'); }
  b.disabled = false;
});
