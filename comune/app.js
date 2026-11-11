
const MAIL_SERIE = ({
  it: { ogg: 'Segnalazione', ciao: 'Ciao! Ti scrivo per la serie «§»', foto: 'Ho una foto che vi manca / ho trovato un problema (foto, nome, numero…):', problema: 'Cosa non va (foto, nome, numero…):' },
  en: { ogg: 'Report', ciao: 'Hi! I’m writing about the series “§”', foto: 'I have a photo you’re missing / I found a problem (photo, name, number…):', problema: 'What’s wrong (photo, name, number…):' },
  fr: { ogg: 'Signalement', ciao: 'Bonjour ! Je t’écris pour la série « § »', foto: 'J’ai une photo qui vous manque / j’ai trouvé un problème (photo, nom, numéro…) :', problema: 'Ce qui ne va pas (photo, nom, numéro…) :' },
  es: { ogg: 'Aviso', ciao: '¡Hola! Te escribo por la serie «§»', foto: 'Tengo una foto que os falta / he encontrado un problema (foto, nombre, número…):', problema: 'Qué está mal (foto, nombre, número…):' },
  de: { ogg: 'Meldung', ciao: 'Hallo! Ich schreibe dir wegen der Serie „§“', foto: 'Ich habe ein Foto, das euch fehlt / ich habe ein Problem gefunden (Foto, Name, Nummer…):', problema: 'Was nicht stimmt (Foto, Name, Nummer…):' }
});
const MAIL_SERIE_L = typeof LINGUA === 'string' && MAIL_SERIE[LINGUA] ? MAIL_SERIE[LINGUA] : MAIL_SERIE.it;
(() => {
  const $ = id => document.getElementById(id);
  const grid = $('grid'), dlg = $('dlg');
  const say = msg => avviso(msg);

  document.documentElement.style.setProperty('--proporzione', String(CONFIG.proporzione || 7));
  document.documentElement.style.setProperty('--colonne', String(CONFIG.colonne || 8));
  if (CONFIG.altezza) {
    document.documentElement.style.setProperty('--altezza', CONFIG.altezza + 'px');
    grid.classList.add('su-misura');
  } else if (CONFIG.proporzione === 1) grid.classList.add('quadrata');
  if ((CONFIG.proporzione || 7) >= 4) grid.classList.add('stretti');


  const SLOT_IMG = 'immagini/in-arrivo.webp';

  const escHtml = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const idVisti = new Set();
  const SEED = ELENCO.filter(r => !r.nascosto).map((r, i) => {
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
      estero: paeseEstero(paese) || !!r.variante,
      variante: !!r.variante,
      codice: r.codice || '',
      senzaCodice: !!r.senzaCodice,
      name: r.nome || '',
      colorName: r.colore || '',
      colorHex: r.hex || '',
      richNumero: r.richNumero || '', richNome: r.richNome || '',
      richInfo: r.richInfo ? r.richInfo + (infoPaese ? escHtml(infoPaese) : '') : '',
      limited: !!r.limitata,
      tags: Array.isArray(r.hashtag) ? r.hashtag.slice() : [],
      info: (r.info || '') + infoPaese + (r.variante && !/variante/i.test(r.info || '') ? ((r.info || infoPaese) ? '. ' : '') + 'Variante' : ''),
      image: r.foto || '',
      fotoInfo: Array.isArray(r.fotoInfo) ? r.fotoInfo.filter(Boolean) : []
    };
  });
  if (SEED.length && SEED.every(p => p.estero && !p.variante)) SEED.forEach(p => { p.estero = false; });

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
        const c = o[5] === 'Variante' ? null : /^\s*\d+\s*-\s*(.+)$/.exec(o[1] || '');
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

  const savePen = p => (typeof SPUNTE_PROVA !== 'undefined' && SPUNTE_PROVA) ? Promise.resolve() : db
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
      if (LISTE && LISTE.eSpunta(t)) return;
      if (LISTE && LISTE.eLista(t)) { parts.push(LISTE.nomeDi(t)); return; }
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
        : filterMode === 'missing' ? (!p.owned && p.image)
        : filterMode === 'doppi' ? p.doppi > 0
        : filterMode.startsWith('L:') ? inLista(p, filterMode.slice(2))
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
    let t = owned + ' su ' + total;
    if (doppi) t += ' · ' + doppi + (doppi === 1 ? ' doppione' : ' doppioni');
    if (typeof shown === 'number' && shown !== pens.length) t += ' · ' + shown + (shown === 1 ? ' visibile' : ' visibili');
    $('count').textContent = t;
    const sug = document.querySelector('.hint-sopra'); if (sug) sug.hidden = pens.some(p => p.owned);
    grid.querySelectorAll('.estere-titolo').forEach(aggiornaTitoloEstere);
    if (!barra) {
      barra = document.createElement('div');
      barra.className = 'avanz-barra';
      barra.setAttribute('role', 'progressbar');
      barra.setAttribute('aria-label', 'Quanto hai completato');
      barra.append(document.createElement('span'));
      const testa = document.createElement('div');
      testa.className = 'stato-testa';
      $('count').before(testa);
      percTesto = document.createElement('span');
      percTesto.className = 'avanz-perc';
      testa.append($('count'), percTesto);
      const riga = document.createElement('div');
      riga.className = 'avanz-riga';
      riga.append(barra);
      testa.after(riga);
    }
    const perc = total ? Math.round(owned / total * 100) : 0;
    barra.firstChild.style.width = perc + '%';
    barra.setAttribute('aria-valuenow', String(perc));
    barra.classList.toggle('completa', total > 0 && owned >= total);
    percTesto.textContent = total && owned >= total ? 'Completa!' : perc + '%';
    const quanti = { owned, missing: pens.filter(p => !p.owned && p.image && !p.estero).length, doppi: pens.filter(p => p.doppi > 0).length };
    [...$('filter').options].forEach(o => {
      if (!o.dataset.testo) o.dataset.testo = o.textContent;
      if (o.value in quanti) o.textContent = o.dataset.testo + ' (' + quanti[o.value] + ')';
    });
    filtroListe();
  }
  function filtroListe() {
    const sel = $('filter');
    if (!LISTE || !sel) return;
    const conti = new Map();
    pens.forEach(p => listeDi(p).forEach(n => { const k = LISTE.chiave(n); conti.set(k, [n, (conti.get(k) || [n, 0])[1] + 1]); }));
    const nomi = LISTE.nomi().filter(n => conti.has(LISTE.chiave(n)));
    conti.forEach(([n]) => { if (!ha(nomi, n)) nomi.push(n); });
    let gr = sel.querySelector('optgroup.gr-liste');
    const firma = nomi.map(n => n + '=' + conti.get(LISTE.chiave(n))[1]).join('|');
    if (!gr || gr.dataset.firma !== firma) {
      if (gr) gr.remove();
      if (nomi.length) {
        gr = document.createElement('optgroup');
        gr.className = 'gr-liste'; gr.label = 'Le mie liste'; gr.dataset.firma = firma;
        nomi.forEach(n => gr.append(new Option('Lista: ' + n + ' (' + conti.get(LISTE.chiave(n))[1] + ')', 'L:' + n)));
        sel.append(gr);
      }
    }
    if (filterMode.startsWith('L:') && !ha(nomi, filterMode.slice(2))) { filterMode = 'all'; setTimeout(render); }
    sel.value = filterMode;
    let nota = document.querySelector('.liste-nota');
    if (filterMode.startsWith('L:')) {
      const n = filterMode.slice(2), quanti = pens.filter(p => inLista(p, n)).length;
      if (!nota) { nota = document.createElement('p'); nota.className = 'liste-nota'; grid.before(nota); }
      nota.innerHTML = '';
      const b = document.createElement('b'); b.textContent = n;
      const a = document.createElement('a'); a.textContent = 'Vai alla lista';
      a.href = new URL('la-mia-collezione/index.html#/lista/' + encodeURIComponent(n), BASE).href;
      nota.append('Lista ', b, ': ' + quanti + (quanti === 1 ? ' oggetto' : ' oggetti') + ' · ', a);
    } else if (nota) nota.remove();
  }

  function rigaInfo() {
    const h1 = document.querySelector('header h1');
    if (!h1 || !SEED.length) return;
    const anni = new Set(SEED.map(s => s.codice));
    const anno = anni.size === 1 && /^(19|20)\d\d$/.test(SEED[0].codice) ? SEED[0].codice : '';
    if (!anno) return;
    const p = document.createElement('p');
    p.className = 'info-serie';
    p.textContent = anno;
    h1.after(p);
  }
  rigaInfo();

  const MINIMO_COLLEZIONISTI = 50;
  const RADICE = new URL('../', document.currentScript.src);
  function descrizione() {
    const fondo = document.querySelector('.wrap > footer');
    if (!fondo || !SEED.length) return;
    const sec = document.createElement('section');
    sec.className = 'descr-serie';
    const riga = document.createElement('div');
    riga.className = 'descr-scrivi';
    const frase = document.createElement('span');
    frase.className = 'descr-scrivi-frase';
    if (CONFIG.cercaAcceso) frase.innerHTML = '<span>Hai una foto che ci manca</span><br><span>o c\'è un problema?</span>';
    else frase.textContent = 'C\'è un problema?';
    const scrivi = document.createElement('a');
    scrivi.className = 'btn';
    scrivi.textContent = 'Scrivici';
    scrivi.href = 'mailto:' + 'collectiontime.support' + '@' + 'gmail.com'
      + '?subject=' + encodeURIComponent(MAIL_SERIE_L.ogg + ' · ' + CONFIG.titolo)
      + '&body=' + encodeURIComponent(MAIL_SERIE_L.ciao.replace('§', CONFIG.titolo) + ' (' + location.href + ').\n\n'
        + (CONFIG.cercaAcceso ? MAIL_SERIE_L.foto : MAIL_SERIE_L.problema) + '\n');
    riga.append(frase, scrivi);
    sec.append(riga);
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
    const suggerimento = [...fondo.querySelectorAll('p.hint')].find(h => /^\s*(Premi su|Tocca)/.test(h.textContent));
    if (suggerimento) {
      suggerimento.textContent = suggerimento.textContent.trim().split(/(?<=\.)\s/)[0];
      suggerimento.classList.add('hint-sopra');
      suggerimento.hidden = pens.some(p => p.owned);
      grid.before(suggerimento);
    }
    fondo.before(sec);
    fetch(new URL('comune/collezionisti.json', RADICE)).then(r => r.ok ? r.json() : null).then(d => {
      const n = d && d.serie && d.serie[CONFIG.dbName];
      if (!n || n < MINIMO_COLLEZIONISTI) return;
      const b = document.createElement('p');
      b.className = 'descr-conta';
      b.textContent = n + ' collezionisti la stanno completando: inizia anche tu!';
      const linea = document.createElement('hr');
      linea.className = 'descr-linea';
      sec.prepend(b, linea);
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
      if (!CONFIG.mostraNomi && p.name) img.title = p.name;
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
      let su = 0;
      img.onerror = () => { su++; if (su <= 2) img.src = '../'.repeat(su) + 'in-arrivo.webp'; else { img.onerror = null; img.src = new URL('comune/slot-vuoto-quadrato.webp', RADICE).href; } };
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

  function aggiornaTitoloEstere(li) {
    const v = !!li.dataset.variante, tutte = pens.filter(p => p.estero && !!p.variante === v && (p.image || p.owned));
    const ce = tutte.filter(p => p.owned).length, tot = tutte.length, perc = tot ? Math.round(ce * 100 / tot) : 0;
    li.querySelector('.estere-count').textContent = ce + ' su ' + tot;
    li.querySelector('.estere-barra span').style.width = perc + '%';
    li.querySelector('.estere-barra').classList.toggle('completa', tot > 0 && ce >= tot);
    li.querySelector('.avanz-perc').textContent = tot && ce >= tot ? 'Completa!' : perc + '%';
  }
  function titoloEstere(v) {
    const li = document.createElement('li');
    li.className = 'estere-titolo';
    li.dataset.variante = v ? '1' : '';
    li.innerHTML = '<b>' + (v ? 'Varianti' : 'ESTERO') + '</b>'
      + '<p class="sub estere-count"></p>'
      + '<div class="avanz-riga"><div class="avanz-barra estere-barra" role="progressbar" aria-label="Quanto hai completato di ESTERO"><span></span></div><span class="avanz-perc"></span></div>'
      + '<div class="riga-bottoni"><button class="btn" type="button" data-e="stampa">Stampa</button><button class="btn" type="button" data-e="condividi">Condividi</button></div>';
    li.querySelector('[data-e=stampa]').addEventListener('click', () => { viaEstere = true; $('btnPrint').click(); });
    li.querySelector('[data-e=condividi]').addEventListener('click', () => $('btnShare').click());
    aggiornaTitoloEstere(li);
    return li;
  }

  function render() {
    const list = visiblePens();
    const nodi = list.filter(p => !p.estero).map(card);
    const varianti = list.filter(p => p.estero && p.variante), estere = list.filter(p => p.estero && !p.variante);
    if (varianti.length) nodi.push(titoloEstere(true), ...varianti.map(card));
    if (estere.length) nodi.push(titoloEstere(false), ...estere.map(card));
    grid.replaceChildren(...nodi);
    $('noResults').hidden = list.length > 0 || pens.length === 0;
    $('emptyAll').hidden = pens.length > 0;
    updateCount(list.length);
    centraRighe();
  }

  function centraRighe() {
    const cs = getComputedStyle(grid), cols = cs.gridTemplateColumns.split(' ').filter(Boolean), n = cols.length;
    const passo = (parseFloat(cols[0]) || 0) + (parseFloat(cs.columnGap) || 0);
    const uguali = CONFIG.righeUguali !== false;
    let gruppo = [];
    const chiudi = () => {
      const N = gruppo.length;
      if (N && n > 1 && passo) {
        const righe = Math.ceil(N / n), base = Math.floor(N / righe), piu = N % righe;
        let k = 0;
        for (let r = 0; r < righe; r++) {
          const quanti = uguali ? base + (r < piu ? 1 : 0) : (r < righe - 1 ? n : N - n * (righe - 1));
          const sposta = (n - quanti) / 2 * passo + 'px';
          gruppo.slice(k, k + quanti).forEach((el, q) => { el.style.translate = quanti < n ? sposta : ''; if (q === 0 && r > 0) el.style.gridColumnStart = '1'; });
          k += quanti;
        }
      }
      gruppo = [];
    };
    [...grid.children].forEach(el => {
      el.style.translate = ''; el.style.gridColumnStart = '';
      if (el.classList.contains('pen')) gruppo.push(el); else chiudi();
    });
    chiudi();
  }
  if ('ResizeObserver' in window) { let largo = 0; new ResizeObserver(() => { const w = grid.clientWidth; if (w !== largo) { largo = w; centraRighe(); } }).observe(grid); }

  const LISTE = typeof ctListe !== 'undefined' ? ctListe : null;
  let editListe = [];
  const campoListe = (() => {
    const vecchio = $('tagChips') ? $('tagChips').closest('.field') : null;
    if (!LISTE || !vecchio) return null;
    vecchio.className = 'field liste-campo';
    vecchio.innerHTML = '<span id="lblListe">Le mie liste</span><div class="liste-pill" id="listePill" role="group" aria-labelledby="lblListe"></div><p class="liste-err" id="listeErr" role="alert" hidden></p>';
    return vecchio;
  })();
  const ha = (elenco, n) => elenco.some(x => LISTE.uguale(x, n));
  ['ct-accesso', 'ct-header'].forEach(ev => window.addEventListener(ev, () => { if (campoListe) disegnaListe(); }));
  function disegnaListe() {
    if (!campoListe) return;
    const box = $('listePill'), err = $('listeErr');
    if (!LISTE.puoi()) {
      err.hidden = true;
      box.innerHTML = '<p class="liste-blocco">Le liste sono per chi è iscritto. <button type="button" class="st-link" data-accedi-liste>Accedi</button></p>';
      box.querySelector('[data-accedi-liste]').addEventListener('click', () => LISTE.chiediAccesso());
      return;
    }
    const tutti = LISTE.nomi();
    editListe.forEach(n => { if (!ha(tutti, n)) tutti.push(n); });
    box.replaceChildren(...tutti.map(n => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lp'; b.textContent = n;
      const dentro = ha(editListe, n);
      b.setAttribute('aria-pressed', String(dentro));
      b.addEventListener('click', () => {
        editListe = ha(editListe, n) ? editListe.filter(x => !LISTE.uguale(x, n)) : [...editListe, n];
        err.hidden = true;
        disegnaListe();
      });
      return b;
    }));
    const nuova = document.createElement('button');
    nuova.type = 'button'; nuova.className = 'lp lp-nuova'; nuova.textContent = '+ Nuova lista';
    nuova.addEventListener('click', () => {
      const campo = document.createElement('input');
      campo.type = 'text'; campo.className = 'lp-campo'; campo.maxLength = LISTE.MAX_NOME;
      campo.placeholder = 'Nome della lista'; campo.setAttribute('aria-label', 'Nome della nuova lista'); campo.autocomplete = 'off';
      const conferma = () => {
        const testo = campo.value.trim();
        if (!testo) { disegnaListe(); return; }
        const v = LISTE.crea(testo);
        if (v.errore) { err.textContent = v.errore; err.hidden = false; campo.focus(); return; }
        err.hidden = true;
        editListe = [...editListe, v.nome];
        disegnaListe();
      };
      campo.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); conferma(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); err.hidden = true; disegnaListe(); }
      });
      campo.addEventListener('blur', () => { if (campo.isConnected && !campo.value.trim()) disegnaListe(); });
      nuova.replaceWith(campo);
      campo.focus();
    });
    box.append(nuova);
  }
  const listeDi = p => LISTE ? LISTE.diPezzo(p.tags) : [];
  const inLista = (p, n) => listeDi(p).some(x => LISTE.uguale(x, n));


  function barraTraduzione(p) {
    const box = $('fInfoBox'), info = $('fInfo');
    if (!box || !info || document.documentElement.lang === 'it' || typeof window.traduciTesto !== 'function' || !p.info) return;
    const t = window.traduciTesto(p.info);
    if (t === null || t === p.info) return;
    const bar = document.createElement('div'), msg = document.createElement('span'), btn = document.createElement('button');
    bar.className = 'tr-b'; btn.type = 'button';
    bar.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>';
    bar.append(msg, ' · ', btn);
    let originale = false;
    const scrivi = () => {
      if (originale) info.setAttribute('translate', 'no'); else info.removeAttribute('translate');
      if (p.richInfo) info.innerHTML = p.richInfo; else info.textContent = p.info;
      msg.textContent = originale ? 'Testo originale (italiano)' : 'Tradotto automaticamente';
      btn.textContent = originale ? 'Traduci' : "Vedi l'originale";
    };
    btn.addEventListener('click', () => { originale = !originale; scrivi(); });
    info.after(bar);
    msg.textContent = 'Tradotto automaticamente'; btn.textContent = "Vedi l'originale";
  }

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
    $('fInfo').removeAttribute('translate'); $('fInfoBox').querySelector('.tr-b')?.remove();
    if (p.richInfo) $('fInfo').innerHTML = p.richInfo; else $('fInfo').textContent = p.info;
    $('fInfoBox').hidden = !p.info;
    mostraFotoInfo(p);
    barraTraduzione(p);
    editListe = listeDi(p);
    if (campoListe) $('listeErr').hidden = true;
    disegnaListe();
    $('fOwned').checked = p.owned;
    dlg.showModal();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  $('editForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!editing) return;
    if (campoListe) {
      const campo = campoListe.querySelector('.lp-campo');
      if (campo && campo.value.trim()) {
        const v = LISTE.crea(campo.value);
        if (v.errore) { $('listeErr').textContent = v.errore; $('listeErr').hidden = false; return; }
        editListe = [...editListe, v.nome];
      }
      const prima = listeDi(editing);
      const aggiunte = editListe.filter(n => !ha(prima, n)), tolte = prima.filter(n => !ha(editListe, n));
      if (aggiunte.length && !(await LISTE.c_e_posto(aggiunte))) return;
      if (aggiunte.length || tolte.length) {
        editing.tags = [...editing.tags.filter(t => !LISTE.eDiLista(t)), ...editListe.map(n => LISTE.tag(LISTE.nomeGiusto(n))),
          ...editing.tags.filter(t => LISTE.eSpunta(t) && ha(editListe, t.slice(LISTE.OK.length)))];
        editing.tagsTouched = true;
        [...aggiunte, ...tolte].forEach(n => LISTE.ricorda(n, true));
      }
    }
    editing.owned = $('fOwned').checked;
    await savePen(editing);
    dlg.close();
  });
  $('btnClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => { editing = null; render(); });

  const printDlg = $('printDlg');
  const kindName = { owned: 'collezione', scambi: 'cerco-scambio', mancanti: 'mi-mancano', doppioni: 'doppioni', all: 'checklist' };
  let viaEstere = false, soloEstere = false;
  let conEstere = false;
  function printList(soloMancanti) {
    const all = [...pens].sort(byPos);
    if (soloEstere) { const e = all.filter(p => p.estero); return soloMancanti ? e.filter(p => !p.owned && p.image) : e; }
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
  const tl = t => { const r = (document.documentElement.lang !== 'it' && typeof window.traduciTesto === 'function') ? window.traduciTesto(t) : null; return r == null ? t : r; };
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
        tesseraCanvas(ctx, 'rgba(242, 169, 0, .14)', 'rgba(26, 33, 64, .09)');
        ctx.restore();
        ctx.fillStyle = 'rgba(26, 33, 64, .055)';
        ctx.fillText(testo, x + SFONDO_TESSERA + 4, y);
      }
    }
    return c;
  }

  let IMG_K = 2;
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
  let qrPronto = null;
  function caricaQR() {
    if (window.qrcode) return Promise.resolve();
    if (!qrPronto) qrPronto = new Promise(ok => {
      const app = document.querySelector('script[src*="comune/app.js"]'), sc = document.createElement('script');
      sc.src = app ? app.src.replace(/app\.js(\?.*)?$/, 'qrcode.js$1') : '/comune/qrcode.js';
      sc.onload = sc.onerror = () => ok();
      document.head.appendChild(sc);
    });
    return qrPronto;
  }
  async function makeImmagine(sezioni, kind) {
    say("Sto creando l'immagine…");
    await caricaQR();
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
    let COLS = orizzontale ? CONFIG.pdfColonne : PDF_COLONNE;
    const ROWS = CONFIG.pdfFile || 2;
    const BAND = 30;
    let TITOLO_H = 26;
    const TITOLO_MAXW = W - 2 * MX - 40;
    if (logo && TITOLO_H * logo.width / logo.height > TITOLO_MAXW) TITOLO_H = TITOLO_MAXW * logo.height / logo.width;
    const LOGO_W = logo ? TITOLO_H * logo.width / logo.height : 0;
    const CART_PX = 22, CART_PY = 7, CART_H = TITOLO_H + 2 * CART_PY;
    const FOOT_H = 58, INFO_H = 30;
    const SOPRA = BAND + 12, gridBottom = FOOT_H + 28;
    const TITOLO_GAP = 8 + INFO_H + 10;
    const spazio = H - SOPRA - CART_H - 12 - 30;
    const ROW_GAP = 12;
    const GAP = 3, CODE_H = 13, BOX = 8;
    const NOME_SIZE = 7.5, NOME_RIGA = 9;
    const nomi = !!CONFIG.mostraNomi;
    const NOME_H = nomi ? 2 * NOME_RIGA + GAP : 0;
    const TESTO_H = GAP + NOME_H + CODE_H + GAP + BOX;
    const TESTA_H = 24;

    const list = sezioni.flatMap(s => s.items);
    const fotoLette = await Promise.all(list.map(p => p.image ? ritaglio(p.image).catch(() => null) : ritaglio(SLOT_IMG).catch(() => null)));
    const foto = new Map(list.map((p, i) => [p, fotoLette[i]]));
    const altiUguali = (CONFIG.proporzione || 7) > 1;
    const maxW = Math.max(1, ...fotoLette.map(f => f ? f.w : 0)), maxH = Math.max(1, ...fotoLette.map(f => f ? f.h : 0));
    const misura = f => {
      const k = altiUguali ? Math.min(fotoW / f.w, orizzontale ? fotoMaxH / f.img.naturalHeight : fotoMaxH / f.h) : scala;
      return [f.w * k, f.h * k];
    };

    let colPitch, CARD_GAP, cardW, PAD, fotoW, fotoMaxH, scala, fotoH, cardH, file;
    const alto = ff => ff.reduce((t, f) => t + (f.testa ? TESTA_H : cardH), 0) + Math.max(0, ff.length - 1) * ROW_GAP;
    function impagina(cols, altezzaFoto) {
      COLS = cols;
      colPitch = (W - 2 * MX) / COLS;
      CARD_GAP = Math.min(6, colPitch * 0.06);
      cardW = colPitch - CARD_GAP;
      PAD = Math.min(5, cardW * 0.06);
      fotoW = cardW - 2 * PAD;
      fotoMaxH = altezzaFoto || (orizzontale ? (spazio - (ROWS - 1) * ROW_GAP) / ROWS - 2 * PAD - TESTO_H
                                             : fotoW);
      scala = Math.min(fotoW / maxW, fotoMaxH / maxH);
      fotoH = altiUguali ? fotoMaxH : maxH * scala;
      cardH = fotoH + 2 * PAD + TESTO_H;
      file = [];
      sezioni.forEach(s => {
        if (s.titolo) file.push({ testa: s });
        for (let i = 0; i < s.items.length; i += COLS) file.push({ items: s.items.slice(i, i + COLS), sezione: s });
      });
      return SOPRA + CART_H + TITOLO_GAP + alto(file) + gridBottom;
    }

    const LARGHEZZA_PX = 1620, ALTEZZA_MAX_PX = 10000;
    IMG_K = LARGHEZZA_PX / W;
    const H_MIN = W * 5 / 4, H_MAX = ALTEZZA_MAX_PX / IMG_K;
    let altezza = impagina(COLS);
    if (altezza < H_MIN) {
      if (orizzontale) {
        const piuLunga = Math.max(...sezioni.map(s => s.items.length));
        if (piuLunga < COLS) altezza = impagina(Math.max(4, piuLunga));
        const righe = file.filter(f => f.items).length, teste = file.length - righe;
        const libero = H_MIN - SOPRA - CART_H - TITOLO_GAP - gridBottom - teste * TESTA_H - (file.length - 1) * ROW_GAP;
        const tetto = Math.min(...fotoLette.filter(Boolean).map(f => fotoW * f.h / f.w));
        const hFoto = Math.min(libero / righe - 2 * PAD - TESTO_H, tetto);
        if (hFoto > fotoMaxH) altezza = impagina(COLS, hFoto);
      } else {
        for (let c = COLS - 1; c >= 2; c--) {
          const a = impagina(c);
          if (a > H_MIN) { altezza = impagina(c + 1); break; }
          altezza = a;
        }
      }
    }
    let pagine = [file];
    if (altezza > H_MAX) {
      const base = SOPRA + CART_H + TITOLO_GAP + gridBottom;
      pagine = [];
      let pag = [];
      file.forEach((f, i) => {
        const conLaFila = f.testa && file[i + 1] ? [f, file[i + 1]] : [f];
        if (pag.length && base + alto(pag.concat(conLaFila)) > H_MAX) { pagine.push(pag); pag = []; }
        pag.push(f);
      });
      if (pag.length) pagine.push(pag);
      altezza = base + Math.max(...pagine.map(alto));
    }
    H = Math.max(altezza, H_MIN);

    const areaTop = H - SOPRA, gridTop = areaTop - CART_H - TITOLO_GAP;
    const bloccoH = Math.max(...pagine.map(alto));
    const avanzo = Math.max(0, (gridTop - gridBottom - bloccoH) / 2);
    const cartTop = areaTop, primaFila = gridTop - avanzo;

    const R = Math.min(6, cardW * 0.12);
    const scheda = (w, h) => `M${R} 0H${w - R}Q${w} 0 ${w} ${R}V${h - R}Q${w} ${h} ${w - R} ${h}H${R}Q0 ${h} 0 ${h - R}V${R}Q0 0 ${R} 0Z`;
    const schedaPath = scheda(cardW, cardH);

    function marchio(pg, x, y, size, spunta) {
      const scale = size / 32;
      pg.drawSvgPath(TESSERA, { x, y, scale, color: ambra });
      const P = SPUNTA.map(([px, py]) => ({ x: x + px * scale, y: y - py * scale }));
      for (let k = 0; k < 2; k++) pg.drawLine({ start: P[k], end: P[k + 1], thickness: SPESSORI[k] * scale, color: spunta, lineCap: true });
    }

    const cosa = tl({ owned: 'La mia collezione', scambi: 'Cerco e scambio', mancanti: 'Mancanti', doppioni: 'Doppioni', all: 'Checklist da compilare' }[kind]);

    function testata(pg, s, top) {
      const T = pdfText(s.titolo), D = pdfText(s.sotto || ''), SZ = 12, sz = 9;
      const tw = bold.widthOfTextAtSize(T, SZ), dw = D ? font.widthOfTextAtSize(D, sz) + 10 : 0;
      const w = tw + dw + 24, h = TESTA_H;
      pg.drawSvgPath(scheda(w, h), { x: MX, y: top, color: bianco, borderColor: ambra, borderWidth: 1.2 });
      pg.drawText(T, { x: MX + 12, y: top - h / 2 - SZ * 0.35, size: SZ, font: bold, color: ink });
      if (D) pg.drawText(D, { x: MX + 12 + tw + 10, y: top - h / 2 - sz * 0.35, size: sz, font, color: grigio });
      pg.drawRectangle({ x: MX + w + 8, y: top - h / 2 - 0.75, width: W - 2 * MX - w - 8, height: 1.5, color: ambra });
    }

    const FILIGRANA_OPACITA = 0.08;
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

    const SITO_SIZE = 10, sc = document.createElement('canvas'), sctx = sc.getContext('2d'), SK = 4;
    const sitoW = bold.widthOfTextAtSize('collectiontime.com', SITO_SIZE);
    sc.width = Math.ceil(sitoW * SK); sc.height = Math.ceil(SITO_SIZE * 1.25 * SK);
    sctx.scale(SK, SK);
    sctx.font = '700 ' + SITO_SIZE + 'px Helvetica, Arial, sans-serif';
    sctx.fillStyle = '#1A2140';
    sctx.textBaseline = 'alphabetic';
    sctx.fillText('collectiontime.com', 0, SITO_SIZE);
    const sito = sc;

    const blobs = [];
    const tutti = printList(false), haiN = tutti.filter(p => p.owned).length;
    const personale = kind !== 'all';
    const oggiTxt = new Date().toLocaleDateString(document.documentElement.lang || 'it', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const conLE = list.some(p => p.limited);
    function pillola(pg, x, yTop, testo, size) {
      const w = bold.widthOfTextAtSize(testo, size) + size * 1.1, h = size * 1.6, r = h / 2;
      pg.drawSvgPath(`M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 ${r} 0Z`, { x, y: yTop, color: ambra });
      pg.drawText(testo, { x: x + size * 0.55, y: yTop - h / 2 - size * 0.36, size, font: bold, color: bianco });
      return w;
    }
    function rigaInfo(pg, top) {
      const cy = top - INFO_H / 2;
      let fineSx = MX;
      if (personale) {
        const R0 = 12.5, ccx = MX + R0 + 2, ctx2 = pg.tela.getContext('2d'), fr = tutti.length ? haiN / tutti.length : 0;
        ctx2.save(); ctx2.lineWidth = 3.4; ctx2.lineCap = 'round';
        ctx2.strokeStyle = '#E3E5EC'; ctx2.beginPath(); ctx2.arc(ccx, H - cy, R0, 0, 2 * Math.PI); ctx2.stroke();
        if (fr > 0) { ctx2.strokeStyle = 'rgb(242,169,0)'; ctx2.beginPath(); ctx2.arc(ccx, H - cy, R0, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * fr); ctx2.stroke(); }
        ctx2.restore();
        const pc = Math.round(fr * 100) + '%', pw = bold.widthOfTextAtSize(pc, 7.5);
        pg.drawText(pc, { x: ccx - pw / 2, y: cy - 2.6, size: 7.5, font: bold, color: ink });
        const tx = ccx + R0 + 9;
        const prog = pdfText(tl('Ne hai ' + haiN + ' su ' + tutti.length));
        const r1 = prog, r2 = oggiTxt;
        pg.drawText(r1, { x: tx, y: cy + 2, size: 11, font: bold, color: ink });
        pg.drawText(r2, { x: tx, y: cy - 10, size: 8.5, font, color: grigio });
        fineSx = tx + Math.max(bold.widthOfTextAtSize(r1, 11), font.widthOfTextAtSize(r2, 8.5));
      }
      if (kind !== 'owned') return;
      const voci = [['ok', tl("ce l'ho")], ['no', tl('mi manca')], ['+1', tl('doppione')]];
      const S = 8, gap = 12, sw = 9.5;
      const larg = voci.reduce((t, [k, v]) => t + (k === '+1' ? bold.widthOfTextAtSize('+1', 7) + 7.7 : sw) + 4 + font.widthOfTextAtSize(v, S), 0) + gap * (voci.length - 1);
      let x = W - MX - 2 - larg;
      if (x < fineSx + 16) return;
      voci.forEach(([k, v]) => {
        if (k === 'ok') { pg.drawRectangle({ x, y: cy - sw / 2, width: sw, height: sw, color: rgb(1, 0.949, 0.8), borderColor: ambra, borderWidth: 1 }); x += sw; }
        else if (k === 'no') { pg.drawRectangle({ x, y: cy - sw / 2, width: sw, height: sw, color: bianco, borderColor: gray, borderWidth: 0.8 }); x += sw; }
        else x += pillola(pg, x, cy + 5.6, '+1', 7);
        x += 4;
        pg.drawText(v, { x, y: cy - S * 0.36, size: S, font, color: grigio });
        x += font.widthOfTextAtSize(v, S) + gap;
      });
    }

    const indirizzo = 'https://collectiontime.com' + location.pathname.replace(/index\.html$/, '');
    let qrTela = null;
    if (window.qrcode) {
      const q = window.qrcode(0, 'M'); q.addData(indirizzo); q.make();
      const n = q.getModuleCount(), M = 8;
      qrTela = document.createElement('canvas'); qrTela.width = qrTela.height = (n + 2) * M;
      const qx = qrTela.getContext('2d'); qx.fillStyle = '#fff'; qx.fillRect(0, 0, qrTela.width, qrTela.height); qx.fillStyle = '#1A2140';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) qx.fillRect((c + 1) * M, (r + 1) * M, M, M);
    }
    function riquadro(pg) {
      const y0 = 16 + FOOT_H, w = W - 2 * MX;
      pg.drawSvgPath(scheda(w, FOOT_H), { x: MX, y: y0, color: bianco, borderColor: ambra, borderWidth: 1.2 });
      marchio(pg, MX + 12, y0 - 12, 18, ink);
      pg.drawText('Collection Time', { x: MX + 36, y: y0 - 25.5, size: 12, font: bold, color: ink });
      pg.drawText(pdfText(tl('Crea anche tu la tua checklist, gratis')), { x: MX + 12, y: y0 - 40, size: 8.5, font, color: grigio });
      pg.drawImage(sito, { x: MX + 12, y: y0 - 52.5, width: sc.width / SK, height: sc.height / SK });
      if (qrTela) {
        const QS = FOOT_H - 10;
        pg.drawImage(qrTela, { x: MX + w - QS - 6, y: y0 - 5 - QS, width: QS, height: QS });
        const t1 = tl('Inquadra per aprire'), t2 = tl('questa serie'), tx = MX + w - QS - 14;
        pg.drawText(pdfText(t1), { x: tx - font.widthOfTextAtSize(t1, 8), y: y0 - FOOT_H / 2 + 2, size: 8, font, color: grigio });
        pg.drawText(pdfText(t2), { x: tx - bold.widthOfTextAtSize(t2, 8), y: y0 - FOOT_H / 2 - 8, size: 8, font: bold, color: ink });
      }
    }

    const sfondo = sfondoTela(W, H);
    const pages = [];
    let ghost = null;
    for (const [nPagina, filePagina] of pagine.entries()) {
      const page = paginaTela(W, H, bold);
      pages.push(page);

      page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: carta });
      page.drawImage(sfondo, { x: 0, y: 0, width: W, height: H });

      page.drawRectangle({ x: 0, y: H - BAND, width: W, height: BAND, color: ink });
      page.drawRectangle({ x: 0, y: H - BAND - 2.5, width: W, height: 2.5, color: ambra });
      marchio(page, MX, H - 5.5, 19, ink);
      page.drawText('Collection Time', { x: MX + 25, y: H - 20.5, size: 15, font: bold, color: bianco });
      const cosaPag = cosa + (pagine.length > 1 ? '  ' + (nPagina + 1) + '/' + pagine.length : '');
      const cw = font.widthOfTextAtSize(cosaPag, 12.5);
      page.drawText(cosaPag, { x: W - MX - cw, y: H - 19.5, size: 12.5, font, color: bianco });

      const usaLogo = logo && !soloEstere;
      const title = pdfText(tl(CONFIG.titolo) + (soloEstere ? ' (' + tl('ESTERO') + ')' : ''));
      let tsz = TITOLO_H * 1.35;
      while (!usaLogo && tsz > 10 && bold.widthOfTextAtSize(title, tsz) > W - 2 * MX - 2 * CART_PX) tsz -= 1;
      const tw = usaLogo ? LOGO_W : bold.widthOfTextAtSize(title, tsz);
      const cartW = tw + 2 * CART_PX;
      page.drawSvgPath(scheda(cartW, CART_H), { x: (W - cartW) / 2, y: cartTop, color: bianco, borderColor: gray, borderWidth: 0.6 });
      page.drawRectangle({ x: (W - cartW) / 2 + R, y: cartTop - CART_H, width: cartW - 2 * R, height: 2.5, color: ambra });
      if (usaLogo) page.drawImage(logo, { x: (W - LOGO_W) / 2, y: cartTop - CART_PY - TITOLO_H, width: LOGO_W, height: TITOLO_H });
      else page.drawText(title, { x: (W - tw) / 2, y: cartTop - CART_PY - TITOLO_H, size: tsz, font: bold, color: ink });
      rigaInfo(page, cartTop - CART_H - 8 - avanzo);

      let top = primaFila;
      for (const fila of filePagina) {
        if (fila.testa) { testata(page, fila.testa, top); top -= TESTA_H + ROW_GAP; continue; }
        const inFila = fila.items.length;
        for (let c = 0; c < inFila; c++) {
          const p = fila.items[c];
          const spost = (!orizzontale || fila.sezione.items.length < COLS) ? (COLS - inFila) * colPitch / 2 : 0;
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
            const righe = righeNome(pdfText(tl(p.name || '')), bold, NOME_SIZE, cardW - 2 * PAD);
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

          if (kind === 'owned' && p.doppi > 0) {
            const t = '+' + p.doppi, sz = 7.5, pw = bold.widthOfTextAtSize(t, sz) + sz * 1.1;
            pillola(page, cx + cardW / 2 - pw + 3, top + sz * 0.8, t, sz);
          }
          if (kind !== 'all') continue;
          const qy = boxY - GAP - BOX;
          page.drawRectangle({ x: cx - BOX / 2, y: qy, width: BOX, height: BOX, color: bianco, borderColor: grigio, borderWidth: 0.8 });
          if (spuntata) {
            page.drawLine({ start: { x: cx - 2.6, y: qy + 3.9 }, end: { x: cx - 0.7, y: qy + 1.7 }, thickness: 1.3, color: ambra });
            page.drawLine({ start: { x: cx - 0.7, y: qy + 1.7 }, end: { x: cx + 3, y: qy + 6.4 }, thickness: 1.3, color: ambra });
          }
        }
        top -= cardH + ROW_GAP;
      }

      const WM = Math.min(250, H * 0.6);
      page.drawImage(filigrana, { x: (W - WM) / 2, y: primaFila - (bloccoH + WM) / 2, width: WM, height: WM, opacity: FILIGRANA_OPACITA });

      riquadro(page);
      blobs.push(await fileDi(page.tela, 'image/jpeg'));
      page.tela.width = page.tela.height = 0;
    }


    const oggi = new Date(), dd = n => String(n).padStart(2, '0');
    const radice = 'collection-time_' + CONFIG.id + '_' + kindName[kind] + (soloEstere ? '-estero' : '') + '_' + oggi.getFullYear() + '-' + dd(oggi.getMonth() + 1) + '-' + dd(oggi.getDate());
    const nomiFile = blobs.map((b, i) => radice + (blobs.length > 1 ? '_' + (i + 1) + '-di-' + blobs.length : '') + '.jpg');
    const scarica = () => {
      blobs.forEach((blob, i) => setTimeout(() => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nomiFile[i];
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }, i * 400));
      say(blobs.length > 1 ? 'Immagini salvate nella cartella Download.' : 'Immagine salvata nella cartella Download.');
    };
    const jpg = typeof File === 'function' ? blobs.map((b, i) => new File([b], nomiFile[i], { type: 'image/jpeg' })) : null;
    if (jpg && navigator.canShare && navigator.canShare({ files: jpg }) && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ files: jpg }).catch(err => { if (!err || err.name !== 'AbortError') scarica(); });
    }
    else scarica();
  }

  const LIBERE = ['all'];
  const conAccount = () => haAccesso();
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
      nota.innerHTML = 'Per creare l\'immagine della tua collezione, dei "Mancanti" e dei "Doppioni" serve un account gratuito. ' +
        '<button type="button" data-accedi>Accedi</button>';
      printDlg.querySelector('.actions').before(nota);
      nota.querySelector('button').addEventListener('click', () => printDlg.close());
    }
    nota.hidden = si;
  }

  const parteMancanti = (titolo, soloNumero) => { const l = printList(true); return soloNumero ? { titolo: titolo + ' · ' + l.length, items: l } : { titolo, sotto: tl('Mancanti') + ' · ' + l.length, items: l }; };
  const parteDoppioni = (titolo, soloNumero) => {
    const l = printList(false).filter(p => p.doppi > 0), n = l.reduce((t, p) => t + p.doppi, 0);
    return soloNumero ? { titolo: titolo + ' · ' + n, items: l, scambio: true } : { titolo, sotto: tl('Doppioni') + ' · ' + n, items: l, scambio: true };
  };
  const sezioniDi = {
    scambi:   () => [parteMancanti(tl('CERCO')), parteDoppioni(tl('SCAMBIO'))],
    mancanti: () => [parteMancanti(tl('MANCANTI'), true)],
    doppioni: () => [parteDoppioni(tl('DOPPIONI'), true)],
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
    coppia.append(voce('mancanti', 'Mancanti', 'cnt-mancanti'), voce('doppioni', 'Doppioni', 'cnt-doppioni'));
    fine.after(coppia);
  })();

  const estereVoce = (function () {
    const l = document.createElement('label');
    l.className = 'print-estere';
    l.innerHTML = '<input type="checkbox" id="printEstere"><span>' + (SEED.some(p => p.estero && !p.variante) ? 'Stampa anche ESTERO' : 'Stampa anche le varianti') + '</span>';
    printDlg.querySelector('.actions').before(l);
    return l;
  })();
  const estereCasella = estereVoce.querySelector('input');
  function conteggiStampa() {
    const base = soloEstere ? pens.filter(p => p.estero) : conEstere ? pens : pens.filter(p => !p.estero);
    const total = base.filter(p => p.image || p.owned).length;
    $('cnt-owned').textContent = base.filter(p => p.owned).length + ' su ' + total;
    const nMancanti = printList(true).length, nDoppioni = printList(false).filter(p => p.doppi > 0).length;
    $('cnt-scambi').textContent = nMancanti + ' cerco · ' + nDoppioni + ' scambio';
    $('cnt-mancanti').textContent = nMancanti;
    $('cnt-doppioni').textContent = nDoppioni;
  }
  estereCasella.addEventListener('change', () => { conEstere = estereCasella.checked; conteggiStampa(); });
  $('btnPrint').addEventListener('click', () => {
    soloEstere = viaEstere; viaEstere = false;
    conEstere = false; estereCasella.checked = false;
    estereVoce.hidden = soloEstere || !(pens.some(p => p.estero) && pens.some(p => !p.estero));
    conteggiStampa();
    bloccaStampa();
    printDlg.showModal();
  });
  $('printCancel').addEventListener('click', () => printDlg.close());

  (function azioniSerie() {
    const h1 = document.querySelector('.wrap header h1');
    if (!h1 || !$('btnPrint') || !$('btnShare')) return;
    const svg = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    const box = document.createElement('div');
    box.className = 'azioni-serie';
    for (const [id, nome, disegno] of [
      ['btnPrint', 'Stampa', '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/>'],
      ['btnShare', 'Condividi', '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'],
    ]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.innerHTML = svg(disegno) + '<span>' + nome + '</span>';
      b.addEventListener('click', () => $(id).click());
      box.append(b);
    }
    const info = h1.nextElementSibling && h1.nextElementSibling.classList.contains('info-serie') ? h1.nextElementSibling : h1;
    info.after(box);
    const CORTI = { 'Dalla prima': 'Dalla 1ª', 'Dal primo': 'Dal 1°' };
    const opz = $('sort') && $('sort').querySelector('option[value=asc]');
    const stretto = matchMedia('(max-width: 360px)');
    function testoOrdine() {
      if (!opz) return;
      if (!opz.dataset.lungo) opz.dataset.lungo = opz.textContent;
      const corto = CORTI[opz.dataset.lungo];
      if (corto) opz.textContent = stretto.matches ? corto : opz.dataset.lungo;
    }
    testoOrdine();
    stretto.addEventListener('change', testoOrdine);
  })();

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
      let convertite = false;
      salvate = rinumera(salvate);
      const perId = new Map(salvate.map(v => [v.id, v]));
      const tagAdmin = LISTE ? new Set(SEED.flatMap(x => x.tags || []).map(x => LISTE.chiave(x))) : new Set();
      pens = SEED.map(s => {
        const p = nuovo(s), v = perId.get(s.id);
        if (v) {
          p.owned = v.owned === true;
          p.doppi = Number.isInteger(v.doppi) && v.doppi > 0 ? v.doppi : 0;
          if (p.doppi) p.owned = true;
          if (v.tagsTouched && Array.isArray(v.tags)) {
            p.tagsTouched = true;
            if (!LISTE) p.tags = v.tags.map(String);
            else {
              const salvate = v.tags.map(String), liste = [], spunte = salvate.filter(LISTE.eSpunta);
              salvate.forEach(t => {
                let n = '';
                if (LISTE.eSpunta(t)) return;
                if (LISTE.eLista(t)) n = LISTE.pulisci(LISTE.nomeDi(t));
                else if (!s.tags.some(x => LISTE.uguale(x, t)) && !tagAdmin.has(LISTE.chiave(t))) { n = LISTE.pulisci(t).slice(0, LISTE.MAX_NOME); if (n) { convertite = true; LISTE.ricorda(n, false); } }
                if (n) n = LISTE.nomeGiusto(n);
                if (n && !ha(liste, n)) liste.push(n);
              });
              p.tags = [...s.tags, ...liste.map(n => LISTE.tag(n)), ...spunte.filter(t => ha(liste, t.slice(LISTE.OK.length)))];
            }
          }
        }
        return p;
      });
      const t = db.transaction(STORE, 'readwrite'), st = t.objectStore(STORE);
      st.clear();
      pens.filter(p => p.owned || p.doppi || p.tagsTouched).forEach(p => st.put(datiVisitatore(p)));
      await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
      if (typeof SPUNTE_PROVA !== 'undefined' && SPUNTE_PROVA) pens.forEach(p => { p.owned = true; });
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
      if (convertite) segnalaModifica();
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

