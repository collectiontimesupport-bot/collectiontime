
(() => {
  const $ = id => document.getElementById(id);
  const grid = $('grid'), dlg = $('dlg');
  const say = msg => avviso(msg);

  document.documentElement.style.setProperty('--proporzione', String(CONFIG.proporzione || 7));
  document.documentElement.style.setProperty('--colonne', String(CONFIG.colonne || 8));
  if (CONFIG.altezza) {
    document.documentElement.style.setProperty('--altezza', CONFIG.altezza + 'px');
    grid.classList.add('su-misura');
  }
  if ((CONFIG.proporzione || 7) >= 4) grid.classList.add('stretti');


  const SLOT_IMG = 'immagini/slot-vuoto.webp';

  const escHtml = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const idVisti = new Set();
  const SEED = ELENCO.map((r, i) => {
    const id = r.id || ('penna-' + String(r.foto || i).split('/').pop().replace(/\.[a-z]+$/i, ''));
    if (idVisti.has(id)) console.warn('ELENCO: l\'id "' + id + '" è usato due volte. Cambiane uno!');
    idVisti.add(id);
    const paese = r.paese || '';
    const numero = r.numero || '';
    const infoPaese = paese && !/uscit[oa] solo/i.test(r.info || '') ? (r.info ? '. ' : '') + 'Uscito solo ' + (/^estero$/i.test(paese) ? 'all\'estero' : 'in ' + paese) : '';
    return {
      id,
      pos: i,
      code: paese && numero && !numero.includes(' - ') ? numero + ' - ' + paese : numero,
      paese,
      estero: paeseEstero(paese),
      codice: r.codice || '',
      senzaCodice: !!r.senzaCodice,
      name: r.nome || '',
      colorName: r.colore || '',
      colorHex: r.hex || '',
      richNumero: r.richNumero || '', richNome: r.richNome || '',
      richInfo: r.richInfo ? r.richInfo + (infoPaese ? escHtml(infoPaese) : '') : '',
      limited: !!r.limitata,
      tags: Array.isArray(r.hashtag) ? r.hashtag.slice() : [],
      info: (r.info || '') + infoPaese,
      image: r.foto || '',
      fotoInfo: Array.isArray(r.fotoInfo) ? r.fotoInfo.filter(Boolean) : []
    };
  });

  const campoColore = (() => {
    const c = document.createElement('div'); c.className = 'field';
    c.innerHTML = 'Colore<div class="colorbox"><span class="dot" id="colorDot"></span><input type="text" id="fColorName" readonly tabindex="-1" aria-label="Colore"></div>';
    const vecchio = document.getElementById('colorDot'); if (vecchio) vecchio.closest('.field').remove();
    return c;
  })();

  let db = null;
  let pens = [];
  let filterMode = 'all';
  const CHIAVE_ORDINE = 'ct-ordine:' + location.pathname.replace(/index\.html$/, '');
  let sortDir = 1;
  try { if (localStorage.getItem(CHIAVE_ORDINE) === 'desc') sortDir = -1; localStorage.removeItem('ct-ordine'); } catch (e) {}
  let query = '';
  let editing = null;

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
  const datiVisitatore = p => ({ id: p.id, owned: p.owned, doppi: p.doppi, tags: p.tags, tagsTouched: p.tagsTouched });
  const ristampe = (() => {
    const m = /^(.*\/catalogo\/kinder\/)/.exec(location.pathname);
    if (!m) return null;
    let gruppi = null;
    let esistenti = null;
    const costruisci = IND => {
      const per = {};
      IND.serie.forEach(s => s.x.forEach(o => {
        const c = /^\s*\d+\s*-\s*(.+)$/.exec(o[1] || '');
        if (c) { const k = c[1].trim(); (per[k] = per[k] || []).push({ db: s.db, id: o[0] }); }
      }));
      const g = {};
      Object.keys(per).forEach(k => {
        const l = per[k];
        if (l.length < 2 || new Set(l.map(x => x.db)).size !== l.length) return;
        l.forEach(x => { g[x.db + '|' + x.id] = l.filter(y => y !== x); });
      });
      gruppi = g;
    };
    const carica = () => gruppi ? Promise.resolve(gruppi) : new Promise(ok => {
      const fine = () => ok(gruppi = gruppi || {});
      try {
        if (typeof INDICE !== 'undefined') { costruisci(INDICE); return fine(); }
        const s = document.createElement('script');
        s.src = m[1] + 'la-mia-collezione/indice.js?v=' + Math.floor(Date.now() / 3600000);
        s.onload = () => { try { costruisci(INDICE); } catch (e) {} fine(); };
        s.onerror = fine;
        document.head.append(s);
      } catch (e) { fine(); }
    });
    const apriDb = nome => new Promise((ok, ko) => {
      const r = indexedDB.open(nome, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    });
    const leggi = async (nome, id) => {
      if (esistenti === null) esistenti = indexedDB.databases ? new Set((await indexedDB.databases()).map(d => d.name)) : false;
      if (esistenti && !esistenti.has(nome)) return null;
      const d = await apriDb(nome);
      return new Promise(ok => { const g = d.transaction(STORE).objectStore(STORE).get(id); g.onsuccess = () => { d.close(); ok(g.result || null); }; g.onerror = () => { d.close(); ok(null); }; });
    };
    const propaga = async p => {
      try {
        const altri = (await carica())[CONFIG.dbName + '|' + p.id];
        if (!altri) return;
        for (const a of altri) {
          const d = await apriDb(a.db);
          await new Promise(ok => {
            const t = d.transaction(STORE, 'readwrite'), st = t.objectStore(STORE), g = st.get(a.id);
            g.onsuccess = () => st.put(Object.assign(g.result || { tags: [], tagsTouched: false }, { id: a.id, owned: !!p.owned, doppi: p.doppi || 0 }));
            t.oncomplete = () => { d.close(); ok(); }; t.onerror = t.onabort = () => { d.close(); ok(); };
          });
        }
      } catch (e) {  }
    };
    const unisci = async () => {
      try {
        const g = await carica();
        let cambiato = false;
        for (const p of pens) {
          const altri = g[CONFIG.dbName + '|' + p.id];
          if (!altri) continue;
          let owned = p.owned, doppi = p.doppi;
          for (const a of altri) {
            const v = await leggi(a.db, a.id);
            if (v) { if (v.owned === true || v.doppi > 0) owned = true; if (v.doppi > doppi) doppi = v.doppi; }
          }
          if (owned !== p.owned || doppi !== p.doppi) { p.owned = owned; p.doppi = doppi; cambiato = true; savePen(p); }
        }
        return cambiato;
      } catch (e) { return false; }
    };
    return { propaga, unisci };
  })();

  const savePen = p => db
    ? wrap(db.transaction(STORE, 'readwrite').objectStore(STORE).put(datiVisitatore(p)))
        .then(() => ristampe ? ristampe.propaga(p) : null)
        .then(segnalaModifica)
        .catch(() => say('Salvataggio non riuscito.'))
    : Promise.resolve();

  const byPos = (a, b) => a.pos - b.pos;
  const TAG_ALIASES = {
    'halloween': ['halloween'],
    'natale': ['natale', 'christmas', 'xmas'],
    'san valentino': ['san valentino', 'valentino', 'valentine', 'innamorati'],
    'pasqua': ['pasqua', 'easter']
  };
  const foldText = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
  function visiblePens() {
    const terms = foldText(query).replace(/#/g, ' ').split(/\s+/).filter(Boolean);
    return pens
      .filter(p => filterMode === 'owned' ? p.owned
        : filterMode === 'missing' ? (!p.owned && p.image && !p.estero)
        : filterMode === 'doppi' ? p.doppi > 0
        : true)
      .filter(p => { if (!terms.length) return true; const hay = searchText(p); return terms.every(t => hay.includes(t)); })
      .sort((a, b) => sortDir * byPos(a, b));
  }

  let barra = null, percTesto = null;
  function updateCount(shown) {
    const base = pens.filter(p => !p.estero);
    const owned = base.filter(p => p.owned).length;
    const total = base.filter(p => p.image || p.owned).length;
    const doppi = pens.reduce((t, p) => t + p.doppi, 0);
    let t = owned + ' ' + CONFIG.possedute + ' su ' + total;
    if (doppi) t += ' · ' + doppi + (doppi === 1 ? ' doppione' : ' doppioni');
    if (typeof shown === 'number' && shown !== pens.length) t += ' · ' + shown + (shown === 1 ? ' visibile' : ' visibili');
    $('count').textContent = t;
    const estere = grid.querySelector('.estere-titolo small');
    if (estere) estere.textContent = testoEstere();
    if (!barra) {
      barra = document.createElement('div');
      barra.className = 'avanz-barra';
      barra.setAttribute('role', 'progressbar');
      barra.setAttribute('aria-label', 'Quanto hai completato');
      barra.append(document.createElement('span'));
      const riga = document.createElement('div');
      riga.className = 'avanz-riga';
      percTesto = document.createElement('span');
      percTesto.className = 'avanz-perc';
      riga.append(barra, percTesto);
      $('count').after(riga);
    }
    const perc = total ? Math.round(owned / total * 100) : 0;
    barra.firstChild.style.width = perc + '%';
    barra.setAttribute('aria-valuenow', String(perc));
    barra.classList.toggle('completa', total > 0 && owned >= total);
    const mancano = Math.max(0, total - owned);
    percTesto.textContent = total && owned >= total ? 'Completa!' : perc + '% · mancano ' + mancano;
    const quanti = { all: pens.length, owned, missing: pens.filter(p => !p.owned && p.image && !p.estero).length, doppi: pens.filter(p => p.doppi > 0).length };
    [...$('filter').options].forEach(o => {
      if (!o.dataset.testo) o.dataset.testo = o.textContent;
      if (o.value in quanti) o.textContent = o.dataset.testo + ' (' + quanti[o.value] + ')';
    });
  }

  const PLURALI_UGUALI = ['auto', 'box', 'charm', 'gadget', 'minifigure', 'peluche', 'photocard', 'portachiavi', 'poster', 'set', 'tote bag'];
  function plurale(nome) {
    const n = String(nome || '').trim();
    if (CONFIG.plurale) return CONFIG.plurale;
    if (!n || PLURALI_UGUALI.includes(n) || /[^aeiou]$/i.test(n)) return n;
    if (/io$/.test(n)) return n.slice(0, -1);
    if (/[cg]o$/.test(n)) return n.slice(0, -1) + 'hi';
    if (/[cg]a$/.test(n)) return n.slice(0, -1) + 'he';
    if (/a$/.test(n)) return n.slice(0, -1) + 'e';
    return n.slice(0, -1) + 'i';
  }
  function rigaInfo() {
    const h1 = document.querySelector('header h1');
    if (!h1 || !SEED.length) return;
    const anni = new Set(SEED.map(s => s.codice));
    const anno = anni.size === 1 && /^(19|20)\d\d$/.test(SEED[0].codice) ? SEED[0].codice : '';
    const principali = SEED.filter(s => !s.estero).length, estere = SEED.length - principali;
    const quanti = principali + ' ' + (principali === 1 ? CONFIG.nome : plurale(CONFIG.nome)) + (estere ? ' + ' + estere + ' estere' : '');
    const p = document.createElement('p');
    p.className = 'info-serie';
    p.textContent = [anno, quanti].filter(Boolean).join(' · ');
    h1.after(p);
  }
  rigaInfo();

  const MINIMO_COLLEZIONISTI = 100;
  const RADICE = new URL('../', document.currentScript.src);
  function descrizione() {
    const fondo = document.querySelector('.wrap > footer');
    if (!fondo || !SEED.length) return;
    const gruppo = document.querySelector('.st-percorso a:last-of-type, a.st-back');
    const nomeGruppo = gruppo ? gruppo.textContent.replace(/^\s*\u2190\s*/, '').trim() : '';
    const anni = new Set(SEED.map(x => x.codice));
    const anno = anni.size === 1 && /^(19|20)\d\d$/.test(SEED[0].codice) ? SEED[0].codice : '';
    const principali = SEED.filter(x => !x.estero);
    const codici = principali.map(x => (/ - (.+)$/.exec(x.paese ? x.code.replace(' - ' + x.paese, '') : x.code) || [])[1]).filter(Boolean);
    const cosa = principali.length + ' ' + (principali.length === 1 ? CONFIG.nome : plurale(CONFIG.nome));
    const tra = [nomeGruppo, anno].filter(Boolean).join(', ');
    const sec = document.createElement('section');
    sec.className = 'descr-serie';
    const p = document.createElement('p');
    p.textContent = 'La checklist completa ' + (principali.length === 1 ? 'di 1 ' + CONFIG.nome : 'delle ' + cosa) + ' di «' + CONFIG.titolo + '»'
      + (tra ? ' (' + tra + ')' : '') + ', con foto, nome e ' + (codici.length ? 'codice' : 'numero') + ' di ognuna'
      + (codici.length > 1 ? ' (da ' + codici[0] + ' a ' + codici[codici.length - 1] + ').' : '.');
    sec.append(p);
    const segnala = document.createElement('a');
    segnala.className = 'btn segnala';
    segnala.textContent = 'Segnala un problema';
    segnala.href = 'mailto:' + 'collectiontime.support' + '@' + 'gmail.com'
      + '?subject=' + encodeURIComponent('Segnalazione · ' + CONFIG.titolo)
      + '&body=' + encodeURIComponent('Ciao! Ho trovato un problema nella serie «' + CONFIG.titolo + '» (' + location.href + ').\n\nCosa non va (foto, nome, numero…):\n');
    sec.append(segnala);
    if (CONFIG.grazieAcceso && String(CONFIG.grazieNome || '').trim()) {
      const g = document.createElement('p');
      g.className = 'descr-grazie';
      g.textContent = 'Grazie a ' + String(CONFIG.grazieNome).trim() + ' per le foto.';
      sec.append(g);
      const apri = document.createElement('button');
      apri.type = 'button'; apri.className = 'descr-grazie-apri'; apri.textContent = 'Leggi tutto'; apri.hidden = true;
      apri.addEventListener('click', () => { const aperto = g.classList.toggle('aperto'); g.classList.toggle('corto', !aperto); apri.textContent = aperto ? 'Mostra meno' : 'Leggi tutto'; });
      sec.append(apri);
      const misura = () => { g.classList.add('corto'); apri.hidden = !(g.scrollHeight > g.clientHeight + 1) && !g.classList.contains('aperto'); if (g.classList.contains('aperto')) g.classList.remove('corto'); };
      g.classList.add('corto'); requestAnimationFrame(misura); addEventListener('resize', misura); if (document.fonts) document.fonts.ready.then(misura);
    }
    const suggerimento = [...fondo.querySelectorAll('p.hint')].find(h => /^\s*Premi su/.test(h.textContent));
    if (suggerimento) fondo.before(suggerimento);
    fondo.before(sec);
    fetch(new URL('comune/collezionisti.json', RADICE)).then(r => r.ok ? r.json() : null).then(d => {
      const n = d && d.serie && d.serie[CONFIG.dbName];
      if (!n || n < MINIMO_COLLEZIONISTI) return;
      const b = document.createElement('p');
      b.className = 'descr-conta';
      b.textContent = n + ' collezionisti la stanno completando su Collection Time: inizia anche tu!';
      segnala.before(b);
    }).catch(() => {});
  }
  descrizione();

  const ensureHalo = (pic, p) => accendiBagliore(pic, p.image);

  function setOwned(p, value) {
    const eraCompleta = serieCompleta();
    p.owned = value;
    const aveviDoppi = !value && p.doppi > 0;
    if (aveviDoppi) say(p.doppi === 1 ? 'Tolto anche il doppione.' : 'Tolti anche i ' + p.doppi + ' doppioni.');
    if (!value) p.doppi = 0;
    savePen(p);
    if (filterMode !== 'all') render();
    else {
      const li = grid.querySelector('[data-id="' + p.id + '"]');
      if (li) {
        li.classList.toggle('owned', value);
        if (value) ensureHalo(li.querySelector('.pic'), p);
        li.querySelector('.open').setAttribute('aria-pressed', String(value));
        if (aveviDoppi) li.querySelector('.doppi').replaceWith(doppiBox(p));
      }
      updateCount();
    }
    if (value && !eraCompleta && serieCompleta()) festeggia();
  }

  const FESTA_MIN = 2, FESTA_MS = 5000, FESTA_N = 360   , FESTA_COLORI = ['#F2A900', '#FFD166', '#1A2140', '#5D6580', '#FFF2CC', '#F2A900', '#E8590C', '#2F9E44'];
  function serieCompleta() {
    const base = pens.filter(p => !p.estero);
    const total = base.filter(p => p.image || p.owned).length;
    return total >= FESTA_MIN && base.filter(p => p.owned).length >= total;
  }
  function festeggia() {
    const chiave = 'ct-festa-' + (CONFIG.id || CONFIG.titolo);
    try { if (sessionStorage.getItem(chiave)) return; sessionStorage.setItem(chiave, '1'); } catch (e) {}
    setTimeout(() => {
      festaMessaggio();
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) festaCoriandoli(festaNascondi);
      else { clearTimeout(festaT); festaT = setTimeout(festaNascondi, FESTA_MS); }
    }, 450);
  }
  let festaT = 0;
  function festaMessaggio() {
    document.querySelectorAll('.festa-msg').forEach(e => e.remove());
    const m = document.createElement('div');
    m.className = 'festa-msg'; m.setAttribute('role', 'status');
    m.innerHTML = '<span class="em" aria-hidden="true">🎉</span><div class="tt"><b>Serie completata!</b><span></span></div>';
    m.querySelector('.tt span').textContent = 'Hai tutti i pezzi di «' + CONFIG.titolo + '».';
    document.body.append(m);
    requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('su')));
  }
  function festaNascondi() {
    clearTimeout(festaT);
    document.querySelectorAll('.festa-msg').forEach(m => { m.classList.remove('su'); setTimeout(() => m.remove(), 500); });
  }
  function festaCoriandoli(alFine) {
    const d = 1, W = innerWidth, H = innerHeight;
    const c = document.createElement('canvas'), x = c.getContext('2d');
    c.className = 'festa-coriandoli'; c.setAttribute('aria-hidden', 'true');
    c.width = Math.round(W * d); c.height = Math.round(H * d); document.body.append(c);
    const N = matchMedia('(pointer: coarse)').matches ? Math.round(FESTA_N * .45) : Math.round(FESTA_N * .7);
    const P = [], G = .17, VMAX = 6;
    for (let i = 0; i < N; i++) {
      const l = i % 2, forza = 3.5 + Math.random() * 5.5;
      P.push({ x: l ? W - 8 : 8, y: H * (.45 + Math.random() * .2), vx: (l ? -1 : 1) * forza * Math.min(3.2, W / 430), vy: -Math.sqrt(2 * G * H * (.2 + Math.random() * .4)),
        w: 6 + Math.random() * 8, h: 10 + Math.random() * 10, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
        c: FESTA_COLORI[i % FESTA_COLORI.length] });
    }
    P.sort((a, b) => (a.c < b.c ? -1 : a.c > b.c ? 1 : 0));
    let colore = '';
    const t0 = performance.now(), DUR = 6000;
    let ult = t0;
    (function giro(t) {
      const k = t - t0, f = Math.min(3, Math.max(.2, (t - ult) / 16.67)); ult = t;
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
      x.globalAlpha = Math.max(0, Math.min(1, (DUR - k) / 1500));
      let visibili = 0;
      for (const p of P) {
        p.vy = Math.min(p.vy + G * f, VMAX); p.vx *= Math.pow(.985, f); if (p.vy > 0) p.vx += Math.sin(p.r * 2) * .06 * f;
        p.x += p.vx * f; p.y += p.vy * f; p.r += p.vr * f;
        if (p.y > H + 20) continue;
        visibili++;
        const co = Math.cos(p.r), si = Math.sin(p.r), sy = Math.abs(Math.cos(p.r * 1.7)) * .8 + .2;
        x.setTransform(co * d, si * d, -si * sy * d, co * sy * d, p.x * d, p.y * d);
        if (p.c !== colore) x.fillStyle = colore = p.c;
        x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      if (k < DUR && (visibili || k < 800)) requestAnimationFrame(giro); else { c.remove(); if (alFine) alFine(); }
    })(t0);
  }

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
      if (p.doppi && !p.owned) {
        say('Segnato anche «Ce l\'ho»: se hai un doppione, ce l\'hai.');
        mostra(); return setOwned(p, true);
      }
      savePen(p);
      if (filterMode === 'doppi' && !p.doppi) render();
      else { mostra(); updateCount(); }
    };
    meno.addEventListener('click', () => cambia(-1));
    piu.addEventListener('click', () => cambia(1));
    mostra();
    return box;
  }

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
      if (!CONFIG.mostraNomi) img.title = img.alt;
      img.decoding = 'async';
      img.loading = 'lazy';
      const spunta = document.createElement('span');
      spunta.className = 'spunta';
      spunta.setAttribute('aria-hidden', 'true');
      pic.append(img, spunta);
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
    if (p.richNumero && !p.paese) code.innerHTML = p.richNumero; else code.textContent = p.code || 'N°';
    code.setAttribute('aria-label', 'Numero ' + (p.code || 'non indicato'));

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'edit';
    edit.textContent = 'info';
    edit.setAttribute('aria-label', 'Dettagli');
    edit.title = 'Dettagli';
    edit.addEventListener('click', () => openEdit(p));

    const doppi = p.image ? [doppiBox(p)] : [];
    if (CONFIG.mostraNomi) {
      const nome = document.createElement('div');
      nome.className = 'nome';
      nome.append(document.createElement('span'));
      if (p.richNome) nome.firstChild.innerHTML = p.richNome; else nome.firstChild.textContent = p.name;
      li.append(btn, nome, edit, code, ...doppi);
    } else {
      li.append(btn, edit, code, ...doppi);
    }
    return li;
  }

  const testoEstere = () => {
    const tutte = pens.filter(p => p.estero && (p.image || p.owned));
    return tutte.filter(p => p.owned).length + ' su ' + tutte.length + ' · non contano per completare la serie';
  };
  function titoloEstere() {
    const li = document.createElement('li');
    li.className = 'estere-titolo';
    const t = document.createElement('b');
    t.textContent = 'Varianti estere';
    const n = document.createElement('small');
    n.textContent = testoEstere();
    li.append(t, n);
    return li;
  }

  function render() {
    const list = visiblePens();
    const nodi = list.filter(p => !p.estero).map(card);
    const estere = list.filter(p => p.estero);
    if (estere.length) nodi.push(titoloEstere(), ...estere.map(card));
    grid.replaceChildren(...nodi);
    $('noResults').hidden = list.length > 0 || pens.length === 0;
    $('emptyAll').hidden = pens.length > 0;
    updateCount(list.length);
  }

  let editTags = [];
  const tagSug = $('tagSug');
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

  let fotoBox = null;
  function mostraFotoInfo(p) {
    if (!fotoBox) {
      fotoBox = document.createElement('div');
      fotoBox.className = 'info-foto';
      fotoBox.innerHTML = '<div class="if-scorri" tabindex="0" aria-label="Foto"></div>' +
        '<button type="button" class="if-freccia if-prec" aria-label="Foto precedente">\u2039</button>' +
        '<button type="button" class="if-freccia if-succ" aria-label="Foto successiva">\u203A</button>' +
        '<div class="if-punti"></div>';
      $('fInfoBox').after(fotoBox);
      const sc = fotoBox.querySelector('.if-scorri');
      const vai = d => sc.scrollBy({ left: d * sc.clientWidth, behavior: 'smooth' });
      fotoBox.querySelector('.if-prec').addEventListener('click', () => vai(-1));
      fotoBox.querySelector('.if-succ').addEventListener('click', () => vai(1));
      sc.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); vai(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); vai(1); }
      });
      sc.addEventListener('scroll', () => aggiornaFotoInfo(), { passive: true });
    }
    const sc = fotoBox.querySelector('.if-scorri');
    const foto = p.fotoInfo || [];
    fotoBox.hidden = !foto.length;
    sc.replaceChildren(...foto.map((src, i) => {
      const im = document.createElement('img');
      im.src = src; im.alt = (p.name || 'Foto') + ' (' + (i + 1) + '/' + foto.length + ')';
      im.loading = 'lazy'; im.draggable = false;
      im.style.cursor = 'zoom-in'; im.addEventListener('click', () => ingrandisciFoto(src, im.alt));
      return im;
    }));
    sc.scrollLeft = 0;
    fotoBox.querySelector('.if-punti').replaceChildren(...foto.map(() => document.createElement('span')));
    fotoBox.classList.toggle('una', foto.length < 2);
    aggiornaFotoInfo();
  }
  let zoomDlg = null;
  function ingrandisciFoto(src, alt) {
    if (!zoomDlg) {
      zoomDlg = document.createElement('dialog');
      zoomDlg.className = 'if-zoom';
      zoomDlg.innerHTML = '<img alt=""><button type="button" class="if-zoom-x" aria-label="Chiudi">\u2715</button>';
      zoomDlg.addEventListener('click', () => zoomDlg.close());
      document.body.appendChild(zoomDlg);
    }
    const im = zoomDlg.querySelector('img');
    im.src = src; im.alt = alt || '';
    zoomDlg.showModal();
  }
  function aggiornaFotoInfo() {
    if (!fotoBox) return;
    const sc = fotoBox.querySelector('.if-scorri');
    const n = sc.children.length;
    const i = n ? Math.min(n - 1, Math.round(sc.scrollLeft / (sc.clientWidth || 1))) : 0;
    [...fotoBox.querySelector('.if-punti').children].forEach((d, k) => d.classList.toggle('on', k === i));
    fotoBox.querySelector('.if-prec').disabled = i <= 0;
    fotoBox.querySelector('.if-succ').disabled = i >= n - 1;
  }

  function openEdit(p) {
    editing = p;
    const img = $('dlgImg');
    if (p.image) img.src = p.image; else img.removeAttribute('src');
    img.hidden = !p.image;
    $('dlgNoPhoto').hidden = !!p.image;
    $('fCodice').value = p.codice;
    const campoCodice = $('fCodice').closest('.field'), trioCodice = document.querySelector('#editForm .trio');
    if (p.senzaCodice) campoCodice.remove(); else if (!campoCodice.isConnected && trioCodice) trioCodice.prepend(campoCodice);
    $('fCode').value = p.code;
    $('fName').value = p.name;
    const trio = document.querySelector('#editForm .trio'), haCol = !!(p.colorName || p.colorHex);
    if (haCol && trio) {
      if (!campoColore.isConnected) trio.insertBefore(campoColore, trio.children[1] || null);
      $('colorDot').style.background = p.colorHex || 'transparent';
      $('colorDot').classList.toggle('empty', !p.colorHex);
      $('fColorName').value = p.colorName;
    } else campoColore.remove();
    if (p.richInfo) $('fInfo').innerHTML = p.richInfo; else $('fInfo').textContent = p.info;
    $('fInfoBox').hidden = !p.info;
    mostraFotoInfo(p);
    editTags = p.tags.slice();
    tagInput.value = '';
    renderTags();
    $('fOwned').checked = p.owned;
    dlg.showModal();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
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

  const printDlg = $('printDlg');
  const kindName = { owned: 'collezione', scambi: 'cerco-scambio', mancanti: 'mi-mancano', doppioni: 'doppioni', all: 'checklist' };
  let conEstere = false;
  function printList(soloMancanti) {
    const all = [...pens].sort(byPos);
    const stampabili = (conEstere || !all.some(p => !p.estero)) ? all : all.filter(p => !p.estero);
    return soloMancanti ? stampabili.filter(p => !p.owned && p.image) : stampabili;
  }
  const loadImg = src => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('immagine non leggibile'));
    i.src = src;
  });
  const pdfText = t => String(t).replace(/[\u0000-\u001F]/g, '');
  const misuraCtx = document.createElement('canvas').getContext('2d');
  const righello = peso => ({ widthOfTextAtSize(t, size) { misuraCtx.font = peso + ' ' + size + 'px Helvetica, Arial, sans-serif'; return misuraCtx.measureText(t).width; } });
  const rgb = (r, g, b) => ({ red: r, green: g, blue: b });

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
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
    return { img, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  function fotoTela(r, dw, dh, transparent) {
    const K = 3.5;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(dw * K));
    c.height = Math.max(1, Math.round(dh * K));
    const ctx = c.getContext('2d');
    if (!transparent) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(r.img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    return c;
  }
  const fileDi = (c, tipo) => new Promise(r => c.toBlob(r, tipo, 0.9));

  async function titoloTela() {
    const el = document.querySelector('.titolo-testo');
    if (!el) return null;
    const radice = document.documentElement, tema = radice.dataset.tema;
    radice.dataset.tema = 'chiaro';
    const cs = getComputedStyle(el), colore = cs.color, famiglia = cs.fontFamily;
    if (tema === undefined) delete radice.dataset.tema; else radice.dataset.tema = tema;
    const text = el.textContent.trim(), size = 200;
    const font = '700 ' + size + 'px ' + famiglia;
    try { if (document.fonts && document.fonts.load) await document.fonts.load(font, text); } catch (e) {  }
    const c = document.createElement('canvas'), ctx = c.getContext('2d');
    ctx.font = font;
    const m = ctx.measureText(text), pad = Math.round(size * 0.04);
    const su = Math.ceil(m.actualBoundingBoxAscent), giu = Math.ceil(m.actualBoundingBoxDescent);
    c.width = Math.ceil(m.width) + 2 * pad;
    c.height = su + giu + 2 * pad;
    ctx.font = font;
    ctx.fillStyle = colore;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, pad, pad + su);
    return c;
  }

  const TESSERA = 'M7 0H25Q32 0 32 7V25Q32 32 25 32H7Q0 32 0 25V7Q0 0 7 0Z';
  const SPUNTA = [[8.22, 16.6], [13.4, 21.6], [24.52, 11.23]];
  const SPESSORI = [4.6, 3.8];

  function tesseraCanvas(ctx, fondo, spunta) {
    ctx.fillStyle = fondo;
    ctx.fill(new Path2D(TESSERA));
    ctx.strokeStyle = spunta; ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      ctx.lineWidth = SPESSORI[i];
      ctx.beginPath(); ctx.moveTo(...SPUNTA[i]); ctx.lineTo(...SPUNTA[i + 1]); ctx.stroke();
    }
  }

  const SFONDO_RIGA = 26, SFONDO_TESSERA = 9, SFONDO_SCRITTA = 8;
  function sfondoTela(W, H) {
    const K = 2, c = document.createElement('canvas');
    c.width = Math.round(W * K); c.height = Math.round(H * K);
    const ctx = c.getContext('2d');
    ctx.scale(K, K);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.26);
    ctx.font = '700 ' + SFONDO_SCRITTA + 'px Helvetica, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    const testo = 'collectiontime.com';
    const passo = SFONDO_TESSERA + 4 + ctx.measureText(testo).width + 22;
    const R = Math.hypot(W, H) / 2 + passo;
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
      drawSvgPath(d, o) {
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

  const PDF_COLONNE = 6;
  async function makeImmagine(sezioni, kind) {
    say("Sto creando l'immagine…");
    const font = righello('400'), bold = righello('700');
    const titolo = await titoloTela();
    const logo = titolo ? titolo : null;

    const ink = rgb(26 / 255, 33 / 255, 64 / 255);
    const ambra = rgb(242 / 255, 169 / 255, 0);
    const carta = rgb(0.957, 0.953, 0.937);
    const bianco = rgb(1, 1, 1), gray = rgb(0.78, 0.8, 0.85), grigio = rgb(0.35, 0.38, 0.5);
    const red = rgb(229 / 255, 10 / 255, 21 / 255);

    const orizzontale = !!CONFIG.pdfColonne;
    const W = orizzontale ? 841.89 : 595.28, MX = 28;
    let H = orizzontale ? 595.28 : 841.89;
    const COLS = orizzontale ? CONFIG.pdfColonne : PDF_COLONNE;
    const ROWS = CONFIG.pdfFile || 2;
    const BAND = 42;
    let TITOLO_H = 32;
    const TITOLO_MAXW = W - 2 * MX - 40;
    if (logo && TITOLO_H * logo.width / logo.height > TITOLO_MAXW) TITOLO_H = TITOLO_MAXW * logo.height / logo.width;
    const LOGO_W = logo ? TITOLO_H * logo.width / logo.height : 0;
    const CART_PX = 26, CART_PY = 12, CART_H = TITOLO_H + 2 * CART_PY;
    const SOPRA = BAND + 16, gridBottom = 52;
    const TITOLO_GAP = 18;
    const spazio = H - SOPRA - CART_H - TITOLO_GAP - gridBottom;
    const ROW_GAP = 12;
    const colPitch = (W - 2 * MX) / COLS;
    const CARD_GAP = Math.min(6, colPitch * 0.06);
    const cardW = colPitch - CARD_GAP;
    const PAD = Math.min(5, cardW * 0.06);
    const GAP = 3, CODE_H = 13, BOX = 8;
    const NOME_SIZE = 7.5, NOME_RIGA = 9;
    const nomi = !!CONFIG.mostraNomi;
    const NOME_H = nomi ? 2 * NOME_RIGA + GAP : 0;
    const TESTO_H = GAP + NOME_H + CODE_H + GAP + BOX;
    const fotoW = cardW - 2 * PAD;
    const fotoMaxH = orizzontale ? (spazio - (ROWS - 1) * ROW_GAP) / ROWS - 2 * PAD - TESTO_H
                                 : fotoW;

    const list = sezioni.flatMap(s => s.items);
    const fotoLette = await Promise.all(list.map(p => (p.image || SLOT_IMG) ? ritaglio(p.image || SLOT_IMG).catch(() => null) : null));
    const foto = new Map(list.map((p, i) => [p, fotoLette[i]]));
    const altiUguali = (CONFIG.proporzione || 7) > 1;
    const maxW = Math.max(1, ...fotoLette.map(f => f ? f.w : 0)), maxH = Math.max(1, ...fotoLette.map(f => f ? f.h : 0));
    const scala = Math.min(fotoW / maxW, fotoMaxH / maxH);
    const misura = f => {
      const k = altiUguali ? Math.min(fotoW / f.w, fotoMaxH / f.h) : scala;
      return [f.w * k, f.h * k];
    };
    const fotoH = altiUguali ? fotoMaxH : maxH * scala;
    const cardH = fotoH + 2 * PAD + TESTO_H;

    const TESTA_H = 24;
    const file = [];
    sezioni.forEach(s => {
      if (s.titolo) file.push({ testa: s });
      for (let i = 0; i < s.items.length; i += COLS) file.push({ items: s.items.slice(i, i + COLS), sezione: s });
    });
    const alto = ff => ff.reduce((t, f) => t + (f.testa ? TESTA_H : cardH), 0) + Math.max(0, ff.length - 1) * ROW_GAP;

    const pagine = [file];
    H = SOPRA + CART_H + TITOLO_GAP + alto(file) + gridBottom;
    const areaTop = H - SOPRA, gridTop = areaTop - CART_H - TITOLO_GAP;
    const bloccoH = Math.max(...pagine.map(alto));
    const avanzo = (gridTop - gridBottom - bloccoH) / 2;
    const cartTop = areaTop - avanzo, primaFila = gridTop - avanzo;

    const R = Math.min(6, cardW * 0.12);
    const scheda = (w, h) => `M${R} 0H${w - R}Q${w} 0 ${w} ${R}V${h - R}Q${w} ${h} ${w - R} ${h}H${R}Q0 ${h} 0 ${h - R}V${R}Q0 0 ${R} 0Z`;
    const schedaPath = scheda(cardW, cardH);

    function marchio(pg, x, y, size, spunta) {
      const scale = size / 32;
      pg.drawSvgPath(TESSERA, { x, y, scale, color: ambra });
      const P = SPUNTA.map(([px, py]) => ({ x: x + px * scale, y: y - py * scale }));
      for (let k = 0; k < 2; k++) pg.drawLine({ start: P[k], end: P[k + 1], thickness: SPESSORI[k] * scale, color: spunta, lineCap: true });
    }

    const cosa = { owned: 'La mia collezione', scambi: 'Cerco e scambio', mancanti: 'Mi mancano', doppioni: 'Doppioni', all: 'Checklist da compilare' }[kind];

    function testata(pg, s, top) {
      const T = pdfText(s.titolo), D = pdfText(s.sotto || ''), SZ = 12, sz = 9;
      const tw = bold.widthOfTextAtSize(T, SZ), dw = D ? font.widthOfTextAtSize(D, sz) + 10 : 0;
      const w = tw + dw + 24, h = TESTA_H;
      pg.drawSvgPath(scheda(w, h), { x: MX, y: top, color: bianco, borderColor: ambra, borderWidth: 1.2 });
      pg.drawText(T, { x: MX + 12, y: top - h / 2 - SZ * 0.35, size: SZ, font: bold, color: ink });
      if (D) pg.drawText(D, { x: MX + 12 + tw + 10, y: top - h / 2 - sz * 0.35, size: sz, font, color: grigio });
      pg.drawRectangle({ x: MX + w + 8, y: top - h / 2 - 0.75, width: W - 2 * MX - w - 8, height: 1.5, color: ambra });
    }

    const sfondo = sfondoTela(W, H);
    const pages = [];
    let ghost = null;
    for (const filePagina of pagine) {
      const page = paginaTela(W, H, bold);
      pages.push(page);

      page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: carta });
      page.drawImage(sfondo, { x: 0, y: 0, width: W, height: H });

      page.drawRectangle({ x: 0, y: H - BAND, width: W, height: BAND, color: ink });
      page.drawRectangle({ x: 0, y: H - BAND - 2.5, width: W, height: 2.5, color: ambra });
      marchio(page, MX, H - 8, 26, ink);
      page.drawText('Collection Time', { x: MX + 34, y: H - 28, size: 20, font: bold, color: bianco });
      const cw = font.widthOfTextAtSize(cosa, 16);
      page.drawText(cosa, { x: W - MX - cw, y: H - 26.5, size: 16, font, color: bianco });

      const title = pdfText(CONFIG.titolo);
      const tw = logo ? LOGO_W : bold.widthOfTextAtSize(title, TITOLO_H * 1.35);
      const cartW = tw + 2 * CART_PX;
      page.drawSvgPath(scheda(cartW, CART_H), { x: (W - cartW) / 2, y: cartTop, color: bianco, borderColor: gray, borderWidth: 0.6 });
      page.drawRectangle({ x: (W - cartW) / 2 + R, y: cartTop - CART_H, width: cartW - 2 * R, height: 2.5, color: ambra });
      if (logo) page.drawImage(logo, { x: (W - LOGO_W) / 2, y: cartTop - CART_PY - TITOLO_H, width: LOGO_W, height: TITOLO_H });
      else page.drawText(title, { x: (W - tw) / 2, y: cartTop - CART_PY - TITOLO_H, size: TITOLO_H * 1.35, font: bold, color: ink });

      let top = primaFila;
      for (const fila of filePagina) {
        if (fila.testa) { testata(page, fila.testa, top); top -= TESTA_H + ROW_GAP; continue; }
        const inFila = fila.items.length;
        for (let c = 0; c < inFila; c++) {
          const p = fila.items[c];
          const spost = orizzontale ? 0 : (COLS - inFila) * colPitch / 2;
          const cx = MX + spost + c * colPitch + colPitch / 2;
          const spuntata = kind === 'owned' && p.owned;

          page.drawSvgPath(schedaPath, { x: cx - cardW / 2, y: top, color: bianco,
            borderColor: spuntata ? ambra : gray, borderWidth: spuntata ? 1.4 : 0.6 });
          if (spuntata) {
            const K = 4, g = document.createElement('canvas');
            g.width = Math.round(cardW * K); g.height = Math.round(cardH * K);
            const gx = g.getContext('2d'); gx.scale(K, K);
            gx.fillStyle = '#FFF2CC'; gx.fill(new Path2D(schedaPath));
            page.drawImage(g, { x: cx - cardW / 2, y: top - cardH, width: cardW, height: cardH });
            page.drawSvgPath(schedaPath, { x: cx - cardW / 2, y: top, borderColor: ambra, borderWidth: 1.4 });
          }

          const fotoTop = top - PAD, f = foto.get(p);
          if (f) {
            const [dw, dh] = misura(f), x = cx - dw / 2, y = fotoTop - fotoH;
            if (p.image) page.drawImage(fotoTela(f, dw, dh, spuntata), { x, y, width: dw, height: dh });
            else {
              if (!ghost) ghost = fotoTela(f, dw, dh);
              page.drawImage(ghost, { x, y, width: dw, height: dh });
            }
          }
          let y = fotoTop - fotoH - GAP;

          if (nomi) {
            const righe = righeNome(pdfText(p.name || ''), bold, NOME_SIZE, cardW - 2 * PAD);
            const y0 = y - NOME_RIGA + 2 - (2 - righe.length) * NOME_RIGA / 2;
            righe.forEach((t, k) => {
              const tw = bold.widthOfTextAtSize(t, NOME_SIZE);
              page.drawText(t, { x: cx - tw / 2, y: y0 - k * NOME_RIGA, size: NOME_SIZE, font: bold, color: ink });
            });
            y -= NOME_H;
          }

          const boxY = y - CODE_H;
          const code = pdfText(p.code || ''), codeW = bold.widthOfTextAtSize(code, 7.5);
          const boxW = Math.min(cardW - 2 * PAD, Math.max(26, codeW + 10));
          page.drawRectangle({ x: cx - boxW / 2, y: boxY, width: boxW, height: CODE_H, color: carta, borderColor: gray, borderWidth: 0.6 });
          if (code) page.drawText(code, { x: cx - codeW / 2, y: boxY + 3.6, size: 7.5, font: bold, color: p.limited ? red : ink });

          if (fila.sezione.scambio) {
            if (p.doppi > 1) {
              const t = '×' + p.doppi, tw = bold.widthOfTextAtSize(t, 9);
              page.drawText(t, { x: cx - tw / 2, y: boxY - GAP - BOX + 0.5, size: 9, font: bold, color: ambra });
            }
            continue;
          }

          const qy = boxY - GAP - BOX;
          page.drawRectangle({ x: cx - BOX / 2, y: qy, width: BOX, height: BOX, color: bianco, borderColor: grigio, borderWidth: 0.8 });
          if (spuntata) {
            page.drawLine({ start: { x: cx - 2.6, y: qy + 3.9 }, end: { x: cx - 0.7, y: qy + 1.7 }, thickness: 1.3, color: ambra });
            page.drawLine({ start: { x: cx - 0.7, y: qy + 1.7 }, end: { x: cx + 3, y: qy + 6.4 }, thickness: 1.3, color: ambra });
          }
        }
        top -= cardH + ROW_GAP;
      }
    }

    const FILIGRANA_OPACITA = 0.12;
    const fc = document.createElement('canvas');
    fc.width = fc.height = 512;
    const fctx = fc.getContext('2d');
    fctx.scale(16, 16);
    tesseraCanvas(fctx, 'rgba(26, 33, 64, .5)', '#1A2140');
    fctx.clearRect(0, 0, 32, 32);
    fctx.fillStyle = 'rgba(26, 33, 64, .5)'; fctx.fill(new Path2D(TESSERA));
    fctx.save(); fctx.translate(4.8, -0.8); fctx.scale(0.7, 0.7);
    fctx.strokeStyle = '#1A2140'; fctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) { fctx.lineWidth = SPESSORI[i]; fctx.beginPath(); fctx.moveTo(...SPUNTA[i]); fctx.lineTo(...SPUNTA[i + 1]); fctx.stroke(); }
    fctx.restore();
    fctx.fillStyle = '#1A2140'; fctx.textAlign = 'center';
    fctx.font = '800 10px Helvetica, Arial, sans-serif';
    fctx.font = '800 ' + Math.min(10 * 23 / fctx.measureText('Collection Time').width, 5) + 'px Helvetica, Arial, sans-serif';
    fctx.fillText('Collection Time', 16, 26.6);
    fctx.fillRect(9, 28.6, 14, 0.6);
    const filigrana = fc;

    const SITO_SIZE = 14, sc = document.createElement('canvas'), sctx = sc.getContext('2d'), SK = 4;
    const sitoW = bold.widthOfTextAtSize('collectiontime.com', SITO_SIZE);
    sc.width = Math.ceil(sitoW * SK); sc.height = Math.ceil(SITO_SIZE * 1.25 * SK);
    sctx.scale(SK, SK);
    sctx.font = '700 ' + SITO_SIZE + 'px Helvetica, Arial, sans-serif';
    sctx.fillStyle = '#1A2140';
    sctx.textBaseline = 'alphabetic';
    sctx.fillText('collectiontime.com', 0, SITO_SIZE);
    const sito = sc;

    pages.forEach(pg => {
      const WM = Math.min(250, H * 0.6);
      pg.drawImage(filigrana, { x: (W - WM) / 2, y: primaFila - (bloccoH + WM) / 2, width: WM, height: WM, opacity: FILIGRANA_OPACITA * 2 });

      marchio(pg, MX, 36, 18, ink);
      pg.drawImage(sito, { x: MX + 24, y: 22 - SITO_SIZE * 0.25, width: sc.width / SK, height: sc.height / SK });

    });

    const blob = await fileDi(pages[0].tela, 'image/jpeg');
    const oggi = new Date(), dd = n => String(n).padStart(2, '0');
    const nome = 'collection-time_' + CONFIG.id + '_' + kindName[kind] + '_' + oggi.getFullYear() + '-' + dd(oggi.getMonth() + 1) + '-' + dd(oggi.getDate()) + '.jpg';
    const scarica = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      say('Immagine salvata nella cartella Download.');
    };
    const jpg = typeof File === 'function' ? new File([blob], nome, { type: 'image/jpeg' }) : null;
    if (jpg && navigator.canShare && navigator.canShare({ files: [jpg] }) && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ files: [jpg] }).catch(err => { if (!err || err.name !== 'AbortError') scarica(); });
    }
    else scarica();
  }

  const LIBERE = ['all'];
  const conAccount = () => { try { return localStorage.getItem('ct-accesso') === '1'; } catch (e) { return false; } };
  function bloccaStampa() {
    const si = conAccount();
    const voci = [...printDlg.querySelectorAll('input[name=printKind]')];
    voci.forEach(i => {
      const chiusa = !si && !LIBERE.includes(i.value);
      i.disabled = chiusa;
      i.closest('label').classList.toggle('chiusa', chiusa);
    });
    const scelta = voci.find(i => i.checked);
    if (!scelta || scelta.disabled) (voci.find(i => !i.disabled) || {}).checked = true;
    let nota = printDlg.querySelector('.print-accedi');
    if (!nota) {
      nota = document.createElement('p');
      nota.className = 'print-accedi';
      nota.innerHTML = 'Per creare l\'immagine della tua collezione, dei "Mi mancano" e dei "Doppioni" serve un account gratuito. ' +
        '<button type="button" data-accedi>Accedi</button>';
      printDlg.querySelector('.actions').before(nota);
      nota.querySelector('button').addEventListener('click', () => printDlg.close());
    }
    nota.hidden = si;
  }

  const parteMancanti = titolo => { const l = printList(true); return { titolo, sotto: 'Mi mancano · ' + l.length, items: l }; };
  const parteDoppioni = titolo => {
    const l = printList(false).filter(p => p.doppi > 0);
    return { titolo, sotto: 'Doppioni · ' + l.reduce((t, p) => t + p.doppi, 0), items: l, scambio: true };
  };
  const sezioniDi = {
    scambi:   () => [parteMancanti('CERCO'), parteDoppioni('SCAMBIO')],
    mancanti: () => [parteMancanti('MI MANCANO')],
    doppioni: () => [parteDoppioni('DOPPIONI')],
    owned:    () => [{ items: printList(false) }],
    all:      () => [{ items: printList(false) }]
  };

  (function () {
    const dopo = printDlg.querySelector('input[value="scambi"]');
    if (!dopo || printDlg.querySelector('input[value="mancanti"]')) return;
    const voce = (valore, nome, id) => {
      const l = document.createElement('label');
      l.className = 'choice';
      l.innerHTML = '<input type="radio" name="printKind" value="' + valore + '"><span><strong>' + nome +
        '</strong> (<span id="' + id + '"></span>)</span>';
      return l;
    };
    const fine = dopo.closest('label');
    const coppia = document.createElement('div');
    coppia.className = 'choice-coppia';
    coppia.append(voce('mancanti', 'Mi mancano', 'cnt-mancanti'), voce('doppioni', 'Doppioni', 'cnt-doppioni'));
    fine.after(coppia);
  })();

  const estereVoce = (function () {
    const l = document.createElement('label');
    l.className = 'print-estere';
    l.innerHTML = '<input type="checkbox" id="printEstere"><span>Stampa anche le varianti estere</span>';
    printDlg.querySelector('.actions').before(l);
    return l;
  })();
  const estereCasella = estereVoce.querySelector('input');
  function conteggiStampa() {
    const base = conEstere ? pens : pens.filter(p => !p.estero);
    const total = base.filter(p => p.image || p.owned).length;
    $('cnt-owned').textContent = base.filter(p => p.owned).length + ' su ' + total;
    const nMancanti = printList(true).length, nDoppioni = printList(false).filter(p => p.doppi > 0).length;
    $('cnt-scambi').textContent = nMancanti + ' cerco · ' + nDoppioni + ' scambio';
    $('cnt-mancanti').textContent = nMancanti;
    $('cnt-doppioni').textContent = nDoppioni;
  }
  estereCasella.addEventListener('change', () => { conEstere = estereCasella.checked; conteggiStampa(); });
  $('btnPrint').addEventListener('click', () => {
    conEstere = false; estereCasella.checked = false;
    estereVoce.hidden = !(pens.some(p => p.estero) && pens.some(p => !p.estero));
    conteggiStampa();
    bloccaStampa();
    printDlg.showModal();
  });
  $('printCancel').addEventListener('click', () => printDlg.close());

  $('btnShare').addEventListener('click', async () => {
    const dati = { title: document.title, url: location.href };
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share(dati); } catch (err) { if (!err || err.name !== 'AbortError') copiaLink(); }
    } else copiaLink();
  });
  async function copiaLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      say('Link copiato: incollalo dove vuoi.');
    } catch (err) {
      say(location.href);
    }
  }
  async function crea() {
    const chosen = printDlg.querySelector('input[name=printKind]:checked');
    const kind = chosen ? chosen.value : 'owned';
    if (!conAccount() && !LIBERE.includes(kind)) { say('Accedi per creare questa immagine.'); return; }
    const sezioni = sezioniDi[kind]().filter(s => s.items.length || kind === 'owned' || kind === 'all');
    if (!sezioni.some(s => s.items.length)) {
      say({ mancanti: 'Non ti manca nulla.', doppioni: 'Non hai doppioni.' }[kind] || 'Non ti manca nulla e non hai doppioni.');
      return;
    }
    printDlg.close();
    try {
      await makeImmagine(sezioni, kind);
    } catch (err) {
      console.error(err);
      say(location.protocol === 'file:'
        ? "L'immagine non si può creare con la pagina aperta dal Finder: aprila dal sito o da un server locale."
        : "Non sono riuscito a creare l'immagine.");
    }
  }
  $('printImg').addEventListener('click', crea);

  $('search').addEventListener('input', e => { query = e.target.value; render(); });
  if (!$('filter').querySelector('option[value="doppi"]')) $('filter').append(new Option('Doppioni', 'doppi'));
  $('filter').addEventListener('change', e => { filterMode = e.target.value; render(); });
  $('sort').value = sortDir === -1 ? 'desc' : 'asc';
  $('sort').addEventListener('change', e => {
    sortDir = e.target.value === 'desc' ? -1 : 1;
    try { localStorage.setItem(CHIAVE_ORDINE, e.target.value); } catch (err) {}
    render();
  });

  function rinumera(salvate) {
    const idNuovo = new Map(SEED.map(s => [s.code + '|' + s.name, s.id]));
    const spostate = [];
    const altre = salvate.filter(p => {
      const nuovo = p.seed && idNuovo.get(p.code + '|' + p.name);
      if (!nuovo || nuovo === p.id) return true;
      spostate.push(Object.assign(p, { id: nuovo }));
      return false;
    });
    const perId = new Map(altre.map(p => [p.id, p]));
    spostate.forEach(p => perId.set(p.id, p));
    return [...perId.values()];
  }

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
          if (p.doppi) p.owned = true;
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
    if (ristampe && db) ristampe.unisci().then(c => { if (c) render(); });
    if (location.hash === '#cerco-scambio') {
      history.replaceState(null, '', location.pathname + location.search);
      const scambi = printDlg.querySelector('input[value="scambi"]');
      if (conAccount()) scambi.checked = true;
      $('btnPrint').click();
    }
    const arrivo = location.hash.match(/^#(info|pezzo)=(.+)$/);
    if (arrivo) {
      history.replaceState(null, '', location.pathname + location.search);
      let id = arrivo[2]; try { id = decodeURIComponent(id); } catch (e) {}
      const p = pens.find(x => x.id === id);
      if (p) {
        if (arrivo[1] === 'info') openEdit(p);
        else {
          const li = grid.querySelector('[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
          if (li) {
            li.scrollIntoView({ block: 'center', behavior: 'smooth' });
            li.animate([{ outline: '3px solid var(--amber)', outlineOffset: '2px' }, { outline: '3px solid var(--amber)', outlineOffset: '2px' }, { outline: '3px solid transparent', outlineOffset: '2px' }], { duration: 2200, easing: 'ease-out' });
          }
        }
      }
    }
  })();
})();
