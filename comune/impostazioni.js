/* =====================================================================
   impostazioni.js — "Le mie statistiche" della pagina Impostazioni
   (Collection Time) · lo usa SOLO impostazioni.html, dopo script.js
   ---------------------------------------------------------------------
   SOLO PER CHI HA FATTO L'ACCESSO (scelta: le statistiche sono un vantaggio dell'account).
   Chi non ha l'account vede l'invito ad accedere (testo SENZA_ACCOUNT qui sotto);
   appena accede le statistiche compaiono da sole (evento "ct-accesso" di script.js).
   Mostra:
     • 4 numeri: pezzi che hai, doppioni, serie iniziate, serie complete
     • "Le mie serie": UN solo elenco di tutte le serie in cui hai segnato
       qualcosa (titolo che porta alla serie, categoria, barra ambra, "6 su 9").
       Resta comodo anche con tante categorie:
         – menu "Tutte (15) / In corso (12) / Complete (3)"
         – menu delle categorie, con il numero di serie dentro
         – ricerca per nome (compare solo da PIU_DI serie in su)
         – si vedono le prime PER_VOLTA serie, poi "Mostra altre"
       Ordine: prima le serie quasi complete, le complete in fondo.
   Da dove prende i dati (niente cloud):
     • spunte e doppioni: dal browser, con le funzioni di script.js
       archivi(), apriArchivio(), leggi() (le stesse della copia di sicurezza)
     • titoli e numero di pezzi: da catalogo/riepilogo.json, un file leggero con
       tutte le serie del sito. Lo rifà da solo l'area amministratore
       ("Nuova serie" e "Pubblica", funzione aggiornaHome): NON va toccato a mano.
   Aspetto: sito.css, voce "pagina Impostazioni".
   ===================================================================== */

const box = document.getElementById('stStatistiche');
if (box) { mostraStatistiche(); window.addEventListener('ct-accesso', mostraStatistiche); }

async function mostraStatistiche() {
  const PER_VOLTA = 10;   // ! MODIFICA: quante serie si vedono prima di "Mostra altre"
  const PIU_DI = 8;       // ! MODIFICA: da quante serie in su compare la ricerca
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const semplice = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');   // senza accenti
  const SENZA_ACCOUNT = '<p class="st-imp-nota">Le statistiche sono per chi ha un account: accedi per vedere la tua collezione in numeri e l\'elenco di tutte le serie che hai iniziato.</p>'
    + '<p><button type="button" class="st-btn" data-accedi>Accedi</button></p>';   // data-accedi: stessa finestra del pulsante "Accedi" in alto (script.js)
  let conAccount = false;
  try { conAccount = localStorage.getItem('ct-accesso') === '1'; } catch (e) {}
  if (!conAccount) { box.innerHTML = SENZA_ACCOUNT; return; }
  const VUOTO = '<p class="st-imp-nota">Non hai ancora segnato niente. Apri una serie dal <a href="' + new URL('index.html', BASE).href + '">catalogo</a> e tocca gli oggetti che hai: qui vedrai la tua collezione in numeri.</p>';

  let mie = [];
  try {
    const R = (await (await fetch(new URL('riepilogo.json?v=' + VERSIONE, CATALOGO))).json()).serie;
    /* per ogni archivio del browser che è una serie del sito: quanti ne hai e quanti doppioni */
    for (const nome of await archivi()) {
      const s = R[nome];
      if (!s) continue;                                        // archivio di una serie che non c'è più
      const db = await apriArchivio(nome), righe = await leggi(db);
      db.close();
      const ce = Math.min(righe.filter(r => r.owned === true || r.doppi > 0).length, s[2]);
      if (!ce) continue;
      mie.push({ link: new URL(s[0] + '/', CATALOGO).href, t: s[1], tot: s[2], cat: s[3], ce,
                 doppi: righe.reduce((n, r) => n + (r.doppi > 0 ? r.doppi : 0), 0) });
    }
  } catch (e) {
    console.warn(e);
    box.innerHTML = '<p class="st-imp-nota">Non riesco a leggere la collezione: controlla la connessione e ricarica la pagina.</p>';
    return;
  }
  if (!mie.length) { box.innerHTML = VUOTO; return; }

  /* ordine: quasi complete prima (percentuale più alta), le complete in fondo */
  const finita = s => s.ce >= s.tot;
  mie.sort((a, b) => (finita(a) - finita(b)) || (b.ce / b.tot - a.ce / a.tot) || a.t.localeCompare(b.t));
  const categoriaDi = s => s.cat.split(' · ')[0];
  const categorie = [...new Set(mie.map(categoriaDi))].sort((a, b) => a.localeCompare(b));
  const complete = mie.filter(finita).length;
  const somma = f => mie.reduce((n, s) => n + f(s), 0);

  /* ---------- disegno la parte fissa: numeri e comandi ---------- */
  box.innerHTML =
    '<div class="st-imp-numeri">'
    + '<div><b>' + somma(s => s.ce) + '</b><small>Ce l\'ho</small></div>'
    + '<div><b>' + somma(s => s.doppi) + '</b><small>Doppioni</small></div>'
    + '<div><b>' + mie.length + '</b><small>Serie iniziate</small></div>'
    + '<div><b>' + complete + '</b><small>Complete</small></div></div>'
    + '<h3 class="st-imp-sotto">Le mie serie</h3>'
    + '<div class="st-imp-comandi">'
    +   '<select id="impStato" aria-label="Quali serie"><option value="">Tutte (' + mie.length + ')</option>'
    +     '<option value="corso">In corso (' + (mie.length - complete) + ')</option><option value="finite">Complete (' + complete + ')</option></select>'
    +   (categorie.length > 1 ? '<select id="impCat" aria-label="Categoria"><option value="">Tutte le categorie</option>'
    +     categorie.map(c => '<option>' + esc(c) + ' (' + mie.filter(s => categoriaDi(s) === c).length + ')</option>').join('') + '</select>' : '')
    +   (mie.length > PIU_DI ? '<input id="impCerca" type="search" placeholder="Cerca tra le tue serie" aria-label="Cerca tra le tue serie">' : '')
    + '</div>'
    + '<ul class="st-imp-serie" id="impLista"></ul>'
    + '<p class="st-imp-altre"><button type="button" id="impAltre" class="st-link" hidden></button></p>';

  /* ---------- l'elenco: si ridisegna quando cambi menu o ricerca ---------- */
  let quante = PER_VOLTA;
  const valore = id => (document.getElementById(id) || {}).value || '';
  const riga = s => '<li' + (finita(s) ? ' class="finita"' : '') + '>'
    + '<span class="st-imp-tit"><a href="' + s.link + '">' + esc(s.t) + '</a><small>' + esc(s.cat) + '</small></span>'
    + '<span class="st-progresso"><i style="width:' + Math.round(s.ce * 100 / s.tot) + '%"></i></span>'
    + '<span class="st-quanti">' + s.ce + ' su ' + s.tot + (s.doppi ? ' · ' + s.doppi + (s.doppi === 1 ? ' doppione' : ' doppioni') : '') + '</span></li>';
  function mostra() {
    const stato = valore('impStato'), cat = valore('impCat').replace(/ \(\d+\)$/, ''), cerca = semplice(valore('impCerca').trim());
    const scelte = mie.filter(s => (!stato || (stato === 'finite') === finita(s))
      && (!cat || categoriaDi(s) === cat)
      && (!cerca || semplice(s.t + ' ' + s.cat).includes(cerca)));
    document.getElementById('impLista').innerHTML = scelte.length
      ? scelte.slice(0, quante).map(riga).join('')
      : '<li class="st-imp-nota">Nessuna serie trovata.</li>';
    const altre = document.getElementById('impAltre'), resto = scelte.length - quante;
    altre.hidden = resto <= 0;
    altre.textContent = 'Mostra altre ' + Math.min(resto, PER_VOLTA) + (resto > PER_VOLTA ? ' (ne restano ' + resto + ')' : '');
  }
  /* onchange / oninput / onclick (e non addEventListener): se l'elenco si ridisegna non si sommano */
  box.onchange = () => { quante = PER_VOLTA; mostra(); };
  box.oninput = e => { if (e.target.id === 'impCerca') { quante = PER_VOLTA; mostra(); } };
  document.getElementById('impAltre').onclick = () => { quante += PER_VOLTA; mostra(); };
  mostra();
}
