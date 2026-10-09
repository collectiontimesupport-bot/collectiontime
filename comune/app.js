/* =====================================================================
   app.js — pagine delle collezioni (Collection Time)
   ---------------------------------------------------------------------
   UN SOLO FILE per tutte le collezioni (penne, lampade, minifigure…):
   ogni pagina lo richiama con  <script src="../../../comune/app.js?v=…"> (una serie sta in catalogo/<categoria>/<serie>/).
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
     · immagine da condividere (anche "Cerco e scambio")
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
  /* grandezza scelta nel CONFIG ("altezza" delle foto, in pixel): larghezza della griglia
     e colonne sui telefoni le calcola comune/collezione.css (classe "su-misura").
     Oggetti stretti (proporzione 4 o più, le penne): classe "stretti", più vicini. */
  if (CONFIG.altezza) {
    document.documentElement.style.setProperty('--altezza', CONFIG.altezza + 'px');
    grid.classList.add('su-misura');
  }
  if ((CONFIG.proporzione || 7) >= 4) grid.classList.add('stretti');

  /* ---------- elenco (da ELENCO, nell'HTML) ----------
     Trasformo le righe scritte nell'HTML (campi in italiano) nel formato
     usato dal resto del programma. L'ordine dell'elenco = ordine sulla pagina. */

  /* Sagoma grigia mostrata al posto degli oggetti senza foto (solo Legami ce l'ha). */
  const SLOT_IMG = 'immagini/slot-vuoto.webp';

  const escHtml = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const idVisti = new Set();
  const SEED = ELENCO.map((r, i) => {
    /* se manca l'id lo ricavo dal nome del file della foto (es. "penna-96-riccio") */
    const id = r.id || ('penna-' + String(r.foto || i).split('/').pop().replace(/\.[a-z]+$/i, ''));
    if (idVisti.has(id)) console.warn('ELENCO: l\'id "' + id + '" è usato due volte. Cambiane uno!');
    idVisti.add(id);
    /* paese = "variante estera": pezzo uscito solo in quel paese (es. paese: "USA"). Per chi NON è in quel paese
       sta sotto "Varianti estere" e non conta per completare la serie (vedi comune/../script.js, voce 14).
       Il paese compare accanto al numero ("01 - USA") e nelle Info ("Uscito solo in USA"). */
    const paese = r.paese || '';
    const numero = r.numero || '';
    const infoPaese = paese && !/uscit[oa] solo/i.test(r.info || '') ? (r.info ? '. ' : '') + 'Uscito solo ' + (/^estero$/i.test(paese) ? 'all\'estero' : 'in ' + paese) : '';   /* frase "Uscito solo in …" delle varianti estere */
    return {
      id,
      pos: i,                                  /* posizione = ordine nell'elenco */
      code: paese && numero && !numero.includes(' - ') ? numero + ' - ' + paese : numero,
      paese,
      estero: paeseEstero(paese),              /* true = variante estera per chi guarda (paeseEstero è in script.js) */
      codice: r.codice || '',
      senzaCodice: !!r.senzaCodice,              /* true = nei Dettagli di questo pezzo il campo Codice non si vede (si toglie la spunta da Modifica una serie → ✎ Editor) */
      name: r.nome || '',
      colorName: r.colore || '',
      colorHex: r.hex || '',
      /* testo con formato (colori, carattere, grandezza) scritto dall'Editor dell'area amministratore: richNumero / richNome / richInfo.
         Se manca si usa il testo semplice (numero / nome / info). L'HTML lo prepara l'Editor (solo span, b, i, u): non scriverlo a mano. */
      richNumero: r.richNumero || '', richNome: r.richNome || '',
      richInfo: r.richInfo ? r.richInfo + (infoPaese ? escHtml(infoPaese) : '') : '',
      limited: !!r.limitata,
      tags: Array.isArray(r.hashtag) ? r.hashtag.slice() : [],
      info: (r.info || '') + infoPaese,   /* testo fisso "Info": si cambia solo nell'HTML */
      image: r.foto || '',                     /* percorso della foto, es. "immagini/01.webp" */
      fotoInfo: Array.isArray(r.fotoInfo) ? r.fotoInfo.filter(Boolean) : []   /* foto extra nelle Info (si scorrono): fotoInfo: ["immagini/01-b.webp", ...] */
    };
  });

  /* campo "Colore" (pallino + nome) nei Dettagli: lo mostro SOLO per i pezzi che hanno un colore (colore: "Blu", hex: "#2c357e" nell'ELENCO),
     così in una serie di 10 oggetti con una sola penna il colore compare solo nella penna. Si assegna da Modifica una serie → ✎ Editor.
     La pagina non ha bisogno di nessun codice in più: il campo lo creo io (se la pagina ce l'ha già scritto, lo riuso). */
  const campoColore = (() => {
    const c = document.createElement('div'); c.className = 'field';
    c.innerHTML = 'Colore<div class="colorbox"><span class="dot" id="colorDot"></span><input type="text" id="fColorName" readonly tabindex="-1" aria-label="Colore"></div>';
    const vecchio = document.getElementById('colorDot'); if (vecchio) vecchio.closest('.field').remove();   /* campo scritto a mano in pagine più vecchie */
    return c;
  })();

  /* ---------- stato della pagina ---------- */
  let db = null;           /* archivio del browser (IndexedDB) */
  let pens = [];           /* tutti gli oggetti, con le spunte e gli hashtag di chi guarda */
  let filterMode = 'all';  /* filtro scelto: all / owned / missing / doppi */
  /* ordine: 1 = dalla prima, -1 = dall'ultima.
     La scelta resta salvata SOLO su questo dispositivo (localStorage), non nel cloud,
     e vale SOLO per questa pagina: ogni serie, lista e categoria ricorda il suo ordine
     (chiave "ct-ordine:" + indirizzo della pagina). */
  const CHIAVE_ORDINE = 'ct-ordine:' + location.pathname.replace(/index\.html$/, '');
  let sortDir = 1;
  try { if (localStorage.getItem(CHIAVE_ORDINE) === 'desc') sortDir = -1; localStorage.removeItem('ct-ordine'); } catch (e) {}   // "ct-ordine" = vecchia scelta unica per tutte le pagine: tolta
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
  /* tutto il testo in cui cercare per un oggetto (numero, codice, nome, info, colore, hashtag) */
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
        : filterMode === 'missing' ? (!p.owned && p.image && !p.estero)      /* le varianti estere non mancano per completare la serie */
        : filterMode === 'doppi' ? p.doppi > 0
        : true)
      .filter(p => { if (!terms.length) return true; const hay = searchText(p); return terms.every(t => hay.includes(t)); })
      .sort((a, b) => sortDir * byPos(a, b));
  }

  /* ---------- disegno della pagina ---------- */
  /* scrive "12 possedute su 103 · 3 doppioni" (gli oggetti senza foto non contano),
     riempie la barra ambra sotto e mette i numeri nella tendina: "Tutte (103)", "In possesso (12)"… */
  let barra = null;
  function updateCount(shown) {
    /* il conteggio e la barra contano solo i pezzi della serie: le varianti estere (p.estero) restano fuori */
    const base = pens.filter(p => !p.estero);
    const owned = base.filter(p => p.owned).length;
    const total = base.filter(p => p.image || p.owned).length;
    const doppi = pens.reduce((t, p) => t + p.doppi, 0);
    let t = owned + ' ' + CONFIG.possedute + ' su ' + total;
    if (doppi) t += ' · ' + doppi + (doppi === 1 ? ' doppione' : ' doppioni');
    if (typeof shown === 'number' && shown !== pens.length) t += ' · ' + shown + (shown === 1 ? ' visibile' : ' visibili');
    $('count').textContent = t;
    const estere = grid.querySelector('.estere-titolo small');   /* "2 su 5" accanto a "Varianti estere": si aggiorna quando spunti */
    if (estere) estere.textContent = testoEstere();
    /* barra di avanzamento (la creo la prima volta, subito sotto il conteggio) */
    if (!barra) {
      barra = document.createElement('div');
      barra.className = 'avanz-barra';
      barra.setAttribute('role', 'progressbar');
      barra.setAttribute('aria-label', 'Quanto hai completato');
      barra.append(document.createElement('span'));
      $('count').after(barra);
    }
    const perc = total ? Math.round(owned / total * 100) : 0;
    barra.firstChild.style.width = perc + '%';
    barra.setAttribute('aria-valuenow', String(perc));
    /* numeri tra parentesi nelle voci della tendina (il testo di base resta quello scritto nella pagina) */
    const quanti = { all: pens.length, owned, missing: pens.filter(p => !p.owned && p.image && !p.estero).length, doppi: pens.filter(p => p.doppi > 0).length };
    [...$('filter').options].forEach(o => {
      if (!o.dataset.testo) o.dataset.testo = o.textContent;
      if (o.value in quanti) o.textContent = o.dataset.testo + ' (' + quanti[o.value] + ')';
    });
  }

  /* riga sotto il titolo: "2026 · 25 sorpresine" (l'anno solo se è uguale per tutti gli oggetti) */
  const PLURALI_UGUALI = ['auto', 'box', 'charm', 'gadget', 'minifigure', 'peluche', 'photocard', 'portachiavi', 'poster', 'set', 'tote bag'];
  function plurale(nome) {
    const n = String(nome || '').trim();
    if (CONFIG.plurale) return CONFIG.plurale;              /* se serve, nel CONFIG: plurale: "…" */
    if (!n || PLURALI_UGUALI.includes(n) || /[^aeiou]$/i.test(n)) return n;
    if (/io$/.test(n)) return n.slice(0, -1);             /* personaggio → personaggi */
    if (/[cg]o$/.test(n)) return n.slice(0, -1) + 'hi';   /* gioco → giochi */
    if (/[cg]a$/.test(n)) return n.slice(0, -1) + 'he';
    if (/a$/.test(n)) return n.slice(0, -1) + 'e';        /* sorpresina → sorpresine */
    return n.slice(0, -1) + 'i';                          /* libro → libri, pallone → palloni */
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

  /* ---------- descrizione della serie, in fondo alla pagina (per Google e per chi arriva) ----------
     La scrive da sola dai dati: "La checklist completa delle 25 sorpresine di «One Piece»
     (Kinder Joy, 2026), con foto, nome e codice di ognuna (da VS326 a VS513A)."
     Se ci sono abbastanza collezionisti aggiunge: "12 collezionisti la stanno completando
     su Collection Time: inizia anche tu!". Il numero arriva da comune/collezionisti.json,
     che l'area amministratore riscrive ogni volta che apri "Statistiche" (contano solo
     le persone con l'account). Sotto MINIMO_COLLEZIONISTI la frase non compare. */
  const MINIMO_COLLEZIONISTI = 3;
  const RADICE = new URL('../', document.currentScript.src);   /* cartella principale del sito (app.js è in comune/) */
  function descrizione() {
    const fondo = document.querySelector('.wrap > footer');
    if (!fondo || !SEED.length) return;
    const gruppo = document.querySelector('.st-percorso a:last-of-type, a.st-back');
    const nomeGruppo = gruppo ? gruppo.textContent.replace(/^\s*\u2190\s*/, '').trim() : '';
    const anni = new Set(SEED.map(x => x.codice));
    const anno = anni.size === 1 && /^(19|20)\d\d$/.test(SEED[0].codice) ? SEED[0].codice : '';
    const principali = SEED.filter(x => !x.estero);           /* la descrizione parla solo dei pezzi della serie, non delle varianti estere */
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
    /* Ringraziamento (facoltativo): «Grazie a Giovanni per le foto.» sotto la descrizione.
       Si accende dall'area amministratore (Modifica una serie → Ringraziamento) e di base è SPENTO:
       CONFIG.grazieAcceso (true/false; se manca = spento) e CONFIG.grazieNome (chi ringraziare, anche più nomi: "Giovanni e Marco"). */
    if (CONFIG.grazieAcceso && String(CONFIG.grazieNome || '').trim()) {
      const g = document.createElement('p');
      g.className = 'descr-grazie';
      g.textContent = 'Grazie a ' + String(CONFIG.grazieNome).trim() + ' per le foto.';
      sec.append(g);
    }
    /* Tasto "Segnala un problema" (solo contorno ambra, discreto): apre un'email già scritta con il nome della serie, così chi trova un errore
       (foto, nome, numero…) te lo dice subito. L'indirizzo è composto qui per non stare in chiaro nella pagina (meno spam).
       Il testo del tasto si traduce in comune/lingua-en.js; l'email arriva sempre in italiano. */
    const segnala = document.createElement('a');
    segnala.className = 'btn segnala';
    segnala.textContent = 'Segnala un problema';
    segnala.href = 'mailto:' + 'collectiontime.support' + '@' + 'gmail.com'
      + '?subject=' + encodeURIComponent('Segnalazione · ' + CONFIG.titolo)
      + '&body=' + encodeURIComponent('Ciao! Ho trovato un problema nella serie «' + CONFIG.titolo + '» (' + location.href + ').\n\nCosa non va (foto, nome, numero…):\n');
    sec.append(segnala);
    fondo.before(sec);
    fetch(new URL('comune/collezionisti.json', RADICE)).then(r => r.ok ? r.json() : null).then(d => {
      const n = d && d.serie && d.serie[CONFIG.dbName];
      if (!n || n < MINIMO_COLLEZIONISTI) return;
      const b = document.createElement('p');
      b.className = 'descr-conta';
      b.textContent = n + ' collezionisti la stanno completando su Collection Time: inizia anche tu!';
      segnala.before(b);                                  /* la frase dei collezionisti sta sopra il tasto */
    }).catch(() => {});
  }
  descrizione();

  /* ---------- bagliore ----------
     L'alone arancio-giallo delle cose che hai è calcolato in comune/bagliore.js
     (uguale anche in "Mi mancano / Doppioni / Cerca"): qui basta chiamarlo. */
  const ensureHalo = (pic, p) => accendiBagliore(pic, p.image);

  /* segna / toglie "Ce l'ho" e aggiorna solo la scheda interessata */
  function setOwned(p, value) {
    p.owned = value;
    const aveviDoppi = !value && p.doppi > 0;
    if (aveviDoppi) say(p.doppi === 1 ? 'Tolto anche il doppione.' : 'Tolti anche i ' + p.doppi + ' doppioni.');
    if (!value) p.doppi = 0;                /* non ce l'hai più: niente doppioni */
    savePen(p);
    if (filterMode !== 'all') render();
    else {
      const li = grid.querySelector('[data-id="' + p.id + '"]');
      if (li) {
        li.classList.toggle('owned', value);
        if (value) ensureHalo(li.querySelector('.pic'), p);
        li.querySelector('.open').setAttribute('aria-pressed', String(value));
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
      if (p.doppi && !p.owned) {            /* un doppione vuol dire che ce l'hai: segno anche "Ce l'ho" */
        say('Segnato anche «Ce l\'ho»: se hai un doppione, ce l\'hai.');
        mostra(); return setOwned(p, true);
      }
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
         <button class="open"> <div class="pic"> [bagliore] <img class="pen-img"> <span class="spunta"> </div> </button>
         [<div class="nome">Nome</div>]   ← solo se CONFIG.mostraNomi
         <button class="edit">info</button>   ← pulsante "info" dei dettagli: sotto la foto (e sotto il nome, se c'è)
         <div class="code">01</div>
         <div class="doppi"> Doppi − 0 + </div>   ← solo per gli oggetti con la foto
       </li>
     "Ce l'ho" si segna premendo la foto: la tesserina .spunta in alto a destra
     è vuota se ti manca, ambra con la spunta (come il logo) se ce l'hai.
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
      const spunta = document.createElement('span');   /* tesserina "Ce l'ho" (solo disegno: il clic è sul pulsante .open) */
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
    if (p.richNumero && !p.paese) code.innerHTML = p.richNumero; else code.textContent = p.code || 'N°';   /* testo con formato dell'Editor, se c'è */
    code.setAttribute('aria-label', 'Numero ' + (p.code || 'non indicato'));

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'edit';
    edit.textContent = 'info';
    edit.setAttribute('aria-label', 'Dettagli');
    edit.title = 'Dettagli';
    edit.addEventListener('click', () => openEdit(p));

    /* nome scritto sotto la foto: solo se la collezione lo chiede (CONFIG.mostraNomi, es. LEGO) */
    const doppi = p.image ? [doppiBox(p)] : [];   /* gli slot vuoti (senza foto) non hanno doppioni */
    if (CONFIG.mostraNomi) {
      const nome = document.createElement('div');
      nome.className = 'nome';
      nome.append(document.createElement('span'));
      if (p.richNome) nome.firstChild.innerHTML = p.richNome; else nome.firstChild.textContent = p.name;
      li.append(btn, nome, edit, code, ...doppi);   /* foto, nome, pulsante "info", numero */
    } else {
      li.append(btn, edit, code, ...doppi);
    }
    return li;
  }

  /* riga di titolo "Varianti estere · 2 su 5" (occupa tutta la larghezza della griglia: aspetto in collezione.css, .estere-titolo).
     Dice quante ne hai: sono un extra, non contano nel "posseduti su…" della serie. */
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

  /* ridisegna tutta la griglia */
  function render() {
    const list = visiblePens();
    /* prima i pezzi della serie, poi (se ce ne sono) il titolo "Varianti estere" e le varianti */
    const nodi = list.filter(p => !p.estero).map(card);
    const estere = list.filter(p => p.estero);
    if (estere.length) nodi.push(titoloEstere(), ...estere.map(card));
    grid.replaceChildren(...nodi);
    $('noResults').hidden = list.length > 0 || pens.length === 0;
    $('emptyAll').hidden = pens.length > 0;
    updateCount(list.length);
  }

  /* ---------- finestra "Dettagli" (si apre con il pulsante "info") ----------
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

  /* ---------- foto extra nelle Info (carosello) ----------
     Se un oggetto ha  fotoInfo: ["immagini/01-b.webp", ...]  nell'elenco, sotto il testo "Info" compare una
     fila di foto che si scorre col dito (o con le frecce / i puntini). Senza fotoInfo non compare nulla. */
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
    fotoBox.classList.toggle('una', foto.length < 2);   /* una sola foto: niente frecce né puntini */
    aggiornaFotoInfo();
  }
  /* clic su una foto delle Info: si ingrandisce a tutto schermo (clic, ✕ o Esc per chiudere) */
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

  /* apre la finestra "Dettagli" di un oggetto */
  function openEdit(p) {
    editing = p;
    const img = $('dlgImg');
    if (p.image) img.src = p.image; else img.removeAttribute('src');
    img.hidden = !p.image;
    $('dlgNoPhoto').hidden = !!p.image;
    $('fCodice').value = p.codice;
    /* campo Codice: di solito c'è sempre; sparisce solo nei pezzi a cui hai tolto la spunta nell'Editor */
    const campoCodice = $('fCodice').closest('.field'), trioCodice = document.querySelector('#editForm .trio');
    if (p.senzaCodice) campoCodice.remove(); else if (!campoCodice.isConnected && trioCodice) trioCodice.prepend(campoCodice);
    $('fCode').value = p.code;
    $('fName').value = p.name;
    /* colore: il campo sta nei Dettagli solo se questo pezzo ha un colore (in mezzo: Codice · Colore · Numero) */
    const trio = document.querySelector('#editForm .trio'), haCol = !!(p.colorName || p.colorHex);
    if (haCol && trio) {
      if (!campoColore.isConnected) trio.insertBefore(campoColore, trio.children[1] || null);
      $('colorDot').style.background = p.colorHex || 'transparent';
      $('colorDot').classList.toggle('empty', !p.colorHex);
      $('fColorName').value = p.colorName;
    } else campoColore.remove();
    if (p.richInfo) $('fInfo').innerHTML = p.richInfo; else $('fInfo').textContent = p.info;   /* Info con il formato dell'Editor, se c'è */
    $('fInfoBox').hidden = !p.info;          /* "Info": nascosta se l'oggetto non ne ha */
    mostraFotoInfo(p);                       /* foto extra da scorrere (se ci sono) */
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

  /* ---------- immagine da condividere ---------- */
  const printDlg = $('printDlg');
  /* le scelte nella finestra Stampa: "La mia collezione" (owned), "Cerco e scambio" (scambi),
     "Mi mancano" (mancanti: solo quelli che cerco), "Doppioni" (doppioni: solo quelli che ho doppi,
     per chi vende invece di scambiare) e "Checklist vuota" (all: tutti i pezzi senza spunte).
     Il nome qui sotto finisce nel nome del file; le voci mancanti/doppioni le aggiungo alla finestra
     più sotto da qui, così non serve cambiare ogni pagina. */
  const kindName = { owned: 'collezione', scambi: 'cerco-scambio', mancanti: 'mi-mancano', doppioni: 'doppioni', all: 'checklist' };
  /* oggetti da mettere nel PDF: tutti, oppure solo quelli che mi mancano (per "Cerco") */
  let conEstere = false;   /* interruttore "Stampa anche le varianti estere" nella finestra Stampa: parte sempre spento */
  function printList(soloMancanti) {
    const all = [...pens].sort(byPos);
    /* le varianti estere (p.estero) NON si stampano, né per Kinder né per McDonald's: solo i pezzi della serie,
       a meno che si accenda "Stampa anche le varianti estere". Se TUTTI i pezzi della pagina sono esteri
       (serie solo estera) si stampa tutto comunque. */
    const stampabili = (conEstere || !all.some(p => !p.estero)) ? all : all.filter(p => !p.estero);
    return soloMancanti ? stampabili.filter(p => !p.owned && p.image) : stampabili;
  }
  /* carica una foto e aspetta che sia pronta */
  const loadImg = src => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('immagine non leggibile'));
    i.src = src;
  });
  /* testo da disegnare: tolgo solo i caratteri di controllo. Stelle (★) e cuori (♥) restano:
     la tela li disegna con il carattere del dispositivo (con il vecchio PDF diventavano "?") */
  const pdfText = t => String(t).replace(/[\u0000-\u001F]/g, '');
  /* "righello" per misurare le scritte: ha lo stesso comando widthOfTextAtSize di prima, ma misura sulla tela
     con lo stesso carattere con cui si disegna (così misura giusto anche ★ ♥ e le lettere accentate) */
  const misuraCtx = document.createElement('canvas').getContext('2d');
  const righello = peso => ({ widthOfTextAtSize(t, size) { misuraCtx.font = peso + ' ' + size + 'px Helvetica, Arial, sans-serif'; return misuraCtx.measureText(t).width; } });
  const rgb = (r, g, b) => ({ red: r, green: g, blue: b });

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

  /* titolo del PDF: lo disegno con lo stesso carattere e colore del titolo della pagina.
     Il colore lo leggo SEMPRE come nel tema chiaro (il PDF ha lo sfondo chiaro): per un attimo
     metto data-tema="chiaro", leggo e rimetto com'era (senza che lo schermo cambi). */
  async function titoloTela() {
    const el = document.querySelector('.titolo-testo');
    if (!el) return null;
    const radice = document.documentElement, tema = radice.dataset.tema;
    radice.dataset.tema = 'chiaro';
    const cs = getComputedStyle(el), colore = cs.color, famiglia = cs.fontFamily;
    if (tema === undefined) delete radice.dataset.tema; else radice.dataset.tema = tema;
    const text = el.textContent.trim(), size = 200;
    const font = '700 ' + size + 'px ' + famiglia;
    try { if (document.fonts && document.fonts.load) await document.fonts.load(font, text); } catch (e) { /* uso il carattere disponibile */ }
    const c = document.createElement('canvas'), ctx = c.getContext('2d');
    ctx.font = font;
    const m = ctx.measureText(text), pad = Math.round(size * 0.04);
    const su = Math.ceil(m.actualBoundingBoxAscent), giu = Math.ceil(m.actualBoundingBoxDescent);
    c.width = Math.ceil(m.width) + 2 * pad;
    c.height = su + giu + 2 * pad;                          // alta quanto le lettere: niente spazio vuoto
    ctx.font = font;
    ctx.fillStyle = colore;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, pad, pad + su);
    return c;
  }

  /* ---- marchio Collection Time: tessera ambra con la spunta ----
     Stessa forma del logo di header.html (griglia 32×32): i due tratti della spunta
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

  /* crea l'immagine da condividere (un file JPEG). Il disegno è nato per il PDF, per questo si parla di pagine e punti.
     "sezioni" = le parti da stampare, ognuna { titolo, sotto, items, scambio }:
     "La mia collezione" e "Checklist vuota" hanno UNA parte senza titolo; "Cerco e scambio" ne ha due
     (CERCO e SCAMBIO), ognuna con la sua testata.
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
  async function makeImmagine(sezioni, kind) {
    say("Sto creando l'immagine…");
    const font = righello('400'), bold = righello('700');
    const titolo = await titoloTela();
    const logo = titolo ? titolo : null;

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
    const ROWS = CONFIG.pdfFile || 2;                       // file per pagina (solo Legami)
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
    const list = sezioni.flatMap(s => s.items);             // tutti gli oggetti, di tutte le parti
    const fotoLette = await Promise.all(list.map(p => (p.image || SLOT_IMG) ? ritaglio(p.image || SLOT_IMG).catch(() => null) : null));
    const foto = new Map(list.map((p, i) => [p, fotoLette[i]]));   // oggetto → la sua foto ritagliata
    const altiUguali = (CONFIG.proporzione || 7) > 1;
    const maxW = Math.max(1, ...fotoLette.map(f => f ? f.w : 0)), maxH = Math.max(1, ...fotoLette.map(f => f ? f.h : 0));
    const scala = Math.min(fotoW / maxW, fotoMaxH / maxH);
    const misura = f => {                                   // larghezza e altezza di una foto nel PDF
      const k = altiUguali ? Math.min(fotoW / f.w, fotoMaxH / f.h) : scala;
      return [f.w * k, f.h * k];
    };
    const fotoH = altiUguali ? fotoMaxH : maxH * scala;     // altezza della zona foto
    const cardH = fotoH + 2 * PAD + TESTO_H;

    /* FILE: ogni parte = la sua testata (se ha un titolo) + le sue file di schede */
    const TESTA_H = 24;                                     // altezza della testata di una parte (CERCO, SCAMBIO)
    const file = [];
    sezioni.forEach(s => {
      if (s.titolo) file.push({ testa: s });
      for (let i = 0; i < s.items.length; i += COLS) file.push({ items: s.items.slice(i, i + COLS), sezione: s });
    });
    const alto = ff => ff.reduce((t, f) => t + (f.testa ? TESTA_H : cardH), 0) + Math.max(0, ff.length - 1) * ROW_GAP;   // altezza di un gruppo di file

    /* PAGINE: in ogni pagina metto file finché ci stanno. Una testata non resta mai
       da sola in fondo alla pagina: va a capo insieme alla sua prima fila.
       L'immagine invece è una pagina sola, alta quanto serve. */
    const pagine = [file];
    H = SOPRA + CART_H + TITOLO_GAP + alto(file) + gridBottom;
    const areaTop = H - SOPRA, gridTop = areaTop - CART_H - TITOLO_GAP;
    /* titolo + schede formano un blocco unico, centrato in altezza (misurato sulla pagina più piena) */
    const bloccoH = Math.max(...pagine.map(alto));
    const avanzo = (gridTop - gridBottom - bloccoH) / 2;
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
      for (let k = 0; k < 2; k++) pg.drawLine({ start: P[k], end: P[k + 1], thickness: SPESSORI[k] * scale, color: spunta, lineCap: true });
    }

    /* scritta nella banda in alto: che cosa è stato stampato */
    const cosa = { owned: 'La mia collezione', scambi: 'Cerco e scambio', mancanti: 'Mi mancano', doppioni: 'Doppioni', all: 'Checklist da compilare' }[kind];

    /* testata di una parte: cartellino bianco con "CERCO" o "SCAMBIO" e sotto-titolo, poi una riga ambra fino al bordo */
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
    let ghost = null;      // sagoma degli slot vuoti: inserita una volta sola
    for (const filePagina of pagine) {
      const page = paginaTela(W, H, bold);
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

      let top = primaFila;                                  // bordo alto della fila che sto disegnando
      for (const fila of filePagina) {
        if (fila.testa) { testata(page, fila.testa, top); top -= TESTA_H + ROW_GAP; continue; }
        const inFila = fila.items.length;                   // oggetti in questa fila
        for (let c = 0; c < inFila; c++) {
          const p = fila.items[c];
          const spost = orizzontale ? 0 : (COLS - inFila) * colPitch / 2;        // fila corta: al centro (non per Legami)
          const cx = MX + spost + c * colPitch + colPitch / 2;                   // centro della colonna
          const spuntata = kind === 'owned' && p.owned;

          /* scheda: bordo ambra se ce l'hai, grigio se no */
          page.drawSvgPath(schedaPath, { x: cx - cardW / 2, y: top, color: bianco,
            borderColor: spuntata ? ambra : gray, borderWidth: spuntata ? 1.4 : 0.6 });

          /* foto appoggiata in basso nella sua zona, come su uno scaffale */
          const fotoTop = top - PAD, f = foto.get(p);
          if (f) {
            const [dw, dh] = misura(f), x = cx - dw / 2, y = fotoTop - fotoH;
            if (p.image) page.drawImage(fotoTela(f, dw, dh, false, true), { x, y, width: dw, height: dh });
            else {
              if (!ghost) ghost = fotoTela(f, dw, dh);
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

          /* riquadro con il numero: largo almeno 26, si allarga se il numero è lungo (es. "13 - USA"),
             ma senza mai uscire dalla scheda */
          const boxY = y - CODE_H;
          const code = pdfText(p.code || ''), codeW = bold.widthOfTextAtSize(code, 7.5);
          const boxW = Math.min(cardW - 2 * PAD, Math.max(26, codeW + 10));
          page.drawRectangle({ x: cx - boxW / 2, y: boxY, width: boxW, height: CODE_H, color: carta, borderColor: gray, borderWidth: 0.6 });
          if (code) page.drawText(code, { x: cx - codeW / 2, y: boxY + 3.6, size: 7.5, font: bold, color: p.limited ? red : ink });

          /* parte SCAMBIO: al posto del quadratino, quanti doppioni ho (×2, ×3…; niente se è uno solo) */
          if (fila.sezione.scambio) {
            if (p.doppi > 1) {
              const t = '×' + p.doppi, tw = bold.widthOfTextAtSize(t, 9);
              page.drawText(t, { x: cx - tw / 2, y: boxY - GAP - BOX + 0.5, size: 9, font: bold, color: ambra });
            }
            continue;
          }

          /* quadratino della checklist (spunta ambra se ce l'hai) */
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

    /* filigrana: il marchio grande al centro, disegnato una volta su un'immagine
       trasparente e poi messo su ogni pagina SOPRA le foto (così non si toglie ritagliando).
       FILIGRANA_OPACITA: 0 = invisibile, 1 = piena. Più è alta, più protegge dalle copie. */
    const FILIGRANA_OPACITA = 0.12;
    const fc = document.createElement('canvas');
    fc.width = fc.height = 512;
    const fctx = fc.getContext('2d');
    fctx.scale(16, 16);
    tesseraCanvas(fctx, 'rgba(26, 33, 64, .5)', '#1A2140');   // tessera a metà, spunta piena: nessuna macchia
    const filigrana = fc;

    /* "collectiontime.com" del piè di pagina: disegnato come IMMAGINE, non come testo,
       così i programmi che aprono il PDF (Anteprima, Acrobat…) non lo trasformano
       in un link cliccabile. Nel PDF non c'è nessun link. */
    const SITO_SIZE = 14, sc = document.createElement('canvas'), sctx = sc.getContext('2d'), SK = 4;   // 4 pixel per punto: nitido
    const sitoW = bold.widthOfTextAtSize('collectiontime.com', SITO_SIZE);
    sc.width = Math.ceil(sitoW * SK); sc.height = Math.ceil(SITO_SIZE * 1.25 * SK);
    sctx.scale(SK, SK);
    sctx.font = '700 ' + SITO_SIZE + 'px Helvetica, Arial, sans-serif';
    sctx.fillStyle = '#1A2140';
    sctx.textBaseline = 'alphabetic';
    sctx.fillText('collectiontime.com', 0, SITO_SIZE);
    const sito = sc;

    pages.forEach(pg => {
      const WM = Math.min(250, H * 0.6);                    // più piccola nelle immagini basse
      pg.drawImage(filigrana, { x: (W - WM) / 2, y: primaFila - (bloccoH + WM) / 2, width: WM, height: WM, opacity: FILIGRANA_OPACITA * 2 });

      /* piè di pagina a sinistra: tessera piccola + indirizzo del sito */
      marchio(pg, MX, 36, 18, ink);
      pg.drawImage(sito, { x: MX + 24, y: 22 - SITO_SIZE * 0.25, width: sc.width / SK, height: sc.height / SK });

    });

    const blob = await fileDi(pages[0].tela, 'image/jpeg');
    /* nome del file, es. "collection-time_legami-erasable_mancanti_2026-09-23.jpg" */
    const oggi = new Date(), dd = n => String(n).padStart(2, '0');                 // data del tuo computer (non quella di Londra)
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
    /* IMMAGINE sul telefono: apro subito il menu Condividi (lì c'è "Salva immagine" → finisce
       nelle Foto, con tutte le altre). Niente finestre in più: se il telefono non lo permette,
       o sul computer, si scarica come prima. */
    const jpg = typeof File === 'function' ? new File([blob], nome, { type: 'image/jpeg' }) : null;
    if (jpg && navigator.canShare && navigator.canShare({ files: [jpg] }) && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ files: [jpg] }).catch(err => { if (!err || err.name !== 'AbortError') scarica(); });
    }
    else scarica();
  }

  /* ---------- immagini personali solo per chi ha fatto l'accesso ----------
     Senza accesso si può creare solo la "Checklist vuota" (value="all").
     Le altre voci (La mia collezione, Cerco e scambio, Mi mancano, Doppioni) si spengono
     e compare l'invito ad accedere. ! MODIFICA: per lasciare libera un'altra voce
     aggiungi il suo value a LIBERE. ct-accesso lo scrive script.js quando si accede. */
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
      nota.querySelector('button').addEventListener('click', () => printDlg.close());   // poi apre l'accesso script.js
    }
    nota.hidden = si;
  }

  /* Le parti di "Cerco e scambio" (una parte vuota non si stampa):
     CERCO = quelli che mi mancano, SCAMBIO = i doppioni.
     "Mi mancano" e "Doppioni" usano UNA sola di queste parti, con un titolo più adatto. */
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

  /* aggiungo alla finestra Stampa le voci "Mi mancano" e "Doppioni" (subito dopo "Cerco e scambio") */
  (function () {
    const dopo = printDlg.querySelector('input[value="scambi"]');
    if (!dopo || printDlg.querySelector('input[value="mancanti"]')) return;
    const voce = (valore, nome, id) => {   // una riga sola, senza spiegazione: la finestra resta corta
      const l = document.createElement('label');
      l.className = 'choice';
      l.innerHTML = '<input type="radio" name="printKind" value="' + valore + '"><span><strong>' + nome +
        '</strong> (<span id="' + id + '"></span>)</span>';
      return l;
    };
    const fine = dopo.closest('label');
    /* le due voci stanno affiancate sulla stessa riga (l'aspetto è in collezione.css: .choice-coppia) */
    const coppia = document.createElement('div');
    coppia.className = 'choice-coppia';
    coppia.append(voce('mancanti', 'Mi mancano', 'cnt-mancanti'), voce('doppioni', 'Doppioni', 'cnt-doppioni'));
    fine.after(coppia);
  })();

  /* interruttore "Stampa anche le varianti estere": compare solo se la pagina ha varianti estere (e non è tutta estera) */
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
    conEstere = false; estereCasella.checked = false;                      /* ogni volta che si apre, spento */
    estereVoce.hidden = !(pens.some(p => p.estero) && pens.some(p => !p.estero));
    conteggiStampa();
    bloccaStampa();
    printDlg.showModal();
  });
  $('printCancel').addEventListener('click', () => printDlg.close());

  /* "Condividi": manda il LINK di questa pagina (chi scarica il PDF/l'immagine non può
     condividerli da lì, il link sì). Sul telefono apre il menu Condividi di sistema;
     dove non c'è (PC, browser che non lo supportano), copia il link e lo dice con "avviso". */
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
  /* "Crea immagine" (da condividere) */
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
      /* aperta con doppio clic (file://) il browser vieta di leggere le foto */
      say(location.protocol === 'file:'
        ? "L'immagine non si può creare con la pagina aperta dal Finder: aprila dal sito o da un server locale."
        : "Non sono riuscito a creare l'immagine.");
    }
  }
  $('printImg').addEventListener('click', crea);

  /* ---------- controlli ----------
     La lente apre e chiude il campo (lo fa script.js, come nelle altre pagine);
     qui scrivendo si filtrano gli oggetti. */
  $('search').addEventListener('input', e => { query = e.target.value; render(); });
  /* voce "Doppioni" nel menu dei filtri: la aggiungo da qui, così non serve cambiare ogni pagina */
  if (!$('filter').querySelector('option[value="doppi"]')) $('filter').append(new Option('Doppioni', 'doppi'));
  $('filter').addEventListener('change', e => { filterMode = e.target.value; render(); });
  $('sort').value = sortDir === -1 ? 'desc' : 'asc';   /* mostra l'ordine salvato */
  $('sort').addEventListener('change', e => {
    sortDir = e.target.value === 'desc' ? -1 : 1;
    try { localStorage.setItem(CHIAVE_ORDINE, e.target.value); } catch (err) {}
    render();
  });

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
    /* arrivo dal pulsante "Cerco e scambio" di "Mi mancano" o "Doppioni" (indirizzo che finisce con #cerco-scambio):
       apro la finestra Stampa già su quella voce, poi tolgo #cerco-scambio dall'indirizzo */
    if (location.hash === '#cerco-scambio') {
      history.replaceState(null, '', location.pathname + location.search);
      const scambi = printDlg.querySelector('input[value="scambi"]');
      if (conAccount()) scambi.checked = true;
      $('btnPrint').click();
    }
  })();
})();
