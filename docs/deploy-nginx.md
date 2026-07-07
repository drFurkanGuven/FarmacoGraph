# Nginx + SSL — farmacograph.furkanguven.space

Reverse proxy from public HTTPS to FarmacoGraph API (Docker on host port `FG_HOST_API_PORT`, default **8001**).

**Sunucu yolu:** `/opt/FarmacoGraph` (Fedora örneği)

## 1. DNS

| Type | Name | Value |
|------|------|--------|
| A | `farmacograph` | Sunucu IP |

```bash
dig +short farmacograph.furkanguven.space
```

## 2. API ayakta mı?

```bash
cd /opt/FarmacoGraph
docker compose ps
./scripts/find-ports.sh --up    # gerekirse
curl -s http://127.0.0.1:8001/api/v1/health
```

## 3. Nginx (otomatik — Fedora + Debian)

```bash
cd /opt/FarmacoGraph
git pull origin main
chmod +x scripts/install-nginx.sh
./scripts/install-nginx.sh
```

Script:
- **Fedora/RHEL** → `/etc/nginx/conf.d/farmacograph.conf`
- **Debian/Ubuntu** → `/etc/nginx/sites-available/` + `sites-enabled/`

HTTP test:

```bash
curl -s http://farmacograph.furkanguven.space/api/v1/health
```

### Manuel (Fedora)

```bash
cd /opt/FarmacoGraph
API_PORT=$(grep -E '^FG_HOST_API_PORT=' .env 2>/dev/null | cut -d= -f2)
API_PORT=${API_PORT:-8001}
sudo cp deploy/nginx/farmacograph.conf /etc/nginx/conf.d/farmacograph.conf
sudo sed -i "s/127.0.0.1:8001/127.0.0.1:${API_PORT}/" /etc/nginx/conf.d/farmacograph.conf
sudo nginx -t && sudo systemctl reload nginx
```

## 4. SSL

```bash
sudo certbot --nginx -d farmacograph.furkanguven.space
curl -s https://farmacograph.furkanguven.space/api/v1/health
```

- Docs: https://farmacograph.furkanguven.space/docs

## Sorun giderme

```bash
cd /opt/FarmacoGraph
docker compose ps
docker compose logs api --tail 50
sudo nginx -t
sudo tail -20 /var/log/nginx/error.log
```

| Belirti | Çözüm |
|---------|--------|
| `sites-available` yok | Fedora — `conf.d` kullan (script otomatik yapar) |
| `~/FarmacoGraph` yok | Proje `/opt/FarmacoGraph` altında |
| 502 Bad Gateway | API down — `docker compose up -d` |
| klinikiq server name warn | Başka site config çakışması; farmacograph etkilenmeyebilir |
