/* =====================================================================
   raccolta.js — "Mi mancano", "Doppioni" e "Cerca" di una categoria
   (Collection Time)
   ---------------------------------------------------------------------
   UN SOLO FILE per tutte le categorie. Ogni categoria ha la sua pagina
   <categoria>/la-mia-collezione/index.html, che carica:
     indice.js    → INDICE: tutte le serie della categoria (creato in automatico)
     script.js    → banda in alto e in basso, barra in basso, avvisi
     bagliore.js  → il bagliore delle cose che hai
     raccolta.js  → questo file
   La parte dopo # nell'indirizzo sceglie cosa mostrare:
     #/mancanti   quelle che mancano (di base: solo nelle serie iniziate)
     #/doppioni   i doppioni, con la lista da copiare per gli scambi
     #/cerca      cerca in tutta la categoria (nome, numero, codice, serie)
   "Ce l'ho" e i doppioni sono gli STESSI delle pagine delle serie:
   ogni serie li salva nel browser nel suo archivio (INDICE → db), con
   una riga per oggetto { id, owned, doppi, tags, tagsTouched }.
   L'aspetto è in comune/collezione.css (sezione 11) e nello stile.css
   della categoria (colore e carattere del titolo).
   ===================================================================== */

(() => {
  const app = document.getElementById('raccolta');
  const SERIE = INDICE.serie;
  const ce = {}, doppi = {};             // id → true se ce l'hai · id → quanti doppioni
  const serieDi = {};                    // id → la sua serie
  SERIE.forEach(s => s.x.forEach(o => { serieDi[o[0]] = s; }));
  const gruppi = [...new Set(SERIE.map(s => s.g))].filter(Boolean);

  /* ---------- aiuti ---------- */
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const semplice = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');   // senza accenti
  const plurale = (n, uno, tanti) => n + ' ' + (n === 1 ? uno : tanti);
  const quante = s => s.x.filter(o => ce[o[0]]).length;
  const doppiDi = s => s.x.reduce((t, o) => t + (doppi[o[0]] || 0), 0);
  const fotoDi = (s, o) => '../' + s.p + '/' + o[3];
  const LENTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

  /* ---------- archivio del browser (lo stesso delle pagine delle serie) ---------- */
  const apri = nome => new Promise((ok, ko) => {
    const r = indexedDB.open(nome, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('penne', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  async function leggiTutto() {
    /* apro solo gli archivi che esistono già (le serie mai aperte non hanno niente di segnato) */
    const esistenti = indexedDB.databases ? new Set((await indexedDB.databases()).map(d => d.name)) : null;
    for (const s of SERIE) {
      if (esistenti && !esistenti.has(s.db)) continue;
      try {
        const db = await apri(s.db);
        const righe = await new Promise(ok => { const g = db.transaction('penne').objectStore('penne').getAll(); g.onsuccess = () => ok(g.result); g.onerror = () => ok([]); });
        righe.forEach(r => { if (r.owned === true || r.doppi > 0) ce[r.id] = true; if (r.doppi > 0) doppi[r.id] = r.doppi; });
        db.close();
      } catch (e) { /* archivio non leggibile: la serie resta "non iniziata" */ }
    }
  }
  /* salva "Ce l'ho" e doppioni di un oggetto nell'archivio della sua serie (gli hashtag restano com'erano) */
  async function salva(id) {
    try {
      const db = await apri(serieDi[id].db);
      const t = db.transaction('penne', 'readwrite'), st = t.objectStore('penne');
      const g = st.get(id);
      g.onsuccess = () => st.put(Object.assign(g.result || { tags: [], tagsTouched: false }, { id, owned: !!ce[id], doppi: doppi[id] || 0 }));
      t.oncomplete = () => { db.close(); segnalaModifica(); };   // se hai fatto l'accesso, aggiorna anche il cloud (script.js)
    } catch (e) { avviso('Salvataggio non riuscito.'); }
  }

  /* ---------- pezzi di pagina ---------- */

  /* un oggetto, fatto come nelle pagine delle serie (stesse classi di comune/collezione.css) */
  function oggetto(s, o) {
    const [id, numero, nome] = o, si = !!ce[id], n = doppi[id] || 0;
    return `<li class="pen${si ? ' owned' : ''}">
      <button type="button" class="open" data-ce="${id}" aria-pressed="${si}" aria-label="Ce l'ho: ${esc(nome || numero)}"><div class="pic"><img class="pen-img" src="${fotoDi(s, o)}" alt="${esc(nome || numero)}"${s.nomi ? '' : ` title="${esc(nome)}"`} loading="lazy" decoding="async" draggable="false"></div></button>
      ${s.nomi ? `<div class="nome"><span>${esc(nome)}</span></div>` : ''}
      <div class="code${numero ? '' : ' none'}">${esc(numero || 'N°')}</div>
      <div class="row"><label class="have"><input type="checkbox" data-ce="${id}"${si ? ' checked' : ''}><span class="have-text">Ce l'ho</span></label></div>
      <div class="doppi${n ? ' si' : ''}"><span class="etichetta">Doppi</span><span class="conta"><button type="button" data-meno="${id}"${n ? '' : ' disabled'} aria-label="Un doppione in meno">−</button><span class="n">${n}</span><button type="button" data-piu="${id}" aria-label="Un doppione in più">+</button></span></div>
    </li>`;
  }
  /* griglia di una serie: penne strette (proporzione alta, es. Legami) più fitte, sorpresine più larghe */
  function griglia(s, oggetti) {
    const stretta = s.pr >= 3;
    return `<div class="${esc(s.cl)}"><ul class="grid" style="--proporzione:${s.pr}; --pen-vh:${stretta ? 260 : 170}px; grid-template-columns: repeat(auto-fill, minmax(${stretta ? 56 : 110}px, 1fr))">${oggetti.map(o => oggetto(s, o)).join('')}</ul></div>`;
  }
  /* titolo di una serie, con il link alla sua pagina */
  const titoloSerie = (s, extra) =>
    `<div class="serie-titolo"><h2><a href="../${s.p}/index.html">${esc(s.t)}</a></h2><small>${[s.g, s.d, extra].filter(Boolean).map(esc).join(' · ')}</small></div>`;
  /* intestazione: link alla categoria, titolo, conteggio e strumenti */
  const testa = (titolo, sotto, strumenti) => `<a class="st-back" href="../index.html">&larr; ${esc(INDICE.categoria)}</a>
    <header><h1><span class="titolo-testo">${titolo}</span></h1>
    <div class="bar"><p class="sub">${sotto}</p><div class="tools">${strumenti || ''}</div></div></header>`;
  const menu = (id, voci, scelta, etichetta) =>
    `<select id="${id}" aria-label="${etichetta}">${voci.map(([k, t]) => `<option value="${esc(k)}"${k === scelta ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const menuGruppi = () => gruppi.length > 1 ? menu('gruppo', [['', 'Tutti i gruppi'], ...gruppi.map(g => [g, g])], gruppo, 'Gruppo') : '';
  const vuoto = testo => `<section class="empty"><p>${testo}</p><a class="st-btn" href="../index.html">Vai alle serie</a></section>`;

  /* ---------- le tre pagine ---------- */

  /* MI MANCANO: per ogni serie, gli oggetti che non hai */
  let soloIniziate = true, gruppo = '';
  function mancanti() {
    const elenco = SERIE.filter(s => (!gruppo || s.g === gruppo) && quante(s) < s.x.length && (!soloIniziate || quante(s) > 0));
    const tot = elenco.reduce((t, s) => t + s.x.length - quante(s), 0);
    app.innerHTML = testa('MI MANCANO', plurale(tot, 'oggetto', 'oggetti') + ' in ' + plurale(elenco.length, 'serie', 'serie'),
      menu('iniziate', [['1', 'Serie che ho iniziato'], ['0', 'Tutte le serie']], soloIniziate ? '1' : '0', 'Quali serie') + menuGruppi())
      + (elenco.map(s => { const m = s.x.filter(o => !ce[o[0]]); return titoloSerie(s, m.length === 1 ? 'ne manca 1' : 'ne mancano ' + m.length) + griglia(s, m); }).join('')
        || vuoto(soloIniziate ? 'Non hai ancora iniziato nessuna serie. Segna con "Ce l\'ho" quello che hai: qui vedrai cosa manca per completare le serie.' : 'Non ti manca niente!'))
      + '<p class="hint" style="margin-top:28px">Premi su una foto per segnare che ce l\'hai. Con + e − conti i doppioni.</p>';
  }

  /* DOPPIONI: quelli segnati con +, con la lista da copiare */
  function doppioni() {
    const elenco = SERIE.filter(s => (!gruppo || s.g === gruppo) && doppiDi(s));
    const tot = elenco.reduce((t, s) => t + doppiDi(s), 0);
    app.innerHTML = testa('DOPPIONI', plurale(tot, 'doppione', 'doppioni') + (elenco.length ? ' in ' + plurale(elenco.length, 'serie', 'serie') : ''),
      menuGruppi() + (tot ? '<button type="button" class="btn primary" id="copia">Copia la lista per gli scambi</button>' : ''))
      + (elenco.map(s => titoloSerie(s) + griglia(s, s.x.filter(o => doppi[o[0]]))).join('')
        || vuoto('Nessun doppione. Hai qualcosa in più? Premi + sotto la foto, nella pagina della serie.'));
    const b = document.getElementById('copia');
    if (b) b.onclick = () => {
      const righe = elenco.map(s => s.t + (s.d ? ' (' + s.d + ')' : '') + ': ' + s.x.filter(o => doppi[o[0]])
        .map(o => [o[1], o[2]].filter(Boolean).join(' ') + (doppi[o[0]] > 1 ? ' ×' + doppi[o[0]] : '')).join(', '));
      navigator.clipboard.writeText('I miei doppioni · ' + INDICE.categoria + ' · Collection Time\n\n' + righe.join('\n'))
        .then(() => avviso('Lista copiata: incollala in un messaggio.'), () => avviso('Non riesco a copiare la lista.'));
    };
  }

  /* CERCA: in tutta la categoria */
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

  /* ---------- disegno e clic ---------- */
  const accendi = () => app.querySelectorAll('.pen.owned .pic').forEach(pic => accendiBagliore(pic, pic.querySelector('.pen-img').src));
  function mostra() {
    const v = location.hash.replace(/^#\/?/, '');
    if (v === 'doppioni') doppioni(); else if (v === 'cerca') cerca(); else mancanti();
    accendi();
  }
  window.addEventListener('hashchange', () => { mostra(); scrollTo(0, 0); });

  app.addEventListener('click', e => {
    const el = e.target.closest('[data-ce], [data-piu], [data-meno]');
    if (!el) return;
    const id = el.dataset.ce || el.dataset.piu || el.dataset.meno;
    /* come nelle pagine delle serie: togliendo "Ce l'ho" spariscono i doppioni,
       aggiungendo un doppione si segna anche "Ce l'ho" */
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
    const y = scrollY;
    if (document.getElementById('risultati')) risultati(); else mostra();   // in "Cerca" non perdo il testo scritto
    scrollTo(0, y);
  });
  app.addEventListener('change', e => {
    if (e.target.id === 'iniziate') soloIniziate = e.target.value === '1';
    else if (e.target.id === 'gruppo') gruppo = e.target.value;
    else return;
    mostra();
  });

  /* avvio: leggo "Ce l'ho" e doppioni dal browser, poi disegno */
  leggiTutto().finally(mostra);
})();
