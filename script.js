/* ==========================================================
   script.js — Collection Time
   1) carica header.html e footer.html nei segnaposto (Fetch)
   2) in ogni pagina "hub" (Home, Legami, e in futuro altre
      sezioni): mostra l'elenco delle schede definito in un
      file .json, così da poter aggiungere nuove sezioni o
      nuovi oggetti senza toccare il codice.
   Da richiamare in ogni pagina con una sola riga:
   <script src="script.js"></script>
   (dentro una sottocartella: <script src="../script.js"></script>)
   ========================================================== */

/* Cartella in cui si trova questo file: header.html, footer.html
   e i link del menu vengono cercati da qui, quindi funzionano
   anche dalle pagine dentro le sottocartelle. */
const BASE = new URL('.', document.currentScript.src);

/* ---------- Header e footer ---------- */

async function caricaParte(idSegnaposto, file) {
  const box = document.getElementById(idSegnaposto);
  if (!box) return;                         // la pagina non ha questo segnaposto
  try {
    const res = await fetch(new URL(file, BASE));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    box.innerHTML = await res.text();
    sistemaLink(box);
  } catch (e) {
    console.warn('Impossibile caricare ' + file + ':', e);
  }
}

/* Rende corretti i link relativi (anche da sottocartelle)
   e segna la voce del menu della pagina in cui ci si trova. */
function sistemaLink(box) {
  const paginaCorrente = normalizza(location.pathname);
  box.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (/^(https?:|mailto:|tel:|#)/i.test(href)) return;   // link esterni: non si toccano
    const url = new URL(href, BASE);
    a.href = url.href;
    if (a.closest('nav') && normalizza(url.pathname) === paginaCorrente) {
      a.setAttribute('aria-current', 'page');
    }
  });
}

/* "/index.html" e "/" contano come la stessa pagina */
function normalizza(percorso) {
  return percorso.replace(/index\.html$/, '').replace(/\/$/, '');
}

/* ---------- Elenco schede (Home, Legami, e future pagine "hub") ----------
   Ogni pagina hub ha un <ul id="cards" data-src="NOMEFILE.json"></ul>.
   Il file json (nella stessa cartella della pagina) ha questa forma:
   {"titolo": "...", "sottotitolo": "...", "schede": [
     {"titolo": "...", "cartella": "...", "descrizione": "...", "immagine": "..."}
   ]}
   "cartella" è il percorso (relativo alla pagina) della sottopagina/sezione:
   per una sezione allo stesso livello: "legami-lampada"
   per risalire e poi scendere in un'altra cartella: "../legami-righello"
*/

async function caricaSchede() {
  const ul = document.getElementById('cards');
  if (!ul) return;                          // questa pagina non è un hub
  const src = ul.dataset.src;
  if (!src) return;
  let data = null;
  if (/^https?:$/.test(location.protocol)) {
    try {
      const res = await fetch(src + '?v=' + Date.now(), { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); if (Array.isArray(d.schede)) data = d; }
    } catch (e) { /* uso i valori già scritti nell'HTML, se ci sono */ }
  }
  if (!data) return;                        // niente file (es. aperto in locale): resta il contenuto di base
  if (data.titolo) document.getElementById('titolo').textContent = data.titolo;
  if (data.sottotitolo) document.getElementById('sottotitolo').textContent = data.sottotitolo;
  const list = data.schede || [];
  const local = location.protocol === 'file:';
  ul.replaceChildren();
  list.forEach(c => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'card';
    const local_suffix = local ? '/index.html' : '/';
    a.href = /\.html?$/i.test(c.cartella) ? c.cartella : c.cartella + local_suffix;
    if (c.immagine) {
      const t = document.createElement('div'); t.className = 'thumb';
      const img = document.createElement('img'); img.src = c.immagine; img.alt = ''; t.append(img); a.append(t);
    }
    const h = document.createElement('h2'); h.textContent = c.titolo; a.append(h);
    if (c.descrizione) { const p = document.createElement('p'); p.textContent = c.descrizione; a.append(p); }
    const o = document.createElement('span'); o.className = 'open'; o.textContent = 'Apri'; a.append(o);
    li.append(a); ul.append(li);
  });
  const vuoto = document.getElementById('empty');
  if (vuoto) vuoto.hidden = list.length > 0;
}

/* ---------- Avvio ---------- */

caricaParte('header-placeholder', 'header.html');
caricaParte('footer-placeholder', 'footer.html');
caricaSchede();
