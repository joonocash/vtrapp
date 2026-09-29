#!/usr/bin/env bash
# Uppdaterar sajten till senaste main och bygger om det som ändrats.
#
# Körs automatiskt av GitHub Actions (.github/workflows/deploy.yml) när något
# mergas till main, men går lika bra att köra för hand på webbservern:
#
#   ./update.sh          bara det som ändrats sedan förra lyckade deployen
#   ./update.sh --allt   allt: beroenden, bygge och omstart (t.ex. efter att
#                        du ändrat frontend/.env, som inte ligger i git)
#
# Så här går det till:
#   1. Hämtar main. Vägrar om servern har egna commits (hellre stopp än tappad ändring).
#   2. Jämför mot den commit som senast deployades (frontend/dist/version.txt)
#      och gör bara det som behövs.
#   3. Bygger frontend i frontend/dist-ny och byter in den först när bygget
#      lyckats. Går bygget sönder ligger den gamla sajten kvar orörd.
#   4. Startar om backend om något under backend/ ändrats.
#   5. Kollar att backend och nginx svarar. Först då skrivs version.txt.
#      Avbröts förra deployen halvvägs görs allt om nästa gång.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

ALLT=0
[[ "${1:-}" == "--allt" ]] && ALLT=1

BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:3001/health}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:3000/}"
PM2_NAMN="${PM2_NAMN:-vtrapp-backend}"

steg() { printf '\n==> %s\n' "$*"; }
fel() { printf '\n!!! %s\n' "$*" >&2; exit 1; }

# Som tjänst (runnern) kan node saknas i PATH om den är installerad med nvm.
if ! command -v node >/dev/null 2>&1 && [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
fi
command -v node >/dev/null 2>&1 || fel "Hittar inte node."
command -v pm2 >/dev/null 2>&1 || fel "Hittar inte pm2."

# ---------- 1. hämta main ----------

gren="$(git symbolic-ref --short HEAD 2>/dev/null || echo '?')"
[[ "$gren" == "main" ]] || fel "Servern står på grenen '$gren', inte main. Kör 'git checkout main' först."

fore="$(git rev-parse HEAD)"
steg "Hämtar senaste main"
git fetch --quiet origin main
git merge --ff-only --quiet origin/main || fel "Servern har ändringar som inte finns på GitHub. Kolla 'git status' och 'git log origin/main..HEAD'."
efter="$(git rev-parse HEAD)"
echo "Nu på $(git log -1 --format='%h %s')"

# Ändrades det här skriptet? Kör då om med den nya versionen.
if [[ -z "${VTRAPP_OMSTART:-}" && "$fore" != "$efter" ]] && ! git diff --quiet "$fore" "$efter" -- update.sh; then
  echo "update.sh ändrades, kör den nya versionen"
  VTRAPP_OMSTART=1 exec "$APP_DIR/update.sh" "$@"
fi

# ---------- 2. vad har ändrats? ----------

deployad=""
[[ -f frontend/dist/version.txt ]] && deployad="$(head -1 frontend/dist/version.txt)"
PAGAR="$APP_DIR/.deploy-pagar" # finns bara medan en deploy pågår

if [[ "$ALLT" == 1 ]]; then
  echo "Kör allt (--allt)"
  andrat="ALLT"
elif [[ -f "$PAGAR" ]]; then
  # Förra deployen avbröts halvvägs, t.ex. efter att en trasig backend startats.
  # Då vet vi inte vad som faktiskt kör, så allt görs om.
  echo "Förra deployen blev inte klar. Kör allt."
  andrat="ALLT"
elif [[ -n "$deployad" ]] && git cat-file -e "$deployad^{commit}" 2>/dev/null; then
  if [[ "$deployad" == "$efter" ]]; then
    echo "Redan deployad: $(git log -1 --format='%h' "$efter"). Inget att göra."
    exit 0
  fi
  andrat="$(git diff --name-only "$deployad" "$efter")"
  echo "Ändrat sedan förra deployen ($(git log -1 --format='%h' "$deployad")):"
  sed -n '1,40s/^/  /p' <<<"$andrat" # inte "| head": med pipefail kan det avbryta skriptet
else
  echo "Hittar ingen tidigare deploy. Kör allt."
  andrat="ALLT"
fi

har() { [[ "$andrat" == "ALLT" ]] || grep -qE "$1" <<<"$andrat"; }

beroenden=0; frontend=0; backend=0
har '(^|/)package(-lock)?\.json$' && beroenden=1
[[ ! -d node_modules ]] && beroenden=1
har '^frontend/' && frontend=1
[[ ! -d frontend/dist ]] && frontend=1
har '^backend/' && backend=1
if [[ "$beroenden" == 1 ]]; then frontend=1; backend=1; fi

# ---------- 3. beroenden och bygge ----------

touch "$PAGAR"

if [[ "$beroenden" == 1 ]]; then
  steg "Installerar beroenden (från roten, repot använder npm workspaces)"
  npm install --no-audit --no-fund
fi

if [[ "$frontend" == 1 ]]; then
  steg "Bygger frontend"
  rm -rf frontend/dist-ny
  npm run build --workspace=frontend -- --outDir dist-ny --emptyOutDir
  [[ -f frontend/dist-ny/index.html ]] || fel "Bygget gav ingen index.html. Sajten är orörd."
  # Byt in det nya bygget. Två namnbyten, sajten är borta i några mikrosekunder.
  rm -rf frontend/dist-gammal
  [[ -d frontend/dist ]] && mv frontend/dist frontend/dist-gammal
  mv frontend/dist-ny frontend/dist
  rm -rf frontend/dist-gammal
  echo "Nytt bygge på plats"
else
  echo "Inget ändrat i frontend, hoppar över bygget"
fi

# ---------- 4. backend ----------

if [[ "$backend" == 1 ]]; then
  steg "Startar om backend ($PM2_NAMN)"
  pm2 restart "$PM2_NAMN" --update-env --silent
else
  echo "Inget ändrat i backend, ingen omstart"
fi

# ---------- 5. kolla att allt svarar ----------

steg "Kollar att sajten svarar"
vanta() {
  local url="$1" namn="$2"
  for _ in $(seq 1 30); do
    if curl -fs -o /dev/null --max-time 3 "$url"; then echo "$namn svarar"; return 0; fi
    sleep 1
  done
  fel "$namn svarar inte på $url efter 30 s. Loggar: pm2 logs $PM2_NAMN --lines 50"
}
vanta "$BACKEND_URL" "Backend"
vanta "$FRONTEND_URL" "Frontend (nginx)"

git rev-parse HEAD > frontend/dist/version.txt
git log -1 --format='%s%n%ci' >> frontend/dist/version.txt
rm -f "$PAGAR"

steg "Klart: $(git log -1 --format='%h %s')"
