# Freshdesk Ticket Intelligence System

Dashboard + AI Chatbot + Analytics untuk data tiket Freshdesk.

## Arsitektur Deployment

```
Vercel (Frontend React)
    │
    ├── /api/* ──rewrite──→ https://server-anda.com/api/*
    │
Server Anda (Docker + Nginx)
    ├── nginx (reverse proxy, port 80)
    └── backend (Node.js Express, port 3001)
            │
            ├── PostgreSQL (di laptop / server terpisah)
            └── Ollama (lokal, untuk AI)
```

## Deployment

### 1. Frontend → Vercel

```bash
cd frontend
vercel --prod
```

Sebelum deploy, edit `frontend/vercel.json`:
- Ganti `https://server-anda.com` dengan domain/IP server backend kamu

### 2. Backend → Server sendiri (Docker + Nginx)

```bash
# Clone di server
git clone https://github.com/amalindouser/Ticket-intelegence.git
cd Ticket-intelegence

# Setup environment
cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgresql://fti_user:fti_password@<IP_LAPTOP>:5432/freshdesk_ticket_intelegence
#   FRESHDESK_DOMAIN=...
#   FRESHDESK_API_KEY=...

# Jalankan
docker compose -f docker-compose.prod.yml up -d --build
```

Backend API tersedia di `http://server-anda:80/api/...`
