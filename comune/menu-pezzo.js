(function () {
  const PRESSIONE_MS = 550;

  async function pannelloListe(db, id) {
    const L = ctListe;
    let dentro = [];
    try {
      const d = await apriArchivio(db);
      const r = await new Promise(ok => { const g = d.transaction(STORE).objectStore(STORE).get(id); g.onsuccess = () => ok(g.result); g.onerror = () => ok(null); });
      d.close();
      dentro = r && r.tagsTouched === true ? L.diPezzo(r.tags) : [];
    } catch (e) {}
    const prima = document.activeElement;
    const sfondo = document.createElement('div'); sfondo.className = 'lp-sfondo';
    const p = document.createElement('div'); p.className = 'lp-pannello';
    p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-labelledby', 'lpTitolo');
    p.innerHTML = '<div class="lp-maniglia" aria-hidden="true"></div><h3 id="lpTitolo">Aggiungi a una lista</h3>'
      + '<p class="lp-sotto">Tocca una lista per mettere o togliere questo pezzo.</p><div class="liste-pill"></div>'
      + '<p class="liste-err" role="alert" hidden></p><button type="button" class="lp-fatto">Fatto</button>';
    const box = p.querySelector('.liste-pill'), err = p.querySelector('.liste-err');
    const ha = n => dentro.some(x => L.uguale(x, n));
    const chiudi = () => { sfondo.remove(); p.remove(); document.removeEventListener('keydown', esc, true); if (prima && prima.focus) prima.focus(); };
    const esc = e => { if (e.key === 'Escape' && !e.target.classList.contains('lp-campo')) { e.preventDefault(); chiudi(); } };
    const cambia = async (n, si) => {
      if (si && !(await L.c_e_posto(n))) return;
      try { await L.metti(db, id, n, si); } catch (e) { avviso('Salvataggio non riuscito.'); return; }
      dentro = si ? [...dentro, n] : dentro.filter(x => !L.uguale(x, n));
      disegna();
      avviso(si ? 'Aggiunto a «' + n + '».' : 'Tolto da «' + n + '».');
    };
    function disegna() {
      const nomi = L.nomi();
      dentro.forEach(n => { if (!nomi.some(x => L.uguale(x, n))) nomi.push(n); });
      box.replaceChildren(...nomi.map(n => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'lp'; b.textContent = n; b.setAttribute('aria-pressed', String(ha(n)));
        b.addEventListener('click', () => { err.hidden = true; cambia(n, !ha(n)); });
        return b;
      }));
      const nuova = document.createElement('button');
      nuova.type = 'button'; nuova.className = 'lp lp-nuova'; nuova.textContent = '+ Nuova lista';
      nuova.addEventListener('click', () => {
        const campo = document.createElement('input');
        campo.type = 'text'; campo.className = 'lp-campo'; campo.maxLength = L.MAX_NOME; campo.autocomplete = 'off';
        campo.placeholder = 'Nome della lista'; campo.setAttribute('aria-label', 'Nome della nuova lista');
        campo.addEventListener('keydown', async e => {
          if (e.key === 'Escape') { e.preventDefault(); err.hidden = true; disegna(); return; }
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (!campo.value.trim()) { disegna(); return; }
          const v = L.crea(campo.value);
          if (v.errore) { err.textContent = v.errore; err.hidden = false; return; }
          err.hidden = true;
          await cambia(v.nome, true);
        });
        campo.addEventListener('blur', () => { if (campo.isConnected && !campo.value.trim()) disegna(); });
        nuova.replaceWith(campo);
        campo.focus();
      });
      box.append(nuova);
    }
    disegna();
    sfondo.addEventListener('click', chiudi);
    p.querySelector('.lp-fatto').addEventListener('click', chiudi);
    document.addEventListener('keydown', esc, true);
    document.body.append(sfondo, p);
    p.querySelector('.lp-fatto').focus();
  }
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
      if (btn.dataset.db && typeof ctListe !== 'undefined') menu.append(voce('Aggiungi a una lista', () => ctListe.puoi() ? pannelloListe(btn.dataset.db, id) : ctListe.chiediAccesso()));
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
