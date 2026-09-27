/* =====================================================================
   pubblica.js — scheda "Pubblica" dell'area amministratore (Collection Time)
   ---------------------------------------------------------------------
   Copia la cartella del sito (Scrivania) nella cartella del repository
   GitHub (Documenti/GitHub/collectiontime), come un copia-incolla fatto
   bene:
     • copia solo i file NUOVI o CAMBIATI (veloce);
     • toglie dal repository i file che nel sito non ci sono più;
     • NON copia le cartelle di lavoro (NON_PUBBLICARE qui sotto),
       né i file nascosti del Mac (.DS_Store), e non tocca mai .git.
   Dopo, in GitHub Desktop basta: "Aggiornamento" → Commit → Push.
   Usa cartella, ricorda, ricordato, messaggio, esc di admin.js.
   ===================================================================== */

/* cartelle del sito che NON vanno sul sito pubblico (solo quelle in cima) */
const NON_PUBBLICARE = ['_backup', '_ko-fi', '_nuovo_da_fare', '_to_delete'];
/* file e cartelle da saltare ovunque */
const SALTA = new Set(['.DS_Store', '.git']);
/* dove sta il repository sul Mac (serve solo per aprire GitHub Desktop) */
const PERCORSO_REPO = '/Users/domenicotagliente/Documents/GitHub/collectiontime';

let repo = null;          // la cartella del repository collegata
let piano = null;         // cosa c'è da fare: { copia: [{ percorso, file, nuovo }], togli: [percorso] }

/* ---------- collegare il repository (ricordato come la cartella del sito) ---------- */
async function usaRepo(d) {
  let ok = false;
  try { await d.getDirectoryHandle('.git'); await d.getFileHandle('CNAME'); ok = true; } catch (e) {}
  if (!ok) { alert('Questa non sembra la cartella del repository: dentro devono esserci la cartella .git e il file CNAME. Scegli Documenti → GitHub → collectiontime.'); return false; }
  repo = d;
  ricorda('repo', d);
  $('pbRepo').textContent = '✓ ' + d.name;
  $('pbCollega').textContent = 'Cambia cartella';
  $('pbControlla').disabled = false;
  return true;
}
$('pbCollega').addEventListener('click', async () => {
  const vecchia = !repo && await ricordato('repo');
  if (vecchia) {
    try { if ((await vecchia.requestPermission({ mode: 'readwrite' })) === 'granted' && await usaRepo(vecchia)) return; } catch (e) {}
  }
  try { await usaRepo(await showDirectoryPicker({ id: 'collectiontime-repo', mode: 'readwrite' })); }
  catch (e) { if (e.name !== 'AbortError') alert('Non riesco ad aprire la cartella: ' + e.message); }
});
(async () => {
  const vecchia = await ricordato('repo');
  if (!vecchia) return;
  try { if ((await vecchia.queryPermission({ mode: 'readwrite' })) === 'granted') { await usaRepo(vecchia); return; } } catch (e) {}
  $('pbCollega').textContent = 'Riapri la cartella “' + vecchia.name + '”';
})();
$('pbDesktop').href = 'x-github-client://openLocalRepo/' + encodeURI(PERCORSO_REPO);

/* ---------- elenco dei file di una cartella: Map percorso → { handle, cartella } ---------- */
async function elencaFile(d, prefisso = '', fuori = new Map(), cima = true) {
  for await (const [nome, h] of d.entries()) {
    if (SALTA.has(nome) || (cima && NON_PUBBLICARE.includes(nome))) continue;
    if (h.kind === 'directory') await elencaFile(h, prefisso + nome + '/', fuori, false);
    else fuori.set(prefisso + nome, { handle: h, cartella: d, nome });
  }
  return fuori;
}
/* due file sono uguali? stessa grandezza e (controllo completo) stesso contenuto;
   senza controllo completo: stessa grandezza e il file del sito NON è più recente della copia */
async function uguali(a, b, completo) {
  if (a.size !== b.size) return false;
  if (!completo) return a.lastModified <= b.lastModified;
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) return false;
  return true;
}

/* ---------- 1) CONTROLLA: cosa cambia ---------- */
$('pbControlla').addEventListener('click', async () => {
  const b = $('pbControlla'), out = $('pbMsg');
  if (!cartella) { messaggio(out, 'Prima collega la cartella del sito (in alto).', 'err'); return; }
  b.disabled = true; $('pbCopia').disabled = true; $('pbDopo').hidden = true;
  try {
    messaggio(out, 'Leggo i file del sito e del repository…');
    const [sito, rep] = await Promise.all([elencaFile(cartella), elencaFile(repo)]);
    const completo = $('pbCompleto').checked;
    piano = { copia: [], togli: [] };
    let n = 0;
    for (const [p, s] of sito) {
      if (++n % 200 === 0) messaggio(out, 'Confronto i file… ' + n + ' di ' + sito.size);
      const f = await s.handle.getFile();
      const r = rep.get(p);
      if (!r) piano.copia.push({ percorso: p, file: f, nuovo: true });
      else if (!(await uguali(f, await r.handle.getFile(), completo))) piano.copia.push({ percorso: p, file: f, nuovo: false });
    }
    for (const [p, r] of rep) if (!sito.has(p)) piano.togli.push({ percorso: p, cartella: r.cartella, nome: r.nome });
    const nuovi = piano.copia.filter(x => x.nuovo).length, cambiati = piano.copia.length - nuovi;
    if (!piano.copia.length && !piano.togli.length) { messaggio(out, '✓ Il repository è già uguale al sito: non c\'è niente da copiare.', 'ok'); piano = null; return; }
    const elenco = (titolo, righe) => righe.length ? '\n\n' + titolo + ' (' + righe.length + '):\n· ' + righe.slice(0, 40).join('\n· ') + (righe.length > 40 ? '\n· … e altri ' + (righe.length - 40) : '') : '';
    messaggio(out, 'Da fare: ' + nuovi + ' file nuovi, ' + cambiati + ' cambiati, ' + piano.togli.length + ' da togliere dal repository.' +
      elenco('Nuovi', piano.copia.filter(x => x.nuovo).map(x => x.percorso)) +
      elenco('Cambiati', piano.copia.filter(x => !x.nuovo).map(x => x.percorso)) +
      elenco('Da togliere (nel sito non ci sono più)', piano.togli.map(x => x.percorso)));
    $('pbCopia').disabled = false;
  } catch (e) { messaggio(out, 'Errore: ' + e.message, 'err'); }
  finally { b.disabled = false; }
});

/* ---------- 2) COPIA nel repository ---------- */
async function cartellaRepo(percorso) {
  let d = repo;
  for (const nome of percorso.split('/').slice(0, -1)) d = await d.getDirectoryHandle(nome, { create: true });
  return d;
}
$('pbCopia').addEventListener('click', async () => {
  if (!piano) return;
  const b = $('pbCopia'), out = $('pbMsg');
  if (piano.togli.length && !confirm('Tolgo dal repository ' + piano.togli.length + ' file che nel sito non ci sono più. Va bene?')) return;
  b.disabled = true; $('pbControlla').disabled = true;
  try {
    let n = 0;
    for (const x of piano.copia) {
      if (++n % 20 === 0) messaggio(out, 'Copio… ' + n + ' di ' + piano.copia.length);
      const d = await cartellaRepo(x.percorso);
      const w = await (await d.getFileHandle(x.percorso.split('/').pop(), { create: true })).createWritable();
      await w.write(x.file); await w.close();
    }
    for (const x of piano.togli) await x.cartella.removeEntry(x.nome);
    messaggio(out, '✓ Copiati ' + piano.copia.length + ' file' + (piano.togli.length ? ' e tolti ' + piano.togli.length : '') + '. Ora pubblica con GitHub Desktop (qui sotto).', 'ok');
    $('pbDopo').hidden = false;
    piano = null;
  } catch (e) { messaggio(out, 'Errore durante la copia: ' + e.message + '\nPremi di nuovo “Controlla cosa cambia” e riprova.', 'err'); }
  finally { $('pbControlla').disabled = false; }
});
