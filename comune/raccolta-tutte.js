
(() => {
  const app = document.getElementById('raccolta');
  app.classList.add('stile-b');
  const SITO = new URL('../', document.currentScript.src);
  const CAT = new URL('catalogo/', SITO);
  const parametri = new URLSearchParams(location.search);

  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const semplice = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const plurale = (n, uno, tanti) => n + ' ' + (n === 1 ? uno : tanti);
  const LENTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

  let ORDINE = [];
  const NOME = {};
  const SERIE = [];
  const caricate = new Set(), inCorso = {}, fallite = new Set();
  const ce = {}, doppi = {}, serieDi = {}, gemelli = {};
  let versioni = {}, iniziate = [];

  async function elencoCategorie() {
    versioni = await versioneDati();
    let ordine = Object.keys(versioni);
    try {
      const h = await (await fetch(new URL('index.html', SITO), { cache: 'no-cache' })).text();
      const visti = [...h.matchAll(/catalogo\/([a-z0-9-]+)\/index\.html/g)].map(m => m[1]);
      ordine = [...new Set(visti.filter(c => ordine.includes(c))), ...ordine.filter(c => !visti.includes(c))];
      ordine = conFissate(ordine, h);
    } catch (e) {}
    ORDINE = ordine;
    ordine.forEach(c => { NOME[c] = NOMI_CATEGORIE[c] || c; });
  }
  function conFissate(ordine, h) {
    try {
      const inLocale = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
      if (!inLocale && localStorage.getItem('ct-accesso') !== '1') return ordine;
      const max = Math.max(0, parseInt((h.match(/data-pin-max="(\d+)"/) || [])[1], 10) || 3);
      const visibili = new Set([...h.replace(/<template[\s\S]*?<\/template>/g, '').matchAll(/class="st-card" href="catalogo\/([a-z0-9-]+)\/index\.html"/g)].map(m => m[1]));
      const pin = (JSON.parse(localStorage.getItem('ct-pin')) || [])
        .map(u => (String(u).match(/catalogo\/([a-z0-9-]+)\//) || [])[1] || String(u))
        .filter(c => c && visibili.has(c) && ordine.includes(c));
      const fissate = [...new Set(pin)].slice(0, max);
      return [...fissate, ...ordine.filter(c => !fissate.includes(c))];
    } catch (e) { return ordine; }
  }
  function caricaCategoria(c) {
    if (caricate.has(c)) return Promise.resolve();
    return inCorso[c] || (inCorso[c] = (async () => {
      try {
        const u = new URL(c + '/la-mia-collezione/indice.js', CAT);
        if (versioni[c]) u.searchParams.set('v', versioni[c]);
        const r = await fetch(u);
        if (!r.ok) throw new Error(r.status);
        const t = await r.text();
        const ind = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
        NOME[c] = ind.categoria || NOME[c];
        ind.serie.forEach(s => { s.c = c; SERIE.push(s); s.x.forEach(o => { serieDi[o[0]] = s; }); });
        if (c === 'kinder') ristampe(ind.serie);
        await leggi(ind.serie);
        caricate.add(c); fallite.delete(c);
      } catch (e) { fallite.add(c); console.warn('Collection Time: non riesco a leggere l\'elenco delle serie di', c, e); }
      delete inCorso[c];
    })());
  }
  function ristampe(serie) {
    const per = {};
    serie.forEach(s => s.x.forEach(o => { const m = o[5] === 'Variante' ? null : /^\s*\d+\s*-\s*(.+)$/.exec(o[1] || ''); if (m) { const k = m[1].trim(); (per[k] = per[k] || []).push({ s, id: o[0] }); } }));
    Object.keys(per).forEach(k => {
      const l = per[k];
      if (l.length < 2 || new Set(l.map(x => x.s)).size !== l.length) return;
      l.forEach(x => { gemelli[x.id] = l.filter(y => y !== x).map(y => y.id); });
    });
  }
  const primo = id => { const g = gemelli[id]; return !g || SERIE.indexOf(serieDi[id]) < Math.min(...g.map(i => SERIE.indexOf(serieDi[i]))); };

  const apri = nome => new Promise((ok, ko) => {
    const r = indexedDB.open(nome, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('penne', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  let esistenti = null;
  async function leggi(serie) {
    for (const s of serie) {
      if (esistenti && !esistenti.has(s.db)) continue;
      try {
        const db = await apri(s.db);
        const righe = await new Promise(ok => { const g = db.transaction('penne').objectStore('penne').getAll(); g.onsuccess = () => ok(g.result); g.onerror = () => ok([]); });
        righe.forEach(r => { if (r.owned === true || r.doppi > 0) ce[r.id] = true; if (r.doppi > 0) doppi[r.id] = r.doppi; });
        db.close();
      } catch (e) {}
    }
  }
  async function salva(id) {
    try {
      const db = await apri(serieDi[id].db);
      const t = db.transaction('penne', 'readwrite'), st = t.objectStore('penne');
      const g = st.get(id);
      g.onsuccess = () => st.put(Object.assign(g.result || { tags: [], tagsTouched: false }, { id, owned: !!ce[id], doppi: doppi[id] || 0 }));
      t.oncomplete = () => { db.close(); if (esistenti) esistenti.add(serieDi[id].db); segnalaModifica(); };
    } catch (e) { avviso('Salvataggio non riuscito.'); }
  }
  async function categorieIniziate() {
    try { esistenti = indexedDB.databases ? new Set((await indexedDB.databases()).map(d => d.name)) : null; } catch (e) { esistenti = null; }
    if (!esistenti) return ORDINE.slice();
    try {
      const r = (await (await fetch(new URL('riepilogo.json', CAT), { cache: 'no-cache' })).json()).serie || {};
      const cat = { 'catalogo-penne': 'legami' };
      [...esistenti].forEach(db => { if (r[db]) cat[db] = r[db][0].split('/')[0]; });
      return ORDINE.filter(c => [...esistenti].some(db => cat[db] === c));
    } catch (e) { return ORDINE.slice(); }
  }

  const principali = s => { if (s._e) return s.x; const p = s.x.filter(o => !paeseEstero(o[5])); return p.length ? p : s.x; };
  const quante = s => principali(s).filter(o => ce[o[0]]).length;
  const doppiDi = s => s.x.reduce((t, o) => t + (primo(o[0]) ? (doppi[o[0]] || 0) : 0), 0);
  const cartellaSerie = s => new URL(s.c + '/' + s.p + '/', CAT).href;
  const fotoDi = (s, o) => cartellaSerie(s) + o[3];

  function oggetto(s, o) {
    const [id, num, nome] = o, si = !!ce[id], n = doppi[id] || 0;
    const numero = o[5] && o[5] !== 'Variante' && !String(num).includes(' - ') ? num + ' - ' + o[5] : num;
    return `<li class="pen${si ? ' owned' : ''}">
      <button type="button" class="open" data-ce="${id}" aria-pressed="${si}" aria-label="Ce l'ho: ${esc(nome || numero)}"><div class="pic"><img class="pen-img" src="${fotoDi(s, o)}" alt="${esc(nome || numero)}"${s.nomi ? '' : ` title="${esc(nome)}"`} loading="lazy" decoding="async"></div><span class="spunta" aria-hidden="true"></span></button>
      ${s.nomi ? `<div class="nome"><span>${esc(nome)}</span></div>` : ''}
      <div class="code${numero ? '' : ' none'}">${esc(numero || 'N°')}</div>
      <div class="doppi${n ? ' si' : ''}"><span class="etichetta">Doppi</span><span class="conta"><button type="button" data-meno="${id}"${n ? '' : ' disabled'} aria-label="Un doppione in meno">−</button><span class="n">${n}</span><button type="button" data-piu="${id}" aria-label="Un doppione in più">+</button></span></div>
    </li>`;
  }
  function griglia(s, oggetti, unaRiga) {
    const stretta = s.pr >= 3;
    return `<div class="${esc(s.cl)}"><ul class="grid r-griglia${stretta ? ' stretti' : ''}${unaRiga ? ' una-riga' : ''}"${unaRiga ? ` data-serie="${esc(s.db)}"` : ''} style="--proporzione:${s.pr}; --pen-vh:${stretta ? 260 : 170}px; grid-template-columns: repeat(auto-fill, minmax(${stretta ? 64 : 110}px, 1fr))">${oggetti.map(o => oggetto(s, o)).join('')}</ul></div>`;
  }
  const titoloSerie = (s, extra, scambi) =>
    `<div class="serie-titolo"><h2><a href="${cartellaSerie(s)}index.html">${esc(s.t)}</a></h2><small>${[categoria === '' && vista() !== 'cerca' ? NOME[s.c] : '', s.g, s.d, extra].filter(Boolean).map(esc).join(' · ')}</small>`
    + (scambi ? `<a class="serie-scambi" href="${cartellaSerie(s)}index.html#cerco-scambio">Cerco e scambio</a>` : '') + '</div>';
  const schedeCollezione = attiva => '<nav class="coll-schede" aria-label="Collezione">'
    + [['mancanti', 'Mancanti'], ['doppioni', 'Doppioni'], ['liste', 'Liste']].map(([k, t]) => `<a href="#/${k}"${k === attiva ? ' aria-current="page"' : ''}>${t}</a>`).join('') + '</nav>';
  const testa = (titolo, sotto, strumenti, scheda) => `<nav class="st-percorso" aria-label="Percorso"><a href="${SITO.href}index.html">Home</a><span class="sep" aria-hidden="true">&rsaquo;</span><span aria-current="page">${scheda ? 'Collezione' : esc(titolo.charAt(0) + titolo.slice(1).toLowerCase())}</span></nav>
    <header><h1><span class="titolo-testo">${scheda ? 'COLLEZIONE' : titolo}</span></h1>${scheda ? schedeCollezione(scheda) : ''}
    <div class="bar"><p class="sub">${sotto}</p><div class="tools">${strumenti || ''}</div></div></header>`;
  const menu = (id, voci, scelta, etichetta) =>
    `<select id="${id}" aria-label="${etichetta}">${voci.map(([k, t]) => `<option value="${esc(k)}"${k === scelta ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  let contiCat = {};
  const menuCategoria = () => menu('categoria', [['', 'Tutte le categorie'], ...ORDINE.map(c => [c, NOME[c] + (contiCat[c] ? ' (' + contiCat[c] + ')' : '')])], categoria, 'Categoria');
  const menuGruppi = () => {
    const g = categoria ? [...new Set(SERIE.filter(s => s.c === categoria).map(s => s.g))].filter(Boolean) : [];
    return g.length > 1 ? menu('gruppo', [['', 'Tutti i gruppi'], ...g.map(x => [x, x])], gruppo, 'Gruppo') : '';
  };
  let filtro = '';
  const lenteSerie = () => `<div class="st-cerca${filtro ? ' open' : ''}" id="cerca-serie"><button type="button" id="apri-cerca-serie" aria-label="Cerca una serie" aria-expanded="${!!filtro}">${LENTE}</button><input type="search" id="filtro-serie" placeholder="Cerca una serie" value="${esc(filtro)}" autocomplete="off"${filtro ? '' : ' tabindex="-1"'}></div>`;
  const vuoto = testo => `<section class="empty"><p>${testo}</p><a class="st-btn" href="${categoria ? CAT.href + categoria + '/index.html' : SITO.href + 'index.html'}">Vai alle serie</a></section>`;
  const avvisoRete = () => fallite.size ? '<p class="st-nessuna">Non riesco a leggere tutte le serie: controlla la connessione e ricarica la pagina.</p>' : '';
  const PER_VOLTA = 10;
  let mostrate = {};
  const quanteMostro = c => mostrate[c] || PER_VOLTA;
  const contoSerie = s => vista() === 'doppioni' ? doppiDi(s) : principali(s).length - quante(s);
  const pezziSerie = s => vista() === 'doppioni' ? s.x.filter(o => doppi[o[0]] && primo(o[0])) : principali(s).filter(o => !ce[o[0]]);
  function schedaCategoria(g) {
    const n = g.l.reduce((t, s) => t + contoSerie(s), 0), dop = vista() === 'doppioni';
    const pz = g.l.map(pezziSerie), mini = [];
    for (let i = 0; mini.length < 5 && pz.some(l => l[i]); i++) pz.forEach((l, k) => { if (l[i] && mini.length < 5) mini.push(fotoDi(g.l[k], l[i])); });
    const tot = g.l.reduce((t, s) => t + principali(s).length, 0), perc = dop || !tot ? 0 : Math.max(1, Math.round(g.l.reduce((t, s) => t + quante(s), 0) * 100 / tot));
    return `<button type="button" class="cat-riga" data-vai-cat="${g.c}"><span class="cat-nome">${esc(NOME[g.c])}</span>`
      + `<span class="cat-conto">${plurale(g.l.length, 'serie', 'serie')} · ${dop ? plurale(n, 'doppione', 'doppioni') : (n === 1 ? 'ne manca 1' : 'ne mancano ' + n)}</span>`
      + `<span class="cat-mini">${mini.map(u => `<img src="${u}" alt="" loading="lazy" decoding="async">`).join('')}</span>`
      + '<span class="cat-vai" aria-hidden="true">›</span>'
      + (dop ? '' : `<span class="cat-barra" aria-hidden="true"><span style="width:${perc}%"></span></span>`) + '</button>';
  }
  const conTitoli = (elenco, sezione) => {
    const gruppi = [];
    elenco.forEach(s => { const g = gruppi[gruppi.length - 1]; g && g.c === s.c ? g.l.push(s) : gruppi.push({ c: s.c, l: [s] }); });
    if (!gruppi.length) return '';
    if (categoria === '') return '<div class="cat-elenco">' + gruppi.map(schedaCategoria).join('') + '</div>' + gruppi.map(g => g.l.map((s, i) => sezione(s, i)).join('')).join('');
    return gruppi.map(g => g.l.map((s, i) => sezione(s, i)).join('')
      + `<p class="altre-serie" data-cat="${g.c}" hidden><button type="button" class="st-btn" data-altre="${g.c}"></button></p>`).join('');
  };
  const sezione = (s, dentro, pos) => `<section class="r-serie" data-cat="${s.c}" data-pos="${pos}" data-nome="${esc(semplice(s.t + ' ' + s.g + ' ' + s.d + ' ' + NOME[s.c]))}">${dentro}</section>`;
  const ordinate = l => l.slice().sort((a, b) => ORDINE.indexOf(a.c) - ORDINE.indexOf(b.c));

  const pausa = new Set((() => { try { return JSON.parse(localStorage.getItem('ct-pausa')) || []; } catch (e) { return []; } })());
  const salvaPausa = () => { try { localStorage.setItem('ct-pausa', JSON.stringify([...pausa])); } catch (e) {} segnaPreferenze('pausa'); };
  let gruppo = '', categoria = '';

  function mancanti() {
    const conEstere = SERIE.flatMap(s => { const e = s.x.filter(o => paeseEstero(o[5])); return e.length && e.length < s.x.length ? [s, Object.assign({}, s, { _e: true, t: s.t + ' (ESTERO)', db: s.db + '#estero', x: e })] : [s]; });
    const tutteCat = conEstere.filter(s => quante(s) > 0 && quante(s) < principali(s).length);
    contiCat = {}; tutteCat.filter(s => !pausa.has(s.db)).forEach(s => { contiCat[s.c] = (contiCat[s.c] || 0) + 1; });
    const tutte = ordinate(tutteCat.filter(s => (!categoria || s.c === categoria) && (!gruppo || s.g === gruppo)));
    const elenco = tutte.filter(s => !pausa.has(s.db)), ferme = tutte.filter(s => pausa.has(s.db));
    const manca = s => principali(s).length - quante(s);
    const tot = elenco.reduce((t, s) => t + manca(s), 0);
    const dove = categoria ? ' in ' + esc(NOME[categoria]) : '';
    app.innerHTML = testa('MANCANTI', plurale(tot, 'oggetto', 'oggetti') + ' in ' + plurale(elenco.length, 'serie', 'serie'),
      (elenco.length || ferme.length ? lenteSerie() : '') + menuCategoria() + menuGruppi(), 'mancanti')
      + avvisoRete()
      + (conTitoli(elenco, (s, pos) => { const m = principali(s).filter(o => !ce[o[0]]); return sezione(s, titoloSerie(s, m.length === 1 ? 'ne manca 1' : 'ne mancano ' + m.length, true) + griglia(s, m, true)
          + `<button type="button" class="non-cerco" data-pausa="${esc(s.db)}">Non la cerco più</button>`, pos); })
        || (ferme.length ? '' : vuoto(SERIE.some(s => (!categoria || s.c === categoria) && quante(s) > 0) ? 'Non ti manca niente!' : 'Non hai ancora iniziato nessuna serie' + dove + '. Segna con "Ce l\'ho" quello che hai: qui vedrai cosa manca per completare le serie.')))
      + (ferme.length ? `<details class="pausa"><summary>Non le cerco più (${ferme.length})</summary>`
          + ferme.map(s => `<div class="pausa-serie" data-nome="${esc(semplice(s.t + ' ' + s.g + ' ' + s.d + ' ' + NOME[s.c]))}"><div><b>${esc(s.t)}</b><small>${[categoria ? '' : NOME[s.c], s.g, 'ne ' + (manca(s) === 1 ? 'manca 1' : 'mancano ' + manca(s))].filter(Boolean).map(esc).join(' · ')}</small></div><button type="button" class="st-btn" data-riprendi="${esc(s.db)}">Riprendi</button></div>`).join('')
          + '</details>' : '')
      + '<p class="st-nessuna nessuna-serie" hidden></p>'
      + '<p class="hint" style="margin-top:28px">Premi su una foto per segnare che ce l\'hai. Con + e − conti i doppioni.</p>';
  }

  function doppioni() {
    const tutteCat = SERIE.filter(s => doppiDi(s));
    contiCat = {}; tutteCat.forEach(s => { contiCat[s.c] = (contiCat[s.c] || 0) + 1; });
    const elenco = ordinate(tutteCat.filter(s => (!categoria || s.c === categoria) && (!gruppo || s.g === gruppo)));
    const tot = elenco.reduce((t, s) => t + doppiDi(s), 0);
    app.innerHTML = testa('DOPPIONI', plurale(tot, 'doppione', 'doppioni') + (elenco.length ? ' in ' + plurale(elenco.length, 'serie', 'serie') : ''),
      (elenco.length ? lenteSerie() : '') + menuCategoria() + menuGruppi(), 'doppioni')
      + avvisoRete()
      + (conTitoli(elenco, (s, pos) => sezione(s, titoloSerie(s, '', true) + griglia(s, s.x.filter(o => doppi[o[0]] && primo(o[0])), true), pos))
        || vuoto(categoria ? 'Nessun doppione in ' + esc(NOME[categoria]) + '.' : 'Nessun doppione. Hai qualcosa in più? Premi + sotto la foto, nella pagina della serie.'))
      + '<p class="st-nessuna nessuna-serie" hidden></p>';
  }

  const PEZZI_ALTRI = 4, SERIE_PRIMA = 5;
  const fila = () => matchMedia('(min-width: 1200px)').matches ? 8 : matchMedia('(min-width: 900px)').matches ? 6 : matchMedia('(min-width: 600px)').matches ? 4 : 3;
  let testoCerca = '', ultimoCercato = '', tutteSerie = false;
  const aperti = {};
  const SOLO_IN = { kinder: ['Kinder', 'kinder/tutte/'] };
  function cerca() {
    contiCat = {};
    app.innerHTML = testa('CERCA', 'Nome, numero, codice o serie', menuCategoria())
      + `<div class="cerca-aperta st-cerca open">${LENTE}<input type="search" id="cerca" placeholder="${categoria ? 'Cerca in ' + esc(NOME[categoria]) : 'Cerca in tutte le categorie'}" value="${esc(testoCerca)}" autocomplete="off"></div>${avvisoRete()}<div id="risultati"></div>`;
    const campo = document.getElementById('cerca');
    let attesa;
    campo.oninput = () => { clearTimeout(attesa); attesa = setTimeout(() => { testoCerca = campo.value; risultati(); }, 120); };
    risultati();
    if (!('ontouchstart' in window) || !testoCerca) campo.focus();
  }
  function distanza(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let m = i;
      for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < m) m = cur[j]; }
      if (m > max) return max + 1;
      prec = cur;
    }
    return prec[b.length];
  }
  const parti = t => semplice(t).split(/[^a-z0-9]+/).filter(Boolean);
  function puntiParola(p, token) {
    let mig = 0;
    for (const t of token) {
      if (t.startsWith(p)) return 3;
      if (t.includes(p)) mig = 2;
      else if (!mig && p.length >= 4 && !/\d/.test(p)) { const max = p.length >= 7 ? 2 : 1; if (distanza(p, t.slice(0, p.length + 1), max) <= max || distanza(p, t, max) <= max) mig = 1; }
    }
    return mig;
  }
  function punti(parole, forte, debole) {
    let tot = 0;
    for (const p of parole) { const a = puntiParola(p, forte) * 2, b = puntiParola(p, debole); if (!a && !b) return 0; tot += Math.max(a, b); }
    return tot;
  }
  const codici = o => [...String(o[1]).split(/\s+-\s+/).slice(1), ...String(o[4] || '').split(/\s+/)].map(semplice).filter(t => /[a-z]/.test(t) && /\d/.test(t) || /^\d{5,}$/.test(t));
  const dataSerie = s => (/[?&]v=(\d{4}-\d\d-\d\d)/.exec(s.cop || '') || [])[1] || '';
  const piuRecente = (a, b) => dataSerie(b) > dataSerie(a) ? 1 : dataSerie(b) < dataSerie(a) ? -1 : 0;
  const rigaSerie = s => {
    const tot = principali(s).length, n = Math.min(quante(s), tot);
    return `<li><a href="${cartellaSerie(s)}index.html">${s.cop ? `<img src="${CAT.href + s.c + '/' + s.cop}" alt="" loading="lazy" decoding="async">` : '<span class="st-sf"></span>'}<span class="st-st"><strong>${esc(s.t)}</strong><small>${esc([categoria ? '' : NOME[s.c], s.g, s.d].filter(Boolean).join(' · '))}</small><em>${n ? (n >= tot ? '✓ Completa' : 'Ce l’hai: ' + n + '/' + tot) : ''}</em></span></a></li>`;
  };
  function tessera(s, o) {
    const [id, num, nm] = o, si = !!ce[id];
    const numero = o[5] && o[5] !== 'Variante' && !String(num).includes(' - ') ? num + ' - ' + o[5] : num;
    return `<li class="lista-pezzo ag-pezzo${si ? ' dentro' : ''}"><button type="button" class="lp-foto" data-ce="${esc(id)}" aria-pressed="${si}" aria-label="Ce l'ho: ${esc((nm || numero) + ' · ' + s.t)}"><img src="${fotoDi(s, o)}" alt="" loading="lazy" decoding="async"><span class="ag-segno" aria-hidden="true">${si ? '✓' : '+'}</span></button>`
      + `<span class="lp-num">${esc(numero || nm || 'N°')}</span>${nm && numero ? `<span class="lp-nome" title="${esc(nm)}">${esc(nm)}</span>` : ''}<a class="lp-serie" href="${cartellaSerie(s)}index.html" title="${esc(s.t)}">${esc(s.t)}</a></li>`;
  }
  const tessere = l => `<ul class="lista-mista">${l.map(x => tessera(x.s, x.o)).join('')}</ul>`;
  function risultati() {
    const box = document.getElementById('risultati');
    if (!box) return;
    if (testoCerca !== ultimoCercato) { ultimoCercato = testoCerca; tutteSerie = false; Object.keys(aperti).forEach(k => delete aperti[k]); }
    const parole = parti(testoCerca);
    if (parole.join('').length < 2) { box.innerHTML = '<p class="st-nessuna">Scrivi almeno due lettere.</p>'; return; }
    const dove = SERIE.filter(s => !categoria || s.c === categoria);
    const q = semplice(testoCerca).replace(/[\s-]+/g, '');
    const esatti = [];
    if (q.length >= 4) dove.forEach(s => s.x.forEach(o => { if (primo(o[0]) && codici(o).includes(q)) esatti.push({ s, o }); }));
    const serieCodice = esatti.length > 3 && new Set(esatti.map(x => x.s)).size === 1 && esatti.length * 2 >= esatti[0].s.x.length ? esatti[0].s : null;
    const giaSopra = new Set(serieCodice ? [] : esatti.map(x => x.o[0]));
    const cats = categoria ? [] : ORDINE.filter(c => caricate.has(c) && punti(parole, parti(NOME[c]), []) > 0);
    const ser = dove.map(s => { const p = punti(parole, parti(s.t), parti([s.g, s.d, NOME[s.c]].join(' '))); return { s, p: p && p + (semplice(s.t).startsWith(parole[0]) ? 2 : 0) }; })
      .filter(x => x.p > 0).sort((a, b) => b.p - a.p || piuRecente(a.s, b.s)).map(x => x.s);
    if (serieCodice) { const i = ser.indexOf(serieCodice); if (i >= 0) ser.splice(i, 1); ser.unshift(serieCodice); }
    const perCat = {};
    dove.forEach(s => {
      if (s === serieCodice) return;
      const titolo = parti(s.t);
      s.x.forEach(o => {
        if (!primo(o[0]) || giaSopra.has(o[0])) return;
        const suoi = parti(o[2] + ' ' + o[1] + ' ' + (o[4] || ''));
        if (!parole.some(w => puntiParola(w, suoi) > 0)) return;
        let p = punti(parole, parti(o[2]), [...parti(o[1] + ' ' + (o[4] || '')), ...titolo]);
        if (esatti.length && p < 3 * parole.length) p = 0;
        if (p > 0) (perCat[s.c] = perCat[s.c] || []).push({ s, o, p });
      });
    });
    let h = '';
    if (esatti.length && !serieCodice) h += `<section class="cr-sez"><h2 class="st-sez-titolo">Codice <span class="cr-codice">${esc(testoCerca.trim().toUpperCase())}</span></h2>${tessere(esatti)}</section>`;
    if (cats.length) h += `<section class="cr-sez"><h2 class="st-sez-titolo">Categorie</h2><div class="cr-chip">${cats.map(c => `<a href="${CAT.href + c}/index.html">${esc(NOME[c])}</a>`).join('')}</div></section>`;
    if (ser.length) {
      const n = tutteSerie ? ser.length : SERIE_PRIMA;
      h += `<section class="cr-sez st-serie-trovate"><h2 class="st-sez-titolo">Serie <span class="cr-n">${ser.length}</span></h2><ul>${ser.slice(0, n).map(rigaSerie).join('')}</ul>`
        + (ser.length > n ? `<p class="st-altre"><button type="button" class="st-btn cr-tutte-serie">Mostra tutte le serie (${ser.length})</button></p>` : '') + '</section>';
    }
    const catP = ORDINE.filter(c => perCat[c]);
    if (catP.length) {
      h += `<h2 class="st-sez-titolo cr-tit-pezzi">Pezzi <span class="cr-n">${catP.reduce((t, c) => t + perCat[c].length, 0)}</span></h2>`;
      catP.forEach(c => {
        const l = perCat[c].sort((a, b) => b.p - a.p || piuRecente(a.s, b.s) || SERIE.indexOf(a.s) - SERIE.indexOf(b.s) || a.s.x.indexOf(a.o) - b.s.x.indexOf(b.o));
        const n = aperti[c] || fila(), solo = SOLO_IN[c];
        h += `<section class="cr-sez cr-cat"><h3 class="cr-cat-tit">${esc(NOME[c])} <span class="cr-n">${l.length}</span></h3>${tessere(l.slice(0, n))}`
          + `<div class="cr-piedi">${l.length > n ? `<button type="button" class="st-btn cr-altri" data-cat="${esc(c)}">Mostra altri (${l.length - n})</button>` : ''}`
          + (solo ? `<a class="cr-solo" href="${CAT.href + solo[1]}index.html?cerca=${encodeURIComponent(testoCerca.trim())}">Cerca solo in ${esc(solo[0])} ›</a>` : '') + '</div></section>';
      });
    }
    box.innerHTML = h || '<p class="st-nessuna">Nessun risultato.</p>';
    accendi();
  }
  let LISTE_DATI = [];
  let catDiDb = null;
  const serieDiDb = db => SERIE.find(x => x.db === db);
  async function preparaListe() {
    LISTE_DATI = await ctListe.tutte();
    if (!catDiDb) {
      catDiDb = { 'catalogo-penne': 'legami' };
      try { const r = (await (await fetch(new URL('riepilogo.json', CAT), { cache: 'no-cache' })).json()).serie || {}; Object.keys(r).forEach(db => { catDiDb[db] = String(r[db][0]).split('/')[0]; }); } catch (e) {}
    }
    const dbs = new Set(LISTE_DATI.flatMap(l => l.pezzi.map(x => x.db)));
    const servono = new Set([...dbs].map(db => catDiDb[db]).filter(c => c && ORDINE.includes(c)));
    if (!ctListe.puoi()) CAT_ESEMPIO.filter(c => ORDINE.includes(c)).forEach(c => servono.add(c));
    const mancano = [...servono].filter(c => !caricate.has(c));
    if (mancano.length && !app.querySelector('header')) app.innerHTML = '<p class="st-nessuna" style="margin-top:40px">Un momento…</p>';
    await Promise.all(mancano.map(caricaCategoria));
  }
  function pezziLista(l) {
    const visti = [], persi = [];
    l.pezzi.forEach(x => { const s = serieDiDb(x.db), o = s && s.x.find(y => y[0] === x.id); o ? visti.push({ s, o, ok: x.ok }) : persi.push(x); });
    visti.sort((a, b) => (ORDINE.indexOf(a.s.c) - ORDINE.indexOf(b.s.c)) || (SERIE.indexOf(a.s) - SERIE.indexOf(b.s)) || (a.s.x.indexOf(a.o) - b.s.x.indexOf(b.o)));
    return { visti, persi: persi.length - (fallite.size ? persi.length : 0) };
  }
  const indirizzoLista = n => '#/lista/' + encodeURIComponent(n);
  const percorsoListe = nome => `<nav class="st-percorso" aria-label="Percorso"><a href="${SITO.href}index.html">Home</a><span class="sep" aria-hidden="true">&rsaquo;</span>`
    + (nome ? `<a href="#/liste">Liste</a><span class="sep" aria-hidden="true">&rsaquo;</span><span aria-current="page">${esc(nome)}</span>` : '<span aria-current="page">Collezione</span>') + '</nav>';
  const notaAccount = () => { if (haAccesso()) return ''; return '<p class="liste-account"><button type="button" class="st-link" data-accedi-liste>Accedi</button> per ritrovarle su tutti i tuoi dispositivi.</p>'; };

  const CAT_ESEMPIO = ['legami', 'lidl', 'lego', 'mcdonalds'];
  const ESEMPI_LISTE = [['Cercati per Sara', 6, 2, ['mcdonalds', 'legami', 'lidl']], ['Da regalare a Natale', 5, 0, ['legami', 'lego', 'legami']],
                        ['Da scambiare con Federico', 8, 0, ['lidl', 'mcdonalds', 'lidl']], ['Per il mercatino', 4, 1, ['lego', 'lidl', 'mcdonalds']]];
  function anteprimaListe() {
    const esempi = ESEMPI_LISTE;
    const pool = c => SERIE.filter(s => s.c === c && s.x && s.x.length >= 3);
    const usate = {};
    const foto = c => { let p = pool(c); if (!p.length) p = SERIE.filter(s => s.x && s.x.length); if (!p.length) return ''; const i = usate[c] = (usate[c] || 0) + 1; const s = p[(i * 7) % p.length]; return `<img src="${fotoDi(s, s.x[i % s.x.length])}" alt="" loading="lazy" decoding="async">`; };
    const scheda = ([nome, n, ok, cats]) => {
      const mini = cats.map(foto).join('');
      return `<div class="lista-scheda"><span class="liste-esempio-tag">Esempio</span><span class="ls-mini">${mini}</span><span class="ls-testo"><b>${nome}</b><small>${plurale(n, 'oggetto', 'oggetti')}</small>`
        + (ok ? `<span class="ls-avanz"><i><span style="width:${Math.round(ok * 100 / n)}%"></span></i><small>${ok} su ${n}</small></span>` : '') + '</span></div>';
    };
    const gia = LISTE_DATI.length;
    app.innerHTML = percorsoListe('') + `<header><h1><span class="titolo-testo">COLLEZIONE</span></h1>${schedeCollezione('liste')}</header>`
      + '<section class="liste-invito"><h2>Crea le tue liste</h2><p data-en="Group any items you like, from any series: “Wanted for Sara”, “Christmas gifts”, “To swap with Federico”… Lists are &lt;b&gt;free for signed-in members&lt;/b&gt; and you’ll find them on all your devices.">Raggruppa i pezzi che vuoi, di qualunque serie: «Cercati per Sara», «Da regalare a Natale», «Da scambiare con Federico»… '
      + 'Le liste sono <b>gratis per chi è iscritto</b> e le ritrovi su tutti i tuoi dispositivi.</p>'
      + '<button type="button" class="st-btn liste-accedi" data-accedi-liste>Accedi con Google</button>'
      + (gia ? `<p class="liste-gia" data-en="You already have ${gia === 1 ? '1 list' : gia + ' lists'} on this device: sign in to see and edit ${gia === 1 ? 'it' : 'them'}.">${gia === 1 ? 'Hai già 1 lista' : 'Hai già ' + gia + ' liste'} su questo dispositivo: accedi per ${gia === 1 ? 'vederla e modificarla' : 'vederle e modificarle'}.</p>` : '') + '</section>'
      + `<div class="liste-elenco liste-esempio" aria-hidden="true">${esempi.map(scheda).join('')}</div>`;
  }

  function pagListe() {
    if (!ctListe.puoi()) return anteprimaListe();
    const tot = LISTE_DATI.reduce((t, l) => t + pezziLista(l).visti.length, 0);
    app.innerHTML = percorsoListe('') + `<header><h1><span class="titolo-testo">COLLEZIONE</span></h1>${schedeCollezione('liste')}<div class="bar"><p class="sub">${plurale(LISTE_DATI.length, 'lista', 'liste')} · ${plurale(tot, 'oggetto', 'oggetti')}</p></div></header>`
      + avvisoRete()
      + (LISTE_DATI.length ? '' : '<p class="liste-zero">Non hai ancora nessuna lista.</p>')
      + '<div class="liste-elenco">' + LISTE_DATI.map(l => {
        const { visti } = pezziLista(l), cat = new Set(visti.map(v => v.s.c)).size, fatti = visti.filter(v => v.ok).length;
        const mini = visti.slice(-3).reverse().map(v => `<img src="${fotoDi(v.s, v.o)}" alt="" loading="lazy" decoding="async">`).join('');
        return `<a class="lista-scheda" href="${indirizzoLista(l.nome)}"><span class="ls-mini">${mini || '<span class="ls-vuota" aria-hidden="true">☆</span>'}</span>`
          + `<span class="ls-testo"><b>${esc(l.nome)}</b><small>${visti.length ? plurale(visti.length, 'oggetto', 'oggetti') + ' · ' + plurale(cat, 'categoria', 'categorie') : 'Ancora vuota'}</small>`
          + (fatti ? `<span class="ls-avanz"><i><span style="width:${Math.round(fatti * 100 / visti.length)}%"></span></i><small>${fatti} su ${visti.length}</small></span>` : '')
          + `</span><span class="cat-vai" aria-hidden="true">›</span></a>`;
      }).join('') + '</div>'
      + '<div class="liste-nuova"><button type="button" class="st-btn" data-nuova-lista>+ Crea una nuova lista</button><p class="liste-err" hidden></p></div>'
      + notaAccount()
      + '<p class="hint" style="margin-top:28px">Per mettere un pezzo in una lista apri la sua serie, premi «info» sotto la foto e tocca la lista. Nelle pagine «Vedi tutti» tieni premuto sul pezzo.</p>';
  }

  function pezzoLista(s, o, ok) {
    const [id, num, nome] = o, si = !!ok;
    const numero = o[5] && o[5] !== 'Variante' && !String(num).includes(' - ') ? num + ' - ' + o[5] : num;
    const serie = s.t.replace(/^.+? - /, '');
    return `<li class="lista-pezzo${si ? ' si' : ''}">
      <button type="button" class="lp-foto" data-spunta-db="${esc(s.db)}" data-spunta="${esc(id)}" aria-pressed="${si}" aria-label="Spunta: ${esc((nome || numero) + ' · ' + s.t)}"><img src="${fotoDi(s, o)}" alt="" loading="lazy" decoding="async"></button>
      <button type="button" class="lp-i" data-scheda-db="${esc(s.db)}" data-scheda="${esc(id)}" aria-label="Info: ${esc(nome || numero)}" title="Info"><span aria-hidden="true">i</span></button>
      <span class="lp-num">${esc(numero || nome || 'N°')}</span>
      <span class="lp-serie" title="${esc(s.t)}">${esc(serie)}</span>
    </li>`;
  }
  function schedaPezzo(db, id, nomeLista) {
    const s = serieDiDb(db), o = s && s.x.find(y => y[0] === id);
    if (!o) return;
    const [, num, nome] = o, si = !!ce[id];
    const numero = o[5] && o[5] !== 'Variante' && !String(num).includes(' - ') ? num + ' - ' + o[5] : num;
    const prima = document.activeElement;
    const sfondo = document.createElement('div'); sfondo.className = 'lp-sfondo';
    const p = document.createElement('div'); p.className = 'lp-pannello lp-scheda';
    p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-labelledby', 'lpsNome');
    p.innerHTML = '<div class="lp-maniglia" aria-hidden="true"></div>'
      + `<div class="lps-testa"><div class="lps-foto"><img src="${fotoDi(s, o)}" alt=""></div>`
      + `<div class="lps-testo"><h3 id="lpsNome">${esc(nome || numero)}</h3>${nome && numero ? `<p class="lps-num">N° ${esc(numero)}</p>` : ''}`
      + `<p class="lps-serie"><a href="${cartellaSerie(s)}index.html">${esc(s.t)}</a></p><p class="lps-cat">${esc([NOME[s.c], s.g, s.d].filter(Boolean).join(' · '))}</p>`
      + `<p class="lps-stato${si ? ' si' : ''}">${si ? '✓ Ce l\'hai nella collezione' : 'Non ce l\'hai nella collezione'}</p></div></div>`
      + `<div class="lps-azioni"><a class="st-btn" href="${cartellaSerie(s)}index.html#info=${encodeURIComponent(id)}">Info complete</a>`
      + `<a class="st-btn" href="${cartellaSerie(s)}index.html#pezzo=${encodeURIComponent(id)}">Vai alla serie</a></div>`
      + '<button type="button" class="lps-togli">Togli dalla lista</button>'
      + '<button type="button" class="lp-fatto">Chiudi</button>';
    const chiudi = () => { sfondo.remove(); p.remove(); document.removeEventListener('keydown', esc_, true); if (prima && prima.focus) prima.focus(); };
    const esc_ = e => { if (e.key === 'Escape') { e.preventDefault(); chiudi(); } };
    sfondo.addEventListener('click', chiudi);
    p.querySelector('.lp-fatto').addEventListener('click', chiudi);
    p.querySelector('.lps-togli').addEventListener('click', async () => {
      chiudi();
      const y = scrollY;
      try { await ctListe.metti(db, id, nomeLista, false); } catch (err) { avviso('Salvataggio non riuscito.'); return; }
      await mostra(); scrollTo(0, y);
      avviso('Tolto da «' + nomeLista + '».', async () => { await ctListe.metti(db, id, nomeLista, true); await mostra(); scrollTo(0, y); });
    });
    document.addEventListener('keydown', esc_, true);
    document.body.append(sfondo, p);
    p.querySelector('.lp-fatto').focus();
  }
  const PIU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const MATITA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>';
  function pagLista(nome) {
    if (!ctListe.puoi()) return anteprimaListe();
    const l = LISTE_DATI.find(x => ctListe.uguale(x.nome, nome));
    if (!l) { app.innerHTML = percorsoListe(nome) + '<section class="empty"><p>Questa lista non c\'è (forse l\'hai eliminata o rinominata).</p><a class="st-btn" href="#/liste">Le mie liste</a></section>'; return; }
    const { visti, persi } = pezziLista(l);
    app.innerHTML = percorsoListe(l.nome)
      + `<div class="lista-testa"><div class="lt-testo"><h1 class="lt-nome" id="lista-titolo">${esc(l.nome)}</h1><p class="lt-quanti"></p>${visti.length ? '<div class="lt-avanz"><div class="avanz-barra"><span></span></div><b class="avanz-perc"></b></div>' : ''}</div>`
      + `<div class="lt-azioni"><button type="button" class="lt-azione" data-aggiungi>${PIU}Aggiungi</button>`
      + `<button type="button" class="lt-azione" data-modifica aria-haspopup="menu" aria-expanded="false">${MATITA}Modifica</button></div>`
      + '</div><div class="liste-conferma" hidden></div>'
      + avvisoRete()
      + (visti.length ? `<ul class="lista-mista">${visti.map(v => pezzoLista(v.s, v.o, v.ok)).join('')}</ul>`
        : `<section class="empty"><p>${persi ? 'Gli oggetti di questa lista non sono più nel sito.' : 'La lista è vuota. Premi «Aggiungi pezzi» per cercarli in tutto il sito.'}</p><button type="button" class="st-btn" data-aggiungi>+ Aggiungi pezzi</button></section>`)
      + (persi ? `<p class="liste-persi">${persi === 1 ? '1 oggetto non più disponibile' : persi + ' oggetti non più disponibili'}</p>` : '');    contaLista();
  }
  function contaLista() {
    const tutti = [...app.querySelectorAll('.lista-pezzo')], si = tutti.filter(li => li.classList.contains('si')).length, tot = tutti.length;
    const q = app.querySelector('.lt-quanti');
    if (!q) return;
    q.innerHTML = si ? `<b>${si} su ${tot}</b> · ${plurale(tot, 'oggetto', 'oggetti')}` : plurale(tot, 'oggetto', 'oggetti');
    const perc = tot ? Math.round(si * 100 / tot) : 0, b = app.querySelector('.lt-avanz');
    if (b) b.hidden = !si;
    if (b) { b.querySelector('.avanz-barra span').style.width = perc + '%'; b.querySelector('.avanz-barra').classList.toggle('completa', tot > 0 && si >= tot); b.querySelector('.avanz-perc').textContent = tot && si >= tot ? 'Completa!' : perc + '%'; }
  }
  const AGG_MAX = 60;
  async function pannelloAggiungi(nome) {
    const l = LISTE_DATI.find(x => ctListe.uguale(x.nome, nome));
    if (!l) return;
    const dentro = new Set(l.pezzi.map(x => x.db + '|' + x.id));
    let aggiunti = 0, quanti = AGG_MAX, cat = '', testo = '';
    const prima = document.activeElement, yPrima = scrollY;
    const p = document.createElement('div');
    p.className = 'ag-pannello'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-labelledby', 'agTitolo');
    p.innerHTML = `<div class="ag-testa"><div><h2 id="agTitolo">Aggiungi a «${esc(l.nome)}»</h2><p class="ag-conto">Tocca un oggetto per aggiungerlo</p></div><button type="button" class="lp-fatto ag-fatto">Fatto</button></div>`
      + `<div class="ag-filtri"><div class="cerca-aperta st-cerca open">${LENTE}<input type="search" class="ag-cerca" placeholder="Nome, numero, codice o serie" autocomplete="off" aria-label="Cerca un oggetto"></div>`
      + `<select class="ag-cat" aria-label="Categoria"><option value="">Tutte le categorie</option>${ORDINE.map(c => `<option value="${esc(c)}">${esc(NOME[c] || c)}</option>`).join('')}</select></div>`
      + '<div class="ag-risultati"><p class="st-nessuna">Un momento…</p></div>';
    document.body.append(p);
    document.body.classList.add('ag-aperto');
    const campo = p.querySelector('.ag-cerca'), box = p.querySelector('.ag-risultati'), conto = p.querySelector('.ag-conto');
    const chiudi = async () => {
      p.remove(); document.body.classList.remove('ag-aperto'); document.removeEventListener('keydown', esc_, true);
      if (aggiunti) { await preparaListe(); await mostra(); } else scrollTo(0, yPrima);
      if (prima && prima.isConnected && prima.focus) prima.focus();
    };
    const esc_ = e => { if (e.key === 'Escape') { e.preventDefault(); chiudi(); } };
    document.addEventListener('keydown', esc_, true);
    p.querySelector('.ag-fatto').addEventListener('click', chiudi);
    await Promise.all(ORDINE.filter(c => !caricate.has(c)).map(caricaCategoria));
    p.querySelector('.ag-cat').innerHTML = `<option value="">Tutte le categorie</option>${ORDINE.map(c => `<option value="${esc(c)}">${esc(NOME[c] || c)}</option>`).join('')}`;
    const disegna = () => {
      const parole = semplice(testo).split(/\s+/).filter(Boolean);
      if (parole.join('').length < 2) { box.innerHTML = `<p class="st-nessuna">Scrivi almeno due lettere: un nome («panda»), un numero o un codice («VS329»), o il nome di una serie.</p>${avvisoRete()}`; return; }
      const trovati = [];
      for (const s of ordinate(SERIE.filter(x => !cat || x.c === cat))) {
        const base = semplice(s.t + ' ' + s.g + ' ' + s.d + ' ' + NOME[s.c]);
        for (const o of s.x) {
          const h = base + ' ' + semplice(o[1] + ' ' + o[2] + ' ' + (o[4] || ''));
          if (parole.every(w => h.includes(w))) trovati.push({ s, o, esatto: parole.length === 1 && (semplice(o[1]) === parole[0] || semplice(o[4] || '').split(/\s+/).includes(parole[0])) });
        }
      }
      trovati.sort((a, b) => b.esatto - a.esatto);
      if (!trovati.length) { box.innerHTML = '<p class="st-nessuna">Nessun oggetto trovato.</p>' + avvisoRete(); return; }
      box.innerHTML = `<p class="ag-quanti">${plurale(trovati.length, 'oggetto trovato', 'oggetti trovati')}</p><ul class="lista-mista">` + trovati.slice(0, quanti).map(({ s, o }) => {
        const [id, num, nm] = o, si = dentro.has(s.db + '|' + id);
        const numero = o[5] && o[5] !== 'Variante' && !String(num).includes(' - ') ? num + ' - ' + o[5] : num;
        return `<li class="lista-pezzo ag-pezzo${si ? ' dentro' : ''}"><button type="button" class="lp-foto" data-ag-db="${esc(s.db)}" data-ag="${esc(id)}" aria-pressed="${si}" aria-label="${esc((nm || numero) + ' · ' + s.t)}"><img src="${fotoDi(s, o)}" alt="" loading="lazy" decoding="async"><span class="ag-segno" aria-hidden="true">${si ? '✓' : '+'}</span></button>`
          + `<span class="lp-num">${esc(numero || nm || 'N°')}</span>${nm && numero ? `<span class="lp-nome">${esc(nm)}</span>` : ''}<span class="lp-serie" title="${esc(s.t)}">${esc(s.t.replace(/^.+? - /, ''))}</span></li>`;
      }).join('') + '</ul>' + (trovati.length > quanti ? `<p class="altre-serie"><button type="button" class="st-btn ag-altri">Mostra altri (ne restano ${trovati.length - quanti})</button></p>` : '');
    };
    let attesa;
    campo.addEventListener('input', () => { clearTimeout(attesa); attesa = setTimeout(() => { testo = campo.value; quanti = AGG_MAX; disegna(); }, 150); });
    campo.addEventListener('keydown', e => { if (e.key === 'Enter') campo.blur(); });
    p.querySelector('.ag-cat').addEventListener('change', e => { cat = e.target.value; quanti = AGG_MAX; disegna(); });
    box.addEventListener('click', async e => {
      if (e.target.closest('.ag-altri')) { quanti += AGG_MAX; disegna(); return; }
      const b = e.target.closest('[data-ag]');
      if (!b) return;
      const db = b.dataset.agDb, id = b.dataset.ag, k = db + '|' + id, si = !dentro.has(k);
      if (si && !(await ctListe.c_e_posto(l.nome))) return;
      try { await ctListe.metti(db, id, l.nome, si); } catch (err) { avviso('Salvataggio non riuscito.'); return; }
      si ? dentro.add(k) : dentro.delete(k);
      aggiunti++;
      b.closest('.lista-pezzo').classList.toggle('dentro', si); b.setAttribute('aria-pressed', String(si));
      b.querySelector('.ag-segno').textContent = si ? '✓' : '+';
      conto.textContent = plurale(dentro.size, 'oggetto', 'oggetti') + ' nella lista';
    });
    disegna();
    if (!('ontouchstart' in window)) campo.focus();
  }

  let menuModifica = null;
  const chiudiModifica = () => {
    if (!menuModifica) return;
    menuModifica.remove(); menuModifica = null;
    const b = app.querySelector('[data-modifica]'); if (b) b.setAttribute('aria-expanded', 'false');
  };
  document.addEventListener('pointerdown', e => { if (menuModifica && !menuModifica.contains(e.target) && !e.target.closest('[data-modifica]')) chiudiModifica(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') chiudiModifica(); });
  window.addEventListener('hashchange', chiudiModifica);

  function rinominaLista(nome) {
    const h = document.getElementById('lista-titolo'), conf = app.querySelector('.liste-conferma');
    const campo = document.createElement('input');
    campo.type = 'text'; campo.className = 'lp-campo lista-rinomina'; campo.maxLength = ctListe.MAX_NOME; campo.value = nome; campo.setAttribute('aria-label', 'Nuovo nome della lista');
    const salva = async () => {
      if (campo.dataset.fatto) return;
      const nuovo = campo.value.trim();
      if (!nuovo || ctListe.chiave(nuovo) === ctListe.chiave(nome) && nuovo === nome) { mostra(); return; }
      campo.dataset.fatto = '1';
      const v = await ctListe.rinomina(nome, nuovo);
      if (v.errore) { delete campo.dataset.fatto; conf.innerHTML = '<p class="liste-err">' + esc(v.errore) + '</p>'; conf.hidden = false; campo.focus(); return; }
      history.replaceState(null, '', indirizzoLista(v.nome)); mostra(); avviso('Lista rinominata in «' + v.nome + '».');
    };
    campo.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); salva(); } else if (ev.key === 'Escape') mostra(); });
    campo.addEventListener('blur', () => setTimeout(() => { if (campo.isConnected) salva(); }, 150));
    h.replaceWith(campo); campo.focus(); campo.select();
  }
  function chiediElimina(nome) {
    const conf = app.querySelector('.liste-conferma');
    conf.innerHTML = '<p>Eliminare la lista «' + esc(nome) + '»? Gli oggetti restano nelle loro serie, sparisce solo la lista.</p><div class="riga-bottoni"><button type="button" class="st-btn liste-si" data-elimina-si>Elimina</button><button type="button" class="st-btn" data-elimina-no>Annulla</button></div>';
    conf.hidden = false;
  }

  app.addEventListener('click', async e => {
    if (vista() !== 'liste' && vista() !== 'lista') return;
    const t = e.target;
    if (t.closest('[data-accedi-liste]')) { const b = document.getElementById('stAccedi'); if (b) b.click(); return; }
    if (!ctListe.puoi()) return;
    const nuova = t.closest('[data-nuova-lista]');
    if (nuova) {
      const box = nuova.parentElement, err = box.querySelector('.liste-err');
      const campo = document.createElement('input');
      campo.type = 'text'; campo.className = 'lp-campo'; campo.maxLength = ctListe.MAX_NOME; campo.placeholder = 'Nome della lista'; campo.autocomplete = 'off';
      campo.setAttribute('aria-label', 'Nome della nuova lista');
      const salva = () => {
        if (!campo.value.trim()) { mostra(); return; }
        const v = ctListe.crea(campo.value);
        if (v.errore) { err.textContent = v.errore; err.hidden = false; campo.focus(); return; }
        location.hash = indirizzoLista(v.nome);
      };
      const riga = document.createElement('div'); riga.className = 'liste-nuova-riga';
      const bSalva = document.createElement('button'); bSalva.type = 'button'; bSalva.className = 'lnr-salva'; bSalva.textContent = 'Salva';
      bSalva.addEventListener('mousedown', ev => ev.preventDefault());
      bSalva.addEventListener('click', salva);
      campo.addEventListener('keydown', ev => {
        if (ev.key === 'Escape') { mostra(); return; }
        if (ev.key !== 'Enter') return;
        ev.preventDefault(); salva();
      });
      campo.addEventListener('blur', () => { if (!campo.value.trim()) setTimeout(() => { if (campo.isConnected && !campo.value.trim()) mostra(); }, 150); });
      riga.append(campo, bSalva);
      nuova.replaceWith(riga);
      campo.focus();
      return;
    }
    const nome = listaAperta();
    if (t.closest('[data-aggiungi]')) { chiudiModifica(); pannelloAggiungi(nome); return; }
    if (t.closest('[data-modifica]')) {
      if (menuModifica) { chiudiModifica(); return; }
      const b = t.closest('[data-modifica]'), r = b.getBoundingClientRect();
      menuModifica = document.createElement('div');
      menuModifica.className = 'st-pin-menu'; menuModifica.setAttribute('role', 'menu');
      menuModifica.innerHTML = '<button type="button" role="menuitem" data-m="rinomina">Rinomina</button><button type="button" role="menuitem" class="lt-rosso" data-m="elimina">Elimina la lista</button>';
      document.body.append(menuModifica);
      const w = menuModifica.offsetWidth;
      menuModifica.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
      menuModifica.style.top = (r.bottom + 8) + 'px';
      b.setAttribute('aria-expanded', 'true');
      menuModifica.addEventListener('click', ev => {
        const m = ev.target.closest('[data-m]'); if (!m) return;
        chiudiModifica();
        m.dataset.m === 'rinomina' ? rinominaLista(nome) : chiediElimina(nome);
      });
      return;
    }
    const sp = t.closest('[data-spunta]');
    if (sp) {
      const li = sp.closest('.lista-pezzo'), on = !li.classList.contains('si');
      li.classList.toggle('si', on); sp.setAttribute('aria-pressed', String(on));
      contaLista();
      try { await ctListe.spunta(sp.dataset.spuntaDb, sp.dataset.spunta, nome, on); }
      catch (err) { li.classList.toggle('si', !on); sp.setAttribute('aria-pressed', String(!on)); contaLista(); avviso('Salvataggio non riuscito.'); }
      const l = LISTE_DATI.find(x => ctListe.uguale(x.nome, nome)), x = l && l.pezzi.find(y => y.db === sp.dataset.spuntaDb && y.id === sp.dataset.spunta);
      if (x) x.ok = on;
      return;
    }
    const pezzo = t.closest('[data-scheda]');
    if (pezzo) { schedaPezzo(pezzo.dataset.schedaDb, pezzo.dataset.scheda, nome); return; }
    if (t.closest('[data-elimina-no]')) { app.querySelector('.liste-conferma').hidden = true; return; }
    if (t.closest('[data-elimina-si]')) {
      await ctListe.elimina(nome);
      location.hash = '#/liste';
      avviso('Lista «' + nome + '» eliminata.');
    }
  });

  const accendi = () => app.querySelectorAll('.pen.owned .pic').forEach(pic => accendiBagliore(pic, pic.querySelector('.pen-img').src));

  const aperte = new Set();
  const FRECCIA = '<svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function unaRiga(ul) {
    ul.querySelectorAll(':scope > .altri').forEach(x => x.remove());
    const pezzi = [...ul.children];
    pezzi.forEach(li => { li.hidden = false; });
    const col = getComputedStyle(ul).gridTemplateColumns.split(' ').filter(c => /px$/.test(c)).length;
    if (!col || pezzi.length <= col) return;
    const aperta = aperte.has(ul.dataset.serie), resto = pezzi.length - (col - 1);
    if (!aperta) pezzi.slice(col - 1).forEach(li => { li.hidden = true; });
    const prossimo = pezzi[col - 1].querySelector('img.pen-img');
    ul.insertAdjacentHTML('beforeend', `<li class="pen altri${aperta ? ' aperta' : ''}" data-altri><button type="button" class="open" aria-expanded="${aperta}" aria-label="${aperta ? 'Chiudi la tendina' : 'Mostra altri ' + resto}">`
      + `<div class="pic">${aperta ? '' : `<img class="sfocata" src="${prossimo ? prossimo.src : ''}" alt="" aria-hidden="true" loading="lazy" decoding="async">`}<span class="bollo">${aperta ? '' : `<b>+${resto}</b>`}${FRECCIA}</span></div></button>`
      + `<div class="code" aria-hidden="true">${aperta ? 'Chiudi' : 'Apri'}</div></li>`);
  }
  const righe = () => app.querySelectorAll('ul.una-riga').forEach(unaRiga);
  let attesa;
  window.addEventListener('resize', () => { clearTimeout(attesa); attesa = setTimeout(righe, 120); });

  function filtra() {
    const parole = semplice(filtro).split(/\s+/).filter(Boolean);
    let viste = 0, tutte = 0;
    const totali = {};
    app.querySelectorAll('.r-serie').forEach(el => { totali[el.dataset.cat] = (totali[el.dataset.cat] || 0) + 1; });
    app.querySelectorAll('.r-serie, .pausa-serie').forEach(el => {
      const va = parole.every(w => el.dataset.nome.includes(w));
      const entro = parole.length ? true : !el.dataset.cat ? true : categoria === '' ? false : +el.dataset.pos < quanteMostro(el.dataset.cat);
      el.hidden = !(va && entro);
      if (el.classList.contains('r-serie')) { tutte++; if (va) viste++; }
    });
    app.querySelectorAll('.altre-serie').forEach(p => {
      const c = p.dataset.cat, resto = (totali[c] || 0) - quanteMostro(c);
      p.hidden = !!parole.length || resto <= 0;
      if (resto > 0) p.firstElementChild.textContent = 'Mostra altre ' + Math.min(resto, PER_VOLTA) + (resto > PER_VOLTA ? ' (ne restano ' + resto + ')' : '');
    });
    app.querySelectorAll('.cat-elenco').forEach(el => { el.hidden = !!parole.length; });
    const p = app.querySelector('details.pausa');
    if (p) { const v = p.querySelectorAll('.pausa-serie:not([hidden])').length; p.hidden = !v; if (parole.length && v) p.open = true; }
    const msg = app.querySelector('.nessuna-serie');
    if (msg) { msg.hidden = !(parole.length && tutte && !viste && !(p && !p.hidden)); msg.textContent = parole.length ? 'Nessuna serie con «' + filtro.trim() + '».' : ''; }
    righe();
  }

  const vista = () => { const v = location.hash.replace(/^#\/?/, ''); return v === 'doppioni' || v === 'cerca' || v === 'liste' ? v : /^lista\//.test(v) ? 'lista' : 'mancanti'; };
  const listaAperta = () => { try { return decodeURIComponent(location.hash.replace(/^#\/?lista\//, '')); } catch (e) { return location.hash.replace(/^#\/?lista\//, ''); } };
  async function prepara() {
    const v = vista(), tutte = !categoria && v === 'cerca';
    if (v === 'liste' || v === 'lista') { await preparaListe(); return; }
    const servono = new Set([...iniziate, ...(categoria ? [categoria] : []), ...(tutte ? ORDINE : [])]);
    const mancano = [...servono].filter(c => !caricate.has(c));
    if (mancano.length && !app.querySelector('header')) app.innerHTML = '<p class="st-nessuna" style="margin-top:40px">Un momento…</p>';
    await Promise.all(mancano.map(caricaCategoria));
    try { unisci(); } catch (e) {}
  }
  let giro = 0;
  async function mostra() {
    const mio = ++giro;
    await prepara();
    if (mio !== giro) return;
    const v = vista();
    if (v !== 'cerca') { const u = v === 'lista' ? 'liste' : v; try { localStorage.setItem('ct-collezione-ultima', u); } catch (e) {}
      const voce = document.querySelector('.st-barra a[data-voce="collezione"]'); if (voce) { const h = new URL(voce.href); h.hash = '#/' + u; voce.href = h.href; } }
    if (v === 'liste' || v === 'lista') { v === 'liste' ? pagListe() : pagLista(listaAperta()); accendi(); document.title = (v === 'lista' ? listaAperta() + ' · ' : '') + 'Liste · Collection Time'; return; }
    if (v === 'doppioni') doppioni(); else if (v === 'cerca') cerca(); else mancanti();
    if (v !== 'cerca') filtra();
    accendi();
    document.title = { mancanti: 'Mancanti', doppioni: 'Doppioni', cerca: 'Cerca' }[v] + (categoria ? ' · ' + NOME[categoria] : '') + ' · Collection Time';
  }
  function scriviIndirizzo() {
    const u = new URL(location.href);
    categoria ? u.searchParams.set('categoria', categoria) : u.searchParams.delete('categoria');
    history.replaceState(history.state, '', u);
  }
  const chiudiSchede = () => document.querySelectorAll('.lp-sfondo, .lp-pannello').forEach(x => x.remove());
  window.addEventListener('hashchange', () => { chiudiSchede(); filtro = ''; aperte.clear(); mostrate = {}; mostra(); scrollTo(0, 0); });
  ['ct-header', 'ct-accesso'].forEach(ev => window.addEventListener(ev, () => { if (vista() === 'liste' || vista() === 'lista') { if (ev === 'ct-accesso') chiudiSchede(); mostra(); } }));

  app.addEventListener('click', e => {
    if (e.target.closest('.cr-tutte-serie')) { tutteSerie = true; risultati(); return; }
    const altri = e.target.closest('.cr-altri');
    if (altri) { const c = altri.dataset.cat; aperti[c] = (aperti[c] || fila()) + PEZZI_ALTRI * fila(); risultati(); return; }
    const vai = e.target.closest('[data-vai-cat]');
    if (vai) { categoria = vai.dataset.vaiCat; gruppo = ''; filtro = ''; mostrate = {}; aperte.clear(); scriviIndirizzo(); barraInBasso(); mostra().then(() => scrollTo(0, 0)); return; }
    const piu = e.target.closest('[data-altre]');
    if (piu) { const c = piu.dataset.altre; mostrate[c] = quanteMostro(c) + PER_VOLTA; filtra(); accendi(); return; }
    const al = e.target.closest('[data-altri]');
    if (al) {
      const ul = al.closest('ul'), k = ul.dataset.serie, chiudo = aperte.has(k);
      chiudo ? aperte.delete(k) : aperte.add(k);
      unaRiga(ul);
      if (chiudo) { const sez = ul.closest('.r-serie'); if (sez && sez.getBoundingClientRect().top < 0) sez.scrollIntoView({ block: 'start' }); }
      else { const b = ul.querySelector(':scope > .altri .open'); if (b) b.blur(); }
      accendi();
      return;
    }
    if (e.target.closest('#apri-cerca-serie')) {
      const box = document.getElementById('cerca-serie'), campo = document.getElementById('filtro-serie');
      if (box.classList.contains('open') && !filtro) { box.classList.remove('open'); campo.tabIndex = -1; e.target.closest('button').setAttribute('aria-expanded', 'false'); }
      else if (box.classList.contains('open')) { filtro = campo.value = ''; filtra(); campo.focus(); }
      else { box.classList.add('open'); campo.tabIndex = 0; e.target.closest('button').setAttribute('aria-expanded', 'true'); campo.focus(); }
      return;
    }
    const p = e.target.closest('[data-pausa], [data-riprendi]');
    if (p) {
      const db = p.dataset.pausa || p.dataset.riprendi, ferma = !!p.dataset.pausa;
      const cambia = f => { f ? pausa.add(db) : pausa.delete(db); salvaPausa(); const y = scrollY; mostra().then(() => scrollTo(0, y)); };
      cambia(ferma);
      const s = SERIE.find(x => x.db === db.replace(/#estero$/, ''));
      if (ferma) avviso('«' + (s ? s.t + (db.endsWith('#estero') ? ' (ESTERO)' : '') : 'La serie') + '» spostata in «Non le cerco più»', () => cambia(false));
      return;
    }
    const el = e.target.closest('[data-ce], [data-piu], [data-meno]');
    if (!el) return;
    const id = el.dataset.ce || el.dataset.piu || el.dataset.meno;
    if (!serieDi[id]) return;
    if (el.dataset.ce) {
      e.preventDefault();
      if (!ce[id]) ce[id] = true;
      else { if (doppi[id]) avviso(doppi[id] === 1 ? 'Tolto anche il doppione.' : 'Tolti anche i ' + doppi[id] + ' doppioni.'); delete ce[id]; delete doppi[id]; }
    }
    else if (el.dataset.piu) { if (!ce[id]) avviso('Segnato anche «Ce l\'ho»: se hai un doppione, ce l\'hai.'); doppi[id] = (doppi[id] || 0) + 1; ce[id] = true; }
    else { doppi[id] = Math.max(0, (doppi[id] || 0) - 1); if (!doppi[id]) delete doppi[id]; }
    salva(id);
    (gemelli[id] || []).forEach(g => {
      if (ce[id]) ce[g] = true; else delete ce[g];
      if (doppi[id]) doppi[g] = doppi[id]; else delete doppi[g];
      salva(g);
    });
    const y = scrollY;
    if (document.getElementById('risultati')) risultati();
    else mostra().then(() => scrollTo(0, y));
  });
  app.addEventListener('input', e => { if (e.target.id === 'filtro-serie') { filtro = e.target.value; filtra(); } });
  app.addEventListener('keydown', e => {
    if (e.target.id === 'cerca' && e.key === 'Enter') e.target.blur();
    if (e.target.id !== 'filtro-serie') return;
    if (e.key === 'Escape') { filtro = e.target.value = ''; filtra(); }
    if (e.key === 'Enter') e.target.blur();
  });
  app.addEventListener('change', e => {
    if (e.target.id === 'gruppo') gruppo = e.target.value;
    else if (e.target.id === 'categoria') { categoria = e.target.value; gruppo = ''; filtro = ''; aperte.clear(); mostrate = {}; scriviIndirizzo(); barraInBasso(); }
    else return;
    mostra();
  });
  function barraInBasso() {
    const serie = document.querySelector('.st-barra a[data-voce="serie"]');
    if (serie) { serie.hidden = !categoria; if (categoria) serie.href = CAT.href + categoria + '/index.html'; }
    document.querySelectorAll('.st-barra a[data-voce="collezione"], .st-barra a[data-voce="cerca"]').forEach(a => {
      const u = new URL(a.href); categoria ? u.searchParams.set('categoria', categoria) : u.searchParams.delete('categoria'); a.href = u.href;
    });
  }

  function unisci() {
    const fatti = new Set();
    Object.keys(gemelli).forEach(id => {
      if (fatti.has(id)) return;
      const ids = [id, ...gemelli[id]]; ids.forEach(i => fatti.add(i));
      const c = ids.some(i => ce[i]), d = Math.max(...ids.map(i => doppi[i] || 0));
      ids.forEach(i => {
        const diverso = !!ce[i] !== c || (doppi[i] || 0) !== d;
        if (c) ce[i] = true; else delete ce[i];
        if (d) doppi[i] = d; else delete doppi[i];
        if (diverso) salva(i);
      });
    });
  }

  app.innerHTML = '<p class="st-nessuna" style="margin-top:40px">Un momento…</p>';
  (async () => {
    await elencoCategorie();
    const chiesta = parametri.get('categoria');
    if (chiesta && ORDINE.includes(chiesta)) categoria = chiesta;
    else if (chiesta) scriviIndirizzo();
    iniziate = await categorieIniziate();
    await mostra();
  })();
})();
