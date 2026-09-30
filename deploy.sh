#!/usr/bin/env bash
# ==============================================================================
# Dheeksha Trade VPS Deployment / Update Script
# Usage on VPS: bash deploy.sh
# ==============================================================================

set -e

echo "🚀 [1/5] Pulling latest changes from Git..."
git pull origin main

echo "📦 [2/5] Installing root & client dependencies..."
npm install

echo "📦 [3/5] Installing backend dependencies..."
npm --prefix server install

echo "🔨 [4/5] Building client & backend..."
npm run build:all

echo "🔄 [5/5] Reloading PM2 backend service..."
pm2 reload ecosystem.config.cjs || pm2 start ecosystem.config.cjs

echo "✅ Deployment completed successfully!"
