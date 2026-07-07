# Nginx + SSL — farmacograph.furkanguven.space

Reverse proxy from public HTTPS to FarmacoGraph API (Docker on host port `FG_HOST_API_PORT`, default **8001**).

## 1. DNS

Domain panelinde **A kaydı** ekle:

| Type | Name | Value |
|------|------|--------|
| A | `farmacograph` | Sunucu IP adresin |

Kontrol (birkaç dakika sürebilir):

```bash
dig +short farmacograph.furkanguven.space
```

## 2. API çalışıyor mu?

```bash
cd ~/FarmacoGraph
grep FG_HOST_API_PORT .env || echo "FG_HOST_API_PORT=8001"
curl -s http://127.0.0.1:8001/api/v1/health
```

Port farklıysa nginx config'teki `8001` değerini güncelle.

## 3. Nginx site config

```bash
cd ~/FarmacoGraph
git pull origin main

# API portunu .env'den oku ve config'e yaz
API_PORT=$(grep -E '^FG_HOST_API_PORT=' .env 2>/dev/null | cut -d= -f2)
API_PORT=${API_PORT:-8001}

sudo cp deploy/nginx/farmacograph.conf /etc/nginx/sites-available/farmacograph.conf
sudo sed -i "s/127.0.0.1:8001/127.0.0.1:${API_PORT}/" /etc/nginx/sites-available/farmacograph.conf

sudo ln -sf /etc/nginx/sites-available/farmacograph.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

HTTP test:

```bash
curl -s http://farmacograph.furkanguven.space/api/v1/health
```

## 4. SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d farmacograph.furkanguven.space
```

Sertifika yenileme otomatik (`certbot renew` timer).

HTTPS test:

```bash
curl -s https://farmacograph.furkanguven.space/api/v1/health
```

- API docs: https://farmacograph.furkanguven.space/docs
- OpenAPI: https://farmacograph.furkanguven.space/openapi.json

## 5. Güvenlik notları

- **Postgres (5432/5433), Neo4j (7474/7687)** dışarıya açık olmasın; sadece API subdomain'i public.
- Production'da `.env` içinde güçlü `FG_JWT_SECRET_KEY` kullan.
- `FG_ENVIRONMENT=production` düşün (ileride).

## Sorun giderme

```bash
sudo nginx -t
sudo systemctl status nginx
docker compose -f ~/FarmacoGraph/docker-compose.yml ps
docker compose -f ~/FarmacoGraph/docker-compose.yml logs api --tail 50
sudo tail -f /var/log/nginx/error.log
```

| Belirti | Olası neden |
|---------|-------------|
| 502 Bad Gateway | API container down veya yanlış upstream port |
| 404 nginx | `sites-enabled` symlink yok |
| SSL hatası | DNS henüz yayılmadı veya certbot domain doğrulayamadı |
