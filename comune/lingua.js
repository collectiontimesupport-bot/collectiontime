(function () {
  'use strict';
  var ha = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var N = function (x) { return String(x).replace(/\s+/g, ' '); };

  window.CTLingua = function (codice, FRASI, MODELLI) {
    var C = window.CT_CONTENUTI;
    if (C) for (var kc in C) if (ha(C, kc) && !ha(FRASI, kc)) FRASI[kc] = C[kc];
    var MIN = {};
    Object.keys(FRASI).forEach(function (k) { MIN[k.toLowerCase()] = FRASI[k]; });

    function traduci(testo) {
      var k = N(testo).trim();
      if (!k || !/[A-Za-zÀ-ú]/.test(k)) return null;
      if (ha(FRASI, k)) return FRASI[k];
      var tutto = k === k.toUpperCase();
      var min = k.toLowerCase();
      if (tutto && ha(MIN, min)) return MIN[min].toUpperCase();
      for (var i = 0; i < MODELLI.length; i++) {
        var m = MODELLI[i][0].exec(k);
        if (m) return typeof MODELLI[i][1] === 'function' ? MODELLI[i][1](m) : k.replace(MODELLI[i][0], MODELLI[i][1]);
      }
      return null;
    }

    var ATTRIBUTI = ['title', 'aria-label', 'placeholder'];
    var SALTA = /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE|NOSCRIPT)$/;
    var LUNGO = 'data-' + codice;

    function nodo(n) {
      if (n.nodeType === 3) {
        var p = n.parentNode;
        if (!p || SALTA.test(p.nodeName)) return;
        var v = n.nodeValue, r = traduci(v);
        if (r !== null) n.nodeValue = /^\s*/.exec(v)[0] + r + /\s*$/.exec(v)[0];
        return;
      }
      if (n.nodeType !== 1 || SALTA.test(n.nodeName) || n.getAttribute('translate') === 'no') return;
      if (n.hasAttribute(LUNGO)) {
        n.innerHTML = n.getAttribute(LUNGO);
        n.removeAttribute(LUNGO);
        return;
      }
      for (var i = 0; i < ATTRIBUTI.length; i++) {
        var a = n.getAttribute(ATTRIBUTI[i]);
        if (a) { var t = traduci(a); if (t !== null) n.setAttribute(ATTRIBUTI[i], t); }
      }
      for (var c = n.firstChild; c; c = c.nextSibling) nodo(c);
    }

    function titoloScheda() {
      var parti = document.title.split(' · '), cambiato = false;
      for (var i = 0; i < parti.length; i++) { var r = traduci(parti[i]); if (r !== null && r !== parti[i]) { parti[i] = r; cambiato = true; } }
      if (cambiato) document.title = parti.join(' · ');
    }
    var dentroNo = function (el) { return el && el.nodeType === 1 && el.closest && el.closest('[translate="no"]'); };

    document.documentElement.lang = codice;
    var osserva;
    function parti(recs) {
      osserva.disconnect();
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        var dove = r.type === 'characterData' ? r.target.parentNode : r.target;
        if (dentroNo(dove)) continue;
        if (r.type === 'childList') { for (var j = 0; j < r.addedNodes.length; j++) nodo(r.addedNodes[j]); }
        else if (r.type === 'characterData') nodo(r.target);
        else if (r.type === 'attributes') { var a = r.target.getAttribute(r.attributeName); var t = a && traduci(a); if (t) r.target.setAttribute(r.attributeName, t); }
      }
      osserva.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTI });
    }
    function avvia() {
      osserva = new MutationObserver(parti);
      nodo(document.body);
      titoloScheda();
      var tit = document.querySelector('title');
      if (tit) new MutationObserver(titoloScheda).observe(tit, { childList: true, characterData: true, subtree: true });
      osserva.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTI });
    }
    if (document.body) avvia(); else document.addEventListener('DOMContentLoaded', avvia);
    window.traduciTesto = traduci;
  };
})();
