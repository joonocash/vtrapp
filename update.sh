#!/bin/bash

# Auto-update script for vtrapp
# Pulls latest changes from GitHub and rebuilds

set -e

echo "========================================="
echo "Updating Västtrafik App from GitHub"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${YELLOW}1. Pulling latest changes from GitHub...${NC}"
cd "$APP_DIR"
git pull origin main

echo ""
echo -e "${YELLOW}2. Installing frontend dependencies...${NC}"
cd "$APP_DIR/frontend"
npm install

echo ""
echo -e "${YELLOW}3. Building frontend...${NC}"
npm run build

echo ""
echo -e "${YELLOW}4. Installing backend dependencies...${NC}"
cd "$APP_DIR/backend"
npm install --production

echo ""
echo -e "${YELLOW}5. Restarting backend (PM2)...${NC}"
pm2 restart vtrapp-backend

echo ""
echo -e "${YELLOW}6. Restarting nginx...${NC}"
sudo systemctl reload nginx

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ Update complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Your app is now running the latest version from GitHub!"
echo ""
