# vtrapp

En självhostad sajt med avgångar i realtid för hållplatser i Göteborg (data från Trafiklab), två partyspel, en samling rötspel och kartverktyget Cassie.

![Västtrafik](https://img.shields.io/badge/V%C3%A4sttrafik-API-0071BC)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)

## Appar

| Adress | App | Kod |
| --- | --- | --- |
| `#/avgangar` | Avgångar i realtid, hållplatssök, linjefilter | `frontend/src/components/DeparturesPage.jsx` |
| `#/agenter` | Agenter – ordspel 5×5, en skärm eller flera enheter | `frontend/src/components/agents/` |
| `#/imposter` | Imposter Who? – bluffspel runt bordet | `frontend/src/components/ImpostorGame.jsx` |
| `#/rotspel` | Rötspel – småspel med topplistor (`#/rotspel/<spel-id>`) | `frontend/src/rotspel/` |
| `#/cassie` | Cassie – 3D-lastbil längs en riktig rutt, b-roll | `frontend/src/cassie/` |

Vilken app som visas ligger i adressens hash, så omladdning, bakåtknapp och
delade länkar landar rätt. Menyn (toppbar på dator, bottenmeny på mobil)
byggs från listan i `frontend/src/shell/appar.js` – ny app = ny rad där.
Nytt rötspel: se [LAGG-TILL-SPEL.md](LAGG-TILL-SPEL.md).

## Design

- Mörkt tema med färgtokens i `frontend/tailwind.config.js` (`ink`, `accent`
  och en omdefinierad `gray`-skala) och gemensamma klasser i
  `frontend/src/index.css` (`.panel`, `.tabular` m.fl.).
- Typsnitt: Inter (text) och Outfit (rubriker), självhostade via
  `@fontsource-variable`. Ikoner från `lucide-react`.
- Allt utom Avgångar laddas först när man går till appen, så startsidan
  hålls lätt.

## Funktioner (Avgångar)

- 🚊 **Realtidsavgångar** - Minuter kvar, förseningar och inställda turer
- 🔍 **Hållplatssökning** - Vald hållplats och de senaste sparas i webbläsaren
- 🔄 **Auto-uppdatering** - Var 45:e sekund, eller direkt med uppdatera-knappen
- 📱 **Responsiv design** - Fungerar på mobil, surfplatta och dator
- 🔒 **Säker** - API-nyckel skyddad på backend, redo för GitHub

## Tech Stack

### Frontend
- React 18
- Vite (build tool)
- Tailwind CSS (styling)

### Backend
- Node.js
- Express
- Axios (HTTP client)

### API
- Trafiklab Realtime APIs

## Installation

### Förutsättningar
- Node.js 16+ installerat
- En API-nyckel från [Trafiklab](https://www.trafiklab.se/)

### Steg 1: Klona projektet
```bash
git clone <repository-url>
cd vtrapp
```

### Steg 2: Installera dependencies
```bash
npm install
```

Detta installerar dependencies för både frontend och backend.

### Steg 3: Konfigurera miljövariabler
Skapa en `.env` fil i `backend/` katalogen:

```bash
cp .env.example backend/.env
```

Redigera `backend/.env` och lägg till din API-nyckel:
```env
TRAFIKLAB_API_KEY=din_api_nyckel_här
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Steg 4: Starta applikationen

#### Alternativ 1: Starta båda (rekommenderas)
```bash
npm run dev
```

Detta startar både backend (port 3001) och frontend (port 5173) samtidigt.

#### Alternativ 2: Starta separat

**Backend:**
```bash
npm run dev:backend
```

**Frontend (i ny terminal):**
```bash
npm run dev:frontend
```

### Steg 5: Öppna i webbläsare
Öppna [http://localhost:5173](http://localhost:5173) i din webbläsare.

## Användning

1. **Default hållplats**: Sidan visar Ullevi Norra när den laddas
2. **Byt hållplats**: Använd sökfältet för att hitta och välja en annan hållplats
3. **Avgångar**: Se kommande avgångar med linje, destination, tid och plattform
4. **Auto-uppdatering**: Avgångar uppdateras automatiskt var 45:e sekund
5. **Realtidsdata**: Grön "i tid" indikator eller förseningsinfo visas

## Säkerhet

- ✅ API-nyckel lagras endast i backend `.env` fil
- ✅ `.env` är gitignored och committas aldrig
- ✅ Frontend har ingen direkt åtkomst till API-nyckeln
- ✅ CORS konfigurerad för att endast acceptera requests från frontend
- ✅ Redo att pushas till GitHub utan att läcka secrets

## API Nyckel från Trafiklab

1. Gå till [trafiklab.se](https://www.trafiklab.se/)
2. Skapa ett konto
3. Logga in på [developer.trafiklab.se](https://developer.trafiklab.se/)
4. Skapa ett nytt projekt
5. Lägg till "Trafiklab Realtime APIs" till ditt projekt
6. Kopiera API-nyckeln och lägg till i `backend/.env`

## Deployment till Ubuntu Server

Vill du köra appen på en egen server med Tailscale för fjärråtkomst?

👉 **[Se fullständig deployment-guide här](DEPLOYMENT.md)**

Guiden täcker:
- Installation på Ubuntu Server (perfekt för TrueNAS Scale VMs)
- Automatisk uppstart med PM2 och systemd
- Automatisk deploy när något mergas till `main` (GitHub Actions)
- Nginx för produktion
- Tailscale-setup för säker fjärråtkomst
- Dela appen med vänner över Tailscale

### Snabbstart deployment:
```bash
git clone https://github.com/joonocash/vtrapp.git
cd vtrapp
chmod +x deploy.sh
./deploy.sh
```

## Framtida förbättringar

- [ ] Favoritmarkerade hållplatser (senaste sökta sparas redan)
- [ ] Browser notifications för specifika linjer
- [ ] PWA support för offline-funktionalitet
- [ ] Historisk förseningsdata och statistik

## Licens

MIT

## Data

Data från [Trafiklab](https://www.trafiklab.se/) / Västtrafik