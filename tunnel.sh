#!/bin/bash
# Start backend + tunnel, capture URL
cd "$(dirname "$0")"
bash start.sh
sleep 3
pkill -f "cloudflared tunnel --url" 2>/dev/null
sleep 1
nohup cloudflared tunnel --url http://localhost:3001 &>/tmp/cloudflared.log &
echo "Menunggu tunnel..."
sleep 8
URL=$(grep -oP 'https://[a-z-]+\.trycloudflare\.com' /tmp/cloudflared.log | head -1)
echo ""
echo "==================================="
echo "  TUNNEL URL: $URL"
echo "==================================="
echo ""
echo "Update vercel.json & push ke GitHub"
