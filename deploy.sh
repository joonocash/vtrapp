#!/bin/bash

# Deployment script for Ubuntu Server
# This script sets up the Västtrafik departure board app

set -e  # Exit on any error

echo "========================================="
echo "Västtrafik App Deployment Script"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$SCRIPT_DIR"

echo -e "${YELLOW}Step 1: Checking system requirements...${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
   echo -e "${RED}Please do not run this script as root. Run as your regular user.${NC}"
   exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed!${NC}"
    echo "Installing Node.js (LTS version)..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}nginx is not installed. Installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y nginx
fi

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 is not installed. Installing globally...${NC}"
    sudo npm install -g pm2
fi

echo -e "${GREEN}✓ System requirements check complete${NC}"
echo ""

echo -e "${YELLOW}Step 2: Installing dependencies...${NC}"

# Install backend dependencies
echo "Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install --production

# Install frontend dependencies and build
echo "Installing frontend dependencies..."
cd "$APP_DIR/frontend"
npm install
echo "Building frontend for production..."
npm run build

echo -e "${GREEN}✓ Dependencies installed and frontend built${NC}"
echo ""

echo -e "${YELLOW}Step 3: Setting up environment variables...${NC}"

# Create backend .env if it doesn't exist
if [ ! -f "$APP_DIR/backend/.env" ]; then
    echo -e "${YELLOW}Creating backend .env file...${NC}"
    cp "$APP_DIR/backend/.env.production.example" "$APP_DIR/backend/.env"
    echo -e "${RED}IMPORTANT: Edit $APP_DIR/backend/.env and add your API key!${NC}"
    read -p "Press enter to continue after you've added your API key..."
fi

echo -e "${GREEN}✓ Environment setup complete${NC}"
echo ""

echo -e "${YELLOW}Step 4: Setting up PM2 for backend...${NC}"

cd "$APP_DIR/backend"

# Stop existing PM2 process if running
pm2 stop vtrapp-backend 2>/dev/null || true
pm2 delete vtrapp-backend 2>/dev/null || true

# Start backend with PM2
pm2 start src/server.js --name vtrapp-backend --time
pm2 save

# Setup PM2 to start on system boot
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
pm2 save

echo -e "${GREEN}✓ Backend is now running with PM2${NC}"
echo ""

echo -e "${YELLOW}Step 5: Setting up nginx...${NC}"

# Create nginx config
sudo tee /etc/nginx/sites-available/vtrapp > /dev/null <<EOF
server {
    listen 3000;
    server_name _;

    root $APP_DIR/frontend/dist;
    index index.html;

    # Serve static files
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/vtrapp /etc/nginx/sites-enabled/vtrapp

# Remove default site if it exists
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

echo -e "${GREEN}✓ nginx configured and running${NC}"
echo ""

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Your app is now running!"
echo ""
echo "Backend (PM2): http://localhost:3001"
echo "Frontend (nginx): http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  - View backend logs: pm2 logs vtrapp-backend"
echo "  - Restart backend: pm2 restart vtrapp-backend"
echo "  - Stop backend: pm2 stop vtrapp-backend"
echo "  - View PM2 status: pm2 status"
echo "  - Check nginx status: sudo systemctl status nginx"
echo ""
echo -e "${YELLOW}Next step: Install Tailscale to access remotely!${NC}"
echo "Run: curl -fsSL https://tailscale.com/install.sh | sh"
echo ""
