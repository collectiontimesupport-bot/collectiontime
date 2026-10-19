
(() => {
  const app = document.getElementById('raccolta');
  const SERIE = INDICE.serie;
  const ce = {}, doppi = {};
  const serieDi = {};
  SERIE.forEach(s => s.x.forEach(o => { serieDi[o[0]] = s; }));
  const gruppi = [...new Set(SERIE.map(s => s.g))].filter(Boolean);

  const gemelli = {};
  try {
    if (/\/catalogo\/kinder\//.test(location.pathname)) {
      const per = {};
      SERIE.forEach(s => s.x.forEach(o => { const c = /^\s*\d+\s*-\s*(.+)$/.exec(o[1] || ''); if (c) { const k = c[1].trim(); (per[k] = per[k] || []).push({ s, id: o[0] }); } }));
      Object.keys(per).forEach(k => {
        const l = per[k];
        if (l.length < 2 || new Set(l.map(x => x.s)).size !== l.length) return;
        l.forEach(x => { gemelli[x.id] = l.filter(y => y !== x).map(y => y.id); });
      });
    }
  } catch (e) {}
  const primo = id => { const g = gemelli[id]; return !g || SERIE.indexOf(serieDi[id]) < Math.min(...g.map(i => SERIE.indexOf(serieDi[i]))); };

  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const semplice = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const plurale = (n, uno, tanti) => n + ' ' + (n === 1 ? uno : tanti);
  const principali = s => s.x.filter(o => !paeseEstero(o[5]));
  const quante = s => principali(s).filter(o => ce[o[0]]).length;
  const doppiDi = s => s.x.reduce((t, o) => t + (primo(o[0]) ? (doppi[o[0]] || 0) : 0), 0);
  const fotoDi = (s, o) => '../' + s.p + '/' + o[3];
  const LENTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

  const apri = nome => new Promise((ok, ko) => {
    const r = indexedDB.open(nome, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('penne', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  async function leggiTutto() {
    const esistenti = indexedDB.databases ? new Set((await indexedDB.databases()).map(d => d.name)) : null;
    for (const s of SERIE) {
      if (esistenti && !esistenti.has(s.db)) continue;
      try {
        const db = await apri(s.db);
        const righe = await new Promise(ok => { const g = db.transaction('penne').objectStore('penne').getAll(); g.onsuccess = () => ok(g.result); g.onerror = () => ok([]); });
        righe.forEach(r => { if (r.owned === true || r.doppi > 0) ce[r.id] = true; if (r.doppi > 0) doppi[r.id] = r.doppi; });
        db.close();
      } catch (e) {  }
    }
  }
  async function salva(id) {
    try {
      const db = await apri(serieDi[id].db);
      const t = db.transaction('penne', 'readwrite'), st = t.objectStore('penne');
      const g = st.get(id);
      g.onsuccess = () => st.put(Object.assign(g.result || { tags: [], tagsTouched: false }, { id, owned: !!ce[id], doppi: doppi[id] || 0 }));
      t.oncomplete = () => { db.close(); segnalaModifica(); };
    } catch (e) { avviso('Salvataggio non riuscito.'); }
  }


  function oggetto(s, o) {
    const [id, num, nome] = o, si = !!ce[id], n = doppi[id] || 0;
    const numero = o[5] && !String(num).includes(' - ') ? num + ' - ' + o[5] : num;
    return `<li class="pen${si ? ' owned' : ''}">
      <button type="button" class="open" data-ce="${id}" aria-pressed="${si}" aria-label="Ce l'ho: ${esc(nome || numero)}"><div class="pic"><img class="pen-img" src="${fotoDi(s, o)}" alt="${esc(nome || numero)}"${s.nomi ? '' : ` title="${esc(nome)}"`} loading="lazy" decoding="async" draggable="false"><span class="spunta" aria-hidden="true"></span></div></button>
      ${s.nomi ? `<div class="nome"><span>${esc(nome)}</span></div>` : ''}
      <div class="code${numero ? '' : ' none'}">${esc(numero || 'N°')}</div>
      <div class="doppi${n ? ' si' : ''}"><span class="etichetta">Doppi</span><span class="conta"><button type="button" data-meno="${id}"${n ? '' : ' disabled'} aria-label="Un doppione in meno">−</button><span class="n">${n}</span><button type="button" data-piu="${id}" aria-label="Un doppione in più">+</button></span></div>
    </li>`;
  }
  function griglia(s, oggetti) {
    const stretta = s.pr >= 3;
    return `<div class="${esc(s.cl)}"><ul class="grid${stretta ? ' stretti' : ''}" style="--proporzione:${s.pr}; --pen-vh:${stretta ? 260 : 170}px; grid-template-columns: repeat(auto-fill, minmax(${stretta ? 56 : 110}px, 1fr))">${oggetti.map(o => oggetto(s, o)).join('')}</ul></div>`;
  }
  const titoloSerie = (s, extra, scambi) =>
    `<div class="serie-titolo"><h2><a href="../${s.p}/index.html">${esc(s.t)}</a></h2><small>${[s.g, s.d, extra].filter(Boolean).map(esc).join(' · ')}</small>`
    + (scambi ? `<a class="serie-scambi" href="../${s.p}/index.html#cerco-scambio">Cerco e scambio</a>` : '') + '</div>';
  const testa = (titolo, sotto, strumenti) => `<nav class="st-percorso" aria-label="Percorso"><a href="../index.html">${esc(INDICE.categoria)}</a><span class="sep" aria-hidden="true">&rsaquo;</span><span aria-current="page">${esc(titolo.charAt(0) + titolo.slice(1).toLowerCase())}</span></nav>
    <header><h1><span class="titolo-testo">${titolo}</span></h1>
    <div class="bar"><p class="sub">${sotto}</p><div class="tools">${strumenti || ''}</div></div></header>`;
  const menu = (id, voci, scelta, etichetta) =>
    `<select id="${id}" aria-label="${etichetta}">${voci.map(([k, t]) => `<option value="${esc(k)}"${k === scelta ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const menuGruppi = () => gruppi.length > 1 ? menu('gruppo', [['', 'Tutti i gruppi'], ...gruppi.map(g => [g, g])], gruppo, 'Gruppo') : '';
  const vuoto = testo => `<section class="empty"><p>${testo}</p><a class="st-btn" href="../index.html">Vai alle serie</a></section>`;


  const pausa = new Set((() => { try { return JSON.parse(localStorage.getItem('ct-pausa')) || []; } catch (e) { return []; } })());
  const salvaPausa = () => { try { localStorage.setItem('ct-pausa', JSON.stringify([...pausa])); } catch (e) {} };

  let soloIniziate = true, gruppo = '';
  function mancanti() {
    const tutte = SERIE.filter(s => (!gruppo || s.g === gruppo) && quante(s) < principali(s).length && (!soloIniziate || quante(s) > 0));
    const elenco = tutte.filter(s => !pausa.has(s.db));
    const ferme = tutte.filter(s => pausa.has(s.db));
    const manca = s => principali(s).length - quante(s);
    const tot = elenco.reduce((t, s) => t + manca(s), 0);
    app.innerHTML = testa('MI MANCANO', plurale(tot, 'oggetto', 'oggetti') + ' in ' + plurale(elenco.length, 'serie', 'serie'),
      menu('iniziate', [['1', 'Serie che ho iniziato'], ['0', 'Tutte le serie']], soloIniziate ? '1' : '0', 'Quali serie') + menuGruppi())
      + (elenco.map(s => { const m = principali(s).filter(o => !ce[o[0]]); return titoloSerie(s, m.length === 1 ? 'ne manca 1' : 'ne mancano ' + m.length, true) + griglia(s, m)
          + `<button type="button" class="non-cerco" data-pausa="${esc(s.db)}">Non la cerco più</button>`; }).join('')
        || (ferme.length ? '' : vuoto(soloIniziate ? 'Non hai ancora iniziato nessuna serie. Segna con "Ce l\'ho" quello che hai: qui vedrai cosa manca per completare le serie.' : 'Non ti manca niente!')))
      + (ferme.length ? `<details class="pausa"><summary>Non le cerco più (${ferme.length})</summary>`
          + ferme.map(s => `<div class="pausa-serie"><div><b>${esc(s.t)}</b><small>${[s.g, 'ne ' + (manca(s) === 1 ? 'manca 1' : 'mancano ' + manca(s))].filter(Boolean).map(esc).join(' · ')}</small></div><button type="button" class="st-btn" data-riprendi="${esc(s.db)}">Riprendi</button></div>`).join('')
          + '</details>' : '')
      + '<p class="hint" style="margin-top:28px">Premi su una foto per segnare che ce l\'hai. Con + e − conti i doppioni.</p>';
  }

  function doppioni() {
    const elenco = SERIE.filter(s => (!gruppo || s.g === gruppo) && doppiDi(s));
    const tot = elenco.reduce((t, s) => t + doppiDi(s), 0);
    app.innerHTML = testa('DOPPIONI', plurale(tot, 'doppione', 'doppioni') + (elenco.length ? ' in ' + plurale(elenco.length, 'serie', 'serie') : ''),
      menuGruppi())
      + (elenco.map(s => titoloSerie(s, '', true) + griglia(s, s.x.filter(o => doppi[o[0]] && primo(o[0])))).join('')
        || vuoto('Nessun doppione. Hai qualcosa in più? Premi + sotto la foto, nella pagina della serie.'));
  }

  let testoCerca = '';
  function cerca() {
    app.innerHTML = testa('CERCA', 'Nome, numero, codice o serie', '')
      + `<div class="cerca-aperta st-cerca open">${LENTE}<input type="search" id="cerca" placeholder="Cerca in ${esc(INDICE.categoria)}" value="${esc(testoCerca)}" autocomplete="off"></div><div id="risultati"></div>`;
    const campo = document.getElementById('cerca');
    campo.oninput = () => { testoCerca = campo.value; risultati(); };
    risultati();
    campo.focus();
  }
  function risultati() {
    const box = document.getElementById('risultati');
    const parole = semplice(testoCerca).split(/\s+/).filter(Boolean);
    if (parole.join('').length < 2) { box.innerHTML = '<p class="st-nessuna">Scrivi almeno due lettere.</p>'; return; }
    const va = t => { const h = semplice(t); return parole.every(w => h.includes(w)); };
    const serie = SERIE.filter(s => va(s.t + ' ' + s.g + ' ' + s.d));
    const oggetti = SERIE.filter(s => !serie.includes(s)).map(s => [s, s.x.filter(o => va(o[1] + ' ' + o[2] + ' ' + o[4] + ' ' + s.t + ' ' + s.d))]).filter(([, os]) => os.length);
    box.innerHTML = (serie.length ? `<ul class="st-cards">${serie.slice(0, 24).map(s => `<li><a class="st-card" href="../${s.p}/index.html">${s.cop ? `<div class="thumb"><img src="../${s.cop}" alt="" loading="lazy"></div>` : ''}<h2>${esc(s.t)}</h2><p>${esc([s.g, s.d].filter(Boolean).join(' · '))}</p><p class="avanz">${quante(s)} su ${s.x.length}</p><span class="st-apri">Apri</span></a></li>`).join('')}</ul>` : '')
      + oggetti.slice(0, 30).map(([s, os]) => titoloSerie(s) + griglia(s, os)).join('')
      || '<p class="st-nessuna">Nessun risultato.</p>';
    accendi();
  }

  const accendi = () => app.querySelectorAll('.pen.owned .pic').forEach(pic => accendiBagliore(pic, pic.querySelector('.pen-img').src));
  function mostra() {
    const v = location.hash.replace(/^#\/?/, '');
    if (v === 'doppioni') doppioni(); else if (v === 'cerca') cerca(); else mancanti();
    accendi();
  }
  window.addEventListener('hashchange', () => { mostra(); scrollTo(0, 0); });

  app.addEventListener('click', e => {
    const p = e.target.closest('[data-pausa], [data-riprendi]');
    if (p) {
      const db = p.dataset.pausa || p.dataset.riprendi, ferma = !!p.dataset.pausa;
      const cambia = f => { f ? pausa.add(db) : pausa.delete(db); salvaPausa(); const y = scrollY; mostra(); scrollTo(0, y); };
      cambia(ferma);
      const nome = (SERIE.find(s => s.db === db) || {}).t || 'La serie';
      if (ferma) avviso('«' + nome + '» spostata in «Non le cerco più»', () => cambia(false));
      return;
    }
    const el = e.target.closest('[data-ce], [data-piu], [data-meno]');
    if (!el) return;
    const id = el.dataset.ce || el.dataset.piu || el.dataset.meno;
    if (el.dataset.ce) {
      e.preventDefault();
      if (!ce[id]) ce[id] = true;
      else {
        if (doppi[id]) avviso(doppi[id] === 1 ? 'Tolto anche il doppione.' : 'Tolti anche i ' + doppi[id] + ' doppioni.');
        delete ce[id]; delete doppi[id];
      }
    }
    else if (el.dataset.piu) {
      if (!ce[id]) avviso('Segnato anche «Ce l\'ho»: se hai un doppione, ce l\'hai.');
      doppi[id] = (doppi[id] || 0) + 1; ce[id] = true;
    }
    else { doppi[id] = Math.max(0, (doppi[id] || 0) - 1); if (!doppi[id]) delete doppi[id]; }
    salva(id);
    (gemelli[id] || []).forEach(g => {
      if (ce[id]) ce[g] = true; else delete ce[g];
      if (doppi[id]) doppi[g] = doppi[id]; else delete doppi[g];
      salva(g);
    });
    const y = scrollY;
    if (document.getElementById('risultati')) risultati(); else mostra();
    scrollTo(0, y);
  });
  app.addEventListener('change', e => {
    if (e.target.id === 'iniziate') soloIniziate = e.target.value === '1';
    else if (e.target.id === 'gruppo') gruppo = e.target.value;
    else return;
    mostra();
  });

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
  leggiTutto().then(() => { try { unisci(); } catch (e) {} }).finally(mostra);
})();
