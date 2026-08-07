# Ranheim Esport - Aim Trainer

Nettleserbasert aim-trainer for Ranheim Esport. Ren HTML/CSS/JavaScript
(ingen Node, ingen byggesteg), highscore lagres i Firebase Firestore,
hostes på GitHub Pages.

## Filstruktur

```
ranaim/
├── index.html              Hele appen (alle "skjermer")
├── css/style.css            Styling (Ranheim-farger)
├── js/
│   ├── app.js                Hovedkontroller / skjermstyring
│   ├── firebase-config.js    DIN Firebase-konfigurasjon (må fylles ut)
│   ├── groups.js             Gruppeliste + passord
│   ├── weekId.js             Beregner ukentlig ID (ISO-uke)
│   ├── highscore.js          Firestore-lesing/skriving
│   └── modes/
│       └── gridshot.js       Gridshot-modusen (spillmotor)
├── assets/
│   ├── ril-logo.png          (legg til Ranheim-logoen her selv)
│   └── sounds/
│       ├── hit.mp3           (legg til lydfil selv)
│       └── miss.mp3          (legg til lydfil selv)
└── firestore.rules           Sikkerhetsregler for Firestore
```

## Steg 1: Sett opp Firebase

1. Gå til [console.firebase.google.com](https://console.firebase.google.com)
2. Klikk **"Legg til prosjekt"**, gi det et navn (f.eks. `ranaim`)
3. Når prosjektet er opprettet: klikk **Firestore Database** i menyen til
   venstre → **Opprett database** → velg **produksjonsmodus** → velg en
   region nær Norge (f.eks. `europe-west1`)
4. Gå til **Project settings** (tannhjulet øverst til venstre) →
   fanen **General** → scroll ned til **"Your apps"** → klikk
   **web-ikonet (`</>`)** for å legge til en web-app
5. Gi appen et navn (f.eks. "Ranaim Web") → **Registrer app**
6. Du får nå opp en kodeblokk med `firebaseConfig = {...}` —
   **kopier disse verdiene** inn i `js/firebase-config.js` i prosjektet
7. Gå til **Firestore Database → Regler (Rules)**, og lim inn innholdet
   fra `firestore.rules` i dette prosjektet → **Publiser**

## Steg 2: Logo og lyd

- Ranheim-logoen ligger allerede i `assets/ril-logo.png`
- Enkle genererte lydeffekter ligger i `assets/sounds/hit.wav` og
  `assets/sounds/miss.wav` - disse fungerer fint, men er syntetiske
  toner. Ønsker dere mer "spillaktige" lydeffekter senere, kan disse
  filene byttes ut med egne mp3/wav-filer (behold samme filnavn, eller
  oppdater stiene i `index.html`).

## Steg 3: Last opp til GitHub

Siden dere ikke bruker Node/git lokalt, enkleste vei er å laste opp
filene direkte via GitHub sitt nettgrensesnitt:

1. Gå til repoet ditt: `github.com/<ditt-brukernavn>/ranaim`
2. Klikk **"Add file" → "Upload files"**
3. Dra inn **alle filene og mappene** fra dette prosjektet
   (viktig: mappestrukturen må bevares - `css/`, `js/`, `js/modes/`, `assets/`)
4. Skriv en commit-melding (f.eks. "Første versjon") → **Commit changes**

> Tips: Hvis opplasting av mapper er tungvint via nettleseren, kan det
> være enklere å installere [GitHub Desktop](https://desktop.github.com)
> (grafisk program, ingen kommandolinje) og dra prosjektmappen inn der.

## Steg 4: Aktiver GitHub Pages

1. I repoet: **Settings → Pages**
2. Under **"Build and deployment" → Source**, velg
   **"Deploy from a branch"**
3. Under **Branch**, velg `main` og mappen `/ (root)` → **Save**
4. Vent ca. 1-2 minutter, siden vil da være live på:
   `https://<ditt-brukernavn>.github.io/ranaim/`

## Legge til flere grupper

Åpne `js/groups.js` og legg til et nytt objekt i `GROUPS`-listen,
følg samme mønster som de eksisterende. Last opp den oppdaterte filen
til GitHub (samme "Upload files"-flyt, eller rediger filen direkte i
GitHub sitt nettgrensesnitt via blyant-ikonet).

## Legge til en ny modus senere (f.eks. Tracking)

1. Lag en ny fil `js/modes/tracking.js` som følger samme mønster som
   `gridshot.js`: eksporter et objekt med `start(canvas, ctx, onComplete)`
   og `stop()`
2. I `js/app.js`, importer den nye modulen og legg den til i `MODES`-
   listen med `comingSoon: false`
3. Highscore-systemet fungerer automatisk for nye moduser dersom du
   bruker samme `submitScore()`-funksjon - vurder om du vil ha egne
   highscorelister per modus (i så fall må datamodellen i
   `highscore.js` utvides med `modeId` som en del av dokumentstien)

## Kjent begrensning i v1

- Kun testet for 24" skjerm i liggende format - ingen mobil/nettbrett-tilpasning
- Gruppepassord er en "ærlighetslås" (ikke reell sikkerhet)
- Ingen automatisk filtrering av upassende nickname - trenerne må følge opp
