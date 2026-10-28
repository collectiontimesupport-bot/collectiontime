
const CH_QUASI = 'ct-trofei-quasi', CH_TROFEI = 'ct-trofei', CH_SNAP = 'ct-trofei-snap', CH_BADGE = 'ct-badge';
const CH_BADGE_SU = 'ct-badge-su';
const SERIE_BADGE = 3;
const BADGE_CERCA = 7;
const MAX_BADGE = 3;
const MAX_POPUP = 3;
const MS_POPUP = 4200;

const RARITA = {
  C: { it: 'Comune',      en: 'Common',    col: '#8A93AD', glow: '0 0 10px #8A93AD88' },
  N: { it: 'Non comune',  en: 'Uncommon',  col: '#2F9E44', glow: '0 0 14px #2F9E44AA' },
  R: { it: 'Raro',        en: 'Rare',      col: '#2F6FED', glow: '0 0 18px #2F6FEDAA' },
  E: { it: 'Epico',       en: 'Epic',      col: '#8E44D6', glow: '0 0 20px #8E44D6AA' },
  L: { it: 'Leggendario', en: 'Legendary', col: '#F2A900', glow: '0 0 24px #F2A900CC' }
};

const P = d => '<path d="' + d + '"/>';
const ICONE = {
  p1: P('M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.500 2.500 M15.500 15.500L18 18 M18 6l-2.500 2.500 M8.500 15.500L6 18'),
  p10: P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8 12.500l3 3 5-6'),
  p50: P('M9 3h6v3H9z M6 5h12v16H6z M9 11l1.500 1.500L13 10 M9 17h6'),
  p100: P('M5 8h14l1 12H4z M9 11V7a3 3 0 0 1 6 0v4'),
  p250: P('M3 8l9-4 9 4v10l-9 4-9-4z M3 8l9 4 9-4 M12 12v10'),
  p500: P('M4 3h16v18H4z M4 9h16 M4 15h16 M8 6h.01 M12 6h.01 M16 6h.01 M8 12h.01 M16 12h.01'),
  p1000: P('M3 9l9-5 9 5z M5 11v7 M10 11v7 M14 11v7 M19 11v7 M3 20h18'),
  s1: P('M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z M9 12l2.500 2.500L16 9'),
  s5: P('M5 4h3v16H5z M10 4h3v16h-3z M15 6l3-1 3 14-3 1z'),
  s10: P('M3 20h18 M3 11h18 M6 11V6h3v5 M11 11V4h3v7 M16 11V7h3v4 M6 20v-5h3v5 M11 20v-4h3v4 M16 20v-6h3v6'),
  s25: P('M12 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M8.500 14L7 21l5-3 5 3-1.500-7'),
  s50: P('M3 8l4.500 4L12 5l4.500 7L21 8l-2 11H5z'),
  i5: P('M7 3h10v18l-5-4-5 4z'),
  i20: P('M12 20L5 8 M12 20l7-12 M12 20V6 M3 9a12 12 0 0 1 18 0'),
  i50: P('M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h4'),
  c3: P('M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14'),
  c6: P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18'),
  m50: P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 3v18 M12 3a9 9 0 0 1 0 18z'),
  d1: P('M9 9h12v12H9z M4 15V4h11'),
  d10: P('M11 11h10v10H11z M7 15V7h8 M3 11V3h9'),
  d50: P('M9 6h7l4 4v11H9z M16 6v4h4 M5 17V3h9'),
  d100: P('M7 9a3 3 0 1 0 0 6c4 0 6-6 10-6a3 3 0 1 1 0 6c-4 0-6-6-10-6z'),
  badge3: P('M12 21s-8-5-8-11a4.500 4.500 0 0 1 8-2.800A4.500 4.500 0 0 1 20 10c0 6-8 11-8 11z M12 10.500v3 M10.500 12h3'),
  tag: P('M9 4L7 20 M17 4l-2 16 M4.500 9h16 M3.500 15h16'),
  cloud: P('M7 18a4 4 0 0 1-.5-8A5.500 5.500 0 0 1 17 8.500 4.500 4.500 0 0 1 17 18z M9.500 13l2 2 3.500-4'),
  notte: P('M20 14.500A8.500 8.500 0 1 1 9.500 4a7 7 0 0 0 10.500 10.500z M18 3v4 M16 5h4'),
  mattina: P('M5 17a7 7 0 0 1 14 0 M2.500 17h19 M12 4v3 M5.500 8.500L7 10 M18.500 8.500L17 10 M7 21h10'),
  domenica: P('M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 10h16 M8 3v4 M16 3v4 M12 12.500l1 2 2.200.3-1.600 1.500.4 2.200-2-1-2 1 .4-2.200-1.600-1.500 2.200-.3z'),
  sabato: P('M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 10h16 M8 3v4 M16 3v4 M13.500 17a3 3 0 1 1-2.500-5 2.500 2.500 0 0 0 2.500 5z'),
  quasi: '<rect x="3" y="3" width="6" height="6" rx="1.500" fill="#FFD166"/><rect x="15" y="3" width="6" height="6" rx="1.500" fill="#FFD166"/><rect x="3" y="15" width="6" height="6" rx="1.500" fill="#FFD166"/><rect x="15" y="15" width="6" height="6" rx="1.500" stroke-dasharray="2 2" stroke-width="1.400"/>'
};

const n_ = (id, g, it, en, dIt, dEn, r, ok, nascosto) => ({ id, g, it, en, dIt, dEn, r, ok, nascosto: !!nascosto, i: ICONE[id] });
const TROFEI = [
  n_('p1', 'Pezzi', '1 pezzo', '1 item', 'Hai segnato il tuo primo pezzo.', 'You ticked your first item.', 'C', S => S.pezzi >= 1),
  n_('p10', 'Pezzi', '10 pezzi', '10 items', 'Hai segnato 10 pezzi in tutto il sito.', 'You ticked 10 items across the site.', 'C', S => S.pezzi >= 10),
  n_('p50', 'Pezzi', '50 pezzi', '50 items', 'Hai segnato 50 pezzi in tutto il sito.', 'You ticked 50 items across the site.', 'N', S => S.pezzi >= 50),
  n_('p100', 'Pezzi', '100 pezzi', '100 items', 'Hai segnato 100 pezzi in tutto il sito.', 'You ticked 100 items across the site.', 'R', S => S.pezzi >= 100),
  n_('p250', 'Pezzi', '250 pezzi', '250 items', 'Hai segnato 250 pezzi in tutto il sito.', 'You ticked 250 items across the site.', 'R', S => S.pezzi >= 250),
  n_('p500', 'Pezzi', '500 pezzi', '500 items', 'Hai segnato 500 pezzi in tutto il sito.', 'You ticked 500 items across the site.', 'E', S => S.pezzi >= 500),
  n_('p1000', 'Pezzi', '1000 pezzi', '1000 items', 'Hai segnato 1000 pezzi in tutto il sito.', 'You ticked 1000 items across the site.', 'L', S => S.pezzi >= 1000),
  n_('s1', 'Serie complete', '1 serie', '1 series', 'Hai completato la tua prima serie.', 'You completed your first series.', 'C', S => S.complete >= 1),
  n_('s5', 'Serie complete', '5 serie', '5 series', 'Hai completato 5 serie.', 'You completed 5 series.', 'N', S => S.complete >= 5),
  n_('s10', 'Serie complete', '10 serie', '10 series', 'Hai completato 10 serie.', 'You completed 10 series.', 'R', S => S.complete >= 10),
  n_('s25', 'Serie complete', '25 serie', '25 series', 'Hai completato 25 serie.', 'You completed 25 series.', 'E', S => S.complete >= 25),
  n_('s50', 'Serie complete', '50 serie', '50 series', 'Hai completato 50 serie.', 'You completed 50 series.', 'L', S => S.complete >= 50),
  n_('i5', 'Serie iniziate', '5 serie diverse', '5 different series', 'Hai segnato almeno un pezzo in 5 serie diverse.', 'You ticked at least one item in 5 different series.', 'C', S => S.iniziate >= 5),
  n_('i20', 'Serie iniziate', '20 serie diverse', '20 different series', 'Hai segnato almeno un pezzo in 20 serie diverse.', 'You ticked at least one item in 20 different series.', 'R', S => S.iniziate >= 20),
  n_('i50', 'Serie iniziate', '50 serie diverse', '50 different series', 'Hai segnato almeno un pezzo in 50 serie diverse.', 'You ticked at least one item in 50 different series.', 'E', S => S.iniziate >= 50),
  n_('c3', 'Esplorazione', '3 categorie', '3 categories', 'Hai pezzi segnati in 3 categorie diverse.', 'You have items ticked in 3 different categories.', 'E', S => S.categorie >= 3),
  n_('c6', 'Esplorazione', '6 categorie', '6 categories', 'Hai pezzi segnati in 6 categorie diverse.', 'You have items ticked in 6 different categories.', 'L', S => S.categorie >= 6),
  n_('m50', 'Completista', 'Categoria al 50%', 'Category at 50%', 'Hai metà dei pezzi di un\'intera categoria.', 'You have half of all the items in a whole category.', 'L', S => S.cat50),
  n_('d1', 'Doppioni', '1 doppione', '1 duplicate', 'Hai segnato il tuo primo doppione.', 'You marked your first duplicate.', 'C', S => S.doppi >= 1),
  n_('d10', 'Doppioni', '10 doppioni', '10 duplicates', 'Hai 10 doppioni da scambiare.', 'You have 10 duplicates to swap.', 'N', S => S.doppi >= 10),
  n_('d50', 'Doppioni', '50 doppioni', '50 duplicates', 'Hai 50 doppioni da scambiare.', 'You have 50 duplicates to swap.', 'R', S => S.doppi >= 50),
  n_('d100', 'Doppioni', '100 doppioni', '100 duplicates', 'Hai 100 doppioni da scambiare.', 'You have 100 duplicates to swap.', 'E', S => S.doppi >= 100),
  n_('cloud', 'Cloud', 'Collezione nel cloud', 'Collection in the cloud', 'Hai fatto l\'accesso: la tua collezione è al sicuro nel cloud.', 'You signed in: your collection is safe in the cloud.', 'C', S => S.cloud),
  n_('badge3', 'Profilo', 'Mi rappresenta', 'It\'s me', 'Hai scelto tutti e 3 i tuoi badge "Amante di…".', 'You picked all 3 of your "Lover of…" badges.', 'C', S => S.badge3),
  n_('tag', 'Profilo', 'Etichettatore', 'Tagger', 'Hai aggiunto il tuo primo hashtag a un pezzo.', 'You added your first hashtag to an item.', 'C', S => S.conTag),
  n_('notte', 'Nascosti', 'Nottambulo', 'Night owl', 'Hai segnato un pezzo tra mezzanotte e le 5.', 'You ticked an item between midnight and 5 a.m.', 'R', (S, ev) => ev.notte, true),
  n_('mattina', 'Nascosti', 'Mattiniero', 'Early bird', 'Hai segnato un pezzo tra le 5 e le 7.', 'You ticked an item between 5 and 7 a.m.', 'R', (S, ev) => ev.mattina, true),
  n_('domenica', 'Nascosti', 'Domenica da collezionista', 'Collector\'s Sunday', 'Hai segnato un pezzo di domenica.', 'You ticked an item on a Sunday.', 'C', (S, ev) => ev.domenica, true),
  n_('sabato', 'Nascosti', 'Weekend da collezionista', 'Collector\'s weekend', 'Hai segnato un pezzo di sabato sera, tra le 20 e le 23.', 'You ticked an item on a Saturday evening, between 8 and 11 p.m.', 'N', (S, ev) => ev.sabato, true),
  n_('quasi', 'Nascosti', 'Quasi!', 'So close!', 'Una serie è rimasta a un solo pezzo dalla fine per più di un giorno.', 'A series has been just one item away from complete for more than a day.', 'C', (S, ev) => ev.quasi, true)
];

const BADGE = [
  ['burger-king', 'Burger King', '#D62300'], ['coolthings', 'Cool Things', '#E50A15'], ['eurospin', 'Eurospin', '#004A99'],
  ['granterre', 'Granterre', '#7A9A2E'], ['kinder', 'Kinder', '#1A2140'], ['legami', 'Legami', '#E50A15'],
  ['lego', 'LEGO', '#E00000'], ['lidl', 'Lidl', '#1d1d86'], ['mcdonalds', 'McDonald’s', '#DA291C'], ['mulino-bianco', 'Mulino Bianco', '#A3282B'],
  ['findus', 'Findus', '#ff0000']
];

const en = () => typeof LINGUA !== 'undefined' && LINGUA === 'en';
const leggiJ = (k, base) => { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : base; } catch (e) { return base; } };
const scriviJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const oggi = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const nomeDi = t => en() ? t.en : t.it, descDi = t => en() ? t.dEn : t.dIt, raritaDi = t => RARITA[t.r][en() ? 'en' : 'it'];
const dataLunga = iso => { const [a, m, g] = iso.split('-').map(Number); return new Date(a, m - 1, g).toLocaleDateString(en() ? 'en-GB' : 'it-IT', { day: 'numeric', month: 'long', year: 'numeric' }); };
const icona = (t, px, col) => '<svg width="' + px + '" height="' + px + '" viewBox="0 0 24 24" fill="none" stroke="' + col + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t.i + '</svg>';

async function leggiSpunte() {
  let R;
  try { R = (await (await fetch(new URL('riepilogo.json', CATALOGO), { cache: 'no-cache' })).json()).serie; } catch (e) { return null; }
  if (!R) return null;
  const categoriaDi = s => String(s[3]).split(' · ')[0];
  const totaleCat = {};
  for (const s of Object.values(R)) {
    const esteri = s[4] || {};
    const tot = s[2] - (Object.keys(esteri).length < s[2] ? Object.keys(esteri).filter(id => paeseEstero(esteri[id])).length : 0);
    totaleCat[categoriaDi(s)] = (totaleCat[categoriaDi(s)] || 0) + tot;
  }
  const serie = {};
  const cePerCat = {}, perSlug = {};
  let conTag = false, estPezzi = 0;
  for (const nome of await archivi()) {
    const s = R[nome];
    if (!s) continue;
    const db = await apriArchivio(nome), righe = await leggi(db);
    db.close();
    const esteri = s[4] || {}, fuori = id => Object.keys(esteri).length < s[2] && !!esteri[id] && paeseEstero(esteri[id]);
    const tot = s[2] - Object.keys(esteri).filter(fuori).length;
    const ce = Math.min(righe.filter(r => !fuori(r.id) && (r.owned === true || r.doppi > 0)).length, tot);
    if (righe.some(r => r.tagsTouched === true && Array.isArray(r.tags) && r.tags.length)) conTag = true;
    estPezzi += righe.filter(r => fuori(r.id) && (r.owned === true || r.doppi > 0)).length;
    if (!ce) continue;
    serie[nome] = { ce, tot, doppi: righe.reduce((n, r) => n + (r.doppi > 0 ? r.doppi : 0), 0) };
    cePerCat[categoriaDi(s)] = (cePerCat[categoriaDi(s)] || 0) + ce;
    const slug = String(s[0]).split('/')[0];
    perSlug[slug] = (perSlug[slug] || 0) + 1;
  }
  return { serie, cePerCat, totaleCat, conTag, perSlug, estPezzi };
}
function numeri(d, cloud) {
  const v = Object.values(d.serie);
  const finita = s => s.tot >= 2 && s.ce >= s.tot;
  return {
    pezzi: v.reduce((n, s) => n + s.ce, 0) + (d.estPezzi || 0),
    complete: v.filter(finita).length,
    iniziate: v.length,
    categorie: Object.keys(d.cePerCat).length,
    doppi: v.reduce((n, s) => n + s.doppi, 0),
    badge3: leggiJ(CH_BADGE, []).length >= MAX_BADGE,
    conTag: !!d.conTag,
    cat50: Object.keys(d.cePerCat).some(c => d.totaleCat[c] > 0 && d.cePerCat[c] * 2 >= d.totaleCat[c]),
    cloud: !!cloud
  };
}
function eventi(d, prima, ora) {
  const ev = { notte: false, mattina: false, domenica: false, sabato: false, quasi: false };
  if (!prima) return ev;
  const somma = o => Object.values(o).reduce((n, x) => n + x, 0);
  const prima2 = Object.assign({ _estere: d.estPezzi || 0 }, prima);
  const aumento = somma(Object.fromEntries(Object.entries(d.serie).map(([k, s]) => [k, s.ce]))) + (d.estPezzi || 0) - somma(prima2);
  if (aumento < 1 || aumento > 3) return ev;
  const h = ora.getHours();
  ev.notte = h < 5; ev.mattina = h >= 5 && h < 7; ev.domenica = ora.getDay() === 0; ev.sabato = ora.getDay() === 6 && h >= 20 && h < 23;
  return ev;
}

export function valutaTrofei(S, ev, gia) {
  return TROFEI.filter(t => !gia[t.id] && t.ok(S, ev));
}

let inCorso = null, iniziatePerSlug = {};
export function controlla(modo) {
  if (inCorso) return inCorso;
  inCorso = (async () => {
    const d = await leggiSpunte();
    if (!d) return [];
    let cloud = false; try { cloud = localStorage.getItem('ct-accesso') === '1'; } catch (e) {}
    const S = numeri(d, cloud);
    const snapPrima = leggiJ(CH_SNAP, null);
    const ev = modo === 'tocco' ? eventi(d, snapPrima, new Date()) : { notte: false, mattina: false, domenica: false, sabato: false, quasi: false };
    const qm = leggiJ(CH_QUASI, {}), nq = {};
    for (const [k, s] of Object.entries(d.serie)) if (s.tot >= 3 && s.ce === s.tot - 1) { nq[k] = qm[k] || oggi(); if (qm[k] && qm[k] < oggi()) ev.quasi = true; }
    scriviJ(CH_QUASI, nq);
    iniziatePerSlug = d.perSlug || {};
    const su = leggiJ(CH_BADGE_SU, {});
    let suCambiato = false;
    for (const [id] of BADGE) if (!su[id] && iniziatePerSlug[id] >= SERIE_BADGE) { su[id] = oggi(); suCambiato = true; }
    if (suCambiato) scriviJ(CH_BADGE_SU, su);
    const gia = leggiJ(CH_TROFEI, {});
    const nuovi = valutaTrofei(S, ev, gia);
    nuovi.forEach(t => { gia[t.id] = oggi(); });
    if (nuovi.length) { scriviJ(CH_TROFEI, gia); window.dispatchEvent(new Event('ct-trofei-cambiati')); }
    scriviJ(CH_SNAP, Object.assign(Object.fromEntries(Object.entries(d.serie).map(([k, s]) => [k, s.ce])), { _estere: d.estPezzi || 0 }));
    return nuovi;
  })().catch(e => { console.warn('Trofei:', e); return []; }).finally(() => { inCorso = null; });
  return inCorso;
}

let attesa = 0;
export function alTocco() {
  clearTimeout(attesa);
  attesa = setTimeout(async () => { mostraNuovi(await controlla('tocco')); }, 1800);
}

function mostraNuovi(nuovi) {
  if (!nuovi.length) return;
  const coda = nuovi.slice(0, MAX_POPUP).map(t => ({ t }));
  if (nuovi.length > MAX_POPUP) coda.push({ altri: nuovi.length - MAX_POPUP });
  const passo = () => { const x = coda.shift(); if (x) popup(x, () => setTimeout(passo, 350)); };
  passo();
}
function popup(x, fine) {
  document.querySelectorAll('.trofeo-pop').forEach(e => e.remove());
  const m = document.createElement('div');
  m.setAttribute('role', 'status');
  if (x.t) {
    const t = x.t, r = RARITA[t.r];
    m.className = 'trofeo-pop';
    m.style.setProperty('--col', r.col); m.style.setProperty('--glow', r.glow);
    m.innerHTML = '<div class="trofeo-med">' + icona(t, 28, '#FFD166') + '</div>'
      + '<div class="tt"><small>' + esc(raritaDi(t)) + '</small><b>' + esc(nomeDi(t)) + '</b><span>' + esc(descDi(t)) + '</span></div>';
  } else {
    m.className = 'trofeo-pop';
    m.style.setProperty('--col', '#F2A900'); m.style.setProperty('--glow', RARITA.L.glow);
    m.innerHTML = '<div class="trofeo-med">' + icona({ i: ICONE.s50 }, 28, '#FFD166') + '</div>'
      + '<div class="tt"><b>' + (en() ? '+' + x.altri + ' more trophies' : '+' + x.altri + ' altri trofei') + '</b><span>'
      + (en() ? 'See them all in Settings.' : 'Li trovi tutti in Impostazioni.') + '</span></div>';
  }
  document.body.append(m);
  requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('su')));
  setTimeout(() => { m.classList.remove('su'); setTimeout(() => { m.remove(); if (fine) fine(); }, 500); }, MS_POPUP);
}

export async function disegnaProfilo(box) {
  await controlla('pagina');
  const gia = leggiJ(CH_TROFEI, {});
  const sbloccati = TROFEI.filter(t => gia[t.id]), tot = TROFEI.length;
  const visibili = TROFEI.filter(t => gia[t.id] || !t.nascosto), misteri = TROFEI.filter(t => !gia[t.id] && t.nascosto);
  const carta = t => {
    const su = !!gia[t.id], r = RARITA[t.r];
    return '<li class="trofeo' + (su ? ' su' : '') + '"' + (su ? ' style="--col:' + r.col + ';--glow:' + r.glow + '"' : '') + '>'
      + '<div class="trofeo-med">' + icona(t, 26, su ? '#FFD166' : '#8A93AD') + '</div>'
      + '<div class="tt"><b>' + esc(nomeDi(t)) + '</b>'
      + (su ? '<small class="ra" style="color:' + r.col + '">' + esc(raritaDi(t)) + '</small><small>' + esc((en() ? 'Unlocked on ' : 'Sbloccato il ') + dataLunga(gia[t.id])) + '</small>'
            : '<small>' + esc(descDi(t)) + '</small>') + '</div></li>';
  };
  const mistero = '<li class="trofeo mistero"><div class="trofeo-med">??</div><div class="tt"><b>??</b></div></li>';
  const scelti = leggiJ(CH_BADGE, []), badgeSu = leggiJ(CH_BADGE_SU, {});
  const aperto = id => !!badgeSu[id] || scelti.includes(id);
  let conAccount = false; try { conAccount = localStorage.getItem('ct-accesso') === '1'; } catch (e) {}
  if (!box.dataset.accesso) { box.dataset.accesso = '1'; window.addEventListener('ct-accesso', () => disegnaProfilo(box)); }
  box.innerHTML =
    '<div class="trofei-testa"><b>' + (en() ? 'Trophies unlocked: ' + sbloccati.length + ' of ' + tot : 'Trofei sbloccati: ' + sbloccati.length + ' su ' + tot) + '</b>'
    + '<span class="st-progresso"><i style="width:' + Math.round(sbloccati.length * 100 / tot) + '%"></i></span></div>'
    + '<ul class="trofei-griglia">' + visibili.map(carta).join('') + misteri.map(() => mistero).join('') + '</ul>'
    + '<h3 class="st-imp-sotto">' + (en() ? 'My badges' : 'I miei badge') + '</h3>'
    + (conAccount
      ? '<p class="st-imp-nota">' + (en() ? 'Pick up to ' + MAX_BADGE + ' badges to show on your profile.' : 'Scegli fino a ' + MAX_BADGE + ' badge da mostrare sul tuo profilo.') + '</p>'
        + '<div class="badge-zona"></div>'
      : '<p class="st-imp-nota">' + (en() ? 'Badges are for people with an account: sign in to pick the ones that represent you.' : 'I badge sono per chi ha un account: accedi per scegliere quelli che ti rappresentano.') + '</p>'
        + '<p><button type="button" class="st-btn" data-accedi>' + (en() ? 'Sign in' : 'Accedi') + '</button></p>');
  const zona = box.querySelector('.badge-zona');
  if (zona) disegnaBadge(zona);
  box.onclick = async e => {
    if (e.target.closest('[data-badge-apri]')) { badgeAperto = !badgeAperto; if (zona) disegnaBadge(zona); return; }
    const b = e.target.closest('[data-badge]');
    if (!b || !conAccount) return;
    if (b.dataset.bloccato) { if (typeof avviso === 'function') avviso(en() ? 'Start ' + SERIE_BADGE + ' series in this category to unlock it.' : 'Inizia ' + SERIE_BADGE + ' serie in questa categoria per sbloccarlo.'); return; }
    let s = leggiJ(CH_BADGE, []);
    const id = b.dataset.badge;
    if (s.includes(id)) s = s.filter(x => x !== id);
    else if (s.length >= MAX_BADGE) { if (typeof avviso === 'function') avviso(en() ? 'You can pick up to ' + MAX_BADGE + ' badges.' : 'Puoi sceglierne al massimo ' + MAX_BADGE + '.'); return; }
    else s.push(id);
    scriviJ(CH_BADGE, s);
    try { localStorage.setItem('ct-badge-t', String(Date.now())); } catch (e) {}
    window.dispatchEvent(new Event('ct-trofei-cambiati'));
    if (zona) disegnaBadge(zona);
    mostraNuovi(await controlla('pagina'));
  };
}
let badgeAperto = false, badgeQ = '';
function disegnaBadge(zona) {
  const scelti = leggiJ(CH_BADGE, []), su = leggiJ(CH_BADGE_SU, {});
  const mie = BADGE.filter(([id]) => su[id] || scelti.includes(id));
  const card = ([id, nome, col]) => badgeHtml(id, nome, col, scelti.includes(id), true, 0);
  if (!mie.length) { zona.innerHTML = '<p class="st-imp-nota">' + (en() ? 'No badges yet: start ' + SERIE_BADGE + ' series in a category to unlock its badge.' : 'Ancora nessun badge: inizia ' + SERIE_BADGE + ' serie in una categoria per sbloccare il suo.') + '</p>'; return; }
  if (mie.length < BADGE_CERCA) { zona.innerHTML = '<div class="badge-lista">' + mie.map(card).join('') + '</div>'; return; }
  const q = badgeQ.trim().toLowerCase(), filtrati = q ? mie.filter(([, nome]) => nome.toLowerCase().includes(q)) : mie;
  zona.innerHTML =
    '<p class="st-imp-nota"><b>' + (en() ? scelti.length + ' picked of ' + MAX_BADGE + ' · ' + mie.length + ' unlocked' : scelti.length + ' scelti su ' + MAX_BADGE + ' · ' + mie.length + ' sbloccati') + '</b></p>'
    + '<div class="badge-lista">' + (scelti.length ? mie.filter(([id]) => scelti.includes(id)).map(card).join('') : '<span class="st-imp-nota">' + (en() ? 'No badge picked yet.' : 'Nessun badge scelto.') + '</span>') + '</div>'
    + '<p><button type="button" class="st-btn" data-badge-apri aria-expanded="' + badgeAperto + '">' + (badgeAperto ? (en() ? 'Close' : 'Chiudi') : (en() ? 'Change or pick from ' + mie.length + ' unlocked' : 'Cambia o scegli tra i ' + mie.length + ' sbloccati')) + '</button></p>'
    + (badgeAperto
      ? '<input id="badgeCerca" type="search" placeholder="' + (en() ? 'Search a category' : 'Cerca una categoria') + '" aria-label="' + (en() ? 'Search a category' : 'Cerca una categoria') + '" value="' + esc(badgeQ) + '">'
        + '<div class="badge-lista">' + (filtrati.length ? filtrati.map(card).join('') : '<span class="st-imp-nota">' + (en() ? 'No results.' : 'Nessun risultato.') + '</span>') + '</div>'
      : '');
  const inp = zona.querySelector('#badgeCerca');
  if (inp) inp.oninput = () => { badgeQ = inp.value; const pos = inp.selectionStart; disegnaBadge(zona); const n = zona.querySelector('#badgeCerca'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } };
}
function badgeHtml(id, nome, col, on, aperto, n) {
  return '<button type="button" class="badge' + (on ? ' on' : '') + (aperto ? '' : ' bloccato') + '"' + (aperto ? '' : ' data-bloccato="1"') + ' data-badge="' + id + '" aria-pressed="' + on + '" style="--col:' + col + '">'
    + '<span class="cuore"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 21s-8-5-8-11a4.500 4.500 0 0 1 8-2.800A4.500 4.500 0 0 1 20 10c0 6-8 11-8 11z"/></svg></span>'
    + '<span class="tt"><small>' + (aperto ? (en() ? 'LOVER OF' : 'AMANTE DI') : (en() ? 'LOCKED · ' : 'BLOCCATO · ') + Math.min(n, SERIE_BADGE) + '/' + SERIE_BADGE + (en() ? ' series' : ' serie')) + '</small><b>' + esc(nome) + '</b></span></button>';
}

export const _TROFEI = TROFEI;
export const _BADGE = BADGE;

