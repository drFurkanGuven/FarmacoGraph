# FarmacoGraph VPS Deployment & Production Guide

This guide covers deploying the full FarmacoGraph platform (FastAPI backend, Next.js Curation Studio, Neo4j knowledge graph with PrimeKG, PostgreSQL, and Nginx SSL reverse proxy) to a Linux VPS (Ubuntu 22.04+, Ubuntu 24.04+, Debian 12+).

---

## 1. Quick One-Line Installation

On a fresh VPS, you can run the automated setup script with a single command:

```bash
curl -sSL https://raw.githubusercontent.com/drFurkanGuven/FarmacoGraph/main/deploy/vps-setup.sh | sudo bash
```

Or pass your custom domain and email:

```bash
curl -sSL https://raw.githubusercontent.com/drFurkanGuven/FarmacoGraph/main/deploy/vps-setup.sh | sudo bash -s -- --domain farmacograph.furkanguven.space --email furkanguven96@gmail.com
```

---

## 2. Step-by-Step Manual Deployment

If you prefer to clone the repository first:

```bash
# 1. Clone repository into /opt/FarmacoGraph
sudo git clone https://github.com/drFurkanGuven/FarmacoGraph.git /opt/FarmacoGraph
cd /opt/FarmacoGraph

# 2. Run the deployment script
sudo bash deploy/vps-setup.sh --domain farmacograph.furkanguven.space --email furkanguven96@gmail.com
```

### Script Flags:
- `--domain <domain>`: Your public domain name (DNS A-record must point to the VPS IP).
- `--email <email>`: Email address used for Let's Encrypt SSL and initial Admin user.
- `--skip-ssl`: Skip Let's Encrypt SSL issuance (useful if behind Cloudflare Flexible SSL).
- `--with-primekg`: Automatically trigger full PrimeKG dataset ingestion immediately (~128K nodes).

---

## 3. Populating the PrimeKG Biomedical Knowledge Graph

To download and ingest Harvard Zitnik Lab's **PrimeKG** dataset (~128,516 nodes, 2M+ relationships) into your Neo4j database on the VPS:

```bash
cd /opt/FarmacoGraph
./scripts/ingestion/run_full_ingestion.sh
```

This runs the automated 6-step pipeline:
1. `download_primekg.py` — Downloads `kg.csv`, `nodes.csv`, `edges.csv`
2. `parse_primekg.py` — Normalizes entities into chunked Parquet files
3. `init_neo4j_schema.py` — Sets up 17 constraints and indexes
4. `etl_primekg_to_neo4j.py` — High-speed UNWIND batch ingestion
5. `enrich_primekg_node_names.py` — Maps human-readable labels to all nodes
6. `verify_ingestion.py` — Verifies relationship counts and schema integrity

---

## 4. Operational Commands

### Check Running Containers
```bash
docker compose ps
```

### View Live Application Logs
```bash
# All logs
docker compose logs -f

# Backend API only
docker compose logs -f api

# Curation Studio only
docker compose logs -f studio
```

### Create New Admin / Curator Users
```bash
./scripts/create-curator.sh --email doctor@hospital.org
```

### Restart Application Stack
```bash
docker compose restart
```

---

## 5. Security & Firewall Architecture

The setup automatically configures:
- **UFW Firewall**: Allows only SSH (`22`), HTTP (`80`), and HTTPS (`443`).
- **Internal Database Isolation**: Neo4j (`7474`, `7687`) and PostgreSQL (`5432`, `5433`) are bound strictly to `127.0.0.1` and blocked from external ingress.
- **Nginx Reverse Proxy**:
  - `https://<domain>/studio` $\rightarrow$ Curation Studio (Next.js)
  - `https://<domain>/api/v1` $\rightarrow$ FastAPI Backend
  - `https://<domain>/docs` $\rightarrow$ Interactive OpenAPI Swagger documentation
