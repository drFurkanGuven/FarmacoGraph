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

**Önemli:** Sadece `listen 80` bloğu yetmez. HTTPS (`443`) bloğunda da `proxy_pass` olmalı.
Tam şablon: `deploy/nginx/farmacograph.conf` (HTTP redirect + HTTPS proxy).

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
# Sertifika yoksa önce:
sudo certbot certonly --nginx -d farmacograph.furkanguven.space

# Tam config (HTTP redirect + HTTPS proxy):
cd /opt/FarmacoGraph
API_PORT=$(grep -E '^FG_HOST_API_PORT=' .env 2>/dev/null | cut -d= -f2)
API_PORT=${API_PORT:-8001}
sudo cp deploy/nginx/farmacograph.conf /etc/nginx/conf.d/farmacograph.conf
sudo sed -i "s/127.0.0.1:8001/127.0.0.1:${API_PORT}/" /etc/nginx/conf.d/farmacograph.conf
sudo nginx -t && sudo systemctl reload nginx
```

```bash
curl -s https://farmacograph.furkanguven.space/api/v1/health
curl -I https://farmacograph.furkanguven.space/docs
```

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
| **404 `/docs` (HTTPS)** | Certbot SSL bloğunda `proxy_pass` eksik — aşağıya bak |
| klinikiq server name warn | Başka site config çakışması; farmacograph etkilenmeyebilir |

### `/docs` 404 ama API localhost'ta çalışıyor

```bash
curl -I http://127.0.0.1:8001/docs          # 200 olmalı
curl -I https://farmacograph.furkanguven.space/docs
sudo nginx -T 2>/dev/null | grep -A35 "farmacograph.furkanguven.space"
```

HTTPS `server { listen 443 ssl; ...}` içinde **mutlaka**:

```nginx
location / {
    proxy_pass http://farmacograph_api;   # upstream 127.0.0.1:8001
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Certbot bazen sadece HTTP bloğunu günceller. SSL bloğuna aynı `location /` ekleyip:

```bash
sudo nginx -t && sudo systemctl reload nginx
```
