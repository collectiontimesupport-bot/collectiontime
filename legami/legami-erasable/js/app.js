/* =====================================================================
   app.js — Legami Erasable Pens (Collection Time)
   ---------------------------------------------------------------------
   Fa funzionare la pagina legami-erasable/index.html.
   Legge dall'HTML due blocchi:
     • CONFIG → testi e misure della collezione
     • PENNE  → l'elenco delle penne (numero, nome, foto…)
   Per aggiungere penne NON serve toccare questo file: basta
   aggiungere una riga all'elenco PENNE nell'HTML.

   Dove vengono salvate le spunte "Ce l'ho"?
   Nel browser di chi visita (IndexedDB), quindi ognuno ha la sua
   collezione. I dati "fissi" (nome, numero, foto…) arrivano sempre
   dall'elenco PENNE, così una modifica all'HTML si vede subito.

   Indice delle sezioni (cerca il titolo con ---------- ):
     · modalità proprietario / visitatore
     · elenco delle penne (da PENNE)
     · archivio (IndexedDB)
     · utilità
     · ordinamento e filtri
     · disegno della pagina (+ bagliore)
     · nuove penne da foto
     · finestra di modifica
     · stampa in PDF
     · controlli, trascinamento, pubblicazione
     · avvio
   ===================================================================== */

(() => {
  /* scorciatoia: $('grid') = document.getElementById('grid') */
  const $ = id => document.getElementById(id);
  const grid = $('grid'), dlg = $('dlg');

  /* ---------- modalità proprietario / visitatore ----------
     Modalità proprietario: sul tuo computer (file, localhost, rete di casa) puoi modificare tutto.
     Sul sito pubblicato i visitatori vedono i dati fissi e cambiano solo hashtag e foto, sul proprio browser.
     Con ?admin=1 forzi la modalità proprietario, con ?admin=0 quella dei visitatori (per provarla). */
  const params = new URLSearchParams(location.search);
  const privateHost = location.protocol === 'file:' ||
    /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname) || /\.local$/.test(location.hostname);
  let ADMIN = privateHost;
  if (CONFIG.modalita === 'pubblica') ADMIN = false;          /* versione da pubblicare: sempre bloccata */
  else if (params.get('admin') === '0') ADMIN = false;         /* anteprima della vista pubblica */
  $('btnAdd').hidden = !ADMIN;
  $('btnPublish').hidden = !ADMIN;
  $('modeBadge').hidden = !ADMIN;
  /* Ogni collezione ha il suo archivio nel browser, legato al nome della sua cartella: così più collezioni
     sullo stesso dominio non si mescolano. (Legami mantiene il nome storico, per non perdere i dati già salvati.) */
  function folderName() {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length && /\.html?$/i.test(parts[parts.length - 1])) parts.pop();
    let n = parts.length ? parts[parts.length - 1] : 'radice';
    try { n = decodeURIComponent(n); } catch (e) { /* lascio com'è */ }
    return n.toLowerCase();
  }
  /* l'anteprima della vista pubblica, aperta sul tuo computer, usa un archivio a parte: i tuoi dati non si toccano */
  const DB_NAME = (CONFIG.dbName || ('catalogo-' + folderName())) + ((!ADMIN && privateHost) ? '-anteprima' : ''), STORE = 'penne';

  /* testi e forma della collezione */
  (function applyConfig() {
    document.title = CONFIG.titolo;
    $('btnAdd').textContent = CONFIG.aggiungi;
    $('optAll').textContent = CONFIG.tutte;
    $('optOwned').textContent = CONFIG.ceLiHo;
    $('lblEp').textContent = CONFIG.etichettaEp;
    $('lblNumero').textContent = CONFIG.etichettaNumero;
    $('pOwnedSmall').textContent = CONFIG.tuttiTesto + ", con il quadratino spuntato dove ce l'hai.";
    $('pMissingLabel').textContent = CONFIG.mancanti;
    $('pAllLabel').textContent = CONFIG.tuttiTesto;
    $('footHint').textContent = ADMIN
      ? 'Premi su ' + CONFIG.un + " per segnare che ce l'hai. Con \u270E cambi i dettagli, la foto e le note."
      : 'Premi su ' + CONFIG.un + " per segnare che ce l'hai. Con \u270E vedi i dettagli, le note e gli hashtag.";
    $('emptyText').textContent = ADMIN
      ? 'Premi "' + CONFIG.aggiungi + '" per inserire la prima foto.'
      : 'Non ci sono ancora elementi in questa collezione.';
    if (CONFIG.home) $('backLink').hidden = false;
    document.documentElement.style.setProperty('--proporzione', String(CONFIG.proporzione || 7));
    if (CONFIG.colonne === 'auto') grid.classList.add('auto');
    /* suggerimenti di hashtag */
    const sug = $('tagSug');
    sug.replaceChildren(document.createTextNode('Suggeriti: '));
    (CONFIG.suggerimenti || []).forEach(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.tag = t; b.textContent = '#' + t;
      sug.append(b);
    });
    sug.hidden = !(CONFIG.suggerimenti || []).length;
  })();

  /* ---------- elenco delle penne (da PENNE, nell'HTML) ----------
     Trasformo le righe scritte nell'HTML (campi in italiano) nel formato
     usato dal resto del programma. L'ordine dell'elenco = ordine sulla pagina. */

  /* Versione dei dati di base: se cambia, chi aveva già aperto la pagina
     riceve le foto e i colori aggiornati (le sue spunte restano). */
  const SEED_V = 5;
  /* Sagoma grigia mostrata al posto delle penne senza foto. */
  const SLOT_IMG = 'immagini/slot-vuoto.png';

  const idVisti = new Set();
  const SEED = (typeof PENNE !== 'undefined' ? PENNE : []).map((r, i) => {
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
      notes: r.note || '',
      img: r.foto || ''                        /* percorso della foto, es. "immagini/01-panda.png" */
    };
  });

  /* ---------- stato della pagina ---------- */
  let db = null;           /* archivio del browser (IndexedDB) */
  let pens = [];           /* tutte le penne, con le spunte di chi guarda */
  let filterMode = 'all';  /* filtro scelto: all / owned / missing */
  let sortDir = 1;         /* ordine: 1 = dalla prima, -1 = dalla più recente */
  let query = '';
  let editing = null;
  let pendingImage = null;
  let queue = [];
  let queueTotal = 0;
  let queueDone = 0;


  /* ---------- archivio (IndexedDB) ---------- */
  function openDB() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  const store = mode => db.transaction(STORE, mode).objectStore(STORE);
  const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  const loadAll = () => wrap(store('readonly').getAll());
  const savePen = p => db ? wrap(store('readwrite').put(p)).catch(() => say('Salvataggio non riuscito.')) : Promise.resolve();
  const removePen = id => db ? wrap(store('readwrite').delete(id)) : Promise.resolve();
  function saveMany(list) {
    if (!db) return Promise.resolve();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, 'readwrite');
      const s = t.objectStore(STORE);
      list.forEach(p => s.put(p));
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
    });
  }

  /* ---------- utilità ---------- */
  /* avviso temporaneo in basso (sparisce dopo 4,5 secondi) */
  let toastTimer;
  function say(msg) {
    const el = $('status');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
  }
  /* id casuale per le penne aggiunte da foto */
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  /* completa una penna con i valori mancanti (utile per dati vecchi o importati) */
  function normalize(p) {
    p.pos = typeof p.pos === 'number' ? p.pos : 1000 + (p.order || 0);
    p.code = p.code || '';
    p.limited = !!p.limited;
    p.owned = typeof p.owned === 'boolean' ? p.owned : true;
    p.name = p.name || '';
    p.notes = p.notes || '';
    p.added = p.added || Date.now();
    p.ep = p.ep || '';
    p.colorHex = p.colorHex || '';
    p.colorName = p.colorName || '';
    p.tags = Array.isArray(p.tags) ? p.tags.map(String) : [];
    p.metaTouched = !!p.metaTouched;
    return p;
  }
  /* crea le penne "di base" dall'elenco PENNE, tutte ancora da spuntare */
  const seedPens = () => SEED.map(s => ({
    id: s.id, seed: true, v: SEED_V, pos: s.pos, code: s.code, limited: s.limited,
    owned: false, name: s.name || '', notes: s.notes || '', image: s.img, added: 0,
    ep: s.ep || '', colorHex: s.colorHex || '', colorName: s.colorName || '', tags: (s.tags || []).slice(), metaTouched: false
  }));

  /* Foto caricata da te (modalità proprietario): la rimpicciolisco a max 1400px,
     tolgo i margini trasparenti e la salvo come WebP (se trasparente) o JPEG. */
  function resizeImage(file, max = 1400) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        let c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s));
        c.height = Math.max(1, Math.round(img.height * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const hasAlpha = /png|webp|gif|svg/.test(file.type);
        if (hasAlpha) {
          /* tolgo i margini trasparenti, così la penna occupa tutto lo spazio */
          try {
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
            for (let y = 0; y < c.height; y++) {
              for (let x = 0; x < c.width; x++) {
                if (d[(y * c.width + x) * 4 + 3] > 12) {
                  if (x < x0) x0 = x; if (x > x1) x1 = x;
                  if (y < y0) y0 = y; if (y > y1) y1 = y;
                }
              }
            }
            if (x1 >= x0 && y1 >= y0) {
              const w = x1 - x0 + 1, h = y1 - y0 + 1;
              const c2 = document.createElement('canvas');
              c2.width = w; c2.height = h;
              c2.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
              c = c2;
            }
          } catch (e) { /* se il browser non lo permette, tengo l'immagine intera */ }
          resolve(c.toDataURL('image/webp', 0.92));
        } else {
          const c3 = document.createElement('canvas');
          c3.width = c.width; c3.height = c.height;
          const ctx = c3.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, c3.width, c3.height);
          ctx.drawImage(c, 0, 0);
          resolve(c3.toDataURL('image/jpeg', 0.88));
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile')); };
      img.src = url;
    });
  }

  /* ---------- ordinamento e filtri ---------- */
  /* le penne si mostrano sempre nell'ordine dell'elenco PENNE (campo pos) */
  const byPos = (a, b) => a.pos - b.pos;
  /* parole alternative per gli hashtag: cercando "christmas" escono le penne di Natale, ecc. */
  const TAG_ALIASES = {
    'halloween': ['halloween'],
    'natale': ['natale', 'christmas', 'xmas'],
    'san valentino': ['san valentino', 'valentino', 'valentine', 'innamorati'],
    'pasqua': ['pasqua', 'easter']
  };
  const foldText = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  /* tutto il testo in cui cercare per una penna (numero, EP, nome, note, colore, hashtag) */
  function searchText(p) {
    const parts = [p.code, p.ep, p.name, p.notes, p.colorName];
    (p.tags || []).forEach(t => {
      parts.push(t, '#' + t);
      const al = TAG_ALIASES[String(t).toLowerCase()];
      if (al) parts.push(...al);
    });
    if (p.limited) parts.push('edizione limitata', 'limitata', 'limited edition', 'limited');
    return foldText(parts.join(' '));
  }
  /* penne da mostrare secondo filtro e ricerca, nell'ordine scelto */
  function visiblePens() {
    const terms = foldText(query).replace(/#/g, ' ').split(/\s+/).filter(Boolean);
    return pens
      .filter(p => filterMode === 'all' || (filterMode === 'owned' ? p.owned : (!p.owned && p.image)))
      .filter(p => { if (!terms.length) return true; const hay = searchText(p); return terms.every(t => hay.includes(t)); })
      .sort((a, b) => sortDir * byPos(a, b));
  }

  /* ---------- disegno della pagina ---------- */
  /* scrive "12 possedute su 103" (le penne senza foto non contano) */
  function updateCount(shown) {
    const owned = pens.filter(p => p.owned).length;
    const total = pens.filter(p => p.image || p.owned).length;
    let t = owned + ' ' + CONFIG.possedute + ' su ' + total;
    if (typeof shown === 'number' && shown !== pens.length) t += ' · ' + shown + (shown === 1 ? ' visibile' : ' visibili');
    $('count').textContent = t;
  }

  /* ---------- bagliore (UNO SOLO per tutte le penne) ----------
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
     di riserva più semplice fatto con il CSS (vedi .no-halo in stile.css). */
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

  /* Crea la scheda <li> di una penna:
       <li class="pen [owned]">
         <button class="open"> <div class="pic"> [bagliore] <img class="pen-img"> </div> </button>
         <div class="code">01</div>
         <div class="row"> ☐ Ce l'ho   ✎ </div>
       </li>
     Se la penna non ha foto mostra la sagoma vuota (SLOT_IMG) e non si può spuntare. */
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
    if (p.image) {
      const img = document.createElement('img');
      img.className = 'pen-img';
      img.src = p.image;
      img.alt = p.name || (CONFIG.nome + ' ' + p.code);
      img.title = p.name || (CONFIG.nome + ' ' + p.code);
      img.draggable = false;
      img.decoding = 'async';
      img.loading = 'lazy';
      pic.append(img);
      if (p.owned) ensureHalo(pic, p);
    } else if (SLOT_IMG) {
      const ghost = document.createElement('img');
      ghost.className = 'ghost';
      ghost.src = SLOT_IMG;
      ghost.alt = '';
      ghost.draggable = false;
      pic.append(ghost);
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
    edit.setAttribute('aria-label', 'Dettagli, foto e note');
    edit.title = 'Dettagli, foto e note';
    edit.addEventListener('click', () => openEdit(p.id));
    row.append(lab, edit);

    li.append(btn, code, row);
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

  /* ---------- nuove penne da foto ---------- */
  async function addFiles(fileList) {
    if (!ADMIN) return;
    const files = [...fileList].filter(f => f.type.startsWith('image/'));
    if (!files.length) { say('Nessuna immagine riconosciuta. Usa file JPG, PNG o WebP.'); return; }
    let pos = pens.reduce((m, p) => Math.max(m, p.pos), 999);
    const created = [];
    const failed = [];
    for (const [i, f] of files.entries()) {
      try {
        const image = await resizeImage(f);
        const p = normalize({
          id: newId(), seed: false, pos: ++pos,
          code: '', limited: false, owned: true,
          name: '', notes: '', image, added: Date.now() + i
        });
        await savePen(p);
        pens.push(p);
        created.push(p.id);
      } catch (e) {
        failed.push(f.name);
      }
    }
    render();
    if (failed.length) say('Non sono riuscito a leggere: ' + failed.join(', '));
    if (created.length) {
      queue = created;
      queueTotal = created.length;
      queueDone = 0;
      openEdit(queue.shift());
    }
  }

  /* ---------- finestra di modifica ---------- */
  function setDlgImage(src) {
    const img = $('dlgImg');
    if (src) img.src = src; else img.removeAttribute('src');
    img.hidden = !src;
    $('dlgNoPhoto').hidden = !!src;
  }
  /* nome del colore a partire dal codice (stesse regole usate per le penne del poster) */
  function colorNameFromHex(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '';
    const n = parseInt(m[1], 16);
    const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const v = max, s = max === 0 ? 0 : d / max;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    if (v < 0.34) return 'Nero';
    if (s < 0.12) {
      if (v >= 0.88) {
        if (s >= 0.07 && (h < 15 || h >= 330)) return 'Rosa';
        if (s >= 0.07 && h >= 25 && h < 70) return 'Crema';
        return 'Bianco';
      }
      return 'Grigio';
    }
    if (h < 12 || h >= 345) return v < 0.55 ? 'Bordeaux' : (s < 0.35 ? 'Rosa' : 'Rosso');
    if (h < 40) { if (v < 0.62) return 'Marrone'; if (s < 0.55) return v >= 0.8 ? 'Beige' : 'Marrone'; return 'Arancione'; }
    if (h < 58) { if (s < 0.25) return 'Crema'; return v < 0.6 ? 'Oliva' : 'Giallo'; }
    if (h < 80) return v >= 0.6 ? 'Verde lime' : 'Oliva';
    if (h < 165) return 'Verde';
    if (h < 195) return 'Turchese';
    if (h < 255) return (v >= 0.75 && s < 0.55) ? 'Azzurro' : 'Blu';
    if (h < 290) return (v >= 0.7 && s < 0.5) ? 'Lilla' : 'Viola';
    return s < 0.5 ? 'Rosa' : 'Fucsia';
  }

  /* colori preimpostati (presi dai cerchi dell'immagine di riferimento) */
  const COLOR_PRESETS = [
    ['Nero', '#000000'], ['Blu', '#2c357e'], ['Verde', '#3c8765'], ['Arancione', '#d95a44'],
    ['Rosa', '#f2cbd3'], ['Viola', '#834687'], ['Rosso', '#c43329'], ['Turchese', '#4aa3a8']
  ];
  let editColorHex = '', autoColorName = '', editTags = [];
  const colorMenu = $('colorMenu'), btnColorMenu = $('btnColorMenu'), colorWrap = $('colorWrap');
  function closeColorMenu() {
    colorMenu.hidden = true;
    btnColorMenu.setAttribute('aria-expanded', 'false');
  }
  function openColorMenu() {
    colorMenu.querySelectorAll('.opt[data-hex]').forEach(o => {
      o.classList.toggle('sel', !!editColorHex && o.dataset.hex.toLowerCase() === editColorHex.toLowerCase());
    });
    colorMenu.hidden = false;
    btnColorMenu.setAttribute('aria-expanded', 'true');
    const first = colorMenu.querySelector('.opt.sel') || colorMenu.querySelector('.opt');
    if (first) first.focus();
  }
  function pickPreset(name, hex) {
    editColorHex = hex;
    $('fColor').value = hex;
    $('fColorName').value = name;
    autoColorName = name;
    paintDot();
  }
  (function buildColorMenu() {
    COLOR_PRESETS.forEach(([name, hex]) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'presentation');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'opt'; b.setAttribute('role', 'option');
      b.dataset.hex = hex; b.dataset.name = name;
      const dot = document.createElement('span');
      dot.className = 'dot'; dot.style.background = hex;
      b.append(dot, document.createTextNode(name));
      b.addEventListener('click', () => { pickPreset(name, hex); closeColorMenu(); $('fColorName').focus(); });
      li.append(b);
      colorMenu.append(li);
    });
    const li = document.createElement('li');
    li.setAttribute('role', 'presentation');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'opt'; b.setAttribute('role', 'option');
    const dot = document.createElement('span');
    dot.className = 'dot rainbow';
    b.append(dot, document.createTextNode('Altro colore\u2026'));
    b.addEventListener('click', () => { closeColorMenu(); $('fColor').click(); });
    li.append(b);
    colorMenu.append(li);
  })();
  btnColorMenu.addEventListener('click', () => { colorMenu.hidden ? openColorMenu() : closeColorMenu(); });
  $('colorDot').addEventListener('click', () => { colorMenu.hidden ? openColorMenu() : closeColorMenu(); });
  colorMenu.addEventListener('keydown', e => {
    const opts = [...colorMenu.querySelectorAll('.opt')];
    const i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
  });
  colorWrap.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !colorMenu.hidden) { e.preventDefault(); e.stopPropagation(); closeColorMenu(); btnColorMenu.focus(); }
  });
  document.addEventListener('click', e => { if (!colorMenu.hidden && !colorWrap.contains(e.target)) closeColorMenu(); });
  function paintDot() {
    const d = $('colorDot');
    d.style.background = editColorHex || 'transparent';
    d.classList.toggle('empty', !editColorHex);
  }
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
    document.querySelectorAll('#tagSug button').forEach(b => {
      b.hidden = editTags.some(t => t.toLowerCase() === b.dataset.tag.toLowerCase());
    });
  }
  function addTag(raw) {
    let t = cleanTag(raw);
    if (!t) return;
    const known = [...document.querySelectorAll('#tagSug button')].find(b => b.dataset.tag.toLowerCase() === t.toLowerCase());
    if (known) t = known.dataset.tag;
    if (!editTags.some(x => x.toLowerCase() === t.toLowerCase())) editTags.push(t);
    renderTags();
  }
  $('fColor').addEventListener('input', e => {
    editColorHex = e.target.value;
    paintDot();
    const nameEl = $('fColorName');
    if (!nameEl.value.trim() || nameEl.value === autoColorName) {
      autoColorName = colorNameFromHex(editColorHex);
      nameEl.value = autoColorName;
    }
  });
  $('fTagInput').addEventListener('keydown', e => {
    const inp = $('fTagInput');
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inp.value); inp.value = ''; }
    else if (e.key === 'Backspace' && !inp.value && editTags.length) { editTags.pop(); renderTags(); }
  });
  $('fTagInput').addEventListener('blur', () => {
    const inp = $('fTagInput');
    if (inp.value.trim()) { addTag(inp.value); inp.value = ''; }
  });
  document.querySelectorAll('#tagSug button').forEach(b => b.addEventListener('click', () => addTag(b.dataset.tag)));

  /* apre la finestra "Dettagli" di una penna (i visitatori possono cambiare solo note, hashtag e "Ce l'ho") */
  function openEdit(id) {
    const p = pens.find(x => x.id === id);
    if (!p) return;
    editing = p;
    pendingImage = null;
    setDlgImage(p.image);
    $('fEp').value = p.ep;
    editColorHex = p.colorHex;
    autoColorName = (COLOR_PRESETS.some(c => c[0] === p.colorName) || p.colorName === colorNameFromHex(p.colorHex)) ? p.colorName : '';
    closeColorMenu();
    $('fColor').value = p.colorHex || '#888888';
    $('fColorName').value = p.colorName;
    paintDot();
    editTags = p.tags.slice();
    $('fTagInput').value = '';
    renderTags();
    const lock = !ADMIN;
    ['fEp', 'fColorName', 'fCode', 'fName'].forEach(id => {
      const el = $(id);
      el.readOnly = lock;
      if (lock) {
        if (el.dataset.ph === undefined) el.dataset.ph = el.placeholder;
        el.placeholder = '';
        el.tabIndex = -1;
      } else {
        if (el.dataset.ph !== undefined) el.placeholder = el.dataset.ph;
        el.removeAttribute('tabindex');
      }
    });
    $('fNotes').readOnly = false;
    btnColorMenu.hidden = lock;
    $('colorDot').style.pointerEvents = lock ? 'none' : '';
    document.querySelector('.colorbox').classList.toggle('locked', lock);
    $('btnPhoto').hidden = lock;
    $('fCode').value = p.code;
    $('fName').value = p.name;
    $('fNotes').value = p.notes;
    $('fOwned').checked = p.owned;
    $('btnDelete').hidden = !ADMIN || !!p.seed;
    const step = $('dlgStep');
    if (queueTotal > 1) {
      step.hidden = false;
      step.textContent = 'Foto ' + (queueDone + 1) + ' di ' + queueTotal;
    } else {
      step.hidden = true;
    }
    $('btnClose').textContent = queue.length ? 'Salta' : 'Chiudi';
    dlg.showModal();
    if (!ADMIN && document.activeElement && document.activeElement.blur) document.activeElement.blur();   /* nessun campo evidenziato all'apertura */
    if (ADMIN) $('fCode').focus();
  }

  $('btnPhoto').addEventListener('click', () => $('photoInput').click());
  $('photoInput').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      pendingImage = await resizeImage(f);
      setDlgImage(pendingImage);
    } catch (err) {
      say('Non riesco a leggere questa immagine.');
    }
  });

  $('editForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!editing) return;
    addTag($('fTagInput').value);
    $('fTagInput').value = '';
    if (ADMIN) {
      editing.ep = $('fEp').value.trim();
      editing.colorHex = editColorHex;
      editing.colorName = $('fColorName').value.trim();
      editing.metaTouched = true;
      editing.code = $('fCode').value.trim();
      editing.name = $('fName').value.trim();
      editing.notes = $('fNotes').value.trim();
    } else {
      const nuovaNota = $('fNotes').value.trim();
      if (nuovaNota !== editing.notes) { editing.notes = nuovaNota; editing.notesTouched = true; }
      if (editTags.join('|') !== editing.tags.join('|')) editing.tagsTouched = true;
    }
    editing.tags = editTags.slice();
    editing.owned = $('fOwned').checked;
    if (pendingImage) { editing.image = pendingImage; editing.customImage = true; }
    await savePen(editing);
    dlg.close();
  });
  $('btnClose').addEventListener('click', () => dlg.close());
  $('btnDelete').addEventListener('click', async () => {
    if (!editing || editing.seed) return;
    if (!confirm('Eliminare questo elemento dal catalogo?')) return;
    const id = editing.id;
    await removePen(id);
    pens = pens.filter(p => p.id !== id);
    editing = null;
    dlg.close();
  });
  dlg.addEventListener('close', () => {
    closeColorMenu();
    editing = null;
    pendingImage = null;
    render();
    if (queue.length) {
      queueDone++;
      openEdit(queue.shift());
    } else {
      queueTotal = 0;
      queueDone = 0;
    }
  });

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

  /* la penna ha sempre la stessa altezza; la larghezza segue l'immagine.
     Le penne si salvano come JPEG su fondo bianco, la sagoma degli slot vuoti come PNG trasparente */
  /* foto di una penna pronta per il PDF */
  async function penImage(src, boxH, transparent) {
    const img = await loadImg(src);
    const dh = boxH, dw = img.naturalWidth * boxH / img.naturalHeight;
    const K = 3.5; /* pixel per punto: circa 250 dpi */
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(dw * K));
    c.height = Math.max(1, Math.round(dh * K));
    const ctx = c.getContext('2d');
    if (!transparent) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, transparent ? 'image/png' : 'image/jpeg', 0.92));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), dw, dh };
  }

  /* La libreria dei PDF (js/pdf-lib.min.js, circa 500 KB) viene scaricata
     SOLO la prima volta che si preme "Crea PDF": così la pagina si apre più in fretta. */
  function loadPdfLib() {
    if (typeof PDFLib !== 'undefined') return Promise.resolve();
    return new Promise(resolve => {
      const sc = document.createElement('script');
      sc.src = 'js/pdf-lib.min.js';
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
    const pad = Math.round(size * 0.12);
    c.width = Math.ceil(ctx.measureText(text).width) + 2 * pad;
    c.height = Math.round(size * 1.3);
    ctx.font = font;
    ctx.fillStyle = cs.color;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, pad, size);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }
  /* crea il PDF: A4 orizzontale, 25 penne per fila, 2 file per pagina (vedi CONFIG) */
  async function makePdf(list, kind) {
    await loadPdfLib();
    if (typeof PDFLib === 'undefined') { say('Il modulo per creare il PDF non è disponibile.'); return; }
    say('Sto creando il PDF…');
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    doc.setTitle(pdfText(CONFIG.titolo));
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const titlePngBytes = await titlePng();
    const logo = titlePngBytes ? await doc.embedPng(titlePngBytes) : null;

    /* A4 orizzontale, 25 penne per fila come nel poster, 2 file per pagina */
    const W = 841.89, H = 595.28, MX = 28, COLS = CONFIG.pdfColonne || 25, ROWS = CONFIG.pdfFile || 2;
    const LOGO_H = 44, LOGO_W = logo ? LOGO_H * logo.width / logo.height : 0, LOGO_TOP = 22;
    const PH = CONFIG.pdfAltezza || 192, GAP = 3, CODE_H = 13, BOX = 8;
    const ITEM_H = PH + GAP + CODE_H + GAP + BOX, ROW_GAP = 14;
    const gridTop = H - LOGO_TOP - LOGO_H - 20;
    const colPitch = (W - 2 * MX) / COLS;
    const gray = rgb(0.78, 0.8, 0.85), dark = rgb(0.1, 0.13, 0.25), red = rgb(229 / 255, 10 / 255, 21 / 255), tick = rgb(242 / 255, 169 / 255, 0);

    const pages = [];
    let ghost = null;
    const perPage = COLS * ROWS;
    for (let start = 0; start < list.length; start += perPage) {
      const page = doc.addPage([W, H]);
      pages.push(page);
      if (logo) {
        page.drawImage(logo, { x: (W - LOGO_W) / 2, y: H - LOGO_TOP - LOGO_H, width: LOGO_W, height: LOGO_H });
      } else {
        const title = pdfText(CONFIG.titolo);
        const tw = bold.widthOfTextAtSize(title, 26);
        page.drawText(title, { x: (W - tw) / 2, y: H - LOGO_TOP - 32, size: 26, font: bold, color: rgb(0.1, 0.13, 0.25) });
      }
      const chunk = list.slice(start, start + perPage);
      for (let i = 0; i < chunk.length; i++) {
        const p = chunk[i];
        const r = Math.floor(i / COLS), c = i % COLS;
        const cx = MX + c * colPitch + colPitch / 2;
        const top = gridTop - r * (ITEM_H + ROW_GAP);

        if (p.image) {
          const { bytes, dw, dh } = await penImage(p.image, PH, false);
          const img = await doc.embedJpg(bytes);
          page.drawImage(img, { x: cx - dw / 2, y: top - PH, width: dw, height: dh });
        } else if (SLOT_IMG) {
          if (!ghost) ghost = await penImage(SLOT_IMG, PH, true).then(async g => ({ img: await doc.embedPng(g.bytes), dw: g.dw, dh: g.dh }));
          page.drawImage(ghost.img, { x: cx - ghost.dw / 2, y: top - PH, width: ghost.dw, height: ghost.dh });
        }

        /* riquadro con il numero */
        const boxY = top - PH - GAP - CODE_H;
        page.drawRectangle({ x: cx - 13, y: boxY, width: 26, height: CODE_H, borderColor: gray, borderWidth: 0.6 });
        const code = pdfText(p.code || '');
        if (code) {
          const tw = bold.widthOfTextAtSize(code, 7.5);
          page.drawText(code, { x: cx - tw / 2, y: boxY + 3.6, size: 7.5, font: bold, color: p.limited ? red : dark });
        }

        /* quadratino della checklist */
        const qy = boxY - GAP - BOX;
        page.drawRectangle({ x: cx - BOX / 2, y: qy, width: BOX, height: BOX, borderColor: rgb(0.4, 0.42, 0.5), borderWidth: 0.8 });
        if (kind === 'owned' && p.owned) {
          page.drawLine({ start: { x: cx - 2.6, y: qy + 3.9 }, end: { x: cx - 0.7, y: qy + 1.7 }, thickness: 1.3, color: tick });
          page.drawLine({ start: { x: cx - 0.7, y: qy + 1.7 }, end: { x: cx + 3, y: qy + 6.4 }, thickness: 1.3, color: tick });
        }
      }
    }

    /* numero di pagina in basso a destra */
    pages.forEach((pg, i) => {
      const t = (i + 1) + ' su ' + pages.length;
      const tw = font.widthOfTextAtSize(t, 9);
      pg.drawText(t, { x: W - MX - tw, y: 22, size: 9, font, color: rgb(0.35, 0.38, 0.5) });
    });

    const bytes = await doc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = CONFIG.id + '-' + kindName[kind] + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
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
      say('Non sono riuscito a creare il PDF.');
    }
  });

  /* ---------- controlli ---------- */
  $('btnAdd').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  const searchBox = $('searchBox'), searchInput = $('search'), btnSearch = $('btnSearch');
  function openSearch() {
    searchBox.classList.add('open');
    btnSearch.setAttribute('aria-expanded', 'true');
    searchInput.tabIndex = 0;
    searchInput.focus();
  }
  function closeSearch() {
    if (searchInput.value.trim()) return;
    searchBox.classList.remove('open');
    btnSearch.setAttribute('aria-expanded', 'false');
    searchInput.tabIndex = -1;
  }
  btnSearch.addEventListener('click', () => {
    if (searchBox.classList.contains('open') && !searchInput.value.trim()) closeSearch();
    else openSearch();
  });
  searchInput.addEventListener('input', e => { query = e.target.value; render(); });
  searchInput.addEventListener('blur', () => {
    setTimeout(() => { if (document.activeElement !== btnSearch && document.activeElement !== searchInput) closeSearch(); }, 120);
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      query = '';
      render();
      closeSearch();
      btnSearch.focus();
    }
  });
  $('filter').addEventListener('change', e => { filterMode = e.target.value; render(); });
  $('sort').addEventListener('change', e => { sortDir = e.target.value === 'desc' ? -1 : 1; render(); });

  /* ---------- trascinare foto sulla pagina ---------- */
  const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  let fileDepth = 0;
  window.addEventListener('dragenter', e => { if (ADMIN && hasFiles(e)) { fileDepth++; document.body.classList.add('dragging-files'); } });
  window.addEventListener('dragleave', e => { if (hasFiles(e)) { fileDepth = Math.max(0, fileDepth - 1); if (!fileDepth) document.body.classList.remove('dragging-files'); } });
  window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (!ADMIN) { fileDepth = 0; document.body.classList.remove('dragging-files'); return; }
    fileDepth = 0;
    document.body.classList.remove('dragging-files');
    addFiles(e.dataTransfer.files);
  });

  /* ---------- pubblicazione ----------
     (Esporta e Importa sono nella banda in alto: li gestisce ../../script.js per tutto il sito) */
  /* scarica un oggetto come file .json */
  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* Pubblica: salva i dati "fissi" (numero, colore, nome, note, hashtag, penne aggiunte) da caricare sul sito */
  $('btnPublish').addEventListener('click', () => {
    const seedImg = new Map(SEED.map(x => [x.id, x.img]));
    const list = [...pens].sort((a, b) => a.pos - b.pos).filter(p => p.seed || p.image).map(p => {
      const r = {
        id: p.id, seed: !!p.seed, pos: p.pos, code: p.code, ep: p.ep, colorHex: p.colorHex, colorName: p.colorName,
        name: p.name, notes: p.notes, tags: p.tags, limited: !!p.limited
      };
      if (!p.seed || (p.image && p.image !== seedImg.get(p.id))) r.image = p.image;
      return r;
    });
    download('catalogo-dati.json', { version: 1, published: new Date().toISOString(), pens: list });
    say('Salvato catalogo-dati.json: caricalo sul sito, accanto alla pagina, al posto del vecchio.');
  });

  /* Vista pubblica: l'elenco PENNE dell'HTML è l'unica fonte dei dati fissi.
     Ad ogni apertura allineo l'archivio del browser all'elenco:
       - penna nuova nell'elenco      → la aggiungo
       - numero/nome/foto cambiati    → li aggiorno
       - penna tolta dall'elenco      → la tolgo
     Le spunte "Ce l'ho" e le note/hashtag scritti dal visitatore restano. */
  async function applyMaster() {
    const master = new Map(seedPens().map(x => [x.id, x]));
    const byId = new Map(pens.map(x => [x.id, x]));
    const toSave = [], toDelete = [];
    const fields = ['pos', 'code', 'ep', 'colorHex', 'colorName', 'name', 'limited'];
    master.forEach((m, id) => {
      const cur = byId.get(id);
      if (!cur) { pens.push(m); toSave.push(m); return; }
      let changed = false;
      fields.forEach(k => { if (cur[k] !== m[k]) { cur[k] = m[k]; changed = true; } });
      if (cur.seed !== m.seed) { cur.seed = m.seed; changed = true; }
      if (cur.customImage) { cur.customImage = false; changed = true; }   /* nella vista pubblica le foto sono fisse */
      if (cur.image !== m.image) { cur.image = m.image; changed = true; }
      if (!cur.notesTouched && cur.notes !== m.notes) { cur.notes = m.notes; changed = true; }
      if (!cur.tagsTouched && cur.tags.join('|') !== m.tags.join('|')) { cur.tags = m.tags.slice(); changed = true; }
      if (changed) toSave.push(cur);
    });
    pens.forEach(x => { if (!master.has(x.id)) toDelete.push(x.id); });
    pens = pens.filter(x => master.has(x.id));
    if (toSave.length) await saveMany(toSave);
    for (const id of toDelete) await removePen(id);
  }

  /* ---------- avvio ---------- */
  (async function init() {
    try {
      db = await openDB();
      pens = (await loadAll()).map(normalize);
      /* penne dell'elenco: aggiungo quelle nuove; se SEED_V è cambiato aggiorno
         foto e colori (non le foto che hai cambiato tu, non i dati che hai modificato) */
      const fresh = seedPens();
      const byId = new Map(pens.map(p => [p.id, p]));
      const toSave = [];
      fresh.forEach(f => {
        const cur = byId.get(f.id);
        if (!cur) { pens.push(f); toSave.push(f); return; }
        /* scheda creata da "Importa" prima di aprire questa pagina: ha solo spunta, note e hashtag */
        if (cur.v === undefined) {
          Object.assign(cur, f, { owned: cur.owned },
            cur.notesTouched ? { notes: cur.notes, notesTouched: true } : {},
            cur.tagsTouched ? { tags: cur.tags, tagsTouched: true } : {});
          toSave.push(cur);
          return;
        }
        if (cur.v !== SEED_V) {
          if (!cur.customImage) cur.image = f.image;
          if (!cur.metaTouched) {
            /* colore e hashtag proposti dal poster, solo se non li hai già modificati tu */
            cur.colorHex = f.colorHex;
            cur.colorName = f.colorName;
            cur.tags = f.tags.slice();
          }
          cur.seed = true;
          cur.v = SEED_V;
          toSave.push(cur);
        }
      });
      if (toSave.length) await saveMany(toSave);
      if (!ADMIN) await applyMaster();
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    } catch (e) {
      db = null;
      pens = seedPens();
      say('Questo browser non permette di salvare il catalogo. Apri il file con Chrome, Edge o Firefox.');   /* es. navigazione privata */
    }
    render();
  })();
})();