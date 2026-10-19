(function () {
  const PRESSIONE_MS = 550;
  window.ctMenuPezzo = function (radice) {
    if (!radice || radice.dataset.menuPezzo) return;
    radice.dataset.menuPezzo = '1';
    radice.style.webkitTouchCallout = 'none'; radice.style.webkitUserSelect = 'none'; radice.style.userSelect = 'none';
    radice.addEventListener('keydown', () => { lungo = false; });
    let menu = null, timer = null, partito = null, lungo = false, premuto = null, apertoAlle = 0;

    const chiudi = () => {
      if (!menu) return;
      menu.remove(); menu = null;
      document.removeEventListener('pointerdown', fuori, true);
      document.removeEventListener('keydown', tasto, true);
      window.removeEventListener('scroll', subito, true);
      window.removeEventListener('resize', subito);
    };
    const subito = () => { if (Date.now() - apertoAlle > 400) chiudi(); };
    const fuori = e => { if (menu && !menu.contains(e.target)) chiudi(); };
    const tasto = e => { if (e.key === 'Escape') { e.preventDefault(); chiudi(); } };
    const ferma = () => { clearTimeout(timer); timer = null; premuto = null; };

    const voce = (testo, vai) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'menuitem');
      b.textContent = testo;
      b.addEventListener('click', () => {
        if (Date.now() - apertoAlle < 350) return;
        chiudi(); vai();
      });
      return b;
    };
    const apri = (btn, x, y) => {
      chiudi();
      const url = btn.dataset.url, id = btn.dataset.id;
      if (!url) return;
      menu = document.createElement('div');
      menu.className = 'st-pin-menu'; menu.setAttribute('role', 'menu');
      const enc = encodeURIComponent(id || '');
      let serie = null;
      try { serie = btn.dataset.serie ? JSON.parse(btn.dataset.serie) : null; } catch (e) { serie = null; }
      const vai = serie && serie.length > 1
        ? serie.map(s => voce('Vai a «' + s.t + '»', () => { location.href = s.u + '#pezzo=' + encodeURIComponent(s.id || ''); }))
        : [voce('Vai alla serie', () => { location.href = url + '#pezzo=' + enc; })];
      menu.append(voce('Info', () => { location.href = url + '#info=' + enc; }), ...vai);
      document.body.append(menu);
      apertoAlle = Date.now();
      const r = btn.getBoundingClientRect();
      if (!(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
      const w = menu.offsetWidth, h = menu.offsetHeight, m = 8;
      const sx = Math.min(Math.max(m, x - w / 2), window.innerWidth - w - m);
      let sy = y + 18;
      if (sy + h > window.innerHeight - m) sy = y - h - 18;
      menu.style.left = sx + 'px'; menu.style.top = Math.max(m, sy) + 'px';
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
      document.addEventListener('pointerdown', fuori, true);
      document.addEventListener('keydown', tasto, true);
      window.addEventListener('scroll', subito, true);
      window.addEventListener('resize', subito);
    };

    const pezzo = e => e.target.closest && e.target.closest('button[data-url]');
    radice.addEventListener('pointerdown', e => {
      const b = pezzo(e);
      if (!b || (e.pointerType === 'mouse' && e.button !== 0)) return;
      partito = { x: e.clientX, y: e.clientY }; lungo = false; premuto = b;
      const x = e.clientX, y = e.clientY;
      timer = setTimeout(() => { timer = null; lungo = true; apri(b, x, y); }, PRESSIONE_MS);
    });
    radice.addEventListener('pointermove', e => { if (timer && partito && Math.hypot(e.clientX - partito.x, e.clientY - partito.y) > 8) ferma(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => radice.addEventListener(ev, ferma));
    window.addEventListener('scroll', ferma, true);
    radice.addEventListener('click', e => { if (lungo && pezzo(e)) { e.preventDefault(); e.stopImmediatePropagation(); lungo = false; } }, true);
    radice.addEventListener('contextmenu', e => {
      const b = pezzo(e);
      if (!b) return;
      e.preventDefault();
      ferma(); lungo = true;
      apri(b, e.clientX, e.clientY);
    });
  };
})();
