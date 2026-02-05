# Deployment Guide - Västtrafik Departure Board

Guide för att sätta upp appen på en Ubuntu Server med Tailscale för fjärråtkomst.

## Översikt

Denna guide hjälper dig att:
1. Klona projektet från GitHub till din Ubuntu Server
2. Installera och konfigurera alla beroenden
3. Sätta upp appen att köra automatiskt vid omstart
4. Installera Tailscale för säker fjärråtkomst
5. Dela ut länken till vänner

## Förutsättningar

- Ubuntu Server 20.04 eller senare (installerat på din TrueNAS Scale VM)
- SSH-åtkomst till servern
- Git installerat
- Din Trafiklab API-nyckel

## Steg 1: Förbered Ubuntu Server

### 1.1 Anslut till din server via SSH

```bash
ssh your-username@your-server-ip
```

### 1.2 Uppdatera systemet

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Installera Git (om det inte redan är installerat)

```bash
sudo apt install git -y
```

## Steg 2: Klona projektet från GitHub

```bash
# Navigera till din hemkatalog eller valfri plats
cd ~

# Klona projektet
git clone https://github.com/joonocash/vtrapp.git

# Gå in i projektmappen
cd vtrapp
```

## Steg 3: Konfigurera API-nyckel

```bash
# Kopiera exempel-filen till .env
cd backend
cp .env.production.example .env

# Redigera .env-filen och lägg till din API-nyckel
nano .env
```

I nano, ändra raden:
```
TRAFIKLAB_API_KEY=your_api_key_here
```

Till din faktiska API-nyckel:
```
TRAFIKLAB_API_KEY=a35a9ed3f76342c8a5640d193af486c4
```

Spara med `Ctrl+O`, Enter, och avsluta med `Ctrl+X`.

## Steg 4: Kör deployment-skriptet

```bash
# Gå tillbaka till projektets rotkatalog
cd ~/vtrapp

# Gör skriptet körbart
chmod +x deploy.sh

# Kör deployment-skriptet
./deploy.sh
```

Skriptet kommer att:
- ✅ Installera Node.js, nginx, och PM2
- ✅ Installera alla projektberoenden
- ✅ Bygga frontend för produktion
- ✅ Starta backend med PM2 (auto-restart vid krasch)
- ✅ Konfigurera nginx att servera appen
- ✅ Sätta upp allt att starta automatiskt vid omstart

## Steg 5: Verifiera att appen fungerar

```bash
# Kontrollera att backend körs
pm2 status

# Testa backend API
curl http://localhost:3001/api/health

# Testa frontend (borde returnera HTML)
curl http://localhost:3000
```

## Steg 6: Installera och konfigurera Tailscale

### 6.1 Installera Tailscale

```bash
# Kör Tailscales installationsskript
curl -fsSL https://tailscale.com/install.sh | sh
```

### 6.2 Starta Tailscale

```bash
# Starta Tailscale och logga in
sudo tailscale up
```

Detta kommer att visa en länk - öppna länken i din webbläsare och logga in med ditt Tailscale-konto.

### 6.3 Få din Tailscale IP-adress

```bash
# Visa din Tailscale IP-adress
tailscale ip -4
```

Exempel på output: `100.x.y.z`

### 6.4 (Valfritt) Sätt ett hostname

```bash
# Sätt ett lättare hostname att komma ihåg
sudo tailscale up --hostname=vtrapp-server
```

### 6.5 Aktivera MagicDNS (rekommenderat)

1. Gå till Tailscale admin-panelen: https://login.tailscale.com/admin/dns
2. Aktivera MagicDNS
3. Nu kan du nå servern med `http://vtrapp-server:3000` istället för IP-adressen

## Steg 7: Dela appen med vänner

### Alternativ 1: Dela Tailscale-nätverket

1. Gå till https://login.tailscale.com/admin/machines
2. Klicka på "Share" vid din server
3. Bjud in dina vänner med deras email
4. De installerar Tailscale på sina enheter och kan sedan nå:
   - `http://100.x.y.z:3000` (med din Tailscale IP)
   - `http://vtrapp-server:3000` (om du aktiverat MagicDNS)

### Alternativ 2: Använd Tailscale Funnel (offentlig access)

⚠️ **Varning**: Detta gör appen tillgänglig på internet för alla!

```bash
# Aktivera Funnel för port 3000
sudo tailscale funnel 3000
```

Detta ger dig en publik URL som du kan dela med vem som helst.

### Alternativ 3: Hybrid-approach (rekommenderat för vänner)

Dela ut Tailscale-nätverket till vänner så får de:
- ✅ Säker krypterad åtkomst
- ✅ Ingen exponering mot hela internet
- ✅ Enkel installation med Tailscale-appen
- ✅ Automatisk anslutning när de är uppkopplade

## Underhåll och Hantering

### Uppdatera appen från GitHub

```bash
cd ~/vtrapp

# Hämta senaste ändringar
git pull

# Bygg om frontend
cd frontend
npm install
npm run build

# Starta om backend
cd ../backend
npm install --production
pm2 restart vtrapp-backend

# Starta om nginx
sudo systemctl restart nginx
```

### Användbara kommandon

#### PM2 (Backend)
```bash
pm2 status                    # Visa status för alla processer
pm2 logs vtrapp-backend      # Visa loggar
pm2 restart vtrapp-backend   # Starta om backend
pm2 stop vtrapp-backend      # Stoppa backend
pm2 start vtrapp-backend     # Starta backend
```

#### Nginx (Frontend)
```bash
sudo systemctl status nginx   # Kontrollera nginx status
sudo systemctl restart nginx  # Starta om nginx
sudo nginx -t                 # Testa nginx konfiguration
```

#### Tailscale
```bash
tailscale status             # Visa Tailscale status
tailscale ip -4              # Visa din Tailscale IP
sudo tailscale up            # Starta Tailscale
sudo tailscale down          # Stoppa Tailscale
```

### Loggar och felsökning

```bash
# Backend-loggar
pm2 logs vtrapp-backend

# Nginx-loggar
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Systemloggar
sudo journalctl -u nginx -f
```

## Brandväggsinställningar (TrueNAS Scale)

Om du kör detta på TrueNAS Scale VM, kontrollera att:

1. VM:en har nätverksåtkomst (Bridge mode rekommenderas)
2. Port 3000 är tillgänglig internt (för nginx)
3. Port 3001 är tillgänglig internt (för backend)
4. Tailscale kan nå UDP port 41641 för utgående trafik

## Säkerhet

- ✅ API-nyckeln är skyddad i `.env` (ej i Git)
- ✅ Backend exponeras inte direkt, endast via nginx proxy
- ✅ Tailscale ger end-to-end kryptering
- ✅ Ingen direktexponering mot internet (om du inte använder Funnel)

## Prestanda

Denna setup använder:
- **PM2**: Håller backend igång, auto-restart vid krasch
- **nginx**: Snabb statisk filserver för frontend
- **Production build**: Optimerad och minifierad frontend-kod

Förväntad resursanvändning:
- RAM: ~200-300 MB
- CPU: <5% vid normal användning
- Disk: ~100 MB

## Hjälp och support

Om något går fel:

1. Kontrollera att alla tjänster körs:
   ```bash
   pm2 status
   sudo systemctl status nginx
   tailscale status
   ```

2. Kolla loggarna:
   ```bash
   pm2 logs vtrapp-backend --lines 50
   ```

3. Testa API:et direkt:
   ```bash
   curl http://localhost:3001/api/lunch
   ```

## Avinstallation

Om du vill ta bort allt:

```bash
# Stoppa och ta bort PM2-processen
pm2 stop vtrapp-backend
pm2 delete vtrapp-backend
pm2 save

# Ta bort nginx-konfiguration
sudo rm /etc/nginx/sites-enabled/vtrapp
sudo rm /etc/nginx/sites-available/vtrapp
sudo systemctl restart nginx

# Ta bort projektmappen
rm -rf ~/vtrapp

# Avinstallera Tailscale (valfritt)
sudo tailscale down
sudo apt remove tailscale -y
```

---

**Lycka till med din deployment! 🚀**
