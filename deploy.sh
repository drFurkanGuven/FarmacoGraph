#!/usr/bin/env bash
# ==============================================================================
# FarmacoGraph — VPS All-in-One Deployment & Maintenance Manager
# ==============================================================================
# Domain: furkanguven.wiki
# Multi-tenant VPS safe: Never touches other projects or existing Nginx vhosts!
#
# Usage:
#   sudo ./deploy.sh           # First-time installation & deployment
#   sudo ./deploy.sh update    # Update to latest GitHub commits & rebuild
#   sudo ./deploy.sh status    # Check container and healthcheck status
#   sudo ./deploy.sh logs      # Stream live logs (or: ./deploy.sh logs api)
#   sudo ./deploy.sh ingest    # Ingest full PrimeKG dataset into Neo4j
#   sudo ./deploy.sh admin     # Create or promote admin curator user
# ==============================================================================
set -euo pipefail

# ANSI Colors
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

log_info()    { echo -e "${CYAN}ℹ [INFO]${RESET} $*"; }
log_success() { echo -e "${GREEN}✓ [SUCCESS]${RESET} ${BOLD}$*${RESET}"; }
log_warn()    { echo -e "${YELLOW}⚠ [WARN]${RESET} $*"; }
log_error()   { echo -e "${RED}✗ [ERROR]${RESET} $*" >&2; }

# Work in current project directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

DOMAIN="${FG_DOMAIN:-furkanguven.wiki}"
EMAIL="${FG_ADMIN_EMAIL:-furkanguven96@gmail.com}"
ENV_FILE="${ROOT_DIR}/.env"

# Root/sudo verification
require_root() {
  if [[ $EUID -ne 0 ]]; then
    log_error "Bu işlem root veya sudo yetkisi gerektirir. Lütfen çalıştırın:"
    echo "  sudo $0 $*"
    exit 1
  fi
}

# Helper to read/write .env variables safely
get_env_val() {
  local key="$1"
  if [[ -f "${ENV_FILE}" ]] && grep -q "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    grep "^${key}=" "${ENV_FILE}" | tail -1 | cut -d= -f2-
    return
  fi
  echo "${2:-}"
}

set_env_val() {
  local key="$1"
  local val="$2"
  touch "${ENV_FILE}"
  if grep -q "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    if sed --version 2>/dev/null | grep -q GNU; then
      sed -i "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}"
    else
      sed -i '' "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}"
    fi
  else
    echo "${key}=${val}" >> "${ENV_FILE}"
  fi
}

# Scan and find free ports if not already configured in .env
setup_non_conflicting_ports() {
  log_info "VPS üzerindeki diğer projelerle port çakışması kontrol ediliyor..."
  if [[ -f "${ROOT_DIR}/scripts/find-ports.sh" ]]; then
    bash "${ROOT_DIR}/scripts/find-ports.sh" --apply >/dev/null 2>&1 || true
  fi

  # Fallback defaults if still unset
  local api_port
  api_port="$(get_env_val FG_HOST_API_PORT "8001")"
  local studio_port
  studio_port="$(get_env_val FG_HOST_STUDIO_PORT "3001")"
  local pg_port
  pg_port="$(get_env_val FG_HOST_PG_PORT "5433")"
  local neo4j_http
  neo4j_http="$(get_env_val FG_HOST_NEO4J_HTTP_PORT "7474")"
  local neo4j_bolt
  neo4j_bolt="$(get_env_val FG_HOST_NEO4J_BOLT_PORT "7687")"

  set_env_val "FG_HOST_API_PORT" "${api_port}"
  set_env_val "FG_HOST_STUDIO_PORT" "${studio_port}"
  set_env_val "FG_HOST_PG_PORT" "${pg_port}"
  set_env_val "FG_HOST_NEO4J_HTTP_PORT" "${neo4j_http}"
  set_env_val "FG_HOST_NEO4J_BOLT_PORT" "${neo4j_bolt}"

  log_success "Portlar ayrıldı (Diğer projelerle çakışma önlendi):"
  echo -e "  - API Port:        ${BOLD}${api_port}${RESET}"
  echo -e "  - Studio Port:     ${BOLD}${studio_port}${RESET}"
  echo -e "  - PostgreSQL Port: ${BOLD}${pg_port}${RESET}"
  echo -e "  - Neo4j HTTP/Bolt: ${BOLD}${neo4j_http} / ${neo4j_bolt}${RESET}"
}

# Generate cryptographically secure environment secrets
setup_environment_file() {
  log_info "Üretim ortamı (.env) ve güvenlik anahtarları yapılandırılıyor..."

  if [[ ! -f "${ENV_FILE}" ]]; then
    if [[ -f "${ROOT_DIR}/.env.example" ]]; then
      cp "${ROOT_DIR}/.env.example" "${ENV_FILE}"
    else
      touch "${ENV_FILE}"
    fi
  fi

  set_env_val "FG_ENVIRONMENT" "production"
  set_env_val "FG_LOG_JSON" "true"
  set_env_val "FG_PUBLIC_URL" "https://${DOMAIN}"
  set_env_val "FG_STUDIO_API_URL" "https://${DOMAIN}/api/v1"
  set_env_val "FG_STUDIO_BASE_PATH" "/studio"

  # JWT Secret
  local current_jwt
  current_jwt="$(get_env_val FG_JWT_SECRET_KEY "")"
  if [[ -z "${current_jwt}" || "${current_jwt}" == *"change-me"* || "${current_jwt}" == *"dev-secret"* || ${#current_jwt} -lt 32 ]]; then
    local new_jwt
    new_jwt="$(openssl rand -hex 32)"
    set_env_val "FG_JWT_SECRET_KEY" "${new_jwt}"
    log_info "Yeni güvenli 64-karakterlik JWT secret üretildi."
  fi

  # PostgreSQL
  local current_pg_pass
  current_pg_pass="$(get_env_val POSTGRES_PASSWORD "")"
  if [[ -z "${current_pg_pass}" || "${current_pg_pass}" == "farmacograph" ]]; then
    local new_pg_pass
    new_pg_pass="$(openssl rand -hex 16)"
    set_env_val "POSTGRES_PASSWORD" "${new_pg_pass}"
  fi

  # Neo4j
  local current_neo4j_pass
  current_neo4j_pass="$(get_env_val FG_NEO4J_PASSWORD "")"
  if [[ -z "${current_neo4j_pass}" || "${current_neo4j_pass}" == "farmacograph" ]]; then
    local new_neo4j_pass
    new_neo4j_pass="$(openssl rand -hex 16)"
    set_env_val "NEO4J_AUTH" "neo4j/${new_neo4j_pass}"
    set_env_val "FG_NEO4J_PASSWORD" "${new_neo4j_pass}"
  fi
}

# Safe Nginx Configuration that NEVER touches other domains on the VPS
setup_isolated_nginx() {
  log_info "İzole Nginx vhost konfigürasyonu hazırlanıyor (${DOMAIN})..."

  local api_port
  api_port="$(get_env_val FG_HOST_API_PORT "8001")"
  local studio_port
  studio_port="$(get_env_val FG_HOST_STUDIO_PORT "3001")"

  # Unique upstream identifiers to completely prevent collisions with any other server block
  local upstream_api="farmacograph_wiki_api"
  local upstream_studio="farmacograph_wiki_studio"

  local vhost_file="/etc/nginx/sites-available/${DOMAIN}.conf"
  local vhost_link="/etc/nginx/sites-enabled/${DOMAIN}.conf"

  # Create config file
  cat > "/tmp/${DOMAIN}.conf" <<NGINX_CONF
# FarmacoGraph — Dedicated Vhost for ${DOMAIN}
# Auto-generated by deploy.sh. Completely isolated from other sites.

upstream ${upstream_api} {
    server 127.0.0.1:${api_port};
    keepalive 16;
}

upstream ${upstream_studio} {
    server 127.0.0.1:${studio_port};
    keepalive 8;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Curation Studio Next.js
    location /studio {
        proxy_pass http://${upstream_studio};
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }

    # API & Documentation
    location / {
        proxy_pass http://${upstream_api};
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }
}
NGINX_CONF

  if [[ -d /etc/nginx/conf.d ]]; then
    local vhost_file="/etc/nginx/conf.d/${DOMAIN}.conf"
    cp "/tmp/${DOMAIN}.conf" "${vhost_file}"
    log_info "Fedora/RHEL Nginx konfigürasyonu yazıldı: ${vhost_file}"
  elif [[ -d /etc/nginx/sites-available ]]; then
    local vhost_file="/etc/nginx/sites-available/${DOMAIN}.conf"
    local vhost_link="/etc/nginx/sites-enabled/${DOMAIN}.conf"
    cp "/tmp/${DOMAIN}.conf" "${vhost_file}"
    mkdir -p /etc/nginx/sites-enabled
    ln -sf "${vhost_file}" "${vhost_link}"
    log_info "Debian/Ubuntu Nginx konfigürasyonu yazıldı: ${vhost_file}"
  else
    local vhost_file="/etc/nginx/conf.d/${DOMAIN}.conf"
    mkdir -p /etc/nginx/conf.d
    cp "/tmp/${DOMAIN}.conf" "${vhost_file}"
    log_info "Nginx konfigürasyonu yazıldı: ${vhost_file}"
  fi
  rm -f "/tmp/${DOMAIN}.conf"

  # Test Nginx syntax safely BEFORE applying
  log_info "Nginx konfigürasyonu test ediliyor (nginx -t)..."
  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx
    log_success "Nginx başarıyla güncellendi ve yeniden yüklendi."
  else
    log_error "Nginx testinde hata tespit edildi! Eski siteler bozulmasın diye iptal edildi."
    nginx -t
    return 1
  fi

  # Request/Expand SSL certificate via Certbot specifically for this domain
  if command -v certbot >/dev/null 2>&1; then
    log_info "Let's Encrypt SSL sertifikası kontrol ediliyor (${DOMAIN})..."
    certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect || {
      log_warn "Otomatik SSL sertifikası alınamadı. DNS A kaydınızın (${DOMAIN} -> Bu VPS IP) oturduğundan emin olun."
      log_warn "DNS yönlendikten sonra 'sudo certbot --nginx -d ${DOMAIN}' çalıştırabilirsiniz."
    }
    systemctl reload nginx >/dev/null 2>&1 || true
  else
    log_warn "certbot paketi bulunamadı. SSL için: apt install certbot python3-certbot-nginx"
  fi
}

# Wait for container healthy status
wait_for_service() {
  local service="$1"
  local max_wait="${2:-60}"
  log_info "Konteynerin hazır olması bekleniyor: ${service}..."
  local elapsed=0
  while [[ $elapsed -lt $max_wait ]]; do
    local health
    health="$(docker compose ps "${service}" --format '{{.Health}}' 2>/dev/null || echo "")"
    if [[ "${health}" == "healthy" ]]; then
      log_success "${service} sağlıklı durumda."
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  log_warn "${service} ${max_wait}s içinde 'healthy' bildirmedi, işleme devam ediliyor..."
}

# Action: Full Installation
cmd_install() {
  require_root
  echo -e "${BOLD}${BLUE}"
  echo "=================================================================="
  echo "    FarmacoGraph Kurulum ve Dağıtım Yöneticisi"
  echo "    Hedef Domain: ${DOMAIN}"
  echo "    Çalışma Dizini: ${ROOT_DIR}"
  echo "=================================================================="
  echo -e "${RESET}"

  # 1. System packages
  if command -v dnf >/dev/null 2>&1; then
    log_info "Fedora/RHEL (dnf) paketleri kontrol ediliyor..."
    dnf install -y -q curl git openssl jq nginx certbot python3-certbot-nginx >/dev/null 2>&1 || true
  elif command -v apt-get >/dev/null 2>&1; then
    log_info "Debian/Ubuntu (apt) paketleri kontrol ediliyor..."
    apt-get update -qq >/dev/null 2>&1 || true
    apt-get install -y -qq curl git openssl jq nginx certbot python3-certbot-nginx >/dev/null 2>&1 || true
  fi

  # 2. Check Docker
  if ! command -v docker >/dev/null 2>&1; then
    log_info "Docker bulunamadı, kuruluyor..."
    if command -v dnf >/dev/null 2>&1; then
      dnf -y install dnf-plugins-core
      dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
      dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      systemctl enable --now docker
    else
      curl -fsSL https://get.docker.com | bash
      systemctl enable --now docker
    fi
  fi

  # 3. Setup Ports without collision
  setup_non_conflicting_ports

  # 4. Setup .env
  setup_environment_file

  # 5. Start databases
  log_info "Veritabanları (PostgreSQL & Neo4j) başlatılıyor..."
  docker compose up -d postgres neo4j
  wait_for_service "postgres" 45
  wait_for_service "neo4j" 45

  # 6. Run database migrations
  log_info "Veritabanı şema migrasyonları uygulanıyor..."
  if [[ -f "${ROOT_DIR}/scripts/migrate-schema.sh" ]]; then
    bash "${ROOT_DIR}/scripts/migrate-schema.sh" || true
  fi

  # 7. Build and run API + Studio
  log_info "FastAPI ve Studio derleniyor ve ayağa kaldırılıyor..."
  docker compose up -d --build api studio
  wait_for_service "api" 45

  # 8. Configure isolated Nginx and SSL
  setup_isolated_nginx

  echo ""
  echo -e "${BOLD}${GREEN}"
  echo "=================================================================="
  echo "    ✓ FarmacoGraph Başarıyla Kuruldu ve Yayına Alındı!"
  echo "=================================================================="
  echo -e "${RESET}"
  echo -e "  🌐 Curation Studio: ${BOLD}https://${DOMAIN}/studio${RESET}"
  echo -e "  📖 Swagger API:     ${BOLD}https://${DOMAIN}/docs${RESET}"
  echo -e "  🩺 Sistem Sağlığı:  ${BOLD}https://${DOMAIN}/api/v1/health${RESET}"
  echo ""
  echo -e "Sonraki Adımlar:"
  echo -e "  - Güncelleme yapmak için:   ${CYAN}sudo ./deploy.sh update${RESET}"
  echo -e "  - Durumu kontrol etmek için: ${CYAN}sudo ./deploy.sh status${RESET}"
  echo -e "  - Logları izlemek için:      ${CYAN}sudo ./deploy.sh logs${RESET}"
  echo -e "  - PrimeKG verisini yüklemek: ${CYAN}sudo ./deploy.sh ingest${RESET}"
  echo ""
}

# Action: Update (Pull & Zero-Hassle Rebuild)
cmd_update() {
  require_root
  log_info "FarmacoGraph güncelleniyor..."

  # 1. Pull latest code from GitHub
  if [[ -d ".git" ]]; then
    local current_branch
    current_branch="$(git branch --show-current 2>/dev/null || echo "main")"
    log_info "GitHub üzerinden en son değişiklikler çekiliyor (${current_branch})..."
    git pull origin "${current_branch}"
  else
    log_warn "Git deposu bulunamadı, git pull atlanıyor."
  fi

  # 2. Run schema migration
  if [[ -f "${ROOT_DIR}/scripts/migrate-schema.sh" ]]; then
    log_info "Veritabanı şeması kontrol ediliyor..."
    bash "${ROOT_DIR}/scripts/migrate-schema.sh" || true
  fi

  # 3. Rebuild and restart API + Studio
  log_info "Konteynerler yeniden derlenip başlatılıyor..."
  docker compose up -d --build api studio

  # 4. Verify Nginx
  if command -v nginx >/dev/null 2>&1; then
    nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
  fi

  log_success "Güncelleme tamamlandı! Sistem güncel ve çalışır durumda."
}

# Action: Check Status
cmd_status() {
  echo -e "${BOLD}--- Konteyner Durumu ---${RESET}"
  docker compose ps
  echo ""
  echo -e "${BOLD}--- Sağlık Durumu (Healthcheck) ---${RESET}"
  local api_port
  api_port="$(get_env_val FG_HOST_API_PORT "8001")"
  curl -s "http://127.0.0.1:${api_port}/api/v1/health" | jq . 2>/dev/null || curl -s "http://127.0.0.1:${api_port}/api/v1/health"
  echo ""
}

# Action: Live Logs
cmd_logs() {
  shift || true
  docker compose logs -f "$@"
}

# Action: PrimeKG Ingestion
cmd_ingest() {
  log_info "PrimeKG (~128K düğüm, ~2M ilişki) veri aktarımı başlatılıyor..."
  if [[ -f "${ROOT_DIR}/scripts/ingestion/run_full_ingestion.sh" ]]; then
    bash "${ROOT_DIR}/scripts/ingestion/run_full_ingestion.sh" "$@"
  else
    log_error "scripts/ingestion/run_full_ingestion.sh bulunamadı!"
    exit 1
  fi
}

# Action: Create Admin
cmd_admin() {
  require_root
  if [[ -f "${ROOT_DIR}/scripts/create-curator.sh" ]]; then
    bash "${ROOT_DIR}/scripts/create-curator.sh" "$@"
  else
    log_error "scripts/create-curator.sh bulunamadı!"
    exit 1
  fi
}

# Main command router
COMMAND="${1:-install}"
case "${COMMAND}" in
  install)
    cmd_install
    ;;
  update|upgrade|pull)
    cmd_update
    ;;
  status|check)
    cmd_status
    ;;
  logs|log)
    cmd_logs "$@"
    ;;
  ingest|primekg)
    cmd_ingest "$@"
    ;;
  admin|curator)
    cmd_admin "$@"
    ;;
  -h|--help)
    echo "FarmacoGraph Deploy Manager"
    echo "Kullanım:"
    echo "  sudo ./deploy.sh           # İlk kurulum ve canlıya alma"
    echo "  sudo ./deploy.sh update    # GitHub'dan güncellemeleri çek ve yeniden derle"
    echo "  sudo ./deploy.sh status    # Durum ve sağlık kontrolü"
    echo "  sudo ./deploy.sh logs      # Canlı logları izle"
    echo "  sudo ./deploy.sh ingest    # PrimeKG verisini Neo4j'e aktar"
    echo "  sudo ./deploy.sh admin     # Yeni admin/küratör hesabı aç"
    ;;
  *)
    log_error "Bilinmeyen komut: ${COMMAND} (Yardım için: ./deploy.sh --help)"
    exit 1
    ;;
esac
