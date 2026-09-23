/* =====================================================================
   app.js — pagine delle collezioni (Collection Time)
   ---------------------------------------------------------------------
   UN SOLO FILE per tutte le collezioni (penne, lampade, minifigure…):
   ogni pagina lo richiama con  <script src="../../comune/app.js?v=…">.
   Il browser lo scarica una volta sola e lo riusa per tutte le pagine.
   Legge dall'HTML due blocchi:
     • CONFIG → testi e misure della collezione
     • PENNE  → l'elenco degli oggetti (numero, nome, foto…)
   Per aggiungere oggetti NON serve toccare questo file: basta
   aggiungere una riga all'elenco PENNE nell'HTML.

   Cosa resta salvato nel browser di chi visita (IndexedDB)?
   Solo i suoi dati: "Ce l'ho" e gli hashtag che ha cambiato.
   Tutto il resto (nome, numero, colore, foto, info) arriva sempre
   dall'elenco PENNE, così una modifica all'HTML si vede subito.

   Indice delle sezioni (cerca il titolo con ---------- ):
     · elenco (da PENNE)
     · archivio (IndexedDB)
     · ricerca e filtri
     · disegno della pagina (+ bagliore)
     · finestra "Dettagli"
     · stampa in PDF
     · controlli
     · avvio
   ===================================================================== */

(() => {
  /* scorciatoia: $('grid') = document.getElementById('grid') */
  const $ = id => document.getElementById(id);
  const grid = $('grid'), dlg = $('dlg');
  /* avviso temporaneo in basso: è quello comune del sito (funzione avviso in script.js) */
  const say = msg => avviso(msg);

  /* misure della collezione (da CONFIG) */
  document.documentElement.style.setProperty('--proporzione', String(CONFIG.proporzione || 7));
  document.documentElement.style.setProperty('--colonne', String(CONFIG.colonne || 8));

  /* ---------- elenco (da PENNE, nell'HTML) ----------
     Trasformo le righe scritte nell'HTML (campi in italiano) nel formato
     usato dal resto del programma. L'ordine dell'elenco = ordine sulla pagina. */

  /* Sagoma grigia mostrata al posto degli oggetti senza foto (solo Legami ce l'ha). */
  const SLOT_IMG = 'immagini/slot-vuoto.webp';

  const idVisti = new Set();
  const SEED = PENNE.map((r, i) => {
    /* se manca l'id lo ricavo dal nome del file della foto (es. "penna-96-riccio") */
    const id = r.id || ('penna-' + String(r.foto || i).split('/').pop().replace(/\.[a-z]+$/i, ''));
    if (idVisti.has(id)) console.warn('ELENCO PENNE: l\'id "' + id + '" è usato due volte. Cambiane uno!');
    idVisti.add(id);
    return {
      id,
      pos: i,                                  /* posizione = ordine nell'elenco */
      code: r.numero || '',
      ep: r.ep || '',
      name: r.nome || '',
      colorName: r.colore || '',
      colorHex: r.hex || '',
      limited: !!r.limitata,
      tags: Array.isArray(r.hashtag) ? r.hashtag.slice() : [],
      info: r.info || '',                      /* testo fisso "Info": si cambia solo nell'HTML */
      image: r.foto || ''                      /* percorso della foto, es. "immagini/01.webp" */
    };
  });

  /* ---------- stato della pagina ---------- */
  let db = null;           /* archivio del browser (IndexedDB) */
  let pens = [];           /* tutti gli oggetti, con le spunte e gli hashtag di chi guarda */
  let filterMode = 'all';  /* filtro scelto: all / owned / missing */
  let sortDir = 1;         /* ordine: 1 = dalla prima, -1 = dalla più recente */
  let query = '';          /* testo scritto nella ricerca */
  let editing = null;      /* oggetto aperto nella finestra "Dettagli" */

  /* ---------- archivio (IndexedDB) ----------
     Ogni collezione ha il suo archivio, con il nome scritto in CONFIG.dbName.
     Per ogni oggetto salvo solo: id, owned ("Ce l'ho"), tags e tagsTouched
     (tagsTouched = hashtag cambiati dal visitatore). Gli stessi campi li
     leggono e scrivono Esporta/Importa (script.js) e la pagina LEGO "Tutte". */
  const STORE = 'penne';
  function openDB() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(CONFIG.dbName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  /* la parte da salvare di un oggetto: solo i dati di chi visita */
  const datiVisitatore = p => ({ id: p.id, owned: p.owned, tags: p.tags, tagsTouched: p.tagsTouched });
  const savePen = p => db
    ? wrap(db.transaction(STORE, 'readwrite').objectStore(STORE).put(datiVisitatore(p))).catch(() => say('Salvataggio non riuscito.'))
    : Promise.resolve();

  /* ---------- ricerca e filtri ---------- */
  /* gli oggetti si mostrano sempre nell'ordine dell'elenco PENNE (campo pos) */
  const byPos = (a, b) => a.pos - b.pos;
  /* parole alternative per gli hashtag: cercando "christmas" escono le penne di Natale, ecc. */
  const TAG_ALIASES = {
    'halloween': ['halloween'],
    'natale': ['natale', 'christmas', 'xmas'],
    'san valentino': ['san valentino', 'valentino', 'valentine', 'innamorati'],
    'pasqua': ['pasqua', 'easter']
  };
  const foldText = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  /* tutto il testo in cui cercare per un oggetto (numero, EP, nome, info, colore, hashtag) */
  function searchText(p) {
    const parts = [p.code, p.ep, p.name, p.info, p.colorName];
    p.tags.forEach(t => {
      parts.push(t, '#' + t);
      const al = TAG_ALIASES[String(t).toLowerCase()];
      if (al) parts.push(...al);
    });
    if (p.limited) parts.push('edizione limitata', 'limitata', 'limited edition', 'limited');
    return foldText(parts.join(' '));
  }
  /* oggetti da mostrare secondo filtro e ricerca, nell'ordine scelto */
  function visiblePens() {
    const terms = foldText(query).replace(/#/g, ' ').split(/\s+/).filter(Boolean);
    return pens
      .filter(p => filterMode === 'all' || (filterMode === 'owned' ? p.owned : (!p.owned && p.image)))
      .filter(p => { if (!terms.length) return true; const hay = searchText(p); return terms.every(t => hay.includes(t)); })
      .sort((a, b) => sortDir * byPos(a, b));
  }

  /* ---------- disegno della pagina ---------- */
  /* scrive "12 possedute su 103" (gli oggetti senza foto non contano) */
  function updateCount(shown) {
    const owned = pens.filter(p => p.owned).length;
    const total = pens.filter(p => p.image || p.owned).length;
    let t = owned + ' ' + CONFIG.possedute + ' su ' + total;
    if (typeof shown === 'number' && shown !== pens.length) t += ' · ' + shown + (shown === 1 ? ' visibile' : ' visibili');
    $('count').textContent = t;
  }

  /* ---------- bagliore (UNO SOLO per tutti gli oggetti) ----------
     Quando una penna è posseduta, dietro la foto compare un alone arancio-giallo
     che segue la sagoma della penna. Prima c'era un'immagine di bagliore già pronta
     per ogni penna (100 immagini in più): ora lo stesso effetto è calcolato qui,
     una volta per foto, per TUTTE le penne (anche quelle che aggiungerai).
     Come funziona:
       1. prendo la sagoma della penna (i pixel non trasparenti) in piccolo (30%)
       2. la sfumo tre volte con raggi diversi e sommo i risultati
       3. tolgo la parte coperta dalla penna e coloro tutto di arancio-giallo
       4. ne faccio un'immagine PNG trasparente e la metto dietro la foto
     I bagliori già calcolati restano in memoria (haloCache) e vengono creati
     uno alla volta (haloChain) per non bloccare la pagina.
     Nota: il calcolo legge i pixel della foto, quindi funziona con la pagina
     aperta dal sito o da un piccolo server locale; aprendo il file con un
     doppio clic (file://) il browser lo vieta: in quel caso si usa un alone
     di riserva più semplice fatto con il CSS (vedi .no-halo in comune/collezione.css). */
  const haloCache = new Map();
  let haloChain = Promise.resolve();
  function makeHalo(src) {
    if (haloCache.has(src)) return haloCache.get(src);
    const job = haloChain.then(() => new Promise(r => setTimeout(r, 0))).then(() => buildHalo(src));
    haloCache.set(src, job);
    haloChain = job.catch(() => {});
    return job;
  }
  /* sfocatura gaussiana (3 passaggi di media) su una matrice di valori 0..1 */
  function gaussBlur(a, w, h, sigma) {
    const r = Math.max(1, Math.floor(Math.round(Math.sqrt(12 * sigma * sigma / 3 + 1)) / 2));
    const div = 2 * r + 1;
    const tmp = new Float32Array(a.length), out = new Float32Array(a.length);
    let cur = a;
    for (let it = 0; it < 3; it++) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        let sum = 0;
        for (let x = 0; x <= r && x < w; x++) sum += cur[row + x];
        for (let x = 0; x < w; x++) {
          tmp[row + x] = sum / div;
          const add = x + r + 1, sub = x - r;
          if (add < w) sum += cur[row + add];
          if (sub >= 0) sum -= cur[row + sub];
        }
      }
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let y = 0; y <= r && y < h; y++) sum += tmp[y * w + x];
        for (let y = 0; y < h; y++) {
          out[y * w + x] = sum / div;
          const add = y + r + 1, sub = y - r;
          if (add < h) sum += tmp[add * w + x];
          if (sub >= 0) sum -= tmp[sub * w + x];
        }
      }
      cur = out;
    }
    return out;
  }
  /* crea il bagliore di una foto: restituisce l'indirizzo dell'immagine e
     il fattore k (quanto è più alto della penna, circa 1.3) */
  async function buildHalo(src) {
    const img = await loadImg(src);
    const S = 0.3;
    const w = Math.max(1, Math.round(img.naturalWidth * S));
    const h = Math.max(1, Math.round(img.naturalHeight * S));
    const pad = Math.ceil(h * 0.15);
    const W = w + 2 * pad, H = h + 2 * pad;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, pad, pad, w, h);
    const px = ctx.getImageData(0, 0, W, H).data;
    const A = new Float32Array(W * H);
    for (let i = 0; i < A.length; i++) A[i] = px[i * 4 + 3] / 255;
    const inv = new Float32Array(W * H).fill(1);
    let B6 = null;
    [[1.5, [1, 1]], [4.5, [1, 0.8]], [9.5, [0.9, 0.6]]].forEach(([sig, ks]) => {
      const B = gaussBlur(A, W, H, sig);
      if (sig === 4.5) B6 = B;
      ks.forEach(k => { for (let i = 0; i < inv.length; i++) inv[i] *= 1 - Math.min(1, k * B[i]); });
    });
    const outData = ctx.createImageData(W, H);
    const d = outData.data;
    for (let i = 0; i < A.length; i++) {
      /* il buco per la penna c'è solo dove è davvero opaca: sotto il bordo morbido il bagliore continua (niente bordo bianco) */
      const ah = Math.min(1, Math.max(0, (A[i] - 0.9) / 0.09));
      const g = (1 - inv[i]) * (1 - ah * ah * (3 - 2 * ah));
      const t = Math.min(1, B6[i] * 1.4);
      d[i * 4] = 255;
      d[i * 4 + 1] = 184 + 44 * t;
      d[i * 4 + 2] = 90 + 20 * t;
      d[i * 4 + 3] = Math.round(g * 255);
    }
    ctx.clearRect(0, 0, W, H);
    ctx.putImageData(outData, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return { url: URL.createObjectURL(blob), k: H / h };
  }
  /* aggiunge il bagliore dietro la foto di una penna (se non c'è già) */
  function ensureHalo(pic, p) {
    if (!p.image || pic.querySelector('.halo')) return;
    const halo = document.createElement('img');
    halo.className = 'halo';
    halo.alt = '';
    halo.draggable = false;
    halo.setAttribute('aria-hidden', 'true');
    pic.insertBefore(halo, pic.firstChild);
    makeHalo(p.image).then(hh => {
      halo.style.setProperty('--k', String(hh.k));
      halo.src = hh.url;
    }).catch(() => {
      /* il browser non permette di leggere i pixel (es. file aperto con doppio clic):
         tolgo l'immagine e uso il bagliore di riserva fatto con il CSS (classe no-halo) */
      halo.remove();
      pic.classList.add('no-halo');
    });
  }

  /* segna / toglie "Ce l'ho" e aggiorna solo la scheda interessata */
  function setOwned(p, value) {
    p.owned = value;
    savePen(p);
    if (filterMode !== 'all') render();
    else {
      const li = grid.querySelector('[data-id="' + p.id + '"]');
      if (li) {
        li.classList.toggle('owned', value);
        if (value) ensureHalo(li.querySelector('.pic'), p);
        li.querySelector('.open').setAttribute('aria-pressed', String(value));
        li.querySelector('.have input').checked = value;
      }
      updateCount();
    }
  }

  /* Crea la scheda <li> di un oggetto:
       <li class="pen [owned]">
         <button class="open"> <div class="pic"> [bagliore] <img class="pen-img"> </div> </button>
         [<div class="nome">Nome</div>]   ← solo se CONFIG.mostraNomi
         <div class="code">01</div>
         <div class="row"> ☐ Ce l'ho   ✎ </div>
       </li>
     Se l'oggetto non ha foto mostra la sagoma vuota (SLOT_IMG) e non si può spuntare. */
  function card(p) {
    const li = document.createElement('li');
    li.className = 'pen' + (p.owned ? ' owned' : '');
    li.dataset.id = p.id;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'open';
    btn.setAttribute('aria-pressed', String(p.owned));
    btn.setAttribute('aria-label', (p.image ? "Ce l'ho: " : 'Da aggiungere: ') + (p.code || p.name || ''));
    btn.disabled = !p.image;
    btn.addEventListener('click', () => { if (p.image) setOwned(p, !p.owned); });
    const pic = document.createElement('div');
    pic.className = 'pic' + (p.image ? '' : ' blank');
    const img = document.createElement('img');
    img.draggable = false;
    if (p.image) {
      img.className = 'pen-img';
      img.src = p.image;
      img.alt = p.name || (CONFIG.nome + ' ' + p.code);
      if (!CONFIG.mostraNomi) img.title = img.alt;   /* nome come pop-up solo se non è già scritto sotto */
      img.decoding = 'async';
      img.loading = 'lazy';
      pic.append(img);
      if (p.owned) ensureHalo(pic, p);
    } else {
      img.className = 'ghost';
      img.src = SLOT_IMG;
      img.alt = '';
      pic.append(img);
    }
    btn.append(pic);

    const code = document.createElement('div');
    code.className = 'code' + (p.limited ? ' limited' : '') + (p.code ? '' : ' none');
    code.textContent = p.code || 'N°';
    code.setAttribute('aria-label', 'Numero ' + (p.code || 'non indicato'));

    const row = document.createElement('div');
    row.className = 'row';
    const lab = document.createElement('label');
    lab.className = 'have';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = p.owned;
    cb.setAttribute('aria-label', "Ce l'ho");
    cb.addEventListener('change', () => setOwned(p, cb.checked));
    const labText = document.createElement('span');
    labText.className = 'have-text';
    labText.textContent = "Ce l'ho";
    lab.append(cb, labText);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'edit';
    edit.textContent = '\u270E';
    edit.setAttribute('aria-label', 'Dettagli');
    edit.title = 'Dettagli';
    edit.addEventListener('click', () => openEdit(p));
    row.append(lab, edit);

    /* nome scritto sotto la foto: solo se la collezione lo chiede (CONFIG.mostraNomi, es. LEGO) */
    if (CONFIG.mostraNomi) {
      const nome = document.createElement('div');
      nome.className = 'nome';
      nome.append(document.createElement('span'));
      nome.firstChild.textContent = p.name;
      li.append(btn, nome, code, row);
    } else {
      li.append(btn, code, row);
    }
    return li;
  }

  /* ridisegna tutta la griglia */
  function render() {
    const list = visiblePens();
    grid.replaceChildren(...list.map(card));
    $('noResults').hidden = list.length > 0 || pens.length === 0;
    $('emptyAll').hidden = pens.length > 0;
    updateCount(list.length);
  }

  /* ---------- finestra "Dettagli" (si apre con la matita ✎) ----------
     Codice, colore, numero, nome e info sono fissi (campi di sola lettura
     nell'HTML): chi visita cambia solo gli hashtag e "Ce l'ho". */
  let editTags = [];
  const tagSug = $('tagSug');
  /* hashtag suggeriti (da CONFIG.suggerimenti) */
  tagSug.append('Suggeriti: ');
  (CONFIG.suggerimenti || []).forEach(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.tag = t; b.textContent = '#' + t;
    b.addEventListener('click', () => addTag(t));
    tagSug.append(b);
  });
  tagSug.hidden = !(CONFIG.suggerimenti || []).length;
  const suggeriti = () => [...tagSug.querySelectorAll('button')];

  const cleanTag = t => {
    t = String(t).replace(/^#+/, '').trim().replace(/\s+/g, ' ');
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  };
  function renderTags() {
    const box = $('tagChips');
    box.replaceChildren();
    editTags.forEach((t, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.append(document.createTextNode('#' + t));
      const x = document.createElement('button');
      x.type = 'button';
      x.textContent = '\u00D7';
      x.setAttribute('aria-label', 'Togli ' + t);
      x.addEventListener('click', () => { editTags.splice(i, 1); renderTags(); });
      chip.append(x);
      box.append(chip);
    });
    /* nascondo i suggerimenti già messi */
    suggeriti().forEach(b => { b.hidden = editTags.some(t => t.toLowerCase() === b.dataset.tag.toLowerCase()); });
  }
  function addTag(raw) {
    let t = cleanTag(raw);
    if (!t) return;
    const known = suggeriti().find(b => b.dataset.tag.toLowerCase() === t.toLowerCase());
    if (known) t = known.dataset.tag;
    if (!editTags.some(x => x.toLowerCase() === t.toLowerCase())) editTags.push(t);
    renderTags();
  }
  const tagInput = $('fTagInput');
  tagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput.value); tagInput.value = ''; }
    else if (e.key === 'Backspace' && !tagInput.value && editTags.length) { editTags.pop(); renderTags(); }
  });
  tagInput.addEventListener('blur', () => {
    if (tagInput.value.trim()) { addTag(tagInput.value); tagInput.value = ''; }
  });

  /* apre la finestra "Dettagli" di un oggetto */
  function openEdit(p) {
    editing = p;
    const img = $('dlgImg');
    if (p.image) img.src = p.image; else img.removeAttribute('src');
    img.hidden = !p.image;
    $('dlgNoPhoto').hidden = !!p.image;
    $('fEp').value = p.ep;
    $('fCode').value = p.code;
    $('fName').value = p.name;
    /* colore (solo nelle pagine che hanno il campo Colore, es. Legami Erasable) */
    const dot = $('colorDot');
    if (dot) {
      dot.style.background = p.colorHex || 'transparent';
      dot.classList.toggle('empty', !p.colorHex);
      $('fColorName').value = p.colorName;
    }
    $('fInfo').textContent = p.info;
    $('fInfoBox').hidden = !p.info;          /* "Info": nascosta se l'oggetto non ne ha */
    editTags = p.tags.slice();
    tagInput.value = '';
    renderTags();
    $('fOwned').checked = p.owned;
    dlg.showModal();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   /* nessun campo evidenziato all'apertura */
  }

  $('editForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!editing) return;
    addTag(tagInput.value);
    tagInput.value = '';
    if (editTags.join('|') !== editing.tags.join('|')) editing.tagsTouched = true;
    editing.tags = editTags.slice();
    editing.owned = $('fOwned').checked;
    await savePen(editing);
    dlg.close();
  });
  $('btnClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => { editing = null; render(); });

  /* ---------- stampa in PDF ---------- */
  const printDlg = $('printDlg');
  const kindName = { all: 'tutte', missing: 'mancanti', owned: 'collezione' };
  /* penne da mettere nel PDF secondo la scelta fatta */
  function printList(kind) {
    const all = [...pens].sort(byPos);
    if (kind === 'missing') return all.filter(p => !p.owned && p.image);
    return all; /* "tutte" e "collezione": tutte le penne */
  }
  /* carica una foto e aspetta che sia pronta */
  const loadImg = src => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('immagine non leggibile'));
    i.src = src;
  });
  const pdfText = t => String(t).replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

  /* foto di un oggetto per il PDF, in due passi:
     1) ritaglio(): carica la foto e trova il riquadro dove c'è davvero il
        disegno (toglie il margine trasparente intorno);
     2) fotoPdf(): disegna solo quel riquadro, alla misura decisa in makePdf.
     Tutte le foto usano la STESSA scala: restano in proporzione tra loro
     (le penne lunghe uguali restano lunghe uguali) e nessuna viene tagliata. */
  async function ritaglio(src) {
    const img = await loadImg(src);
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const a = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (a[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }   // foto tutta trasparente: la tengo intera
    return { img, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  /* Le foto si salvano come JPEG su fondo bianco (il fondo della scheda: file leggero),
     la sagoma degli slot vuoti come PNG trasparente. */
  async function fotoPdf(r, dw, dh, transparent) {
    const K = 3.5; /* pixel per punto: circa 250 dpi */
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(dw * K));
    c.height = Math.max(1, Math.round(dh * K));
    const ctx = c.getContext('2d');
    if (!transparent) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(r.img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, transparent ? 'image/png' : 'image/jpeg', 0.92));
    return new Uint8Array(await blob.arrayBuffer());
  }

  /* La libreria dei PDF (comune/pdf-lib.min.js, circa 500 KB) viene scaricata
     SOLO la prima volta che si preme "Crea PDF": così la pagina si apre più in fretta.
     Il percorso si ricava da quello di app.js: stanno nella stessa cartella. */
  const PDF_LIB = document.currentScript.src.replace(/[^/]*$/, '') + 'pdf-lib.min.js';
  function loadPdfLib() {
    if (typeof PDFLib !== 'undefined') return Promise.resolve();
    return new Promise(resolve => {
      const sc = document.createElement('script');
      sc.src = PDF_LIB;
      sc.onload = resolve;
      sc.onerror = resolve;   /* se non si carica, makePdf mostra un avviso */
      document.head.appendChild(sc);
    });
  }

  /* titolo del PDF: disegnato con lo stesso carattere e colore del titolo della pagina */
  async function titlePng() {
    const el = document.querySelector('.titolo-testo');
    if (!el) return null;
    const cs = getComputedStyle(el), text = el.textContent.trim(), size = 200;
    const font = '700 ' + size + 'px ' + cs.fontFamily;
    try { if (document.fonts && document.fonts.load) await document.fonts.load(font, text); } catch (e) { /* uso il carattere disponibile */ }
    const c = document.createElement('canvas'), ctx = c.getContext('2d');
    ctx.font = font;
    const m = ctx.measureText(text), pad = Math.round(size * 0.04);
    const su = Math.ceil(m.actualBoundingBoxAscent), giu = Math.ceil(m.actualBoundingBoxDescent);
    c.width = Math.ceil(m.width) + 2 * pad;
    c.height = su + giu + 2 * pad;                          // alta quanto le lettere: niente spazio vuoto
    ctx.font = font;
    ctx.fillStyle = cs.color;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, pad, pad + su);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }

  /* ---- marchio Collection Time: tessera ambra con la spunta ----
     Stessa forma di favicon.svg (griglia 32×32): i due tratti della spunta
     hanno la forma delle lancette della "o" a orologio. */
  const TESSERA = 'M7 0H25Q32 0 32 7V25Q32 32 25 32H7Q0 32 0 25V7Q0 0 7 0Z';   // quadrato arrotondato 32×32
  const SPUNTA = [[8.22, 16.6], [13.4, 21.6], [24.52, 11.23]];                 // i 3 punti della spunta
  const SPESSORI = [4.6, 3.8];                                                  // tratto corto più spesso, lungo più sottile

  /* disegna il marchio su un'immagine trasparente (px × px) */
  function tesseraCanvas(ctx, fondo, spunta) {
    ctx.fillStyle = fondo;
    ctx.fill(new Path2D(TESSERA));
    ctx.strokeStyle = spunta; ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      ctx.lineWidth = SPESSORI[i];
      ctx.beginPath(); ctx.moveTo(...SPUNTA[i]); ctx.lineTo(...SPUNTA[i + 1]); ctx.stroke();
    }
  }

  /* SFONDO DELLE PAGINE: file inclinate di "tessera + collectiontime.com"
     ripetute su tutta la pagina, molto chiare, come una carta da regalo con il marchio.
     Disegnato UNA volta e riusato su tutte le pagine (il PDF resta leggero).
     SFONDO_RIGA = distanza tra una fila e l'altra, SFONDO_TESSERA = grandezza
     della tessera, SFONDO_SCRITTA = grandezza della scritta (tutto in punti). */
  const SFONDO_RIGA = 26, SFONDO_TESSERA = 9, SFONDO_SCRITTA = 8;
  async function sfondoPng(W, H) {
    const K = 2, c = document.createElement('canvas');   // 2 pixel per punto: basta, è un motivo leggero
    c.width = Math.round(W * K); c.height = Math.round(H * K);
    const ctx = c.getContext('2d');
    ctx.scale(K, K);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.26);                                     // tutto inclinato di circa 15 gradi
    ctx.font = '700 ' + SFONDO_SCRITTA + 'px Helvetica, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    const testo = 'collectiontime.com';
    const passo = SFONDO_TESSERA + 4 + ctx.measureText(testo).width + 22;   // un "mattoncino": tessera + scritta + spazio
    const R = Math.hypot(W, H) / 2 + passo;                // copro anche gli angoli della pagina ruotata
    for (let r = 0, y = -R; y < R; r++, y += SFONDO_RIGA) {
      for (let x = -R + (r % 2) * passo / 2; x < R; x += passo) {
        ctx.save();
        ctx.translate(x, y - SFONDO_TESSERA / 2);
        ctx.scale(SFONDO_TESSERA / 32, SFONDO_TESSERA / 32);
        tesseraCanvas(ctx, 'rgba(242, 169, 0, .24)', 'rgba(26, 33, 64, .16)');
        ctx.restore();
        ctx.fillStyle = 'rgba(26, 33, 64, .09)';
        ctx.fillText(testo, x + SFONDO_TESSERA + 4, y);
      }
    }
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }

  /* spezza un nome su al massimo 2 righe larghe "max" punti (il resto finisce con "…") */
  function righeNome(testo, fnt, size, max) {
    const parole = testo.split(/\s+/).filter(Boolean), righe = [];
    let riga = '';
    for (const p of parole) {
      const prova = riga ? riga + ' ' + p : p;
      if (!riga || fnt.widthOfTextAtSize(prova, size) <= max) riga = prova;
      else { righe.push(riga); riga = p; }
    }
    if (riga) righe.push(riga);
    if (righe.length > 2) righe.splice(1, righe.length - 1, righe.slice(1).join(' '));
    return righe.map(t => {
      if (fnt.widthOfTextAtSize(t, size) <= max) return t;
      while (t.length > 1 && fnt.widthOfTextAtSize(t + '…', size) > max) t = t.slice(0, -1);
      return t.trimEnd() + '…';
    });
  }

  /* crea il PDF: A4 orizzontale, CONFIG.pdfColonne oggetti per fila, CONFIG.pdfFile file per pagina.
     Ogni oggetto ha la sua scheda bianca: foto (intera, mai tagliata), [nome], numero, quadratino. */
  async function makePdf(list, kind) {
    await loadPdfLib();
    if (typeof PDFLib === 'undefined') { say('Il modulo per creare il PDF non è disponibile.'); return; }
    say('Sto creando il PDF…');
    const { PDFDocument, StandardFonts, rgb, LineCapStyle } = PDFLib;
    const doc = await PDFDocument.create();
    doc.setTitle(pdfText(CONFIG.titolo));
    doc.setAuthor('Collection Time');                 // proprietà del file (autore, programma)
    doc.setCreator('collectiontime.com');
    doc.setProducer('Collection Time');
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const titlePngBytes = await titlePng();
    const logo = titlePngBytes ? await doc.embedPng(titlePngBytes) : null;

    /* ---- colori ---- */
    const ink = rgb(26 / 255, 33 / 255, 64 / 255);          // blu scuro del sito
    const ambra = rgb(242 / 255, 169 / 255, 0);            // ambra del marchio
    const carta = rgb(0.957, 0.953, 0.937);                // fondo pagina, avorio chiaro
    const bianco = rgb(1, 1, 1), gray = rgb(0.78, 0.8, 0.85), grigio = rgb(0.35, 0.38, 0.5);
    const red = rgb(229 / 255, 10 / 255, 21 / 255);

    /* ---- misure (in punti; A4 orizzontale = 842 × 595) ---- */
    const W = 841.89, H = 595.28, MX = 28, COLS = CONFIG.pdfColonne || 25, ROWS = CONFIG.pdfFile || 2;
    const BAND = 30;                                        // banda blu in alto
    /* titolo su un cartellino bianco, come le schede; TITOLO_H = altezza delle lettere */
    let TITOLO_H = 32;
    const TITOLO_MAXW = W - 2 * MX - 40;
    if (logo && TITOLO_H * logo.width / logo.height > TITOLO_MAXW) TITOLO_H = TITOLO_MAXW * logo.height / logo.width;   // titoli molto lunghi
    const LOGO_W = logo ? TITOLO_H * logo.width / logo.height : 0;
    const CART_PX = 26, CART_PY = 12, CART_H = TITOLO_H + 2 * CART_PY;   // margini del cartellino
    const areaTop = H - BAND - 16, gridBottom = 52;         // spazio tra la banda e il piè di pagina
    const TITOLO_GAP = 18;                                  // spazio tra titolo e schede
    const gridTop = areaTop - CART_H - TITOLO_GAP;          // spazio massimo per le schede
    const ROW_GAP = 12;
    const colPitch = (W - 2 * MX) / COLS;
    const CARD_GAP = Math.min(6, colPitch * 0.06);          // spazio tra una scheda e l'altra
    const cardW = colPitch - CARD_GAP;
    const PAD = Math.min(5, cardW * 0.06);                  // margine interno della scheda
    const GAP = 3, CODE_H = 13, BOX = 8;
    const NOME_SIZE = 7.5, NOME_RIGA = 9;
    const nomi = !!CONFIG.mostraNomi;                       // LEGO sì, Legami no
    const NOME_H = nomi ? 2 * NOME_RIGA + GAP : 0;
    const TESTO_H = GAP + NOME_H + CODE_H + GAP + BOX;       // tutto quello che sta sotto la foto
    const fotoW = cardW - 2 * PAD;
    const fotoMaxH = (gridTop - gridBottom - (ROWS - 1) * ROW_GAP) / ROWS - 2 * PAD - TESTO_H;

    /* carico e ritaglio tutte le foto e scelgo la misura:
       • oggetti alti e stretti (CONFIG.proporzione > 1: penne, lampade) → tutti ALTI UGUALI;
       • foto quadrate (LEGO) → tutte con la STESSA scala, scelta in modo che la foto
         più larga e quella più alta entrino nella scheda (restano in proporzione). */
    const foto = await Promise.all(list.map(p => (p.image || SLOT_IMG) ? ritaglio(p.image || SLOT_IMG).catch(() => null) : null));
    const altiUguali = (CONFIG.proporzione || 7) > 1;
    const maxW = Math.max(1, ...foto.map(f => f ? f.w : 0)), maxH = Math.max(1, ...foto.map(f => f ? f.h : 0));
    const scala = Math.min(fotoW / maxW, fotoMaxH / maxH);
    const misura = f => {                                   // larghezza e altezza di una foto nel PDF
      const k = altiUguali ? Math.min(fotoW / f.w, fotoMaxH / f.h) : scala;
      return [f.w * k, f.h * k];
    };
    const fotoH = altiUguali ? fotoMaxH : maxH * scala;     // altezza della zona foto
    const cardH = fotoH + 2 * PAD + TESTO_H;
    /* titolo + schede formano un blocco unico, centrato in altezza nella pagina */
    const righe = Math.min(ROWS, Math.ceil(list.length / COLS));
    const avanzo = (gridTop - gridBottom - righe * cardH - (righe - 1) * ROW_GAP) / 2;
    const cartTop = areaTop - avanzo, primaFila = gridTop - avanzo;

    /* scheda bianca con gli angoli arrotondati */
    const R = Math.min(6, cardW * 0.12);
    const scheda = (w, h) => `M${R} 0H${w - R}Q${w} 0 ${w} ${R}V${h - R}Q${w} ${h} ${w - R} ${h}H${R}Q0 ${h} 0 ${h - R}V${R}Q0 0 ${R} 0Z`;
    const schedaPath = scheda(cardW, cardH);

    /* piccolo marchio pieno, disegnato a vettori */
    function marchio(pg, x, y, size, spunta) {
      const scale = size / 32;
      pg.drawSvgPath(TESSERA, { x, y, scale, color: ambra });
      const P = SPUNTA.map(([px, py]) => ({ x: x + px * scale, y: y - py * scale }));
      for (let k = 0; k < 2; k++) pg.drawLine({ start: P[k], end: P[k + 1], thickness: SPESSORI[k] * scale, color: spunta, lineCap: LineCapStyle.Round });
    }

    /* scritta nella banda in alto: che cosa è stato stampato */
    const cosa = { owned: 'La mia collezione', missing: 'Quelle che mi mancano', all: 'Checklist da compilare' }[kind];

    const sfondo = await doc.embedPng(await sfondoPng(W, H));
    const pages = [];
    let ghost = null;      // sagoma degli slot vuoti: inserita una volta sola
    const perPage = COLS * ROWS;
    for (let start = 0; start < list.length; start += perPage) {
      const page = doc.addPage([W, H]);
      pages.push(page);

      /* sfondo: carta avorio + motivo di tessere Collection Time */
      page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: carta });
      page.drawImage(sfondo, { x: 0, y: 0, width: W, height: H });

      /* banda blu in alto con il marchio e la scelta di stampa */
      page.drawRectangle({ x: 0, y: H - BAND, width: W, height: BAND, color: ink });
      page.drawRectangle({ x: 0, y: H - BAND - 2.5, width: W, height: 2.5, color: ambra });
      marchio(page, MX, H - 7, 16, ink);
      page.drawText('Collection Time', { x: MX + 22, y: H - 20, size: 12, font: bold, color: bianco });
      const cw = font.widthOfTextAtSize(cosa, 10);
      page.drawText(cosa, { x: W - MX - cw, y: H - 19.5, size: 10, font, color: bianco });

      /* titolo della collezione sul suo cartellino (bordo ambra sotto) */
      const title = pdfText(CONFIG.titolo);
      const tw = logo ? LOGO_W : bold.widthOfTextAtSize(title, TITOLO_H * 1.35);
      const cartW = tw + 2 * CART_PX;
      page.drawSvgPath(scheda(cartW, CART_H), { x: (W - cartW) / 2, y: cartTop, color: bianco, borderColor: gray, borderWidth: 0.6 });
      page.drawRectangle({ x: (W - cartW) / 2 + R, y: cartTop - CART_H, width: cartW - 2 * R, height: 2.5, color: ambra });
      if (logo) page.drawImage(logo, { x: (W - LOGO_W) / 2, y: cartTop - CART_PY - TITOLO_H, width: LOGO_W, height: TITOLO_H });
      else page.drawText(title, { x: (W - tw) / 2, y: cartTop - CART_PY - TITOLO_H, size: TITOLO_H * 1.35, font: bold, color: ink });

      const chunk = list.slice(start, start + perPage);
      for (let i = 0; i < chunk.length; i++) {
        const p = chunk[i];
        const r = Math.floor(i / COLS), c = i % COLS;
        const cx = MX + c * colPitch + colPitch / 2;        // centro della colonna
        const top = primaFila - r * (cardH + ROW_GAP);        // bordo alto della scheda
        const spuntata = kind === 'owned' && p.owned;

        /* scheda: bordo ambra se ce l'hai, grigio se no */
        page.drawSvgPath(schedaPath, { x: cx - cardW / 2, y: top, color: bianco,
          borderColor: spuntata ? ambra : gray, borderWidth: spuntata ? 1.4 : 0.6 });

        /* foto appoggiata in basso nella sua zona, come su uno scaffale */
        const fotoTop = top - PAD, f = foto[start + i];
        if (f) {
          const [dw, dh] = misura(f), x = cx - dw / 2, y = fotoTop - fotoH;
          if (p.image) page.drawImage(await doc.embedJpg(await fotoPdf(f, dw, dh, false)), { x, y, width: dw, height: dh });
          else {
            if (!ghost) ghost = await doc.embedPng(await fotoPdf(f, dw, dh, true));
            page.drawImage(ghost, { x, y, width: dw, height: dh });
          }
        }
        let y = fotoTop - fotoH - GAP;

        /* nome (solo se la collezione lo chiede: CONFIG.mostraNomi), su 1 o 2 righe */
        if (nomi) {
          const righe = righeNome(pdfText(p.name || ''), bold, NOME_SIZE, cardW - 2 * PAD);
          const y0 = y - NOME_RIGA + 2 - (2 - righe.length) * NOME_RIGA / 2;   // 1 riga = centrata nello spazio di 2
          righe.forEach((t, k) => {
            const tw = bold.widthOfTextAtSize(t, NOME_SIZE);
            page.drawText(t, { x: cx - tw / 2, y: y0 - k * NOME_RIGA, size: NOME_SIZE, font: bold, color: ink });
          });
          y -= NOME_H;
        }

        /* riquadro con il numero */
        const boxY = y - CODE_H;
        page.drawRectangle({ x: cx - 13, y: boxY, width: 26, height: CODE_H, color: carta, borderColor: gray, borderWidth: 0.6 });
        const code = pdfText(p.code || '');
        if (code) {
          const tw = bold.widthOfTextAtSize(code, 7.5);
          page.drawText(code, { x: cx - tw / 2, y: boxY + 3.6, size: 7.5, font: bold, color: p.limited ? red : ink });
        }

        /* quadratino della checklist (spunta ambra se ce l'hai) */
        const qy = boxY - GAP - BOX;
        page.drawRectangle({ x: cx - BOX / 2, y: qy, width: BOX, height: BOX, color: bianco, borderColor: grigio, borderWidth: 0.8 });
        if (spuntata) {
          page.drawLine({ start: { x: cx - 2.6, y: qy + 3.9 }, end: { x: cx - 0.7, y: qy + 1.7 }, thickness: 1.3, color: ambra });
          page.drawLine({ start: { x: cx - 0.7, y: qy + 1.7 }, end: { x: cx + 3, y: qy + 6.4 }, thickness: 1.3, color: ambra });
        }
      }
    }

    /* filigrana: il marchio grande al centro, disegnato una volta su un'immagine
       trasparente e poi messo su ogni pagina SOPRA le foto (così non si toglie ritagliando).
       FILIGRANA_OPACITA: 0 = invisibile, 1 = piena. Più è alta, più protegge dalle copie. */
    const FILIGRANA_OPACITA = 0.12;
    const fc = document.createElement('canvas');
    fc.width = fc.height = 512;
    const fctx = fc.getContext('2d');
    fctx.scale(16, 16);
    tesseraCanvas(fctx, 'rgba(26, 33, 64, .5)', '#1A2140');   // tessera a metà, spunta piena: nessuna macchia
    const filigrana = await doc.embedPng(new Uint8Array(await (await new Promise(r => fc.toBlob(r, 'image/png'))).arrayBuffer()));

    pages.forEach((pg, i) => {
      const WM = 250;
      pg.drawImage(filigrana, { x: (W - WM) / 2, y: primaFila - (righe * cardH + (righe - 1) * ROW_GAP + WM) / 2, width: WM, height: WM, opacity: FILIGRANA_OPACITA * 2 });

      /* piè di pagina a sinistra: tessera piccola + indirizzo del sito */
      marchio(pg, MX, 36, 18, ink);
      pg.drawText('collectiontime.com', { x: MX + 24, y: 22, size: 14, font: bold, color: ink });

      /* numero di pagina in basso a destra */
      const t = (i + 1) + ' su ' + pages.length;
      const tw = font.widthOfTextAtSize(t, 9);
      pg.drawText(t, { x: W - MX - tw, y: 22, size: 9, font, color: grigio });
    });

    const bytes = await doc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    /* nome del file, es. "collection-time_legami-erasable_mancanti_2026-09-23.pdf" */
    const oggi = new Date(), dd = n => String(n).padStart(2, '0');                 // data del tuo computer (non quella di Londra)
    a.download = 'collection-time_' + CONFIG.id + '_' + kindName[kind] + '_' + oggi.getFullYear() + '-' + dd(oggi.getMonth() + 1) + '-' + dd(oggi.getDate()) + '.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    say('PDF salvato nella cartella Download (' + pages.length + (pages.length === 1 ? ' pagina).' : ' pagine).'));
  }

  $('btnPrint').addEventListener('click', () => {
    const total = pens.filter(p => p.image || p.owned).length;
    $('cnt-owned').textContent = pens.filter(p => p.owned).length + ' su ' + total;
    $('cnt-missing').textContent = pens.filter(p => !p.owned && p.image).length + ' su ' + total;
    $('cnt-all').textContent = 'vuoto';
    printDlg.showModal();
  });
  $('printCancel').addEventListener('click', () => printDlg.close());
  $('printGo').addEventListener('click', async () => {
    const chosen = printDlg.querySelector('input[name=printKind]:checked');
    const kind = chosen ? chosen.value : 'owned';
    const list = printList(kind);
    if (!list.length) {
      say(kind === 'owned' ? 'Non hai ancora segnato niente nella tua collezione.' : 'Non ti manca nulla.');
      return;
    }
    printDlg.close();
    try {
      await makePdf(list, kind);
    } catch (err) {
      console.error(err);
      /* aperta con doppio clic (file://) il browser vieta di leggere le foto */
      say(location.protocol === 'file:'
        ? 'Il PDF non si può creare con la pagina aperta dal Finder: aprila dal sito o da un server locale.'
        : 'Non sono riuscito a creare il PDF.');
    }
  });

  /* ---------- controlli ----------
     La lente apre e chiude il campo (lo fa script.js, come nelle altre pagine);
     qui scrivendo si filtrano gli oggetti. */
  $('search').addEventListener('input', e => { query = e.target.value; render(); });
  $('filter').addEventListener('change', e => { filterMode = e.target.value; render(); });
  $('sort').addEventListener('change', e => { sortDir = e.target.value === 'desc' ? -1 : 1; render(); });

  /* ---------- id rinumerati (settembre 2026) ----------
     Gli id dell'elenco PENNE sono stati rimessi in ordine (seed-001, seed-002…).
     Chi aveva già aperto la pagina ha le spunte salvate con gli id vecchi:
     le sposto sugli id nuovi riconoscendo la penna da numero + nome
     (le schede vecchie avevano anche questi campi).
     Quando tutti avranno riaperto la pagina puoi togliere questa funzione
     e la riga "salvate = rinumera(salvate);" in "avvio". */
  function rinumera(salvate) {
    const idNuovo = new Map(SEED.map(s => [s.code + '|' + s.name, s.id]));
    const spostate = [];
    const altre = salvate.filter(p => {
      const nuovo = p.seed && idNuovo.get(p.code + '|' + p.name);
      if (!nuovo || nuovo === p.id) return true;
      spostate.push(Object.assign(p, { id: nuovo }));
      return false;
    });
    /* una sola scheda per id: vincono quelle appena spostate */
    const perId = new Map(altre.map(p => [p.id, p]));
    spostate.forEach(p => perId.set(p.id, p));
    return [...perId.values()];
  }

  /* ---------- avvio ----------
     1. leggo dal browser le spunte e gli hashtag di chi visita
     2. li unisco all'elenco PENNE (oggetti nuovi, tolti o cambiati: vale l'elenco)
     3. riscrivo l'archivio con i soli oggetti dell'elenco e i soli dati del visitatore */
  (async function avvio() {
    const nuovo = s => Object.assign({}, s, { owned: false, tags: s.tags.slice(), tagsTouched: false });
    try {
      db = await openDB();
      let salvate = await wrap(db.transaction(STORE).objectStore(STORE).getAll());
      salvate = rinumera(salvate);
      const perId = new Map(salvate.map(v => [v.id, v]));
      pens = SEED.map(s => {
        const p = nuovo(s), v = perId.get(s.id);
        if (v) {
          p.owned = v.owned === true;
          if (v.tagsTouched && Array.isArray(v.tags)) { p.tags = v.tags.map(String); p.tagsTouched = true; }
        }
        return p;
      });
      const t = db.transaction(STORE, 'readwrite'), st = t.objectStore(STORE);
      st.clear();
      pens.filter(p => p.owned || p.tagsTouched).forEach(p => st.put(datiVisitatore(p)));
      await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    } catch (e) {
      db = null;
      pens = SEED.map(nuovo);
      say('Questo browser non permette di salvare la collezione (per esempio in navigazione privata).');
    }
    render();
  })();
})();
