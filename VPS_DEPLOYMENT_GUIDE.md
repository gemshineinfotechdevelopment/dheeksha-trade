# Dheeksha Trade - VPS Deployment Guide (Hostinger / Ubuntu)

This guide provides step-by-step instructions to deploy the Dheeksha Trade application (React Vite Frontend + Node/Express TypeScript Backend + MongoDB Atlas + Cloudinary) on an Ubuntu VPS.

---

## 🏗️ Architecture Overview

```
                          Internet (User Request)
                                    │
                                    ▼
                         [ Nginx Web Server ] (Port 80 / 443 SSL)
                                    │
               ┌────────────────────┴────────────────────┐
               │                                         │
        Frontend Requests (/ & /assets/*)       Backend API Requests (/api/*)
               │                                         │
               ▼                                         ▼
   Static Files (/var/www/.../dist)          Express API (Port 5004 via PM2)
                                                         │
                                         ┌───────────────┴───────────────┐
                                         ▼                               ▼
                                   MongoDB Atlas                    Cloudinary
```

---

## 📋 Step 1: Initial VPS Server Setup

Connect to your VPS via SSH:
```bash
ssh root@YOUR_VPS_IP
```

Update system packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget ufw nginx
```

### Install Node.js (v20 LTS):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v # Should be v20.x or newer
npm -v
```

### Install PM2 (Process Manager):
```bash
sudo npm install -g pm2
```

### Configure Firewall:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 📂 Step 2: Clone Project & Configure Directory

Create the web directory and clone your repository:
```bash
sudo mkdir -p /var/www/dheeksha-trade
sudo chown -R $USER:$USER /var/www/dheeksha-trade
cd /var/www/dheeksha-trade

git clone <YOUR_GIT_REPO_URL> .
```

---

## ⚙️ Step 3: Configure Environment Variables

### 1. Root `.env` (Frontend)
```bash
nano .env
```
Add:
```env
VITE_API_URL=/api
```
*(Save: `Ctrl + O` -> `Enter`, Exit: `Ctrl + X`)*

### 2. Backend `server/.env`
```bash
nano server/.env
```
Add your production configuration:
```env
PORT=5004
NODE_ENV=production
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.txhuc3s.mongodb.net/dheeksha_trade?retryWrites=true&w=majority
CORS_ORIGIN=https://yourdomain.com
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 🚀 Step 4: Install Dependencies & Build

```bash
cd /var/www/dheeksha-trade

# Install dependencies for both frontend and backend
npm install
npm --prefix server install

# Build both frontend and backend
npm run build:all
```

---

## 🔄 Step 5: Start Backend with PM2

Start the backend API server using the PM2 configuration:
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```
*(Follow the onscreen prompt from `pm2 startup` to enable auto-restart on system reboot).*

Check status & logs:
```bash
pm2 status
pm2 logs dheeksha-trade-api
```

---

## 🌐 Step 6: Configure Nginx

Copy the provided Nginx configuration:
```bash
sudo cp nginx/dheeksha-trade.conf /etc/nginx/sites-available/dheeksha-trade
```

Edit the domain name inside `/etc/nginx/sites-available/dheeksha-trade`:
```bash
sudo nano /etc/nginx/sites-available/dheeksha-trade
```
*Replace `yourdomain.com` with your actual domain or VPS IP address.*

Enable the site:
```bash
sudo ln -sf /etc/nginx/sites-available/dheeksha-trade /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Step 7: Setup Free SSL (HTTPS) with Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Certbot will configure SSL automatically and auto-renew.

---

## ⚡ Future Updates (1-Step Deploy)

Whenever you push new updates to GitHub, simply run:
```bash
cd /var/www/dheeksha-trade
bash deploy.sh
```
This will automatically pull the changes, rebuild the frontend, rebuild the backend, and restart PM2 without downtime!
