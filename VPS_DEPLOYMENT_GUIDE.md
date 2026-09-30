# Dheeksha Trade - VPS Deployment Guide (Ubuntu)

Target Domain / Subdomain: `dheeksha-trade.gemshine.tech`  
Backend Port: `5004`  
Database: Local MongoDB on VPS (`mongodb://127.0.0.1:27017/dheeksha_trade`)

---

## 🏗️ Architecture Overview

```
                      Internet (Client Browser)
                                 │
                                 ▼
                     [ Nginx Reverse Proxy ] (Ports 80 & 443 SSL)
                     (dheeksha-trade.gemshine.tech)
                                 │
            ┌────────────────────┴────────────────────┐
            │                                         │
     Static Frontend                           Backend API
    (/var/www/dheeksha-trade/dist)       (http://127.0.0.1:5004/api)
                                                      │
                                           ┌──────────┴──────────┐
                                           ▼                     ▼
                                    Local MongoDB           Cloudinary
                             (127.0.0.1:27017)
```

---

## 📋 Step 1: VPS Server Setup & Essential Tools

Connect to your VPS:
```bash
ssh root@YOUR_VPS_IP
```

Update packages and install basic utilities:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget gnupg ufw nginx build-essential
```

### 1.1 Install Node.js (v20 LTS):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v # Check: v20.x
npm -v
```

### 1.2 Install PM2 (Process Manager):
```bash
sudo npm install -g pm2
```

---

## 🍃 Step 2: Install and Start MongoDB on VPS

### 2.1 Install MongoDB Community Edition (Ubuntu 22.04 / 24.04):

```bash
# Import MongoDB public GPG Key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes

# Add MongoDB repository for Ubuntu
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update repository lists & install MongoDB
sudo apt update
sudo apt install -y mongodb-org
```

*(Note: If your Ubuntu version already provides `mongodb`, you can also verify using `mongod --version`).*

### 2.2 Start and Enable MongoDB Service:
```bash
sudo systemctl start mongod
sudo systemctl enable mongod
sudo systemctl status mongod
```
MongoDB will now run on `127.0.0.1:27017` and start automatically on boot.

---

## 📂 Step 3: Clone Project & Prepare Web Directory

```bash
sudo mkdir -p /var/www/dheeksha-trade
sudo chown -R $USER:$USER /var/www/dheeksha-trade
cd /var/www/dheeksha-trade

git clone https://github.com/gemshineinfotechdevelopment/dheeksha-trade.git .
```

---

## ⚙️ Step 4: Configure Environment Files

### 4.1 Frontend `.env` (in `/var/www/dheeksha-trade`):
```bash
nano .env
```
Add:
```env
VITE_API_URL=/api
```
*(Save: `Ctrl + O` -> `Enter`, Exit: `Ctrl + X`)*

### 4.2 Backend `server/.env` (in `/var/www/dheeksha-trade/server`):
```bash
nano server/.env
```
Paste the following:
```env
PORT=5004
NODE_ENV=production
MONGODB_URI=mongodb://127.0.0.1:27017/dheeksha_trade
CORS_ORIGIN=https://dheeksha-trade.gemshine.tech
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```
*(Fill in your Cloudinary keys if file/PDF uploads are used).*

---

## 🔨 Step 5: Install Dependencies & Build Application

From the root directory `/var/www/dheeksha-trade`:
```bash
cd /var/www/dheeksha-trade

# Install Frontend & Backend Dependencies
npm install
npm --prefix server install

# Build both React Vite and Backend TypeScript
npm run build:all
```

*(Optional: If you want to seed initial dummy/admin data)*
```bash
npm --prefix server run seed
```

---

## 🚀 Step 6: Start Backend with PM2

Start the Node API server on port 5004:
```bash
cd /var/www/dheeksha-trade
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```
*(Copy and run the `sudo env PATH=...` command shown on screen by `pm2 startup` if required).*

Check status:
```bash
pm2 status
pm2 logs dheeksha-trade-api --lines 20
```

---

## 🌐 Step 7: Configure Nginx & DNS

### 7.1 DNS Record (Hostinger / Cloudflare / Domain Registrar)
Add an **A Record** in your DNS management for `gemshine.tech`:
- **Type**: `A`
- **Name / Host**: `dheeksha-trade`
- **Points to / Value**: `YOUR_VPS_IP`
- **TTL**: `Auto` or `300`

### 7.2 Configure Nginx:
```bash
sudo cp /var/www/dheeksha-trade/nginx/dheeksha-trade.conf /etc/nginx/sites-available/dheeksha-trade
sudo ln -sf /etc/nginx/sites-available/dheeksha-trade /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Step 8: Configure Firewall & Free SSL (HTTPS)

### 8.1 Firewall:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

### 8.2 SSL Certificate:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dheeksha-trade.gemshine.tech
```
Follow prompts, enter your email, and accept terms. Certbot will configure SSL and automatic renewal automatically.

---

## 🔄 Step 9: Automatic Future Deployments (1 Command)

Whenever you push new changes to GitHub:
```bash
cd /var/www/dheeksha-trade
bash deploy.sh
```
This single command pulls new code, installs dependencies, builds frontend & backend, and reloads PM2 with zero hassle.
