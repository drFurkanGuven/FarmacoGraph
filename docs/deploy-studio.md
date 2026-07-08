# Deploy Curation Studio (production)

Studio URL: **https://farmacograph.furkanguven.space/studio/**

## Server (Fedora, `/opt/FarmacoGraph`)

```bash
cd /opt/FarmacoGraph
git pull

# Build & start API + Studio (first studio build ~2–3 min)
docker compose up -d --build api studio

docker compose ps
curl -sI http://127.0.0.1:3001/studio/ | head -5
```

## Nginx

```bash
sudo cp deploy/nginx/farmacograph.conf /etc/nginx/conf.d/farmacograph.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Verify

- Studio: https://farmacograph.furkanguven.space/studio/
- API health: https://farmacograph.furkanguven.space/api/v1/health
- Dashboard should load queue/stats from the same-origin API (`/api/v1`)

## Environment (optional `.env` on server)

```env
FG_HOST_STUDIO_PORT=3001
FG_STUDIO_API_URL=https://farmacograph.furkanguven.space/api/v1
FG_STUDIO_BASE_PATH=/studio
```

## Troubleshooting

```bash
docker compose logs studio --tail 50
docker compose logs api --tail 30
curl -s http://127.0.0.1:3001/studio/ | head -20
```

If Studio build fails (memory): `docker system prune` and retry with swap enabled.
