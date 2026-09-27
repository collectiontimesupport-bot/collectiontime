/* =====================================================================
   motore.js — il "motore" dell'area amministratore (Collection Time)
   ---------------------------------------------------------------------
   Qui ci sono SOLO le funzioni che leggono e riscrivono il TESTO delle
   pagine del sito (niente pulsanti, niente foto): le usa admin.js.
   Non tocca mai i file da solo: riceve un testo e restituisce il testo
   nuovo, poi è admin.js a salvarlo nella cartella.

   Cosa sa fare:
     1) CARD delle pagine-elenco (<ul class="st-cards">, una card per riga):
        leggerle, cambiarne titolo/testo/copertina, spostarle, nasconderle
     2) SERIE (pagine con "const CONFIG" e "const ELENCO"):
        leggere impostazioni ed elenco, riscrivere l'elenco
     3) INDICE di una categoria (la-mia-collezione/indice.js), quello che
        usano "Mi mancano", "Doppioni" e "Cerca": lo rifà da zero
        leggendo le card e le pagine delle serie (= "aggiorna-catalogo")
     4) pulsante "Vedi tutti" e pagina "tutti" di un gruppo

   Funziona anche fuori dal browser (con Node) per le prove: vedi in fondo.
   ===================================================================== */

const Motore = (() => {

  /* ---------- piccoli aiuti ---------- */
  const oggi = () => {                                   // data di oggi "2026-09-27" (ora italiana)
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };
  const entita = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rarr: '→', larr: '←', nbsp: ' ' };
  const decodifica = t => String(t).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (entita[e] ?? m));
  const codifica = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const soloTesto = html => decodifica(String(html).replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  /* nome di cartella dal titolo: "Stikeez - I Puffi 2017" → "stikeez-i-puffi-2017" */
  const cartellaDa = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  /* "?v=…" con la data di oggi in fondo a un percorso (toglie quello vecchio) */
  const conVersione = percorso => String(percorso).replace(/\?v=[^"'\s]*$/, '') + '?v=' + oggi();

  /* =====================================================================
     1) CARD DELLE PAGINE-ELENCO
     Ogni card è UNA riga: <li …><a class="st-card" href="…">…</a></li>
     Una card nascosta dall'area admin diventa un commento:
       <!-- NASCOSTA: <li …>…</li> -->
     così resta nel file (basta togliere il commento per rimetterla).
     ===================================================================== */
  const NASC_INIZIO = '<!-- NASCOSTA: ', NASC_FINE = ' -->';

  function leggiCard(html) {
    const m = /<ul class="st-cards"([^>]*)>/.exec(html);
    if (!m) return null;
    const inizio = m.index + m[0].length, fine = html.indexOf('</ul>', inizio);
    const righe = html.slice(inizio, fine).split('\n');
    const card = [];
    let multiriga = false;
    righe.forEach((r, i) => {
      const s = r.trim();
      let nascosta = false, li = s;
      if (s.startsWith(NASC_INIZIO) && s.endsWith(NASC_FINE)) { nascosta = true; li = s.slice(NASC_INIZIO.length, -NASC_FINE.length).trim(); }
      if (!li.startsWith('<li')) return;
      if (!li.endsWith('</li>')) { multiriga = true; return; }
      card.push(Object.assign(analizzaCard(li), { riga: i, nascosta, rientro: r.match(/^\s*/)[0] }));
    });
    return {
      card, righe, inizio, fine, multiriga,
      perAnno: /data-per-anno/.test(m[1]),
      tutti: leggiVediTutti(html)
    };
  }
  function analizzaCard(li) {
    const prendi = re => { const x = re.exec(li); return x ? x[1] : ''; };
    return {
      li,
      href: prendi(/<a[^>]*\bhref="([^"]*)"/),
      img: prendi(/<img[^>]*\bsrc="([^"]*)"/),
      titolo: decodifica(prendi(/<h2>([\s\S]*?)<\/h2>/)),
      testoHtml: prendi(/<p>([\s\S]*?)<\/p>/),
      cerca: decodifica(prendi(/\bdata-cerca="([^"]*)"/))
    };
  }
  /* cartella a cui porta la card: "stikeez/index.html" → "stikeez" */
  const cartellaCard = c => c.href.replace(/\/?index\.html$/, '').replace(/\/$/, '');

  /* cambia i campi di UNA card (solo quelli passati) e restituisce la riga <li> nuova */
  function cambiaCard(li, { titolo, testoHtml, cerca, img } = {}) {
    let t = li;
    if (titolo !== undefined) t = t.replace(/<h2>[\s\S]*?<\/h2>/, '<h2>' + codifica(titolo) + '</h2>');
    if (testoHtml !== undefined) t = t.replace(/<p>[\s\S]*?<\/p>/, '<p>' + testoHtml + '</p>');
    if (cerca !== undefined) t = /\bdata-cerca="/.test(t)
      ? t.replace(/\bdata-cerca="[^"]*"/, 'data-cerca="' + codifica(cerca) + '"')
      : t.replace(/^<li/, '<li data-cerca="' + codifica(cerca) + '"');
    if (img !== undefined) {
      if (/<img[^>]*\bsrc="/.test(t)) t = t.replace(/(<img[^>]*\bsrc=")[^"]*"/, '$1' + img + '"');
      else t = t.replace(/(<a class="st-card"[^>]*>)/, '$1<div class="thumb"><img src="' + img + '" alt="" loading="lazy"></div>');
    }
    return t;
  }
  /* testo della card (dentro <p>): "9 sorpresine<br>2010" ↔ due righe */
  const testoDaRighe = righe => righe.map(r => codifica(r.trim())).filter(Boolean).join('<br>');
  const righeDaTesto = html => String(html).split(/<br\s*\/?>/i).map(decodifica);

  /* riscrive la lista: "elenco" = le card nell'ordine voluto ({ li, nascosta });
     le righe che non sono card (commenti) restano dove sono */
  function scriviCard(html, lettura, elenco) {
    const righe = lettura.righe.slice();
    const posti = lettura.card.map(c => c.riga);          // righe occupate dalle card, dall'alto
    const rientri = lettura.card.map(c => c.rientro);      // ogni posto tiene il suo rientro
    const testo = (c, r) => (r ?? rientri[0] ?? '    ') + (c.nascosta ? NASC_INIZIO + c.li + NASC_FINE : c.li);
    if (!posti.length) {                                   // lista vuota: le metto prima della fine
      righe.splice(righe.length - 1, 0, ...elenco.map(c => testo(c)));
    } else {
      /* le card in più (nuove) vanno nel primo posto, prima delle altre */
      const extra = elenco.length - posti.length;
      posti.forEach((p, i) => { const c = elenco[i + Math.max(extra, 0)]; righe[p] = c ? testo(c, rientri[i]) : null; });
      if (extra > 0) righe.splice(posti[0], 0, ...elenco.slice(0, extra).map(c => testo(c)));
    }
    return html.slice(0, lettura.inizio) + righe.filter(r => r !== null).join('\n') + html.slice(lettura.fine);
  }
  /* una card nuova, come quelle scritte a mano */
  function nuovaCard({ cartella, titolo, testoHtml, cerca, copertina }) {
    const foto = copertina ? '<div class="thumb"><img src="' + copertina + '" alt="" loading="lazy"></div>' : '';
    return '<li data-cerca="' + codifica(cerca || '') + '"><a class="st-card" href="' + cartella + '/index.html">' + foto +
      '<h2>' + codifica(titolo) + '</h2><p>' + testoHtml + '</p><span class="st-apri">Apri</span></a></li>';
  }
  /* tendine per anno: accende/spegne data-per-anno sulla lista */
  function impostaPerAnno(html, si) {
    return html.replace(/<ul class="st-cards"([^>]*)>/, (m, a) => {
      a = a.replace(/\s*data-per-anno/, '');
      return '<ul class="st-cards"' + a + (si ? ' data-per-anno' : '') + '>';
    });
  }

  /* =====================================================================
     4) PULSANTE "VEDI TUTTI" (link alla pagina tutti/ o tutte/ del gruppo)
     Spento dall'area admin diventa: <!-- NASCOSTO: <p class="tutte-link">…</p> -->
     ===================================================================== */
  function leggiVediTutti(html) {
    const m = /^([ \t]*)(<!-- NASCOSTO: )?(<p class="tutte-link">[\s\S]*?<\/p>)( -->)?[ \t]*$/m.exec(html);
    if (!m) return null;
    return { acceso: !m[2], riga: m[0], p: m[3], rientro: m[1],
      testo: soloTesto(m[3]).replace(/\s*→\s*$/, ''), href: (/href="([^"]*)"/.exec(m[3]) || [])[1] || '' };
  }
  function impostaVediTutti(html, acceso) {
    const v = leggiVediTutti(html);
    if (!v) return html;
    return html.replace(v.riga, v.rientro + (acceso ? v.p : '<!-- NASCOSTO: ' + v.p + ' -->'));
  }
  const STILE_TUTTI = `  /* collegamento "Vedi tutti … insieme" (come nella home LEGO) */
  .tutte-link { text-align: center; margin: -18px 0 28px; }
  .tutte-link a { display: inline-block; padding: 10px 18px; border-radius: 999px; background: var(--amber); color: var(--blu); font-weight: 600; text-decoration: none; }
  .tutte-link a:hover { filter: brightness(1.06); }
`;
  /* aggiunge il pulsante (e il suo stile, se manca) sopra le card */
  function aggiungiVediTutti(html, testo, cartella = 'tutti') {
    if (leggiVediTutti(html)) return html;
    if (!/\.tutte-link\s*\{/.test(html)) html = html.replace('</style>', STILE_TUTTI + '</style>');
    const riga = '  <!-- collegamento alla pagina con TUTTI gli oggetti insieme (cartella "' + cartella + '"): creato dall\'area amministratore -->\n' +
      '  <p class="tutte-link"><a href="' + cartella + '/index.html">' + codifica(testo) + ' &rarr;</a></p>\n';
    const dove = html.search(/^[ \t]*<p class="st-nessuna"[^\n]*\n/m);
    if (dove >= 0) { const fineRiga = html.indexOf('\n', dove) + 1; return html.slice(0, fineRiga) + riga + html.slice(fineRiga); }
    return html.replace(/^([ \t]*)<ul class="st-cards"/m, riga + '$1<ul class="st-cards"');
  }
  /* pagina tutti/ di un gruppo, copiata da una pagina "tutti" che c'è già (modello) */
  function creaPaginaTutti(modello, { gruppo, titolo, parola, url, profondita }) {
    const su = '../'.repeat(profondita);                   // quanti "../" per tornare alla cartella principale
    let t = modello
      .replace(/(href|src)="(?:\.\.\/)+(favicon|apple-touch-icon|site\.webmanifest|sito\.css|script\.js)/g, '$1="' + su + '$2')
      .replace(/<title>[^<]*<\/title>/, '<title>' + codifica(titolo) + ' · Collection Time</title>')
      .replace(/(<meta name="description" content=")[^"]*"/, '$1' + codifica(titolo + ' in una pagina: quelli che ho e quelli che mi mancano.') + '"')
      .replace(/(<meta property="og:title" content=")[^"]*"/, '$1' + codifica(titolo) + ' · Collection Time"')
      .replace(/(<meta property="og:url" content=")[^"]*"/, '$1https://www.collectiontime.com/' + url + '"')
      .replace(/(<a class="st-back" href="\.\.\/index\.html">&larr; )[^<]*</, '$1' + codifica(gruppo) + '<')
      .replace(/<h1>[^<]*<\/h1>/, '<h1>' + codifica(titolo.toUpperCase()) + '</h1>')
      .replace(/(<p class="attesa" id="attesa">)[^<]*</, '$1Carico…<')
      .replace(/(<p class="hint">)[^<]*</, '$1Tocca ' + codifica(parola) + ' per segnare che ce l\'hai (o toglierlo). Tieni il dito sopra (o passa col mouse) per vedere il nome e la serie.<')
      .replace(/(\.textContent = ')Non riesco a caricare [^']*'/, "$1Non riesco a caricare l\\'elenco. Riprova tra poco.'");
    /* il riquadro di spiegazione in cima: riga del titolo */
    t = t.replace(/(<!-- =+\n\s*)[^\n]*·\s*TUTTI[^\n]*/, '$1' + gruppo.toUpperCase() + ' · TUTTI — tutti gli oggetti di tutte le serie in una');
    return t;
  }

  /* =====================================================================
     2) PAGINE DELLE SERIE (CONFIG + ELENCO)
     ===================================================================== */
  /* legge un oggetto/array scritto in JavaScript nella pagina ({ … } o [ … ]) */
  function valuta(testo) { return Function('"use strict"; return (' + testo + ');')(); }
  /* trova la parentesi che chiude quella in posizione i (salta testi tra virgolette e commenti) */
  function chiusura(t, i) {
    const apre = t[i], chiude = apre === '{' ? '}' : ']';
    let livello = 0;
    for (let k = i; k < t.length; k++) {
      const c = t[k];
      if (c === '"' || c === "'" || c === '`') { for (k++; k < t.length && t[k] !== c; k++) if (t[k] === '\\') k++; continue; }
      if (c === '/' && t[k + 1] === '/') { k = t.indexOf('\n', k); if (k < 0) return -1; continue; }
      if (c === '/' && t[k + 1] === '*') { k = t.indexOf('*/', k + 2) + 1; continue; }
      if (c === apre) livello++;
      else if (c === chiude && --livello === 0) return k;
    }
    return -1;
  }
  function blocco(html, nome) {
    const m = new RegExp('const ' + nome + '\\s*=\\s*([\\[{])').exec(html);
    if (!m) return null;
    const da = m.index + m[0].length - 1, a = chiusura(html, da);
    return a < 0 ? null : { da, a: a + 1, testo: html.slice(da, a + 1) };
  }
  function leggiSerie(html) {
    const c = blocco(html, 'CONFIG'), e = blocco(html, 'ELENCO');
    if (!c || !e) return null;
    const config = valuta(c.testo), elenco = valuta(e.testo);
    /* righe dell'elenco com'erano scritte (per non riscrivere quelle che non cambiano)
       e commenti "//" (restano sopra la riga che li segue) */
    const righe = e.testo.slice(1, -1).split('\n');
    const originali = {}, commenti = {};
    let attesa = [];
    for (const r of righe) {
      const s = r.trim();
      if (!s) continue;
      if (s.startsWith('//')) { attesa.push(r); continue; }
      const id = (/id:\s*"([^"]+)"/.exec(s) || [])[1];
      if (id) { originali[id] = r; if (attesa.length) commenti[id] = attesa; attesa = []; }
    }
    const classe = (/<body[^>]*\bclass="([^"]*)"/.exec(html) || [])[1] || '';
    const h1 = /<span class="titolo-testo">([\s\S]*?)<\/span>/.exec(html);
    return { config, elenco, originali, commenti, commentiFine: attesa, classe, titoloPagina: h1 ? decodifica(h1[1]) : config.titolo };
  }
  /* una riga dell'elenco: { id: "…", numero: "…", … }  (testi con le virgolette doppie) */
  function rigaElenco(o) {
    const val = v => Array.isArray(v) ? '[' + v.map(val).join(', ') + ']' : typeof v === 'string' ? JSON.stringify(v) : String(v);
    return '  { ' + Object.keys(o).filter(k => o[k] !== undefined && o[k] !== '' && !(Array.isArray(o[k]) && !o[k].length))
      .map(k => k + ': ' + val(o[k])).join(', ') + ' },';
  }
  const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  /* riscrive l'ELENCO: le righe uguali a prima restano identiche */
  function scriviElenco(html, lettura, nuovo) {
    const e = blocco(html, 'ELENCO');
    const prima = {}; lettura.elenco.forEach(o => { prima[o.id] = o; });
    const righe = [];
    nuovo.forEach(o => {
      (lettura.commenti[o.id] || []).forEach(c => righe.push(c));
      righe.push(prima[o.id] && uguali(prima[o.id], o) && lettura.originali[o.id] ? lettura.originali[o.id] : rigaElenco(o));
    });
    lettura.commentiFine.forEach(c => righe.push(c));
    return html.slice(0, e.da) + '[\n' + righe.join('\n') + '\n]' + html.slice(e.a);
  }
  /* cambia UN valore del CONFIG (es. titolo, colonne).
     commento (facoltativo) = nuovo commento a destra ("// …");
     se la voce manca la aggiunge sotto la voce "dopo" (o in fondo al CONFIG) */
  function impostaConfig(html, chiave, valore, commento, dopo) {
    const c = blocco(html, 'CONFIG');
    const scritto = typeof valore === 'string' ? JSON.stringify(valore) : String(valore);
    const riga = new RegExp('^([ \\t]*' + chiave + ':\\s*)("(?:[^"\\\\]|\\\\.)*"|[-\\d.]+|true|false)(,?)([ \\t]*)(//[^\\n]*)?$', 'm');
    let nuovo;
    if (riga.test(c.testo)) {
      nuovo = c.testo.replace(riga, (m, a, v, virgola, spazi, vecchioCommento) => {
        const testo = a + scritto + virgola;
        if (commento === undefined) return testo + (spazi || '') + (vecchioCommento || '');
        return testo.padEnd(Math.max(testo.length + 1, (a + v + virgola + (spazi || '')).length)) + '// ' + commento;
      });
    } else {
      const righe = c.testo.split('\n');
      const eVoce = r => /^\s*\w+:/.test(r);
      /* la aggiungo sotto la voce "dopo" (se non c'è, sotto l'ultima voce) */
      let k = dopo ? righe.findIndex(r => new RegExp('^\\s*' + dopo + ':').test(r)) : -1;
      if (k < 0) for (k = righe.length - 1; k > 0 && !eVoce(righe[k]); k--);
      const ultima = !righe.slice(k + 1).some(eVoce);        // dopo non ci sono altre voci: la nuova non vuole la virgola
      if (!/,\s*(\/\/.*)?$/.test(righe[k])) righe[k] = righe[k].replace(/^(.*?\S)(\s*(\/\/.*)?)$/, '$1,$2');
      const testo = '  ' + chiave + ': ' + scritto + (ultima ? '' : ',');
      righe.splice(k + 1, 0, commento ? testo.padEnd(35) + '// ' + commento : testo);
      nuovo = righe.join('\n');
    }
    return html.slice(0, c.da) + nuovo + html.slice(c.a);
  }

  /* ---------- come si chiama un pezzo (nei testi della pagina) ----------
     Le frasi si scrivono con l'articolo: "una tote bag" / "le tote bag",
     "un portachiavi" / "i portachiavi". Dall'articolo capisco maschile e femminile. */
  function leggiFrase(frase) {
    const m = /^\s*(un'|uno|una|un|i|gli|le)(?:\s+|(?<='))(.+?)\s*$/i.exec(String(frase || ''));
    return m ? { art: m[1].toLowerCase(), parola: m[2] } : { art: '', parola: String(frase || '').trim() };
  }
  function forme(un, i) {
    const s = leggiFrase(un), p = leggiFrase(i);
    const fem = p.art ? p.art === 'le' : /^(una|un')$/.test(s.art);
    const artS = s.art || (fem ? 'una' : 'un'), artP = p.art || (fem ? 'le' : 'i');
    const sing = s.parola, plur = p.parola || s.parola;
    return {
      un: artS + (artS.endsWith("'") ? '' : ' ') + sing,     // "una tote bag"
      i: artP + ' ' + plur,                                   // "le tote bag"
      sing, plur, fem,
      tutti: (fem ? 'Tutte ' : 'Tutti ') + artP + ' ' + plur, // "Tutte le tote bag"
      dei: { i: 'dei', gli: 'degli', le: 'delle' }[artP] + ' ' + plur   // "delle tote bag"
    };
  }
  /* le parole scritte ora nella pagina (dal suggerimento in basso e dalla finestra Stampa) */
  function leggiParole(html) {
    const lettura = leggiSerieSicura(html);
    const nome = lettura && lettura.config ? lettura.config.nome || '' : '';
    const u = /<p class="hint">(?:Premi su|Tocca) ((?:un'|uno|una|un)\s?.+?) per segnare/.exec(html);
    const t = /<strong>Tutt[ie] ((?:i|gli|le) [^<]+)<\/strong>/.exec(html);
    return forme(u ? decodifica(u[1]) : 'un ' + nome, t ? decodifica(t[1]) : 'i ' + nome);
  }
  /* scrive le parole in tutti i testi che le usano (e in CONFIG: nome, possedute) */
  function impostaParole(html, un, i) {
    const f = forme(un, i);
    const E = codifica;
    html = html
      .replace(/(<option value="all" id="optAll">)[^<]*</, '$1' + (f.fem ? 'Tutte' : 'Tutti') + '<')
      .replace(/(<option value="owned" id="optOwned">)[^<]*</, '$1' + (f.fem ? 'Ce le ho' : 'Ce li ho') + '<')
      .replace(/(<p class="hint">(?:Premi su|Tocca) )(?:un'|uno|una|un)\s?.+?( per segnare)/, (m, a, b) => a + E(f.un) + b)
      .replace(/<small>Tutt[ie] (?:i|gli|le) [^,<]+,/, '<small>' + E(f.tutti) + ',')
      .replace(/<strong>Tutt[ie] (?:i|gli|le) [^<]+<\/strong>/, '<strong>' + E(f.tutti) + '</strong>')
      .replace(/<strong>Quell[ie] che mi mancano<\/strong>/, '<strong>' + (f.fem ? 'Quelle' : 'Quelli') + ' che mi mancano</strong>')
      .replace(/(content="[^"]*)con quell[ie] che ho e quell[ie] che mi mancano/g, '$1con ' + (f.fem ? 'quelle che ho e quelle' : 'quelli che ho e quelli') + ' che mi mancano');
    const possedute = f.fem ? 'possedute' : 'posseduti';
    html = impostaConfig(html, 'nome', f.sing);
    return impostaConfig(html, 'possedute', possedute, '"5 ' + possedute + ' su 18"');
  }

  /* commenti di spiegazione di una pagina NUOVA: scritti da zero con le parole giuste
     (così non restano frasi della serie da cui è stata copiata) */
  function commentiNuovaPagina(html, { titolo, categoria, un, i }) {
    const f = forme(un, i);
    const testa = `<!-- =====================================================================
     ${titolo.toUpperCase()} — pagina della collezione (${categoria})
     ---------------------------------------------------------------------
     Pagina creata dall'area amministratore. Com'è fatta questa cartella:

       index.html           ← questa pagina: struttura, IMPOSTAZIONI (CONFIG)
                              ed ELENCO ${f.dei.toUpperCase()} (in fondo)
       immagini/            ← le foto in WebP trasparente (01.webp, 02.webp…)
                              e copertina.webp (la foto della card, se c'è)
       (l'aspetto grafico è in comune/collezione.css, uguale per tutte le
        collezioni, e nel file css/stile.css della categoria;
        il funzionamento, app.js, sta nella cartella "comune" del sito)

     ▸ PER CAMBIARE NOMI, FOTO, ORDINE, QUANTI PER FILA E GRANDEZZA:
       area amministratore (_admin/index.html) → "Modifica una serie".
       A mano: blocco "ELENCO ${f.dei.toUpperCase()}" in fondo a questa pagina.
     ===================================================================== -->`;
    const griglia = `<!-- ============ GRIGLIA ${f.dei.toUpperCase()} ============
       Resta vuota qui: app.js crea una scheda <li> per ogni riga
       dell'ELENCO (in fondo a questa pagina). -->`;
    const elenco = `/* =====================================================================
   ELENCO ${f.dei.toUpperCase()}  ★ QUI SI AGGIUNGONO O CAMBIANO ★
   ---------------------------------------------------------------------
   Ogni riga { … } è ${f.un}, nello stesso ordine della pagina.

   PIÙ FACILE: area amministratore → "Modifica una serie" (aggiunge le
   righe, prepara le foto e aggiorna "Mi mancano", "Doppioni" e "Cerca").

   A MANO: copia una riga, incollala dove vuoi che compaia, cambia i valori,
   poi nell'area amministratore premi "Aggiorna catalogo".

   I CAMPI
     id        codice unico (es. l'ultimo + 1): serve al browser per ricordare
               se ce l'hai. Non usarlo due volte e non cambiarlo dopo la pubblicazione.
     numero    il numero mostrato sotto la foto
     codice    codice o anno
     nome      nome
     foto      "immagini/NN.webp?v=DATA" (sfondo trasparente, WebP: le prepara
               l'area amministratore). Se sostituisci una foto con una con lo
               STESSO nome, metti la data di oggi in "?v=" (es. ?v=${oggi()}):
               così i browser scaricano quella nuova e non quella vecchia salvata.
     info      facoltativo: testo fisso nei dettagli
     hashtag   facoltativo, es. ["Natale"]
     (altri campi, se ci sono: come nelle righe già scritte)

   Attenzione: ogni riga finisce con una virgola, e i testi vanno tra
   virgolette "…".
   ===================================================================== */`;
    html = html.replace(/<!-- =+\n[\s\S]*?=+ -->/, testa);
    html = html.replace(/<!-- =+ GRIGLIA[\s\S]*?-->/, griglia);
    html = html.replace(/\/\* =+\n\s*ELENCO[\s\S]*?=+ \*\//, elenco);
    return html;
  }
  /* righe della pagina (non l'elenco) che contengono ancora una parola della serie copiata */
  function paroleRimaste(html, parole) {
    const e = blocco(html, 'ELENCO');
    const fuori = e ? html.slice(0, e.da) + html.slice(e.a) : html;
    const re = new RegExp('(^|[^\\p{L}])(' + parole.filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}])', 'iu');
    return parole.filter(Boolean).length ? fuori.split('\n').map(r => r.trim()).filter(r => re.test(r) && !r.includes('! MODIFICA')) : [];
  }

  /* nuovo titolo di una serie: scheda del browser, anteprima dei link, titolo grande, PDF */
  function cambiaTitoloSerie(html, titolo, titoloGrande) {
    html = html
      .replace(/<title>[^<]*<\/title>/, '<title>' + codifica(titolo) + ' · Collection Time</title>')
      .replace(/(<meta property="og:title" content=")[^"]*"/, '$1' + codifica(titolo) + ' · Collection Time"')
      .replace(/(<span class="titolo-testo">)[\s\S]*?(<\/span>)/, '$1' + codifica(titoloGrande || titolo.toUpperCase()) + '$2');
    return impostaConfig(html, 'titolo', titolo);
  }
  function cambiaDescrizione(html, testo) {
    return html.replace(/(<meta name="description" content=")[^"]*"/, '$1' + codifica(testo) + '"')
      .replace(/(<meta property="og:description" content=")[^"]*"/, '$1' + codifica(testo) + '"');
  }

  /* quanti per fila e grandezza (CONFIG: colonne, altezza, proporzione, pdfColonne).
     a = { colonne, altezza, proporzione } (solo quelli da cambiare) */
  const COMMENTI_ASPETTO = {
    colonne: 'quanti per fila sugli schermi larghi (sui telefoni diminuiscono da soli)',
    proporzione: "altezza ÷ larghezza dell'oggetto più largo (calcolata dalle foto)",
    altezza: 'altezza delle foto sugli schermi larghi, in pixel (più alto = più grandi)',
    pdfColonne: 'quanti per fila nel PDF'
  };
  function impostaAspetto(html, a) {
    if (a.colonne != null) html = impostaConfig(html, 'colonne', a.colonne, COMMENTI_ASPETTO.colonne);
    if (a.proporzione != null) html = impostaConfig(html, 'proporzione', a.proporzione, COMMENTI_ASPETTO.proporzione, 'colonne');
    if (a.altezza != null) html = impostaConfig(html, 'altezza', a.altezza, COMMENTI_ASPETTO.altezza, 'proporzione');
    if (a.pdfColonne != null && /\bpdfColonne:/.test(blocco(html, 'CONFIG').testo)) html = impostaConfig(html, 'pdfColonne', a.pdfColonne, COMMENTI_ASPETTO.pdfColonne);
    return html;
  }
  /* quanti per fila nel PDF orizzontale (solo Legami): come sulla pagina, ma al massimo 8 oggetti (20 penne) */
  const pdfColonneDa = (colonne, proporzione) => Math.min(colonne, proporzione >= 4 ? 20 : 8);

  /* pagina di una serie NUOVA, copiata da un'altra serie (modello):
     cambia titoli, indirizzo, CONFIG (id, dbName, titolo, parole, aspetto), ELENCO
     e riscrive i commenti di spiegazione con le parole giuste */
  function creaPaginaSerie(modello, { url, titolo, titoloGrande, descrizione, id, dbName, elenco, backTesto, categoria, un, i, aspetto }) {
    const lettura = leggiSerie(modello);
    const vecchie = leggiParole(modello);
    let t = cambiaTitoloSerie(modello, titolo, titoloGrande);
    t = cambiaDescrizione(t, descrizione);
    t = t.replace(/(<meta property="og:url" content=")[^"]*"/, '$1https://www.collectiontime.com/' + url + '"');
    if (backTesto) t = t.replace(/(<a class="st-back" href="[^"]*">&larr; )[^<]*</, '$1' + codifica(backTesto) + '<');
    t = t.replace(/(<!-- Link per tornare alla pagina )[^>]*?( -->)/, '$1' + codifica(backTesto || '') + '$2');
    t = impostaConfig(t, 'id', id);
    t = impostaConfig(t, 'dbName', dbName);
    t = impostaParole(t, un || vecchie.un, i || vecchie.i);
    if (aspetto) t = impostaAspetto(t, aspetto);
    /* commenti del CONFIG che parlano della serie copiata: generici */
    const cfg = blocco(t, 'CONFIG').testo;
    if (/\bpdfFile:/.test(cfg)) t = impostaConfig(t, 'pdfFile', lettura.config.pdfFile, 'file di foto per pagina del PDF (solo Legami: le altre pagine hanno il PDF verticale)');
    if (/\bmostraNomi:/.test(cfg)) t = impostaConfig(t, 'mostraNomi', lettura.config.mostraNomi, 'true = nome scritto sotto ogni foto; false = solo nei dettagli');
    t = commentiNuovaPagina(t, { titolo, categoria, un: un || vecchie.un, i: i || vecchie.i });
    t = scriviElenco(t, Object.assign({}, lettura, { elenco: [], originali: {}, commenti: {}, commentiFine: [] }), elenco);
    /* parole della serie copiata rimaste nella pagina (se le parole sono cambiate) */
    const rimaste = forme(un || vecchie.un, i || vecchie.i).sing === vecchie.sing ? [] : paroleRimaste(t, [vecchie.sing, vecchie.plur]);
    return { html: t, rimaste };
  }

  /* =====================================================================
     3) INDICE DI UNA CATEGORIA (la-mia-collezione/indice.js)
     leggi(percorso) → testo del file (o null); percorso dalla cartella del sito.
     Giro: pagina della categoria → card → se la cartella è una SERIE la metto
     nell'indice, se è un'altra pagina-elenco (gruppo) entro anche lì.
     Le card nascoste non entrano.
     ===================================================================== */
  async function albero(leggi, cartella, profondita = 0, visti = new Set()) {
    if (visti.has(cartella) || profondita > 6) return null;
    visti.add(cartella);
    const html = await leggi(cartella + '/index.html');
    if (html == null) return null;
    const serie = leggiSerieSicura(html);
    if (serie) return { tipo: 'serie', cartella, html, serie };
    const lista = leggiCard(html);
    const nodo = { tipo: 'lista', cartella, html, lista, figli: [], titolo: soloTesto((/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html) || [])[1] || cartella) };
    if (!lista) return nodo;
    for (const c of lista.card) {
      if (/^(https?:|\.\.|#)/.test(c.href)) continue;
      const figlio = await albero(leggi, cartella + '/' + cartellaCard(c), profondita + 1, visti);
      if (figlio) { figlio.card = c; nodo.figli.push(figlio); }
    }
    return nodo;
  }
  function leggiSerieSicura(html) {
    if (!/const ELENCO\s*=/.test(html)) return null;
    try { return leggiSerie(html); } catch (e) { return { errore: e.message }; }
  }
  /* tutte le serie di un nodo, in ordine, con il loro gruppo (titolo della card di primo livello) */
  function serieDi(nodo, gruppo = '', livello = 0, fuori = []) {
    for (const f of nodo.figli || []) {
      if (f.card && f.card.nascosta) continue;
      if (f.tipo === 'serie') fuori.push({ nodo: f, gruppo, lista: nodo.cartella });
      else serieDi(f, livello === 0 ? f.card.titolo : gruppo, livello + 1, fuori);
    }
    return fuori;
  }
  function rigaIndice(radice, { nodo, gruppo, lista }) {
    const s = nodo.serie, rel = nodo.cartella.slice(radice.length + 1);
    const relLista = lista.slice(radice.length + 1);                // pagina-elenco che ha la card
    return {
      p: rel, g: gruppo, t: nodo.card.titolo, d: soloTesto(nodo.card.testoHtml),
      cop: nodo.card.img ? (relLista ? relLista + '/' : '') + nodo.card.img : '',
      db: s.config.dbName, cl: s.classe, pr: s.config.proporzione || 1, nomi: !!s.config.mostraNomi,
      x: s.elenco.map(o => [o.id, o.numero, o.nome, o.foto || '', [o.codice, o.info, ...(o.hashtag || []), o.limitata ? 'edizione limitata limited edition' : ''].filter(Boolean).join(' ')])
    };
  }
  /* testo completo del nuovo indice.js (tiene il commento in cima di quello vecchio) */
  function testoIndice(vecchio, categoria, serie) {
    const dati = { categoria, creato: oggi(), serie };
    const riga = 'const INDICE = ' + JSON.stringify(dati) + ';\n';
    if (vecchio && /const INDICE\s*=/.test(vecchio)) return vecchio.slice(0, vecchio.search(/const INDICE\s*=/)) + riga;
    return `/* =====================================================================
   indice.js — ${categoria}: tutte le serie in un solo file
   ---------------------------------------------------------------------
   CREATO IN AUTOMATICO dalle pagine delle serie: NON modificarlo a mano.
   Lo usano "Mi mancano", "Doppioni" e "Cerca" (la-mia-collezione/index.html).
   Quando aggiungi o cambi una serie, rifallo con l'area amministratore
   (_admin/index.html → "Aggiorna catalogo").
   Per ogni serie: p = cartella, g = gruppo, t = titolo, d = testo della card,
   cop = copertina, db = archivio nel browser, cl = classe della pagina,
   pr = proporzione delle foto, nomi = nomi sotto le foto,
   x = oggetti [id, numero, nome, foto, parole per la ricerca]
   ===================================================================== */
` + riga;
  }
  /* rifà l'indice di UNA categoria: restituisce { testo, serie, problemi } (non salva) */
  async function creaIndice(leggi, categoria) {
    const vecchio = await leggi(categoria + '/la-mia-collezione/indice.js');
    const radice = await albero(leggi, categoria);
    const problemi = [];
    const trovate = serieDi(radice).filter(x => {
      if (x.nodo.serie.errore) { problemi.push(x.nodo.cartella + ': ' + x.nodo.serie.errore); return false; }
      return true;
    });
    const serie = trovate.map(x => rigaIndice(categoria, x));
    const nome = vecchio && (/"categoria":"((?:[^"\\]|\\.)*)"/.exec(vecchio) || [])[1];
    return { testo: testoIndice(vecchio, nome ? JSON.parse('"' + nome + '"') : radice.titolo, serie), serie, problemi, radice };
  }

  return {
    oggi, codifica, decodifica, soloTesto, cartellaDa, conVersione,
    leggiCard, analizzaCard, cartellaCard, cambiaCard, scriviCard, nuovaCard, impostaPerAnno, testoDaRighe, righeDaTesto,
    leggiVediTutti, impostaVediTutti, aggiungiVediTutti, creaPaginaTutti,
    leggiSerie, scriviElenco, rigaElenco, impostaConfig, cambiaTitoloSerie, cambiaDescrizione, creaPaginaSerie,
    forme, leggiParole, impostaParole, commentiNuovaPagina, paroleRimaste, impostaAspetto, pdfColonneDa,
    albero, serieDi, creaIndice
  };
})();

/* per le prove con Node (nel browser questa riga non fa niente) */
if (typeof module !== 'undefined') module.exports = Motore;
