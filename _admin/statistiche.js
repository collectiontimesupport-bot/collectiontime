/* =====================================================================
   statistiche.js — scheda "Statistiche" dell'area amministratore
   ---------------------------------------------------------------------
   Entra con il TUO account del sito (email e password) e legge dal cloud
   (Firebase → Firestore) i documenti collezioni/<codice utente>: uno per
   ogni persona che ha fatto l'accesso almeno una volta.
   Per farlo usa gli indirizzi "REST" di Google (niente librerie da
   scaricare): la chiave qui sotto è PUBBLICA, la stessa di comune/cloud.js.

   Chi può leggere TUTTI i documenti? Solo chi è scritto nelle regole di
   Firestore (console di Firebase → Firestore Database → Regole): la prima
   volta questa pagina ti mostra la riga esatta da aggiungere, con il tuo
   codice utente. Senza quella riga Google risponde "permesso negato".

   I nomi dei pezzi e delle serie li prende dai file indice.js del sito
   (per questo serve la cartella collegata; se no mostra solo i codici).
   ===================================================================== */

(() => {
  const CHIAVE = 'AIzaSyCgch5N04Z8YBprYCyJiMj_cYoXfz32b7c';        // apiKey di comune/cloud.js
  const PROGETTO = 'collection-time-dd8fe';                          // projectId di comune/cloud.js
  const $ = id => document.getElementById(id);
  const esc = t => Motore.codifica(t ?? '');
  const msg = (t, tipo) => { const el = $('stMsg'); el.hidden = false; el.className = 'msg' + (tipo ? ' ' + tipo : ''); el.innerHTML = t; };
  let accesso = null;     // { token, uid, email }
  let documenti = null;   // [{ uid, creato, aggiornato, collezioni }]

  try { $('stEmail').value = localStorage.getItem('ct-admin-email') || ''; } catch (e) {}

  /* ---------- chiamate a Google ---------- */
  async function google(url, corpo) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const d = await r.json();
    if (!r.ok) throw new Error((d.error && d.error.message) || ('errore ' + r.status));
    return d;
  }
  const ERRORI = {
    INVALID_LOGIN_CREDENTIALS: 'Email o password sbagliate.',
    INVALID_PASSWORD: 'Password sbagliata.', EMAIL_NOT_FOUND: 'Non c\'è un account con questa email.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Troppi tentativi: riprova tra qualche minuto.', USER_DISABLED: 'Account disattivato.'
  };
  const spiega = e => ERRORI[String(e.message).split(' ')[0]] || e.message;

  /* Firestore scrive i valori "impacchettati" ({ stringValue: … }): qui li spacchetto */
  function valore(v) {
    if (!v) return null;
    if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = valore(x); return o; }
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(valore);
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('stringValue' in v) return v.stringValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return Date.parse(v.timestampValue);
    return null;
  }
  async function scaricaTutti() {
    const tutti = [];
    let pagina = '';
    do {
      const url = `https://firestore.googleapis.com/v1/projects/${PROGETTO}/databases/(default)/documents/collezioni?pageSize=300` + (pagina ? '&pageToken=' + encodeURIComponent(pagina) : '');
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + accesso.token } });
      const d = await r.json();
      if (r.status === 403) throw Object.assign(new Error('permesso'), { permesso: true });
      if (!r.ok) throw new Error((d.error && d.error.message) || ('errore ' + r.status));
      for (const doc of d.documents || []) {
        const f = valore({ mapValue: { fields: doc.fields } });
        tutti.push({ uid: doc.name.split('/').pop(), creato: Date.parse(doc.createTime), aggiornato: f.aggiornato || Date.parse(doc.updateTime), collezioni: f.collezioni || {} });
      }
      pagina = d.nextPageToken || '';
    } while (pagina);
    return tutti;
  }

  /* ---------- entrare ---------- */
  $('stEntra').addEventListener('click', async () => {
    const email = $('stEmail').value.trim(), password = $('stPassword').value;
    if (!email || !password) { msg('Scrivi email e password del tuo account del sito.', 'err'); return; }
    $('stEntra').disabled = true;
    msg('Entro…');
    try {
      const d = await google(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CHIAVE}`, { email, password, returnSecureToken: true });
      accesso = { token: d.idToken, uid: d.localId, email };
      try { localStorage.setItem('ct-admin-email', email); } catch (e) {}
      $('stPassword').value = '';
      await carica();
    } catch (e) { msg(esc(spiega(e)), 'err'); }
    $('stEntra').disabled = false;
  });
  $('stPasswordNuova').addEventListener('click', async () => {
    const email = $('stEmail').value.trim();
    if (!email) { msg('Scrivi prima la tua email (quella del tuo account Google con cui entri nel sito).', 'err'); return; }
    try {
      await google(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${CHIAVE}`, { requestType: 'PASSWORD_RESET', email });
      msg('✓ Ti ho mandato un\'email per scegliere una password (guarda anche nello spam). Il tuo account resta lo stesso: potrai entrare sia con Google sia con la password.', 'ok');
    } catch (e) { msg(esc(spiega(e)), 'err'); }
  });

  async function carica() {
    msg('Scarico le collezioni dal cloud…');
    try { documenti = await scaricaTutti(); }
    catch (e) {
      if (!e.permesso) { msg('Errore: ' + esc(e.message), 'err'); return; }
      msg(`<b>Manca un permesso (si fa una volta sola).</b> Google non ti lascia ancora leggere le collezioni degli altri.
        <ol>
          <li>Apri la <a href="https://console.firebase.google.com/project/${PROGETTO}/firestore/databases/-default-/rules" target="_blank" rel="noopener">console di Firebase → Firestore → Regole</a>.</li>
          <li>Dentro il blocco <code>match /collezioni/{…} { … }</code>, sotto la riga che c'è già, aggiungi questa riga:</li>
        </ol>
        <pre class="codice">      allow read: if request.auth != null &amp;&amp; request.auth.uid == "${esc(accesso.uid)}";</pre>
        <p>(<code>${esc(accesso.uid)}</code> è il codice del tuo account: così solo tu puoi leggere tutto.) Premi <b>Pubblica</b>, aspetta un minuto e premi di nuovo “Entra e carica i numeri”.</p>`, 'err');
      return;
    }
    msg('✓ Dentro come ' + esc(accesso.email) + ' · ' + documenti.length + ' account letti.', 'ok');
    await disegna();
  }

  /* ---------- nomi dal sito: indice.js di ogni categoria ---------- */
  async function nomiDalSito() {
    const serie = {};   // dbName → { t, categoria, pezzi: { id: nome } , n }
    if (typeof sito === 'undefined' || !sito) return serie;
    for (const c of sito.categorie) {
      const t = await leggi(c.cartella + '/la-mia-collezione/indice.js');
      if (!t) continue;
      try {
        const I = JSON.parse(t.slice(t.indexOf('{', t.search(/const INDICE\s*=/)), t.lastIndexOf('}') + 1));
        for (const s of I.serie) {
          const pezzi = {}; s.x.forEach(o => { pezzi[o[0]] = o[2] + ' (n° ' + o[1] + ')'; });
          serie[s.db] = { t: s.t, categoria: I.categoria, pezzi, n: s.x.length };
        }
      } catch (e) {}
    }
    return serie;
  }

  /* ---------- i numeri ---------- */
  async function disegna() {
    const nomi = await nomiDalSito();
    const ora = Date.now(), GIORNO = 864e5;
    const conSpunte = documenti.filter(d => Object.values(d.collezioni).some(c => (c.possedute || []).length));
    const spunte = documenti.reduce((t, d) => t + Object.values(d.collezioni).reduce((s, c) => s + (c.possedute || []).length, 0), 0);
    const doppi = documenti.reduce((t, d) => t + Object.values(d.collezioni).reduce((s, c) => s + Object.values(c.doppi || {}).reduce((a, b) => a + b, 0), 0), 0);
    const riq = (n, t) => `<div class="numero"><b>${Number(n).toLocaleString('it-IT')}</b><span>${esc(t)}</span></div>`;

    /* nuovi iscritti per mese (primo salvataggio nel cloud) */
    const mesi = {};
    documenti.forEach(d => { const m = new Date(d.creato).toISOString().slice(0, 7); mesi[m] = (mesi[m] || 0) + 1; });
    const nomeMese = m => new Date(m + '-01T12:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    /* per serie e per pezzo */
    const perSerie = {}, perPezzo = {}, perCategoria = {};
    for (const d of documenti) {
      const categorieDiQuesto = new Set();
      for (const [db, c] of Object.entries(d.collezioni)) {
        const pos = c.possedute || [];
        if (!pos.length && !Object.keys(c.doppi || {}).length) continue;
        const info = nomi[db] || { t: db, categoria: '?', pezzi: {}, n: 0 };
        categorieDiQuesto.add(info.categoria);
        const s = perSerie[db] = perSerie[db] || { db, t: info.t, categoria: info.categoria, persone: 0, complete: 0 };
        s.persone++;
        if (info.n && new Set(pos).size >= info.n) s.complete++;
        const ho = new Set(pos);
        for (const id of Object.keys(info.pezzi)) {
          const p = perPezzo[db + '|' + id] = perPezzo[db + '|' + id] || { nome: info.pezzi[id], serie: info.t, categoria: info.categoria, ce: 0, manca: 0, doppi: 0 };
          if (ho.has(id)) p.ce++; else p.manca++;
        }
        for (const [id, n] of Object.entries(c.doppi || {})) {
          const p = perPezzo[db + '|' + id] = perPezzo[db + '|' + id] || { nome: info.pezzi[id] || id, serie: info.t, categoria: info.categoria, ce: 0, manca: 0, doppi: 0 };
          p.doppi += n;
        }
        if (!Object.keys(info.pezzi).length) pos.forEach(id => {
          const p = perPezzo[db + '|' + id] = perPezzo[db + '|' + id] || { nome: id, serie: info.t, categoria: info.categoria, ce: 0, manca: 0, doppi: 0 };
          p.ce++;
        });
      }
      categorieDiQuesto.forEach(c => { perCategoria[c] = (perCategoria[c] || 0) + 1; });
    }
    const categorie = Object.keys(perCategoria).sort((a, b) => perCategoria[b] - perCategoria[a]);

    const box = $('stRisultati');
    box.hidden = false;
    box.innerHTML = `
      <div class="numeri">
        ${riq(documenti.length, 'account (hanno fatto l\'accesso)')}
        ${riq(documenti.filter(d => ora - d.aggiornato < 7 * GIORNO).length, 'attivi negli ultimi 7 giorni')}
        ${riq(documenti.filter(d => ora - d.aggiornato < 30 * GIORNO).length, 'attivi negli ultimi 30 giorni')}
        ${riq(conSpunte.length, 'con almeno un “Ce l\'ho”')}
        ${riq(spunte, '“Ce l\'ho” in tutto')}
        ${riq(doppi, 'doppioni in tutto')}
      </div>
      <p class="muted">Contano solo le persone che hanno fatto l'accesso: chi usa il sito senza account salva le spunte solo nel suo browser (quelle non si vedono). Le visite di tutti le trovi su GoatCounter, qui sopra.</p>
      <div class="griglia" style="align-items:start">
        <section class="box"><h3 style="margin-top:0">Nuovi account per mese</h3>${tabella(['Mese', 'Account'], Object.keys(mesi).sort().reverse().map(m => [nomeMese(m), mesi[m]]), 1)}</section>
        <section class="box"><h3 style="margin-top:0">Categorie più usate</h3>${tabella(['Categoria', 'Persone'], categorie.map(c => [c, perCategoria[c]]), 1)}</section>
      </div>
      <section class="box">
        <div class="riga" style="margin-top:0"><h3 style="margin:0">Serie e pezzi</h3><span class="spazio" style="flex:1"></span>
          <label class="campo" style="min-width:220px">Categoria<select id="stCat"><option value="">Tutte</option>${categorie.map(c => `<option>${esc(c)}</option>`).join('')}</select></label></div>
        <div id="stDettagli"></div>
      </section>`;
    const dettagli = () => {
      const cat = $('stCat').value, filtro = x => !cat || x.categoria === cat;
      const serie = Object.values(perSerie).filter(filtro).sort((a, b) => b.persone - a.persone);
      const pezzi = Object.values(perPezzo).filter(filtro);
      const top = (k, n = 15) => pezzi.filter(p => p[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, n);
      const riga = (p, k) => [p.nome, p.serie + (cat ? '' : ' · ' + p.categoria), p[k]];
      $('stDettagli').innerHTML = `
        <h3>Serie più collezionate <span class="muted">(persone con almeno un pezzo · quante l'hanno completa)</span></h3>
        ${tabella(['Serie', 'Categoria', 'Persone', 'Complete'], serie.slice(0, 20).map(s => [s.t, s.categoria, s.persone, s.complete]), 2)}
        <div class="griglia" style="align-items:start">
          <div><h3>Pezzi più posseduti</h3>${tabella(['Pezzo', 'Serie', 'Ce l\'hanno'], top('ce').map(p => riga(p, 'ce')), 2)}</div>
          <div><h3>Pezzi più cercati <span class="muted">(mancano a chi ha iniziato la serie)</span></h3>${tabella(['Pezzo', 'Serie', 'Lo cercano'], top('manca').map(p => riga(p, 'manca')), 2)}</div>
          <div><h3>Più doppioni <span class="muted">(da scambiare)</span></h3>${tabella(['Pezzo', 'Serie', 'Doppioni'], top('doppi', 10).map(p => riga(p, 'doppi')), 2)}</div>
        </div>`;
    };
    $('stCat').addEventListener('change', dettagli);
    dettagli();
  }
  /* tabella con la barretta ambra sotto il numero (colonna "colBarra") */
  function tabella(titoli, righe, colBarra) {
    if (!righe.length) return '<p class="muted">Ancora niente.</p>';
    const max = Math.max(1, ...righe.map(r => +r[colBarra] || 0));
    return `<table class="classifica"><thead><tr>${titoli.map((t, i) => `<th${i >= colBarra ? ' style="text-align:right"' : ''}>${esc(t)}</th>`).join('')}</tr></thead><tbody>` +
      righe.map(r => '<tr>' + r.map((v, i) => i === colBarra
        ? `<td class="num">${esc(v)}<div class="barra" style="width:${Math.round(100 * (+v || 0) / max)}%;margin-left:auto"></div></td>`
        : `<td${i > colBarra ? ' class="num"' : ''}>${esc(v)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
  }
})();
