# Quick Start - Deploy på Ubuntu Server

## 🚀 5-minuters deployment

### På din Ubuntu Server (SSH):

```bash
# 1. Klona projektet
git clone https://github.com/joonocash/vtrapp.git
cd vtrapp

# 2. Lägg till API-nyckel
cd backend
cp .env.production.example .env
nano .env
# Ändra: TRAFIKLAB_API_KEY=a35a9ed3f76342c8a5640d193af486c4
# Spara: Ctrl+O, Enter, Ctrl+X

# 3. Kör deployment
cd ..
chmod +x deploy.sh
./deploy.sh
```

Vänta ~5 minuter medan allt installeras och konfigureras.

### När deployment är klar:

```bash
# 4. Installera Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --hostname=vtrapp-server

# 5. Få din Tailscale-adress
tailscale ip -4
# Output: 100.x.y.z
```

### Öppna i webbläsare:
- **Lokal access**: `http://localhost:3000`
- **Tailscale access**: `http://100.x.y.z:3000` (din Tailscale IP)
- **Med MagicDNS**: `http://vtrapp-server:3000`

## 📱 Dela med vänner

### Alternativ 1: Bjud in till Tailscale (Rekommenderat)
1. Gå till https://login.tailscale.com/admin/machines
2. Klicka "Share" vid din server
3. Bjud in vänners email-adresser
4. De installerar Tailscale-appen och får automatisk åtkomst

### Alternativ 2: Tailscale Funnel (Offentlig länk)
```bash
sudo tailscale funnel 3000
```
⚠️ Gör appen tillgänglig för hela internet!

## 🔧 Användbara kommandon

```bash
# Kontrollera status
pm2 status                    # Backend status
sudo systemctl status nginx   # Frontend status
tailscale status              # Tailscale status

# Visa loggar
pm2 logs vtrapp-backend      # Backend-loggar
sudo tail -f /var/log/nginx/error.log  # Nginx-loggar

# Starta om
pm2 restart vtrapp-backend   # Starta om backend
sudo systemctl restart nginx  # Starta om frontend
```

## 🔄 Uppdatera appen

```bash
cd ~/vtrapp
git pull
cd frontend && npm install && npm run build
cd ../backend && npm install --production
pm2 restart vtrapp-backend
sudo systemctl restart nginx
```

## ❓ Felsökning

**Problem: Appen startar inte**
```bash
pm2 logs vtrapp-backend --lines 50
```

**Problem: Kan inte nå från Tailscale**
```bash
# Kontrollera att Tailscale är uppkopplat
tailscale status

# Testa lokalt först
curl http://localhost:3000
```

**Problem: API-fel**
```bash
# Kontrollera att API-nyckeln är korrekt
cat ~/vtrapp/backend/.env
```

## 📖 Full dokumentation

För detaljerad information, se [DEPLOYMENT.md](DEPLOYMENT.md)

---

**Support**: Kolla loggarna först, de innehåller nästan alltid lösningen! 🐛
