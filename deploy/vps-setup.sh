#!/usr/bin/env bash
# ==============================================================================
# FarmacoGraph — Master VPS Server Bootstrap & Production Setup Script
# ==============================================================================
# Supported OS: Ubuntu 22.04+, Ubuntu 24.04+, Debian 12+
#
# One-liner installation on a clean VPS:
#   curl -sSL https://raw.githubusercontent.com/drFurkanGuven/FarmacoGraph/main/deploy/vps-setup.sh | sudo bash
#
# Or run with custom options:
#   sudo bash deploy/vps-setup.sh --domain farmacograph.furkanguven.space --email admin@example.com
#
# Options:
#   --domain <domain>    Public domain name (default: farmacograph.furkanguven.space)
#   --email <email>      Email for Let's Encrypt SSL and initial Admin user
#   --skip-ssl           Skip Let's Encrypt SSL (e.g. for development or Cloudflare proxy)
#   --with-primekg       Automatically download and ingest PrimeKG graph (128K nodes)
#   --non-interactive    Run without prompting for input
# ==============================================================================
set -euo pipefail

# Text formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

log_info() { echo -e "${CYAN}[INFO]${RESET} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${RESET} ${BOLD}$*${RESET}"; }
log_warn() { echo -e "${YELLOW}[WARN]${RESET} $*"; }
log_error() { echo -e "${RED}[ERROR]${RESET} $*" >&2; }

# Default parameters
DOMAIN="farmacograph.furkanguven.space"
EMAIL="furkanguven96@gmail.com"
SKIP_SSL=false
WITH_PRIMEKG=false
NON_INTERACTIVE=false
INSTALL_DIR="/opt/FarmacoGraph"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain=*) DOMAIN="${1#*=}" ;;
    --domain) shift; DOMAIN="$1" ;;
    --email=*) EMAIL="${1#*=}" ;;
    --email) shift; EMAIL="$1" ;;
    --skip-ssl) SKIP_SSL=true ;;
    --with-primekg) WITH_PRIMEKG=true ;;
    --non-interactive|-y) NON_INTERACTIVE=true ;;
    -h|--help)
      sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
  shift
done

echo -e "${BOLD}${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║          FarmacoGraph VPS Production Deployment Setup           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# 1. Root check
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (or with sudo)."
   exit 1
fi

log_info "Deployment Target: ${BOLD}${DOMAIN}${RESET}"
log_info "Admin / SSL Email: ${BOLD}${EMAIL}${RESET}"
log_info "Installation Path: ${BOLD}${INSTALL_DIR}${RESET}"

# 2. Update packages and install prerequisites
log_info "Step 1/8: Installing system packages (curl, git, openssl, jq, ufw, nginx)..."
apt-get update -qq
apt-get install -y -qq \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  openssl \
  jq \
  ufw \
  nginx \
  certbot \
  python3-certbot-nginx \
  python3-pip \
  python3-venv

# 3. Configure UFW firewall
log_info "Step 2/8: Configuring UFW firewall (SSH, HTTP, HTTPS)..."
ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
# Prevent external access to internal database ports
ufw deny 5432/tcp >/dev/null 2>&1 || true
ufw deny 5433/tcp >/dev/null 2>&1 || true
ufw deny 7474/tcp >/dev/null 2>&1 || true
ufw deny 7687/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

# 4. Install Docker & Docker Compose Plugin if missing
log_info "Step 3/8: Verifying Docker and Docker Compose..."
if ! command -v docker >/dev/null 2>&1; then
  log_info "Installing official Docker Engine..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  log_info "Docker is already installed."
fi

# 5. Clone or update repository
log_info "Step 4/8: Setting up FarmacoGraph codebase..."
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  log_info "Existing repository detected in ${INSTALL_DIR}, pulling latest changes..."
  cd "${INSTALL_DIR}"
  git fetch --all --prune
  git checkout main || git checkout master
  git pull origin $(git branch --show-current)
elif [[ -d "./.git" ]] && grep -qi "FarmacoGraph" .git/config 2>/dev/null; then
  log_info "Running from existing local workspace: $(pwd)"
  INSTALL_DIR="$(pwd)"
else
  log_info "Cloning FarmacoGraph to ${INSTALL_DIR}..."
  mkdir -p "$(dirname "${INSTALL_DIR}")"
  git clone https://github.com/drFurkanGuven/FarmacoGraph.git "${INSTALL_DIR}"
  cd "${INSTALL_DIR}"
fi

# 6. Configure Environment & Cryptographic Secrets
log_info "Step 5/8: Generating secure production secrets..."
ENV_FILE="${INSTALL_DIR}/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp .env.example "${ENV_FILE}" 2>/dev/null || touch "${ENV_FILE}"
fi

# Helper to write/update env var
set_env() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}"
  else
    echo "${key}=${val}" >> "${ENV_FILE}"
  fi
}

JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASS=$(openssl rand -hex 16)
NEO4J_PASS=$(openssl rand -hex 16)

set_env "FG_ENVIRONMENT" "production"
set_env "FG_LOG_JSON" "true"
set_env "FG_PUBLIC_URL" "https://${DOMAIN}"
set_env "FG_STUDIO_API_URL" "https://${DOMAIN}/api/v1"
set_env "FG_STUDIO_BASE_PATH" "/studio"
set_env "FG_JWT_SECRET_KEY" "${JWT_SECRET}"

# If passwords are not already set securely, update them
if ! grep -q "POSTGRES_PASSWORD" "${ENV_FILE}" || grep -q "POSTGRES_PASSWORD=farmacograph" "${ENV_FILE}"; then
  set_env "POSTGRES_PASSWORD" "${POSTGRES_PASS}"
fi
if ! grep -q "NEO4J_AUTH" "${ENV_FILE}" || grep -q "NEO4J_AUTH=neo4j/farmacograph" "${ENV_FILE}"; then
  set_env "NEO4J_AUTH" "neo4j/${NEO4J_PASS}"
  set_env "FG_NEO4J_PASSWORD" "${NEO4J_PASS}"
fi

set_env "FG_HOST_PG_PORT" "5433"
set_env "FG_HOST_NEO4J_HTTP_PORT" "7474"
set_env "FG_HOST_NEO4J_BOLT_PORT" "7687"
set_env "FG_HOST_API_PORT" "8001"
set_env "FG_HOST_STUDIO_PORT" "3001"

# 7. Start Docker Containers & Run Migrations
log_info "Step 6/8: Starting Docker Compose stack and running schema migrations..."
docker compose down --remove-orphans >/dev/null 2>&1 || true

# Bring up databases first
docker compose up -d postgres neo4j
log_info "Waiting for PostgreSQL and Neo4j to become healthy..."
timeout=60
while [[ $timeout -gt 0 ]]; do
  if docker compose ps postgres | grep -q "(healthy)" && docker compose ps neo4j | grep -q "(healthy)"; then
    break
  fi
  sleep 2
  timeout=$((timeout - 2))
done

# Run schema migrations
log_info "Applying database schema migrations..."
if [[ -f "./scripts/migrate-schema.sh" ]]; then
  bash ./scripts/migrate-schema.sh || true
fi

# Build and start API and Studio
log_info "Building and starting API and Curation Studio..."
docker compose up -d --build api studio

# 8. Setup Nginx Reverse Proxy & SSL Certificate
log_info "Step 7/8: Configuring Nginx and SSL certificate for ${DOMAIN}..."

NGINX_CONF="/etc/nginx/sites-available/farmacograph.conf"
cat > "${NGINX_CONF}" <<NGINX_EOF
upstream farmacograph_api {
    server 127.0.0.1:8001;
    keepalive 16;
}

upstream farmacograph_studio {
    server 127.0.0.1:3001;
    keepalive 8;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /studio {
        proxy_pass http://farmacograph_studio;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
        proxy_redirect off;
        proxy_buffering off;
    }

    location / {
        proxy_pass http://farmacograph_api;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
    }
}
NGINX_EOF

ln -sf "${NGINX_CONF}" /etc/nginx/sites-enabled/farmacograph.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

if [[ "${SKIP_SSL}" != "true" ]]; then
  log_info "Obtaining Let's Encrypt SSL certificate for ${DOMAIN}..."
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect || {
    log_warn "Certbot automated issuance encountered an issue. Ensure your DNS A Record points to this VPS IP."
  }
  systemctl reload nginx || true
fi

# 9. Optional PrimeKG Ingestion
if [[ "${WITH_PRIMEKG}" == "true" ]]; then
  log_info "Step 8/8: Executing PrimeKG Ingestion (~128K nodes)..."
  bash scripts/ingestion/run_full_ingestion.sh || log_warn "PrimeKG ingestion can be run later with: ./scripts/ingestion/run_full_ingestion.sh"
else
  log_info "Step 8/8: Skipping PrimeKG ingestion (run './scripts/ingestion/run_full_ingestion.sh' anytime to populate)."
fi

# Create default curator/admin if script exists
if [[ -f "./scripts/create-curator.sh" ]]; then
  bash ./scripts/create-curator.sh --email "${EMAIL}" >/dev/null 2>&1 || true
fi

echo ""
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║          ✓ FarmacoGraph Successfully Deployed to VPS!           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  🌐 Studio Web UI:   ${BOLD}https://${DOMAIN}/studio${RESET}"
echo -e "  📖 API & Docs:      ${BOLD}https://${DOMAIN}/docs${RESET}"
echo -e "  🩺 Healthcheck:     ${BOLD}https://${DOMAIN}/api/v1/health${RESET}"
echo ""
echo -e "Useful Commands:"
echo -e "  - Container Status: ${CYAN}docker compose ps${RESET}"
echo -e "  - View Live Logs:   ${CYAN}docker compose logs -f${RESET}"
echo -e "  - Ingest PrimeKG:   ${CYAN}./scripts/ingestion/run_full_ingestion.sh${RESET}"
echo -e "  - Restart Stack:    ${CYAN}docker compose restart${RESET}"
echo ""
