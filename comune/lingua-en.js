/* =====================================================================
   lingua-en.js — il sito in INGLESE (Collection Time)
   ---------------------------------------------------------------------
   Questo file si carica SOLO quando il visitatore sceglie "English"
   (link nella banda in basso o pagina Impostazioni): chi legge in italiano
   non scarica niente in più. Lo carica script.js (voce 15, "La lingua").

   COME FUNZIONA (semplice)
     • Le pagine restano scritte in ITALIANO: l'italiano è la lingua "vera" del sito.
     • Questo file è un dizionario: a sinistra la frase in italiano, a destra
       quella in inglese. Il sito cerca le frasi uguali nella pagina (anche quelle
       che crea il codice, come gli avvisi) e le sostituisce.
     • Una frase che NON è nel dizionario resta in italiano: non si rompe niente.
       Per questo i nomi delle serie, dei pezzi e delle categorie (e le serie
       nuove) NON vanno tradotti e non devi fare niente quando ne crei una.
     • Le descrizioni delle serie ("La checklist completa delle 25 sorpresine di…")
       si traducono da sole con i MODELLI più in basso.
     • Testi lunghi con link o grassetti (FAQ, Contatti): l'inglese sta dentro la
       pagina stessa, nell'attributo data-en="…" del paragrafo, accanto
       all'italiano. Se cambi l'italiano ricordati di cambiare anche il data-en.

   PER AGGIUNGERE O CAMBIARE UNA FRASE
     Trova la riga nell'elenco FRASI e cambia quello a destra; per una frase nuova
     copia una riga e scrivi:  "frase in italiano": "frase in inglese",
     La frase italiana deve essere IDENTICA a quella del sito (stesse lettere,
     apostrofi e punteggiatura). Le maiuscole contano meno: "MI MANCANO" si
     traduce con la riga "Mi mancano" (e resta tutto maiuscolo).
     Non dimenticare la virgola alla fine della riga.

   Non cambia: Privacy e Note legali (restano in italiano), le immagini da
   condividere (hanno le scritte dentro l'immagine) e il testo dei social.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- 1) FRASI: italiano → inglese ---------- */
  var FRASI = {
    /* — banda in alto, banda in basso, menu del profilo — */
    "Accedi": "Sign in",
    "Esci": "Sign out",
    "Accedi con Google e salva la collezione nel cloud": "Sign in with Google and save your collection in the cloud",
    "Accedi e salva la collezione nel cloud": "Sign in and save your collection in the cloud",
    "Collection Time, pagina iniziale": "Collection Time, home page",
    "Informazioni": "Information",
    "Un catalogo fatto da un collezionista, per i collezionisti.": "A catalog made by a collector, for collectors.",
    "Aggiungi alla Home": "Add to Home Screen",
    "Sostieni": "Support",
    "il progetto": "the project",
    "Come funziona (FAQ)": "How it works (FAQ)",
    "FAQ": "FAQ",
    "Contatti": "Contact",
    "Impostazioni": "Settings",
    "Note legali": "Legal notice",
    "Sito amatoriale e non ufficiale, non affiliato né approvato dalle aziende produttrici degli oggetti presentati. Marchi, nomi dei prodotti e immagini appartengono ai rispettivi proprietari e sono usati solo per riconoscere gli oggetti della collezione. Sei il titolare di un'immagine e vuoi che venga tolta?": "Unofficial fan site, not affiliated with or endorsed by the companies that make the items shown. Trademarks, product names and images belong to their respective owners and are used only to identify the items in the collection. Do you own an image and want it removed?",
    "Scrivimi": "Write to me",
    "e la rimuovo.": "and I'll remove it.",
    "Sito non ufficiale, non affiliato ai produttori. Marchi e immagini appartengono ai rispettivi proprietari.": "Unofficial site, not affiliated with the manufacturers. Trademarks and images belong to their respective owners.",
    "Dettagli": "Details",
    "Il mio profilo": "My profile",
    "Le mie statistiche ›": "My statistics ›",
    "Collezioni": "Collections",
    "Nome": "Name",
    "Cambia nome": "Change name",
    "Il tuo nome": "Your name",
    "Accesso": "Sign-in",
    "con Google": "with Google",
    "Cambia password": "Change password",
    "Elimina account…": "Delete account…",
    "Eliminare l'account?": "Delete the account?",
    "Vengono cancellati": "These will be deleted",
    "per sempre": "forever",
    "Elimina per sempre": "Delete forever",
    "Annulla": "Cancel",
    "Salva": "Save",
    "Chiudi": "Close",
    "Salvata nel cloud": "Saved in the cloud",
    "Salvataggio nel cloud in corso…": "Saving to the cloud…",

    /* — finestra Accedi — */
    "La tua collezione nel cloud": "Your collection in the cloud",
    "Accedi per": "Sign in to",
    "salvare la collezione nel cloud": "save your collection in the cloud",
    "e ritrovarla sul telefono, sul computer e su un nuovo dispositivo.": "and find it again on your phone, your computer and any new device.",
    "Accedi con Google": "Sign in with Google",
    "oppure con la tua email": "or with your email",
    "Continua con Google": "Continue with Google",
    "Il modo più rapido: senza password e senza email da confermare.": "The quickest way: no password and no email to confirm.",
    "Oppure registrati con l'email →": "Or sign up with email →",
    "Email": "Email",
    "Password": "Password",
    "Nuova password (min. 6 caratteri)": "New password (min. 6 characters)",
    "Nickname (facoltativo)": "Nickname (optional)",
    "Controlla l'email: sembra incompleta.": "Check the email: it looks incomplete.",
    "Questo indirizzo email non è accettato: usa la tua email vera.": "This email address is not accepted: please use your real email.",
    "Account creato. Ti ho mandato un'email: apri il link per confermarla e salvare la collezione nel cloud (guarda anche nello spam).": "Account created. I've sent you an email: open the link to confirm it and save your collection in the cloud (check your spam folder too).",
    "Account creato. Apri il menu del profilo per confermare l'email e salvare la collezione nel cloud.": "Account created. Open the profile menu to confirm your email and save your collection in the cloud.",
    "Sei uscito. La collezione è rimasta su questo dispositivo perché l'email non era ancora confermata.": "You're signed out. Your collection stayed on this device because your email wasn't confirmed yet.",
    "Per salvare nel cloud conferma la tua email (menu del profilo).": "To save to the cloud, confirm your email (profile menu).",
    "Il tuo account non ha ancora la conferma dell'email: apri il link che ti abbiamo mandato (o rimandalo dal menu del profilo) e la collezione si salverà nel cloud.": "Your account's email isn't confirmed yet: open the link we sent you (or send it again from the profile menu) and your collection will be saved in the cloud.",
    "Conferma la tua email per salvare nel cloud": "Confirm your email to save to the cloud",
    "Invia di nuovo l'email": "Send the email again",
    "Ho confermato": "I've confirmed",
    "Email confermata: la tua collezione ora si salva nel cloud.": "Email confirmed: your collection is now saved in the cloud.",
    "Non vedo ancora la conferma: apri il link nell'email e riprova.": "I don't see the confirmation yet: open the link in the email and try again.",
    "Non riesco a controllare adesso: riprova tra poco.": "I can't check right now: try again shortly.",
    "Email inviata di nuovo (guarda anche nello spam).": "Email sent again (check your spam folder too).",
    "Non riesco a inviare l'email adesso: riprova tra qualche minuto.": "I can't send the email right now: try again in a few minutes.",
    "Crea account": "Create account",
    "Hai già un account? Accedi": "Already have an account? Sign in",
    "Password dimenticata?": "Forgot your password?",
    "Non hai un account? Crea account": "Don't have an account? Create account",
    "Iscrivendoti accetti la": "By signing up you accept the",
    "Privacy": "Privacy",
    "Salviamo solo il tuo nome, la tua email, il tuo paese e quello che segni sul sito (spunte, doppioni, hashtag). Dettagli nella pagina Privacy.": "We only save your name, your email, your country and what you mark on the site (checks, duplicates, hashtags). Details on the Privacy page.",
    "Scegli il tuo paese": "Choose your country",
    "Non vuoi un account?": "Don't want an account?",
    "Spunte già presenti": "Existing checks",
    "Su questo dispositivo ci sono già delle spunte che non sono nel tuo account.": "This device already has checks that are not in your account.",
    "Se sono prove o non sono tue, usa solo quelle del tuo account.": "If they are tests or not yours, use only the ones in your account.",
    "Aggiungile al mio account": "Add them to my account",
    "Usa solo quelle del mio account": "Use only my account's",
    "Se vuoi solo uscire da questo dispositivo, usa": "If you only want to leave this device, use",
    ": la collezione resta nel tuo account.": ": your collection stays in your account.",

    /* — avvisi (messaggi che compaiono in basso) — */
    "Accesso fatto: la tua collezione si salva anche nel cloud.": "Signed in: your collection is now also saved in the cloud.",
    "Il browser ha bloccato la finestra di Google: permetti i pop-up per questo sito e riprova.": "Your browser blocked the Google window: allow pop-ups for this site and try again.",
    "Accesso non riuscito. Riprova tra poco.": "Sign-in failed. Please try again shortly.",
    "L'indirizzo email non è scritto bene.": "The email address doesn't look right.",
    "Scrivi la password.": "Enter your password.",
    "La password deve avere almeno 6 caratteri.": "The password must have at least 6 characters.",
    "Esiste già un account con questa email: premi \"Accedi\" (se l'hai creato con Google, usa \"Continua con Google\").": "An account with this email already exists: press “Sign in” (if you created it with Google, use “Continue with Google”).",
    "Email o password sbagliate. Se non hai ancora un account premi \"Crea account\"; se ti sei iscritto con Google usa \"Continua con Google\".": "Wrong email or password. If you don't have an account yet press “Create account”; if you signed up with Google use “Continue with Google”.",
    "Non c'è nessun account con questa email: premi \"Crea account\".": "There is no account with this email: press “Create account”.",
    "Password sbagliata.": "Wrong password.",
    "Troppi tentativi: aspetta qualche minuto e riprova.": "Too many attempts: wait a few minutes and try again.",
    "Connessione assente: riprova quando sei online.": "No connection: try again when you're online.",
    "L'accesso con email non è ancora attivo. Riprova più tardi.": "Email sign-in is not available yet. Please try again later.",
    "L'accesso non è ancora attivo. Riprova più tardi.": "Sign-in is not available yet. Please try again later.",
    "Qualcosa non ha funzionato. Riprova tra poco.": "Something went wrong. Please try again shortly.",
    "Account creato: la tua collezione si salva anche nel cloud.": "Account created: your collection is now also saved in the cloud.",
    "Scrivi la tua email qui sopra, poi premi di nuovo \"Password dimenticata?\".": "Enter your email above, then press “Forgot your password?” again.",
    "Ti ho mandato un'email per scegliere una nuova password (guarda anche nello spam).": "I've sent you an email to choose a new password (check your spam folder too).",
    "Ti ho mandato un'email per scegliere la nuova password (guarda anche nello spam).": "I've sent you an email to choose a new password (check your spam folder too).",
    "Sei uscito: la collezione è al sicuro nel tuo account e non è più su questo dispositivo.": "You're signed out: your collection is safe in your account and no longer on this device.",
    "Account e collezione eliminati.": "Account and collection deleted.",
    "Collezione eliminata. Per eliminare anche l'account, accedi di nuovo e ripeti subito.": "Collection deleted. To delete the account as well, sign in again and repeat right away.",
    "Nome cambiato.": "Name changed.",
    "Non sono riuscito a cambiare il nome. Riprova.": "I couldn't change the name. Please try again.",
    "Paese salvato.": "Country saved.",
    "Non c'è ancora niente da esportare.": "There is nothing to export yet.",
    "File salvato nella cartella Download.": "File saved in your Downloads folder.",
    "Questo file non è un backup di Collection Time.": "This file is not a Collection Time backup.",
    "Più tardi": "Later",
    "Non riesco a collegarmi: controlla la connessione e riprova.": "I can't connect: check your connection and try again.",
    "Questo browser non permette di leggere o salvare le collezioni.": "This browser doesn't allow reading or saving collections.",
    "Questo browser non permette di salvare la collezione (per esempio in navigazione privata).": "This browser doesn't allow saving the collection (for example in private browsing).",
    "Salvataggio non riuscito.": "Saving failed.",
    "Categoria tolta dalle fissate": "Category unpinned",
    "Categoria fissata in alto": "Category pinned to the top",
    "Tolto anche il doppione.": "The duplicate was removed too.",
    "Segnato anche «Ce l'ho»: se hai un doppione, ce l'hai.": "Also marked “Owned”: if you have a duplicate, you own it.",
    "Link copiato: incollalo dove vuoi.": "Link copied: paste it wherever you like.",
    "Accedi per creare questa immagine.": "Sign in to create this image.",
    "Immagine salvata nella cartella Download.": "Image saved in your Downloads folder.",
    "Non sono riuscito a creare l'immagine.": "I couldn't create the image.",
    "L'immagine non si può creare con la pagina aperta dal Finder: aprila dal sito o da un server locale.": "The image can't be created from a page opened from Finder: open it from the website or a local server.",
    "Non ti manca nulla.": "You're not missing anything.",
    "Non hai doppioni.": "You have no duplicates.",
    "Non ti manca nulla e non hai doppioni.": "You're not missing anything and you have no duplicates.",
    "Novità precedenti": "Previous news",
    "Novità successive": "Next news",

    /* — Home — */
    "Catalogo collezioni": "Collection catalog",
    "Cerca una categoria": "Search a category",
    "pezzi catalogati": "items cataloged",
    "serie": "series",
    "categorie": "categories",
    "collezionisti iscritti": "registered collectors",
    "Novità": "New",
    "Nuova": "New",
    "Tutte le categorie": "All categories",
    "Nessuna categoria trovata.": "No category found.",
    "Le collezioni a tema Legami.": "Legami-themed collections.",
    "Le serie di minifigure da collezione.": "Collectible minifigure series.",
    "Le sorpresine di ovetti e merendine.": "Surprises from eggs and snacks.",
    "Oggetti Gacha da collezionare.": "Gacha items to collect.",
    "Le collezioni dei supermercati Lidl.": "Collections from Lidl supermarkets.",
    "Le collezioni dei supermercati Eurospin.": "Collections from Eurospin supermarkets.",
    "Le collezioni delle merende GranTerre.": "Collections from GranTerre snacks.",
    "Sorpresine e raccolta punti.": "Surprises and loyalty-point prizes.",
    "Happy Meal e gadget da collezione.": "Happy Meal toys and collectible gadgets.",
    "I giochi dei King Jr. Meal.": "Toys from the King Jr. Meal.",
    "I giochi dei menu per bambini.": "Toys from the kids' meals.",
    "I ciondoli da collezione.": "Collectible charms.",
    "Apri": "Open",
    "Come funziona": "How it works",
    "Trova la serie": "Find the series",
    "Scegli la categoria e apri la serie che collezioni.": "Pick the category and open the series you collect.",
    "Spunta i pezzi": "Check off your items",
    "Tocca quelli che hai: si illuminano. Segna anche i doppioni.": "Tap the ones you have: they light up. Mark your duplicates too.",
    "Vedi cosa ti manca": "See what you're missing",
    "In «Mi mancano» trovi la lista pronta da stampare o condividere.": "In “Missing” you'll find a ready-made list to print or share.",
    "Seguici per le novità": "Follow us for updates",
    "Nuove serie, curiosità e storie dal catalogo.": "New series, curiosities and stories from the catalog.",

    /* — pagine delle categorie e barra in basso — */
    "← Tutte le collezioni": "← All collections",
    "Cerca una collezione": "Search a collection",
    "Nessuna collezione trovata.": "No collection found.",
    "Entra in un gruppo: segnalazioni, scambi e idee.": "Join a group: tips, swaps and ideas.",
    "Gruppo Facebook": "Facebook group",
    "Profilo Instagram": "Instagram profile",
    "Gruppo WhatsApp": "WhatsApp group",
    "Gruppo Telegram": "Telegram group",
    "Server Discord": "Discord server",
    "Profilo TikTok": "TikTok profile",
    "Canale YouTube": "YouTube channel",
    "Community Reddit": "Reddit community",
    "Scrivici e lo aggiungiamo qui": "Write to us and we'll add it here",
    "Segnala un problema": "Report a problem",
    "Serie": "Series",
    "Doppioni": "Duplicates",
    "Cerca": "Search",
    "Sezioni della categoria": "Category sections",
    "Chiudi tutte le tendine": "Close all sections",
    "Apri tutte le tendine": "Open all sections",
    "Dalla più vecchia": "Oldest first",
    "Dalla più recente": "Newest first",
    "Tutti i gruppi": "All groups",
    "Tieni premuta una categoria per fissarla in alto": "Press and hold a category to pin it to the top",

    /* — pagina di una serie — */
    "Tutte": "All",
    "Tutti": "All",
    "In possesso": "Owned",
    "Mi mancano": "Missing",
    "Dalla prima": "From the first",
    "Dall'ultima": "From the last",
    "Dal primo": "From the first",
    "Dall'ultimo": "From the last",
    "Doppi": "Dupes",
    "Stampa": "Print",
    "Condividi": "Share",
    "info": "info",
    "Info": "Info",
    "Nessun risultato per questi filtri.": "No results for these filters.",
    "Non ci sono ancora elementi in questa collezione.": "There are no items in this collection yet.",
    "Nessun risultato.": "No results.",
    "Nessuna foto per questo numero.": "No photo for this number.",
    "Colore": "Color",
    "Numero": "Number",
    "Metadati": "Metadata",
    "Suggeriti:": "Suggested:",
    "Varianti estere": "Foreign variants",
    "Estero": "Abroad",
    "non indicato": "not specified",
    "Percorso": "Breadcrumb",
    "Quanto hai completato": "How much you've completed",
    "Cerca numero, nome, info": "Search number, name, info",
    "Mostra": "Show",
    "Ordine": "Order",
    "Aggiungi un hashtag": "Add a hashtag",
    "Un doppione in meno": "One duplicate less",
    "Un doppione in più": "One duplicate more",
    "Ce l'ho": "Owned",
    "Dettagli dell'oggetto": "Item details",
    "Quali serie": "Which series",
    "Quali": "Which",

    /* — finestra Stampa / immagine da condividere — */
    "Cosa vuoi stampare?": "What do you want to print?",
    "Stampa anche le varianti estere": "Also print foreign variants",
    "Crea un'immagine da condividere.": "Create an image to share.",
    "La mia collezione": "My collection",
    "Cerco e scambio": "Wanted & trading",
    "Da condividere: in alto quelli che cerco (mi mancano), sotto quelli che scambio (i doppioni).": "To share: the ones I'm looking for (missing) on top, the ones I'm trading (duplicates) below.",
    "Checklist vuota": "Empty checklist",
    "Crea immagine": "Create image",
    "Per creare l'immagine della tua collezione, dei \"Mi mancano\" e dei \"Doppioni\" serve un account gratuito.": "To create an image of your collection, your “Missing” or your “Duplicates” you need a free account.",
    "Per creare l'immagine della tua collezione, dei \"Mi mancano\" e dei \"Doppioni\" serve un account gratuito. ": "To create an image of your collection, your “Missing” or your “Duplicates” you need a free account.",

    /* — Mi mancano / Doppioni / Cerca — */
    "Serie che ho iniziato": "Series I've started",
    "Tutte le serie": "All series",
    "Non hai ancora iniziato nessuna serie. Segna con \"Ce l'ho\" quello che hai: qui vedrai cosa manca per completare le serie.": "You haven't started any series yet. Mark what you have as “Owned”: here you'll see what's missing to complete your series.",
    "Vai alle serie": "Go to the series",
    "Premi su una foto per segnare che ce l'hai. Con + e − conti i doppioni.": "Tap a photo to mark it as owned. Use + and − to count duplicates.",
    "Non ti manca niente!": "You're not missing anything!",
    "Non la cerco più": "Not looking for it anymore",
    "Riprendi": "Resume",
    "Nessun doppione. Hai qualcosa in più? Premi + sotto la foto, nella pagina della serie.": "No duplicates. Got something extra? Tap + under the photo, on the series page.",

    /* — Impostazioni — */
    "La tua collezione in numeri, l'aspetto del sito, il tuo paese e il tuo account.": "Your collection in numbers, the look of the site, your country and your account.",
    "Le mie statistiche": "My statistics",
    "Conto la tua collezione…": "Counting your collection…",
    "Le statistiche sono per chi ha un account: accedi per vedere la tua collezione in numeri e l'elenco di tutte le serie che hai iniziato.": "Statistics are for people with an account: sign in to see your collection in numbers and a list of all the series you've started.",
    "Aspetto": "Appearance",
    "Aspetto del sito": "Appearance of the site",
    "Automatico": "Automatic",
    "Chiaro": "Light",
    "Scuro": "Dark",
    "Lingua": "Language",
    "English": "Italiano",     /* il link in basso: in inglese serve per tornare all'italiano */
    "Il tuo paese": "Your country",
    "Serve per mostrarti come normali i pezzi del tuo paese: gli altri stanno sotto «Varianti estere».": "This shows items from your country as regular ones: the others appear under “Foreign variants”.",
    "Account e dati": "Account and data",
    "Non hai fatto l'accesso: la collezione è salvata solo in questo browser. Con l'account la salvi nel cloud e la ritrovi su tutti i tuoi dispositivi.": "You're not signed in: your collection is saved only in this browser. With an account you save it in the cloud and find it on all your devices.",
    "Copia di sicurezza": "Backup",
    "Scarica un file": "Download a file",
    "Carica un file": "Upload a file",
    "Serie iniziate": "Series started",
    "Complete": "Complete",
    "Le mie serie": "My series",
    "Cerca tra le tue serie": "Search your series",
    "Nessuna serie trovata.": "No series found.",
    "Non riesco a leggere la collezione: controlla la connessione e ricarica la pagina.": "I can't read the collection: check your connection and reload the page.",
    "Non hai ancora segnato niente. Apri una serie dal": "You haven't marked anything yet. Open a series from the",
    "catalogo": "catalog",
    "e tocca gli oggetti che hai: qui vedrai la tua collezione in numeri.": "and tap the items you have: here you'll see your collection in numbers.",

    /* — Contatti, 404 — */
    "Per segnalare un errore, proporre una novità o solo per scrivermi.": "To report a mistake, suggest something new or just to write to me.",
    "collectiontime.support (chiocciola) gmail.com": "collectiontime.support (at) gmail.com",
    "Seguici": "Follow us",
    "I social di Collection Time: novità, nuove serie e storie.": "Collection Time on social media: news, new series and stories.",
    "Pagina Facebook": "Facebook page",
    "Per una segnalazione": "What to include in a report",
    "Questo pezzo non è ancora in collezione": "This piece isn't in the collection yet",
    "La pagina che cerchi non esiste o è stata spostata.": "The page you're looking for doesn't exist or has been moved.",
    "Torna alle collezioni": "Back to the collections",

    /* — etichette della scheda dettaglio, ricerca nelle pagine, pagina 404 — */
    "Anno": "Year",
    "Codice": "Code",
    "Cerca una serie": "Search a series",
    "Cerca una serie o una minifigura": "Search a series or a minifigure",
    /* pagina Kinder "Tutte le sorpresine" (catalogo/kinder/tutte) */
    "Tutte le sorpresine": "All the surprise toys",
    "Vedi tutte le sorpresine per codice →": "See all the surprise toys by code →",
    "Cerca un codice o un nome": "Search a code or a name",
    "Senza codice": "No code",
    "Carico le sorpresine…": "Loading the surprise toys…",
    "Nessuna sorpresina trovata.": "No surprise toy found.",
    "Non riesco a caricare le sorpresine. Riprova tra poco.": "I can't load the surprise toys. Try again in a moment.",
    "Tocca una sorpresina per segnare che ce l'hai (o toglierlo). Tieni il dito sopra (o passa col mouse) per vedere il nome e la serie. Sotto ogni foto c'è il codice.": "Tap a surprise toy to mark that you own it (or unmark it). Hold your finger over it (or hover with the mouse) to see the name and the series. The code is under each photo.",
    "Pagina non trovata": "Page not found",
    "Ho capito": "Got it",
    "Tutte le collezioni degli astucci Legami": "All the Legami pencil case collections",

    /* — promemoria "Tieni al sicuro la tua collezione" (script.js) — */
    "Tieni al sicuro la tua collezione.": "Keep your collection safe.",
    "Se cambi telefono o cancelli i dati del browser la perderesti: accedi per salvarla e ritrovarla ovunque.": "If you change phone or clear your browser data you would lose it: sign in to save it and find it anywhere.",

    /* — passi di "Aggiungi alla Home" (script.js, finestra con i passi): ogni pezzo di frase, perché il grassetto la divide — */
    "Tocca": "Tap",
    "Premi": "Press",
    "Aggiungi": "Add",
    "Aggiungi alla schermata Home": "Add to Home Screen",
    "Aggiungi al Dock": "Add to Dock",
    "Installa": "Install",
    "Conferma": "Confirm",
    "Apri il menu": "Open the",
    "di Safari": "menu in Safari",
    "Apri il menu del browser (i tre puntini ⋮ o le tre righe ☰)": "Open the browser menu (the three dots ⋮ or the three lines ☰)",
    "o": "or",

    /* — varie, una per riga — */
    "24 Stikeez + la coppa": "24 Stikeez + the cup"
  };

  /* ---------- 2) NOMI dei pezzi (per le frasi con il numero: "118 penne") ---------- */
  var NOMI = {
    "penna": "pen", "penne": "pens", "sorpresina": "surprise", "sorpresine": "surprises",
    "minifigura": "minifigure", "minifigure": "minifigures", "charm": "charms",
    "figura": "figure", "figure": "figures", "gioco": "toy", "giochi": "toys",
    "personaggio": "character", "personaggi": "characters", "peluche": "plush toys",
    "premio": "prize", "premi": "prizes", "gadget": "gadgets", "set": "sets",
    "poster": "posters", "astuccio": "pencil case", "astucci": "pencil cases",
    "tote bag": "tote bags", "telo": "towel", "teli": "towels", "tazza": "mug", "tazze": "mugs",
    "statuina": "figurine", "statuine": "figurines", "scatoletta": "tin", "scatolette": "tins",
    "portachiavi": "keychains", "photocard": "photocards", "pallone": "ball", "palloni": "balls",
    "moneta": "coin", "monete": "coins", "mezzo": "vehicle", "mezzi": "vehicles",
    "matita": "pencil", "matite": "pencils", "libro": "book", "libri": "books",
    "lampada": "lamp", "lampade": "lamps", "gommina": "eraser", "gommine": "erasers",
    "box": "boxes", "biglia": "marble", "biglie": "marbles", "bicchiere": "glass",
    "bicchieri": "glasses", "auto": "cars", "animale": "animal", "animali": "animals",
    "Stikeez": "Stikeez", "zainetti": "backpacks", "mazzi": "decks", "cofanetti": "box sets",
    "decorazioni": "decorations", "dinosauri": "dinosaurs", "kart": "karts", "paio di calze": "pair of socks"
  };
  /* paesi che compaiono accanto all'anno ("2014 · Germania") */
  var PAESI = { "Estero": "Abroad", "Germania": "Germany", "Italia": "Italy", "Francia": "France", "Spagna": "Spain", "Regno Unito": "United Kingdom",
    "Giappone": "Japan", "Cina": "China", "Brasile": "Brazil", "Messico": "Mexico", "Polonia": "Poland", "Olanda": "Netherlands", "merendine da frigo": "fridge snacks" };
  var MESI = { gennaio: "January", febbraio: "February", marzo: "March", aprile: "April", maggio: "May", giugno: "June",
    luglio: "July", agosto: "August", settembre: "September", ottobre: "October", novembre: "November", dicembre: "December" };
  function nome(x) { return Object.prototype.hasOwnProperty.call(NOMI, x) ? NOMI[x] : x; }
  var ELENCO_NOMI = Object.keys(NOMI).sort(function (a, b) { return b.length - a.length; }).join('|');
  var N = function (x) { return String(x).replace(/\s+/g, ' '); };   // spazi e "a capo" multipli → uno spazio solo

  /* ---------- 3) MODELLI: frasi con numeri o nomi dentro ----------
     [ come è scritta in italiano (con ( ) per le parti che cambiano), cosa scrivere in inglese ]
     $1, $2… = le parti tra parentesi. Una funzione può costruire la frase più complessa. */
  var MODELLI = [
    /* "12 possedute su 103" (anche "posseduti"), con doppioni e visibili: "· 3 doppioni · 5 visibili" */
    [/^(\d+) (?:possedute|posseduti|posseduto|posseduta) su (\d+)((?: · \d+ doppion[ei])?)((?: · \d+ visibil[ei])?)$/, function (m) {
      return m[1] + ' owned of ' + m[2] + m[3].replace(/doppion[ei]/, function (d) { return d === 'doppione' ? 'duplicate' : 'duplicates'; }).replace(/visibil[ei]/, 'shown');
    }],
    [/^(\d+) su (\d+)$/, "$1 of $2"],
    [/^dal (\d{4})$/, "from $1"],
    [/^(Tutte|Tutti) \((\d+)\)$/, "All ($2)"],
    [/^In possesso \((\d+)\)$/, "Owned ($1)"],
    [/^Mi mancano \((\d+)\)$/, "Missing ($1)"],
    [/^Doppioni \((\d+)\)$/, "Duplicates ($1)"],
    [/^In corso \((\d+)\)$/, "In progress ($1)"],
    [/^Complete \((\d+)\)$/, "Complete ($1)"],
    [/^Tutte le categorie \((\d+)\)$/, "All categories ($1)"],
    /* "118 penne" (e "+ 3 estere") */
    [new RegExp('^(\\d+) (' + ELENCO_NOMI + ')((?: \\+ \\d+ estere)?)$'), function (m) {
      return m[1] + ' ' + nome(m[2]) + m[3].replace(' estere', ' foreign');
    }],
    [/^(\d+) oggett[io] in (\d+) seri[ae]$/, function (m) { return m[1] + (m[1] === '1' ? ' item' : ' items') + ' in ' + m[2] + ' ' + (m[2] === '1' ? 'series' : 'series'); }],
    [/^(\d+) cerco · (\d+) scambio$/, "$1 wanted · $2 trading"],
    [/^(\d+) doppione$/, "$1 duplicate"],
    [/^(\d+) doppioni$/, "$1 duplicates"],
    [/^(.*?) · (\d+) doppion(?:e|i)$/, function (m) { return m[1] + ' · ' + m[2] + (m[2] === '1' ? ' duplicate' : ' duplicates'); }],
    [/^(.*?)ne manca 1$/, function (m) { return m[1] + '1 missing'; }],
    [/^(.*?)ne mancano (\d+)$/, function (m) { return m[1] + m[2] + ' missing'; }],
    [/^Non le cerco più \((\d+)\)$/, "Not looking for these anymore ($1)"],
    [/^Mostra altre (\d+)(?: \(ne restano (\d+)\))?$/, function (m) { return 'Show ' + m[1] + ' more' + (m[2] ? ' (' + m[2] + ' left)' : ''); }],
    [/^Ce l'ho: (.+)$/, "Owned: $1"],
    [/^Numero (.+)$/, "Number $1"],
    [/^Codice (.+)$/, "Code $1"],
    [/^Togli (.+)$/, "Remove $1"],
    [/^Il mio profilo: (.+)$/, "My profile: $1"],
    [/^Cerca in (.+)$/, "Search in $1"],
    [/^Tolti anche i (\d+) doppioni\.$/, "The $1 duplicates were removed too."],
    [/^Fai parte della community di (.+)$/, "Join the $1 community"],
    [/^Hai un gruppo su (.+)\?$/, "Do you run a $1 group?"],
    [/^Il mio gruppo su (.+) · Collection Time$/, "My $1 group · Collection Time"],
    [/^Segnato anche «Ce l'ho»(.*)$/, "Also marked “Owned”$1"],
    [/^Importato: (\d+) oggett[oi] segnat[oi] "Ce l'ho"\.$/, "Imported: $1 items marked “Owned”."],
    [/^Tieni premuta una categoria per fissarla in alto \(al massimo (\d+)\)\.$/, "Press and hold a category to pin it to the top (up to $1)."],
    [/^Puoi fissare al massimo (\d+) categorie: togline una tenendola premuta$/, "You can pin up to $1 categories: unpin one by pressing and holding it"],
    [/^Ho corretto «(.+)» in «(.+)»: controlla e premi di nuovo "Crea account"\.$/, function (m) { return 'I corrected “' + m[1] + '” to “' + m[2] + '”: check it and press “Create account” again.'; }],
    [/^Salvata nel cloud · (.+)$/, function (m) { return 'Saved in the cloud · ' + m[1].replace(/[a-zì]+/g, function (w) { return MESI[w] || w; }); }],
    [/^(\d+) collezionisti la stanno completando su Collection Time: inizia anche tu!$/, "$1 collectors are completing it on Collection Time: start yours too!"],
    [/^Grazie a (.+) per le foto\.$/, "Thanks to $1 for the photos."],
    [/^Uscito solo (?:in (.+)|all'estero)$/, function (m) { return 'Released only ' + (m[1] ? 'in ' + m[1].replace(/ e /g, ' and ') : 'abroad'); }],
    [/^(.*?)\. Uscito solo (?:in (.+)|all'estero)$/, function (m) { return m[1] + '. Released only ' + (m[2] ? 'in ' + m[2].replace(/ e /g, ' and ') : 'abroad'); }],
    /* descrizione in fondo alla serie */
    [/^La checklist completa (?:di 1|delle|dei|degli|della) (?:(\d+) )?(.+?) di «(.+?)»(?: \((.+?)\))?, con foto, nome e (codice|numero) di ognuna(?: \(da (.+?) a (.+?)\))?\.$/, function (m) {
      var uno = !m[1];
      return 'The complete checklist of ' + (uno ? '1 ' : m[1] + ' ') + nome(m[2]) + ' in “' + m[3] + '”' + (m[4] ? ' (' + m[4] + ')' : '')
        + ', with photo, name and ' + (m[5] === 'codice' ? 'code' : 'number') + ' of each' + (m[6] ? ' (from ' + m[6] + ' to ' + m[7] + ')' : '') + '.';
    }],
    /* frasi della finestra Stampa e della serie, scritte con il nome del pezzo (penne, charm…) */
    [/^Tutt[eiao] .+?,? con il quadratino spuntato dove ce l'hai\.$/, "All items, with the box checked where you own them."],
    [/^Tutt[eiao] .+? con il quadratino vuoto, da compilare a mano\.$/, "All items with an empty box, to fill in by hand."],
    [/^(?:Premi su|Tocca) (?:una|uno|un)'? ?.+? per segnare che ce l'hai\. Con info vedi i dettagli, le info e gli hashtag\.$/, "Tap an item to mark that you own it. Use info to see details, notes and hashtags."],
    [/^Nessun risultato per (.+)$/, "No results for $1"],
    /* pagine "Vedi tutti…" delle categorie */
    [/^Tocca (?:una|uno|un)'? ?.+? per segnare che ce l'hai \(o toglierlo\)\. Tieni il dito sopra \(o passa col mouse\) per vedere il nome e la serie\.$/,
      "Tap an item to mark that you own it (or unmark it). Hold your finger over it (or hover with the mouse) to see the name and the series."],
    [/^Vedi (?:tutti|tutte) .+? insieme →$/, "See them all together →"],
    /* "2 su 5 · non contano…" sotto "Varianti estere" */
    [/^(\d+) su (\d+) · non contano per completare la serie$/, "$1 of $2 · they don't count toward completing the series"],
    /* avviso dopo "Non la cerco più" */
    [/^«(.+)» spostat[ao] in «Non le cerco più»$/, "“$1” moved to “Not looking for these anymore”"],
    /* "2014 · Germania" */
    [/^(\d{4}) · (.+)$/, function (m) { return m[1] + ' · ' + (ha(PAESI, m[2]) ? PAESI[m[2]] : m[2]); }]
  ];

  /* ---------- 4) il motore (non serve toccarlo) ---------- */
  var MIN = {};
  Object.keys(FRASI).forEach(function (k) { MIN[k.toLowerCase()] = FRASI[k]; });
  var ha = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  /* una stringa in italiano → inglese (o null se non so tradurla) */
  function traduci(testo) {
    var k = N(testo).trim();
    if (!k || !/[A-Za-zÀ-ú]/.test(k)) return null;
    if (ha(FRASI, k)) return FRASI[k];
    var tutto = k === k.toUpperCase();                      // "MI MANCANO": cerco la frase normale e scrivo in maiuscolo
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

  function nodo(n) {
    if (n.nodeType === 3) {                                  // testo
      var p = n.parentNode;
      if (!p || SALTA.test(p.nodeName)) return;
      var v = n.nodeValue, r = traduci(v);
      if (r !== null) n.nodeValue = /^\s*/.exec(v)[0] + r + /\s*$/.exec(v)[0];
      return;
    }
    if (n.nodeType !== 1 || SALTA.test(n.nodeName) || n.getAttribute('translate') === 'no') return;   // translate="no": non tradurre (es. il menu "English")
    if (n.hasAttribute('data-en')) {                         // testo lungo: l'inglese sta nella pagina
      n.innerHTML = n.getAttribute('data-en');
      n.removeAttribute('data-en');
      return;
    }
    for (var i = 0; i < ATTRIBUTI.length; i++) {
      var a = n.getAttribute(ATTRIBUTI[i]);
      if (a) { var t = traduci(a); if (t !== null) n.setAttribute(ATTRIBUTI[i], t); }
    }
    for (var c = n.firstChild; c; c = c.nextSibling) nodo(c);
  }

  function titoloScheda() {
    var parti = document.title.split(' · '), r = traduci(parti[0]);
    if (r !== null) { parti[0] = r; document.title = parti.join(' · '); }
  }

  document.documentElement.lang = 'en';
  var osserva;
  function parti(recs) {
    osserva.disconnect();                                     // mentre traduco non voglio sentire le mie stesse modifiche
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (r.type === 'childList') { for (var j = 0; j < r.addedNodes.length; j++) nodo(r.addedNodes[j]); }
      else if (r.type === 'characterData') nodo(r.target);
      else if (r.type === 'attributes') { var a = r.target.getAttribute(r.attributeName); var t = a && traduci(a); if (t) r.target.setAttribute(r.attributeName, t); }
    }
    osserva.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTI });
  }
  osserva = new MutationObserver(parti);
  nodo(document.body);
  titoloScheda();
  osserva.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTI });
  window.traduciEn = traduci;                                // per le prove da console: traduciEn("Mi mancano")
})();
