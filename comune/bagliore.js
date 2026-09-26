/* =====================================================================
   bagliore.js — BAGLIORE delle cose che hai (Collection Time)
   ---------------------------------------------------------------------
   UN SOLO FILE per tutte le pagine che mostrano gli oggetti:
   le pagine delle serie (comune/app.js) e "Mi mancano / Doppioni / Cerca"
   (comune/raccolta.js). Va richiamato PRIMA di quei file:
     <script src="../../comune/bagliore.js?v=…"></script>
   Mette a disposizione una sola funzione:
     accendiBagliore(riquadro, foto)
       riquadro = il <div class="pic"> della foto, foto = indirizzo della foto
   ---------------------------------------------------------------------
     Quando una penna è posseduta, dietro la foto compare un alone arancio-giallo
     che segue la sagoma della penna. Prima c'era un'immagine di bagliore già pronta
     per ogni penna (100 immagini in più): ora lo stesso effetto è calcolato qui,
     una volta per foto, per TUTTE le penne (anche quelle che aggiungerai).
     Come funziona:
       1. prendo la sagoma della penna (i pixel non trasparenti) in piccolo (30%)
       2. la sfumo tre volte con raggi diversi e sommo i risultati
       3. tolgo la parte coperta dalla penna e coloro tutto di arancio-giallo
       4. ne faccio un'immagine PNG trasparente e la metto dietro la foto
     I bagliori già calcolati restano in memoria (haloCache) e vengono creati
     uno alla volta (haloChain) per non bloccare la pagina.
     Nota: il calcolo legge i pixel della foto, quindi funziona con la pagina
     aperta dal sito o da un piccolo server locale; aprendo il file con un
     doppio clic (file://) il browser lo vieta: in quel caso si usa un alone
     di riserva più semplice fatto con il CSS (vedi .no-halo in comune/collezione.css).
   ===================================================================== */

(() => {
  /* carica una foto e aspetta che sia pronta */
  const caricaFoto = src => new Promise((ok, ko) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ko(new Error('immagine non leggibile'));
    i.src = src;
  });

  const haloCache = new Map();
  let haloChain = Promise.resolve();
  function makeHalo(src) {
    if (haloCache.has(src)) return haloCache.get(src);
    const job = haloChain.then(() => new Promise(r => setTimeout(r, 0))).then(() => buildHalo(src));
    haloCache.set(src, job);
    haloChain = job.catch(() => {});
    return job;
  }
  /* sfocatura gaussiana (3 passaggi di media) su una matrice di valori 0..1 */
  function gaussBlur(a, w, h, sigma) {
    const r = Math.max(1, Math.floor(Math.round(Math.sqrt(12 * sigma * sigma / 3 + 1)) / 2));
    const div = 2 * r + 1;
    const tmp = new Float32Array(a.length), out = new Float32Array(a.length);
    let cur = a;
    for (let it = 0; it < 3; it++) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        let sum = 0;
        for (let x = 0; x <= r && x < w; x++) sum += cur[row + x];
        for (let x = 0; x < w; x++) {
          tmp[row + x] = sum / div;
          const add = x + r + 1, sub = x - r;
          if (add < w) sum += cur[row + add];
          if (sub >= 0) sum -= cur[row + sub];
        }
      }
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let y = 0; y <= r && y < h; y++) sum += tmp[y * w + x];
        for (let y = 0; y < h; y++) {
          out[y * w + x] = sum / div;
          const add = y + r + 1, sub = y - r;
          if (add < h) sum += tmp[add * w + x];
          if (sub >= 0) sum -= tmp[sub * w + x];
        }
      }
      cur = out;
    }
    return out;
  }
  /* crea il bagliore di una foto: restituisce l'indirizzo dell'immagine e
     il fattore k (quanto è più alto della penna, circa 1.3) */
  async function buildHalo(src) {
    const img = await caricaFoto(src);
    const S = 0.3;
    const w = Math.max(1, Math.round(img.naturalWidth * S));
    const h = Math.max(1, Math.round(img.naturalHeight * S));
    const pad = Math.ceil(h * 0.15);
    const W = w + 2 * pad, H = h + 2 * pad;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, pad, pad, w, h);
    const px = ctx.getImageData(0, 0, W, H).data;
    const A = new Float32Array(W * H);
    for (let i = 0; i < A.length; i++) A[i] = px[i * 4 + 3] / 255;
    const inv = new Float32Array(W * H).fill(1);
    let B6 = null;
    [[1.5, [1, 1]], [4.5, [1, 0.8]], [9.5, [0.9, 0.6]]].forEach(([sig, ks]) => {
      const B = gaussBlur(A, W, H, sig);
      if (sig === 4.5) B6 = B;
      ks.forEach(k => { for (let i = 0; i < inv.length; i++) inv[i] *= 1 - Math.min(1, k * B[i]); });
    });
    const outData = ctx.createImageData(W, H);
    const d = outData.data;
    for (let i = 0; i < A.length; i++) {
      /* il buco per la penna c'è solo dove è davvero opaca: sotto il bordo morbido il bagliore continua (niente bordo bianco) */
      const ah = Math.min(1, Math.max(0, (A[i] - 0.9) / 0.09));
      const g = (1 - inv[i]) * (1 - ah * ah * (3 - 2 * ah));
      const t = Math.min(1, B6[i] * 1.4);
      d[i * 4] = 255;
      d[i * 4 + 1] = 184 + 44 * t;
      d[i * 4 + 2] = 90 + 20 * t;
      d[i * 4 + 3] = Math.round(g * 255);
    }
    ctx.clearRect(0, 0, W, H);
    ctx.putImageData(outData, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return { url: URL.createObjectURL(blob), k: H / h };
  }
  /* aggiunge il bagliore dietro la foto (se non c'è già) */
  window.accendiBagliore = function (pic, src) {
    if (!src || pic.querySelector('.halo') || pic.classList.contains('no-halo')) return;
    const halo = document.createElement('img');
    halo.className = 'halo';
    halo.alt = '';
    halo.draggable = false;
    halo.setAttribute('aria-hidden', 'true');
    pic.insertBefore(halo, pic.firstChild);
    makeHalo(src).then(hh => {
      halo.style.setProperty('--k', String(hh.k));
      halo.src = hh.url;
    }).catch(() => {
      /* il browser non permette di leggere i pixel (es. file aperto con doppio clic):
         tolgo l'immagine e uso il bagliore di riserva fatto con il CSS (classe no-halo) */
      halo.remove();
      pic.classList.add('no-halo');
    });
  };
})();
