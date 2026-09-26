/* =====================================================================
   app.js — pagine delle collezioni (Collection Time)
   ---------------------------------------------------------------------
   UN SOLO FILE per tutte le collezioni (penne, lampade, minifigure…):
   ogni pagina lo richiama con  <script src="../../comune/app.js?v=…">.
   Il browser lo scarica una volta sola e lo riusa per tutte le pagine.
   Legge dall'HTML due blocchi:
     • CONFIG → testi e misure della collezione
     • ELENCO → l'elenco degli oggetti (numero, nome, foto…)
   Per aggiungere oggetti NON serve toccare questo file: basta
   aggiungere una riga all'ELENCO nell'HTML.

   Cosa resta salvato nel browser di chi visita (IndexedDB)?
   Solo i suoi dati: "Ce l'ho", i doppioni e gli hashtag che ha cambiato.
   Tutto il resto (nome, numero, colore, foto, info) arriva sempre
   dall'ELENCO, così una modifica all'HTML si vede subito.

   Indice delle sezioni (cerca il titolo con ---------- ):
     · elenco (da ELENCO)
     · archivio (IndexedDB)
     · ricerca e filtri
     · disegno della pagina (+ bagliore)
     · finestra "Dettagli"
     · stampa in PDF o immagine
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

  /* ---------- elenco (da ELENCO, nell'HTML) ----------
     Trasformo le righe scritte nell'HTML (campi in italiano) nel formato
     usato dal resto del programma. L'ordine dell'elenco = ordine sulla pagina. */

  /* Sagoma grigia mostrata al posto degli oggetti senza foto (solo Legami ce l'ha). */
  const SLOT_IMG = 'immagini/slot-vuoto.webp';

  const idVisti = new Set();
  const SEED = ELENCO.map((r, i) => {
    /* se manca l'id lo ricavo dal nome del file della foto (es. "penna-96-riccio") */
    const id = r.id || ('penna-' + String(r.foto || i).split('/').pop().replace(/\.[a-z]+$/i, ''));
    if (idVisti.has(id)) console.warn('ELENCO: l\'id "' + id + '" è usato due volte. Cambiane uno!');
    idVisti.add(id);
    return {
      id,
      pos: i,                                  /* posizione = ordine nell'elenco */
      code: r.numero || '',
      codice: r.codice || '',
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
  let filterMode = 'all';  /* filtro scelto: all / owned / missing / doppi */
  let sortDir = 1;         /* ordine: 1 = dalla prima, -1 = dalla più recente */
  let query = '';          /* testo scritto nella ricerca */
  let editing = null;      /* oggetto aperto nella finestra "Dettagli" */

  /* ---------- archivio (IndexedDB) ----------
     Ogni collezione ha il suo archivio, con il nome scritto in CONFIG.dbName.
     Per ogni oggetto salvo solo: id, owned ("Ce l'ho"), doppi (quanti doppioni),
     tags e tagsTouched (tagsTouched = hashtag cambiati dal visitatore). Gli stessi campi li
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
  const datiVisitatore = p => ({ id: p.id, owned: p.owned, doppi: p.doppi, tags: p.tags, tagsTouched: p.tagsTouched });
  const savePen = p => db
    ? wrap(db.transaction(STORE, 'readwrite').objectStore(STORE).put(datiVisitatore(p)))
        .then(segnalaModifica)                                  /* se hai fatto l'accesso, aggiorna anche il cloud (script.js) */
        .catch(() => say('Salvataggio non riuscito.'))
    : Promise.resolve();

  /* ---------- ricerca e filtri ---------- */
  /* gli oggetti si mostrano sempre nell'ordine dell'ELENCO (campo pos) */
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
    const parts = [p.code, p.codice, p.name, p.info, p.colorName];
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
      .filter(p => filterMode === 'owned' ? p.owned
        : filterMode === 'missing' ? (!p.owned && p.image)
        : filterMode === 'doppi' ? p.doppi > 0
        : true)
      .filter(p => { if (!terms.length) return true; const hay = searchText(p); return terms.every(t => hay.includes(t)); })
      .sort((a, b) => sortDir * byPos(a, b));
  }

  /* ---------- disegno della pagina ---------- */
  /* scrive "12 possedute su 103 · 3 doppioni" (gli oggetti senza foto non contano) */
  function updateCount(shown) {
    const owned = pens.filter(p => p.owned).length;
    const total = pens.filter(p => p.image || p.owned).length;
    const doppi = pens.reduce((t, p) => t + p.doppi, 0);
    let t = owned + ' ' + CONFIG.possedute + ' su ' + total;
    if (doppi) t += ' · ' + doppi + (doppi === 1 ? ' doppione' : ' doppioni');
    if (typeof shown === 'number' && shown !== pens.length) t += ' · ' + shown + (shown === 1 ? ' visibile' : ' visibili');
    $('count').textContent = t;
  }

  /* ---------- bagliore ----------
     L'alone arancio-giallo delle cose che hai è calcolato in comune/bagliore.js
     (uguale anche in "Mi mancano / Doppioni / Cerca"): qui basta chiamarlo. */
  const ensureHalo = (pic, p) => accendiBagliore(pic, p.image);

  /* segna / toglie "Ce l'ho" e aggiorna solo la scheda interessata */
  function setOwned(p, value) {
    p.owned = value;
    const aveviDoppi = !value && p.doppi > 0;
    if (!value) p.doppi = 0;                /* non ce l'hai più: niente doppioni */
    savePen(p);
    if (filterMode !== 'all') render();
    else {
      const li = grid.querySelector('[data-id="' + p.id + '"]');
      if (li) {
        li.classList.toggle('owned', value);
        if (value) ensureHalo(li.querySelector('.pic'), p);
        li.querySelector('.open').setAttribute('aria-pressed', String(value));
        li.querySelector('.have input').checked = value;
        if (aveviDoppi) li.querySelector('.doppi').replaceWith(doppiBox(p));   /* contatore di nuovo a 0 */
      }
      updateCount();
    }
  }

  /* Contatore dei doppioni sotto "Ce l'ho":  Doppi  − 2 +
     (aspetto in comune/collezione.css, sezione 5, voce .doppi) */
  function doppiBox(p) {
    const box = document.createElement('div');
    box.className = 'doppi';
    const etichetta = document.createElement('span');
    etichetta.className = 'etichetta';
    etichetta.textContent = 'Doppi';
    const conta = document.createElement('span');
    conta.className = 'conta';
    const meno = document.createElement('button'), n = document.createElement('span'), piu = document.createElement('button');
    meno.type = piu.type = 'button';
    meno.textContent = '\u2212';
    piu.textContent = '+';
    meno.setAttribute('aria-label', 'Un doppione in meno');
    piu.setAttribute('aria-label', 'Un doppione in più');
    n.className = 'n';
    conta.append(meno, n, piu);
    box.append(etichetta, conta);
    const mostra = () => { n.textContent = p.doppi; meno.disabled = !p.doppi; box.classList.toggle('si', p.doppi > 0); };
    const cambia = d => {
      p.doppi = Math.max(0, p.doppi + d);
      if (p.doppi && !p.owned) { mostra(); return setOwned(p, true); }   /* un doppione vuol dire che ce l'hai: segno anche "Ce l'ho" */
      savePen(p);
      if (filterMode === 'doppi' && !p.doppi) render();   /* filtro "Doppioni": se arriva a 0 sparisce */
      else { mostra(); updateCount(); }
    };
    meno.addEventListener('click', () => cambia(-1));
    piu.addEventListener('click', () => cambia(1));
    mostra();
    return box;
  }

  /* Crea la scheda <li> di un oggetto:
       <li class="pen [owned]">
         <button class="open"> <div class="pic"> [bagliore] <img class="pen-img"> </div> </button>
         [<div class="nome">Nome</div>]   ← solo se CONFIG.mostraNomi
         <div class="code">01</div>
         <div class="row"> ☐ Ce l'ho   ✎ </div>
         <div class="doppi"> Doppi − 0 + </div>   ← solo per gli oggetti con la foto
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
    const doppi = p.image ? [doppiBox(p)] : [];   /* gli slot vuoti (senza foto) non hanno doppioni */
    if (CONFIG.mostraNomi) {
      const nome = document.createElement('div');
      nome.className = 'nome';
      nome.append(document.createElement('span'));
      nome.firstChild.textContent = p.name;
      li.append(btn, nome, code, row, ...doppi);
    } else {
      li.append(btn, code, row, ...doppi);
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
    $('fCodice').value = p.codice;
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
     2) fotoTela(): disegna solo quel riquadro, alla misura decisa in makePdf.
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
  /* Foto su fondo bianco (il fondo della scheda: nel PDF diventa un JPEG leggero),
     sagoma degli slot vuoti trasparente (nel PDF diventa un PNG). */
  function fotoTela(r, dw, dh, transparent) {
    const K = 3.5; /* pixel per punto: circa 250 dpi */
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(dw * K));
    c.height = Math.max(1, Math.round(dh * K));
    const ctx = c.getContext('2d');
    if (!transparent) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(r.img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    return c;
  }
  /* tela → file (JPEG o PNG), per metterla nel PDF o per scaricarla */
  const fileDi = (c, tipo) => new Promise(r => c.toBlob(r, tipo, 0.9));
  const byteDi = async (c, tipo) => new Uint8Array(await (await fileDi(c, tipo)).arrayBuffer());

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

  /* titolo del PDF: lo disegno con lo stesso carattere e colore del titolo della pagina */
  async function titoloTela() {
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
    return c;
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
  function sfondoTela(W, H) {
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
    return c;
  }

  /* ---- PAGINA IMMAGINE ----
     Per l'immagine da condividere disegno con le stesse misure del PDF, ma su una tela.
     Questa "pagina finta" ha gli stessi comandi di una pagina PDF (drawRectangle, drawText…):
     così il disegno è scritto UNA volta sola e serve sia al PDF sia all'immagine.
     Nel PDF l'altezza si conta dal basso, sulla tela dall'alto: per questo si usa H - y.
     IMG_K = pixel per punto (2: un A4 verticale viene largo 1190 pixel). */
  const IMG_K = 2;
  function paginaTela(W, H, bold) {
    const c = document.createElement('canvas');
    c.width = Math.round(W * IMG_K); c.height = Math.round(H * IMG_K);
    const ctx = c.getContext('2d');
    ctx.scale(IMG_K, IMG_K);
    const colore = k => 'rgb(' + [k.red, k.green, k.blue].map(v => Math.round(v * 255)) + ')';
    const bordo = (o, disegna) => {
      if (!o.borderColor) return;
      ctx.strokeStyle = colore(o.borderColor); ctx.lineWidth = o.borderWidth || 1; disegna();
    };
    return {
      tela: c,
      drawRectangle(o) {
        const y = H - o.y - o.height;
        if (o.color) { ctx.fillStyle = colore(o.color); ctx.fillRect(o.x, y, o.width, o.height); }
        bordo(o, () => ctx.strokeRect(o.x, y, o.width, o.height));
      },
      drawSvgPath(d, o) {                                  // forme (schede arrotondate, marchio)
        const k = o.scale || 1, forma = new Path2D(d);
        ctx.save(); ctx.translate(o.x, H - o.y); ctx.scale(k, k);
        if (o.color) { ctx.fillStyle = colore(o.color); ctx.fill(forma); }
        bordo(o, () => { ctx.lineWidth /= k; ctx.stroke(forma); });
        ctx.restore();
      },
      drawLine(o) {
        ctx.strokeStyle = colore(o.color); ctx.lineWidth = o.thickness; ctx.lineCap = o.lineCap ? 'round' : 'butt';
        ctx.beginPath(); ctx.moveTo(o.start.x, H - o.start.y); ctx.lineTo(o.end.x, H - o.end.y); ctx.stroke();
      },
      drawImage(img, o) {
        ctx.globalAlpha = o.opacity == null ? 1 : o.opacity;
        ctx.drawImage(img, o.x, H - o.y - o.height, o.width, o.height);
        ctx.globalAlpha = 1;
      },
      drawText(t, o) {
        ctx.fillStyle = colore(o.color);
        ctx.font = (o.font === bold ? '700 ' : '400 ') + o.size + 'px Helvetica, Arial, sans-serif';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(t, o.x, H - o.y);
      }
    };
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

  /* crea il PDF (immagine = false) o l'immagine da condividere (immagine = true).
     Ogni oggetto ha la sua scheda bianca: foto (intera, mai tagliata), [nome], numero, quadratino.
     L'IMMAGINE ha la stessa grafica del PDF ma è UNA sola, alta quanto serve:
     tutti gli oggetti uno sotto l'altro, senza spazio vuoto in fondo.
     Due impaginazioni:
     • pagine Legami (hanno CONFIG.pdfColonne): A4 ORIZZONTALE, CONFIG.pdfColonne oggetti
       per fila e CONFIG.pdfFile file per pagina, come il poster;
     • tutte le altre pagine (non hanno pdfColonne): A4 VERTICALE, PDF_COLONNE oggetti per fila
       e tante file quante ne entrano nella pagina. Le schede hanno sempre la stessa misura,
       quindi una serie normale sta in una pagina sola. L'ultima fila si mette al centro. */
  const PDF_COLONNE = 6;   // oggetti per fila nel PDF verticale (più alto = schede più piccole)
  async function makePdf(list, kind, immagine) {
    await loadPdfLib();   // serve anche per l'immagine: misura le scritte
    if (typeof PDFLib === 'undefined') { say('Il modulo per creare il PDF non è disponibile.'); return; }
    say(immagine ? "Sto creando l'immagine…" : 'Sto creando il PDF…');
    const { PDFDocument, StandardFonts, rgb, LineCapStyle } = PDFLib;
    const doc = await PDFDocument.create();
    doc.setTitle(pdfText(CONFIG.titolo));
    doc.setAuthor('Collection Time');                 // proprietà del file (autore, programma)
    doc.setCreator('collectiontime.com');
    doc.setProducer('Collection Time');
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    /* una tela va dentro il PDF (come JPEG o PNG); nell'immagine si usa così com'è */
    const metti = async (c, jpeg) => immagine ? c : jpeg ? doc.embedJpg(await byteDi(c, 'image/jpeg')) : doc.embedPng(await byteDi(c, 'image/png'));
    const titolo = await titoloTela();
    const logo = titolo ? await metti(titolo) : null;

    /* ---- colori ---- */
    const ink = rgb(26 / 255, 33 / 255, 64 / 255);          // blu scuro del sito
    const ambra = rgb(242 / 255, 169 / 255, 0);            // ambra del marchio
    const carta = rgb(0.957, 0.953, 0.937);                // fondo pagina, avorio chiaro
    const bianco = rgb(1, 1, 1), gray = rgb(0.78, 0.8, 0.85), grigio = rgb(0.35, 0.38, 0.5);
    const red = rgb(229 / 255, 10 / 255, 21 / 255);

    /* ---- misure (in punti; A4 = 595 × 842) ---- */
    const orizzontale = !!CONFIG.pdfColonne;                // solo le pagine Legami
    const W = orizzontale ? 841.89 : 595.28, MX = 28;
    let H = orizzontale ? 595.28 : 841.89;                  // l'immagine poi diventa alta quanto serve
    const COLS = orizzontale ? CONFIG.pdfColonne : PDF_COLONNE;
    let ROWS = orizzontale ? (CONFIG.pdfFile || 2) : 0;     // nel PDF verticale lo calcolo più sotto
    const BAND = 30;                                        // banda blu in alto
    /* titolo scritto su un cartellino bianco, come le schede; TITOLO_H = altezza delle lettere */
    let TITOLO_H = 32;
    const TITOLO_MAXW = W - 2 * MX - 40;
    if (logo && TITOLO_H * logo.width / logo.height > TITOLO_MAXW) TITOLO_H = TITOLO_MAXW * logo.height / logo.width;   // titoli molto lunghi
    const LOGO_W = logo ? TITOLO_H * logo.width / logo.height : 0;
    /* margini del cartellino bianco intorno al titolo */
    const CART_PX = 26, CART_PY = 12, CART_H = TITOLO_H + 2 * CART_PY;
    const SOPRA = BAND + 16, gridBottom = 52;               // spazio sotto la banda e per il piè di pagina
    const TITOLO_GAP = 18;                                  // spazio tra titolo e schede
    const spazio = H - SOPRA - CART_H - TITOLO_GAP - gridBottom;   // altezza massima per le schede
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
    const fotoMaxH = orizzontale ? (spazio - (ROWS - 1) * ROW_GAP) / ROWS - 2 * PAD - TESTO_H
                                 : fotoW;                   // PDF verticale: zona foto quadrata

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
    if (!orizzontale) ROWS = Math.max(1, Math.floor((spazio + ROW_GAP) / (cardH + ROW_GAP)));   // file che entrano
    if (immagine) {                                         // immagine: tutte le file, altezza su misura
      ROWS = Math.ceil(list.length / COLS);
      H = SOPRA + CART_H + TITOLO_GAP + ROWS * cardH + (ROWS - 1) * ROW_GAP + gridBottom;
    }
    const areaTop = H - SOPRA, gridTop = areaTop - CART_H - TITOLO_GAP;
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

    const sfondo = await metti(sfondoTela(W, H));
    const pages = [];
    let ghost = null;      // sagoma degli slot vuoti: inserita una volta sola
    const perPage = COLS * ROWS;
    for (let start = 0; start < list.length; start += perPage) {
      const page = immagine ? paginaTela(W, H, bold) : doc.addPage([W, H]);
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
        const inFila = Math.min(COLS, chunk.length - r * COLS);                 // oggetti in questa fila
        const spost = orizzontale ? 0 : (COLS - inFila) * colPitch / 2;          // fila corta: al centro (non per Legami)
        const cx = MX + spost + c * colPitch + colPitch / 2;                     // centro della colonna
        const top = primaFila - r * (cardH + ROW_GAP);        // bordo alto della scheda
        const spuntata = kind === 'owned' && p.owned;

        /* scheda: bordo ambra se ce l'hai, grigio se no */
        page.drawSvgPath(schedaPath, { x: cx - cardW / 2, y: top, color: bianco,
          borderColor: spuntata ? ambra : gray, borderWidth: spuntata ? 1.4 : 0.6 });

        /* foto appoggiata in basso nella sua zona, come su uno scaffale */
        const fotoTop = top - PAD, f = foto[start + i];
        if (f) {
          const [dw, dh] = misura(f), x = cx - dw / 2, y = fotoTop - fotoH;
          if (p.image) page.drawImage(await metti(fotoTela(f, dw, dh, false), true), { x, y, width: dw, height: dh });
          else {
            if (!ghost) ghost = await metti(fotoTela(f, dw, dh, true));
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
    const filigrana = await metti(fc);

    pages.forEach((pg, i) => {
      const WM = Math.min(250, H * 0.6);                    // più piccola nelle immagini basse
      pg.drawImage(filigrana, { x: (W - WM) / 2, y: primaFila - (righe * cardH + (righe - 1) * ROW_GAP + WM) / 2, width: WM, height: WM, opacity: FILIGRANA_OPACITA * 2 });

      /* piè di pagina a sinistra: tessera piccola + indirizzo del sito */
      marchio(pg, MX, 36, 18, ink);
      pg.drawText('collectiontime.com', { x: MX + 24, y: 22, size: 14, font: bold, color: ink });

      /* numero di pagina in basso a destra (non nell'immagine: è una sola) */
      if (immagine) return;
      const t = (i + 1) + ' su ' + pages.length;
      const tw = font.widthOfTextAtSize(t, 9);
      pg.drawText(t, { x: W - MX - tw, y: 22, size: 9, font, color: grigio });
    });

    const blob = immagine ? await fileDi(pages[0].tela, 'image/jpeg')
                          : new Blob([await doc.save()], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    /* nome del file, es. "collection-time_legami-erasable_mancanti_2026-09-23.pdf" (o .jpg) */
    const oggi = new Date(), dd = n => String(n).padStart(2, '0');                 // data del tuo computer (non quella di Londra)
    a.download = 'collection-time_' + CONFIG.id + '_' + kindName[kind] + '_' + oggi.getFullYear() + '-' + dd(oggi.getMonth() + 1) + '-' + dd(oggi.getDate()) + (immagine ? '.jpg' : '.pdf');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    say(immagine ? 'Immagine salvata nella cartella Download.'
                 : 'PDF salvato nella cartella Download (' + pages.length + (pages.length === 1 ? ' pagina).' : ' pagine).'));
  }

  $('btnPrint').addEventListener('click', () => {
    const total = pens.filter(p => p.image || p.owned).length;
    $('cnt-owned').textContent = pens.filter(p => p.owned).length + ' su ' + total;
    $('cnt-missing').textContent = pens.filter(p => !p.owned && p.image).length + ' su ' + total;
    $('cnt-all').textContent = 'vuoto';
    printDlg.showModal();
  });
  $('printCancel').addEventListener('click', () => printDlg.close());
  /* "Crea PDF" (da stampare) e "Crea immagine" (da condividere) */
  async function crea(immagine) {
    const chosen = printDlg.querySelector('input[name=printKind]:checked');
    const kind = chosen ? chosen.value : 'owned';
    const list = printList(kind);
    if (!list.length) {
      say(kind === 'owned' ? 'Non hai ancora segnato niente nella tua collezione.' : 'Non ti manca nulla.');
      return;
    }
    printDlg.close();
    try {
      await makePdf(list, kind, immagine);
    } catch (err) {
      console.error(err);
      /* aperta con doppio clic (file://) il browser vieta di leggere le foto */
      const cosa = immagine ? "L'immagine" : 'Il PDF';
      say(location.protocol === 'file:'
        ? cosa + ' non si può creare con la pagina aperta dal Finder: aprila dal sito o da un server locale.'
        : 'Non sono riuscito a creare ' + (immagine ? "l'immagine." : 'il PDF.'));
    }
  }
  $('printGo').addEventListener('click', () => crea(false));
  $('printImg').addEventListener('click', () => crea(true));

  /* ---------- controlli ----------
     La lente apre e chiude il campo (lo fa script.js, come nelle altre pagine);
     qui scrivendo si filtrano gli oggetti. */
  $('search').addEventListener('input', e => { query = e.target.value; render(); });
  /* voce "Doppioni" nel menu dei filtri: la aggiungo da qui, così non serve cambiare ogni pagina */
  if (!$('filter').querySelector('option[value="doppi"]')) $('filter').append(new Option('Doppioni', 'doppi'));
  $('filter').addEventListener('change', e => { filterMode = e.target.value; render(); });
  $('sort').addEventListener('change', e => { sortDir = e.target.value === 'desc' ? -1 : 1; render(); });

  /* ---------- id rinumerati (settembre 2026) ----------
     Gli id dell'ELENCO sono stati rimessi in ordine (seed-001, seed-002…).
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
     1. leggo dal browser le spunte, i doppioni e gli hashtag di chi visita
     2. li unisco all'ELENCO (oggetti nuovi, tolti o cambiati: vale l'elenco)
     3. riscrivo l'archivio con i soli oggetti dell'elenco e i soli dati del visitatore */
  (async function avvio() {
    const nuovo = s => Object.assign({}, s, { owned: false, doppi: 0, tags: s.tags.slice(), tagsTouched: false });
    try {
      db = await openDB();
      let salvate = await wrap(db.transaction(STORE).objectStore(STORE).getAll());
      salvate = rinumera(salvate);
      const perId = new Map(salvate.map(v => [v.id, v]));
      pens = SEED.map(s => {
        const p = nuovo(s), v = perId.get(s.id);
        if (v) {
          p.owned = v.owned === true;
          p.doppi = Number.isInteger(v.doppi) && v.doppi > 0 ? v.doppi : 0;
          if (p.doppi) p.owned = true;         /* dati salvati prima della regola: doppione = ce l'hai */
          if (v.tagsTouched && Array.isArray(v.tags)) { p.tags = v.tags.map(String); p.tagsTouched = true; }
        }
        return p;
      });
      const t = db.transaction(STORE, 'readwrite'), st = t.objectStore(STORE);
      st.clear();
      pens.filter(p => p.owned || p.doppi || p.tagsTouched).forEach(p => st.put(datiVisitatore(p)));
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
