
(() => {
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
    return { url: URL.createObjectURL(blob), k: H / h, ar: img.naturalWidth / img.naturalHeight };
  }
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
      halo.style.setProperty('--ar', String(hh.ar));
      halo.src = hh.url;
    }).catch(() => {
      halo.remove();
      pic.classList.add('no-halo');
    });
  };
})();
