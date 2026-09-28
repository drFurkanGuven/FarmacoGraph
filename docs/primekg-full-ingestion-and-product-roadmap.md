# FarmacoGraph: Full PrimeKG Ingestion, Data Pipeline & Clinical Product Roadmap

> **Document Status:** Architectural Specification & Implementation Master Plan  
> **Target Audience:** Engineering, Data Pipeline Developers, Opencode AI Agents, Clinical Curators  
> **Repository Location:** `FarmacoGraph/docs/primekg-full-ingestion-and-product-roadmap.md`

---

## 1. Executive Summary & Vision

### 1.1 The Challenge
FarmacoGraph currently has an enterprise-grade backend architecture (FastAPI, Neo4j, Pydantic validation, Auth, Outbox/Event system, Next.js Studio), but it operates as an **empty shell with only 4 mock/staging drugs** (`ramipril`, `losartan`, `spironolactone`, `metoprolol`). Without high-density, real-world pharmacological data:
- The DDI (Drug-Drug Interaction) engine relied on suffix heuristics instead of graph paths.
- The Mechanism Builder requires manual drawing of boxes from scratch.
- The platform feels incomplete and lacks clinical diagnostic power.

### 1.2 The Solution
Ingest the **entire PrimeKG (Precision Medicine Knowledge Graph)** developed by Harvard Zitnik Lab, containing:
- **~129,375 nodes** across 10 biological scales (Drugs, Targets/Genes, Pathways, Diseases, Biological Processes, Molecular Functions, Phenotypes, Anatomy).
- **~4,050,000 relationships (edges)** across 29 biomedical categories.
- Combined with a **Continuous Data Sync Pipeline** (openFDA / DailyMed) and **Graph-RAG (MCP Server)** to create a definitive, evidence-backed clinical pharmacology intelligence platform.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RAW DATA SOURCES                                │
│  ┌────────────────────────┐              ┌───────────────────────────┐ │
│  │ PrimeKG (Harvard/MIMS) │              │  openFDA / DailyMed API   │ │
│  │ ~129K Nodes, 4M Edges  │              │  Black Box Warnings, SPLs │ │
│  └───────────┬────────────┘              └─────────────┬─────────────┘ │
└──────────────┼─────────────────────────────────────────┼───────────────┘
               │                                         │
               ▼                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   INGESTION & VALIDATION PIPELINE                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ scripts/ingestion/etl_primekg_to_neo4j.py                        │  │
│  │ • Chunked UNWIND Batches (10,000/batch)                          │  │
│  │ • Ontology Entity Mapping & Normalization                        │  │
│  │ • Strict Validation Matrix (FG-C001 to FG-C029)                  │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       CORE FARMACOGRAPH GRAPH                          │
│                   (Neo4j 5.x Biomedical Database)                      │
│   (Drug) ──[:TARGETS]──► (Target) ──[:PART_OF]──► (Pathway)            │
│     │                      │                                           │
│     ├──[:INTERACTS_WITH]──┤                                           │
│     │                      ▼                                           │
│     └──[:TREATS]──────► (Disease) ◄──[:LEADS_TO]── (AdverseEffect)     │
└──────────────┬──────────────────────────────┬──────────────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌───────────────────────────────────────┐
│     STUDIO WEB INTERFACE     │ │       INTELLIGENCE & AI (MCP)         │
│ • Mechanism Builder (Auto)   │ │ • Zero-Hallucination Graph-RAG        │
│ • Polypharmacy & DDI Engine  │ │ • Claude / GPT Clinical Co-pilot      │
│ • Visual Pathway Traversal   │ │ • Alternative Drug Recommendations   │
└──────────────────────────────┘ └───────────────────────────────────────┘
```

---

## 2. PrimeKG Schema Mapping to FarmacoGraph Ontology

PrimeKG integrates 20 primary biomedical resources (DrugBank, KEGG, Reactome, GO, DisGeNET, SIDER, Mondo, HPO, etc.). Below is the exact mapping to FarmacoGraph core labels and relationship types:

### 2.1 Node Mapping Table

| PrimeKG `node_type` | FarmacoGraph Label | Identifier Ontologies | Example Entity |
| :--- | :--- | :--- | :--- |
| `drug` | `Drug` | RxNorm, DrugBank, ATC | Ramipril, Metoprolol, Amlodipine |
| `gene/protein` | `Target` / `BiomedicalEntity` | NCBI Gene, Ensembl, UniProt | ACE, ADRB1, HMGCR |
| `pathway` | `Pathway` / `MechanismFragment` | Reactome, KEGG, WikiPathways | Renin-Angiotensin System, Beta-adrenergic signaling |
| `biological_process` | `BiologicalProcess` | Gene Ontology (GO:BP) | Vasodilation, Potassium excretion, Platelet aggregation |
| `molecular_function` | `MolecularFunction` | Gene Ontology (GO:MF) | Angiotensin-converting enzyme activity |
| `cellular_component`| `CellularComponent` | Gene Ontology (GO:CC) | Plasma membrane, Sarcoplasmic reticulum |
| `disease` | `Disease` | MONDO, ICD-10, MeSH | Essential Hypertension, Heart Failure, Type 2 Diabetes |
| `effect/phenotype` | `AdverseEffect` / `Phenotype` | HPO, MedDRA, SIDER | Angioedema, Hyperkalemia, Bradycardia |
| `anatomy` | `Anatomy` | UBERON | Heart, Kidney proximal tubule, Vascular endothelium |

### 2.2 Relationship (Edge) Mapping Table

| PrimeKG `relation` | FarmacoGraph Relationship | Direction | Properties / Metadata |
| :--- | :--- | :--- | :--- |
| `drug_protein` | `TARGETS` / `INHIBITS` / `ACTIVATES` | `(Drug)->(Target)` | `action_type`, `affinity_nm`, `source: "primekg"` |
| `protein_pathway` | `PART_OF_PATHWAY` | `(Target)->(Pathway)` | `source: "reactome/kegg"` |
| `pathway_pathway` | `PRECEDES` / `HIERARCHY` | `(Pathway)->(Pathway)` | `sequence_order` |
| `protein_protein` | `INTERACTS_WITH_PROTEIN` | `(Target)-(Target)` | `ppi_score`, `biochemical_evidence` |
| `drug_drug` | `INTERACTS_WITH` | `(Drug)-(Drug)` (Symmetric)| `source: "primekg"`, `severity`, `evidence_ids` |
| `indication` | `TREATS` | `(Drug)->(Disease)` | `approval_status: "fda_approved"` |
| `contraindication` | `CONTRAINDICATED_IN` | `(Drug)->(Disease)` | `evidence_level`, `clinical_action` |
| `drug_effect` | `CAUSES_ADVERSE_EFFECT` | `(Drug)->(AdverseEffect)`| `frequency`, `sider_evidence_id` |
| `disease_phenotype`| `PRESENTS_PHENOTYPE` | `(Disease)->(Phenotype)` | `hpo_term_id` |
| `disease_gene` | `ASSOCIATED_WITH_GENE` | `(Disease)->(Target)` | `disgenet_score` |

---

## 3. Data Pipeline Implementation (Full Ingestion Architecture)

To process all ~4.05 million edges and ~129,000 nodes without memory exhaustion or timeouts:

### 3.1 Pipeline Directory Structure
```
FarmacoGraph/
├── scripts/
│   └── ingestion/
│       ├── download_primekg.py       # Downloads kg.csv from Harvard Dataverse / Hugging Face
│       ├── parse_primekg.py          # Pre-processes, cleans, splits nodes and edges into TSV
│       ├── etl_primekg_to_neo4j.py   # High-throughput batch UNWIND ingester into Neo4j
│       └── verify_ingestion.py       # Graph invariant checker and summary reporter
```

### 3.2 Ingestion Phase 1: Pre-processing & Normalization (`parse_primekg.py`)
1. Download `kg.csv` from Hugging Face (`mims-harvard/PrimeKG`) or Harvard Dataverse.
2. Generate deterministic UUIDv5 for entities using namespace `UUID("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")` based on entity ontology ID (e.g. `drug:DB00171`).
3. Normalize naming: lowercase slugs, stripped names, canonical ATC/RxNorm mapping.
4. Export clean chunks: `nodes_drugs.parquet`, `nodes_targets.parquet`, `nodes_diseases.parquet`, `edges_targets.parquet`, `edges_ddi.parquet`, `edges_pathways.parquet`.

### 3.3 Ingestion Phase 2: High-Performance Neo4j Batch Loader (`etl_primekg_to_neo4j.py`)
Uses async Neo4j driver with parameterized batch `UNWIND` queries (batch size: 10,000):

```cypher
// Index creation prior to ingestion for high-speed MERGE
CREATE CONSTRAINT drug_id_unique IF NOT EXISTS FOR (d:Drug) REQUIRE d.id IS UNIQUE;
CREATE INDEX drug_slug_idx IF NOT EXISTS FOR (d:Drug) ON (d.slug);
CREATE INDEX drug_name_idx IF NOT EXISTS FOR (d:Drug) ON (d.name);
CREATE CONSTRAINT target_id_unique IF NOT EXISTS FOR (t:Target) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT disease_id_unique IF NOT EXISTS FOR (d:Disease) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT pathway_id_unique IF NOT EXISTS FOR (p:Pathway) REQUIRE p.id IS UNIQUE;

// Batch Node Ingestion Pattern:
UNWIND $batch AS row
MERGE (d:Drug {id: row.id})
ON CREATE SET
  d.name = row.name,
  d.slug = row.slug,
  d.status = "published",
  d.content_layer = "biomedical",
  d.source = "primekg",
  d.external_ids = row.external_ids;

// Batch Relationship Ingestion Pattern:
UNWIND $batch AS row
MATCH (a:Drug {id: row.source_id})
MATCH (b:Drug {id: row.target_id})
MERGE (a)-[r:INTERACTS_WITH]-(b)
ON CREATE SET
  r.severity = row.severity,
  r.title = row.title,
  r.mechanism_explanation = row.mechanism_explanation,
  r.source = "primekg",
  r.evidence_ids = row.evidence_ids;
```

---

## 4. Continuous Data Sync & Freshness (openFDA & DailyMed Workers)

Biomedical literature evolves constantly. An unattended database becomes obsolete within months.

### 4.1 Sync Worker Architecture (`farmacograph/workers/fda_sync.py`)
- **Cadence:** Weekly or Monthly scheduled background worker.
- **Source API:** `https://api.fda.gov/drug/label.json` and `https://dailymed.nlm.nih.gov/dailymed/services/rest`.
- **Target Fields:**
  1. `boxed_warning` (Kara Kutu Uyarısı): If new text is detected, updates `has_black_box_warning=True` and records `black_box_text`.
  2. `indications_and_usage`: Checks for newly approved indications.
  3. `drug_interactions`: Detects newly reported interaction warnings.
  4. `contraindications`: Flags newly documented clinical contraindications.

### 4.2 Staging & Curator Approval Loop
To preserve data integrity, automated sync workers do **not** write blindly to live nodes:
1. When FDA sync detects a diff, it creates a `PendingChange` record in the database.
2. In Studio, a badge appears: *"3 Pending FDA Label Updates"*.
3. Curator reviews the incoming text, verifies with clinical judgement, and clicks *"Approve & Commit to Graph"*.

---

## 5. Mechanism Builder Automation (Auto-Layout from Graph)

Currently, the Mechanism Builder requires users to manually add nodes without knowing the underlying biological cascade. With full PrimeKG ingestion:

### 5.1 Auto-Generate Mechanism Pipeline
When the user types a drug name (e.g. *"Metoprolol"*) in the Mechanism Builder:
1. **API Call:** `GET /api/v1/drugs/metoprolol/mechanism-subgraph`
2. **Neo4j Cypher Traversal:**
   ```cypher
   MATCH (d:Drug {slug: $slug})-[r1:TARGETS]->(t:Target)
   OPTIONAL MATCH (t)-[r2:PART_OF_PATHWAY]->(p:Pathway)
   OPTIONAL MATCH (p)-[r3:PRECEDES]->(p2:Pathway)
   OPTIONAL MATCH (d)-[r4:TREATS]->(dis:Disease)
   OPTIONAL MATCH (d)-[r5:CAUSES_ADVERSE_EFFECT]->(adv:AdverseEffect)
   RETURN d, r1, t, r2, p, r3, p2, r4, dis, r5, adv
   ```
3. **Canvas Auto-Layout (`Dagre` / Hierarchical Layout):**
   - Automatically renders the biological cascade on the React Flow canvas:
     `[Drug: Metoprolol] ➔ [Target: β1-Adrenergic Receptor] ➔ [Pathway: AC-cAMP Signaling] ➔ [Outcome: Decreased Inotropy/HR] ➔ [Disease: Angina Pectoris]`
4. **Curator Enrichment:** The curator can click any node, open the newly added **Node Inspector panel**, edit descriptions, add Turkish translations, add educational clinical pearls, and save snapshots.

---

## 6. The 3 Core Killer Applications (Why This Transcends Demo Status)

### 6.1 Multi-Drug Polypharmacy & Synergism Simulator (`/interactions`)
- Clinical reality: Multimorbid elderly patients take 5–10 drugs simultaneously.
- Traditional tools only test drug pairs $(A, B)$ in isolation.
- **FarmacoGraph Multi-Traversal:** Analyzes the complete intersection graph of all $N$ selected drugs:
  - Detects shared target bottlenecks (e.g. 3 drugs all metabolized by CYP3A4).
  - Detects physiological synergies (e.g. Dual RAAS blockade + Potassium-sparing diuretic causing hyperkalemic cardiac arrest).
  - Provides **Alternative Drug Recommendations** that achieve the same therapeutic target without the overlapping toxic pathway.

### 6.2 Zero-Hallucination Graph-RAG Clinical Co-pilot (`farmacograph/mcp`)
- Standard LLMs hallucinate drug dosages and invent interactions.
- With PrimeKG in Neo4j and the `farmacograph/mcp` server:
  - LLM queries Neo4j for actual graph paths before generating answers.
  - Every clinical claim in the AI response is footnoted with node IDs, PubMed PMIDs, and FDA SPL citations.
  - Hekimler ve eczacılar için güvenilir, kanıtlı yapay zeka asistanı.

### 6.3 Interactive Educational Layer (`/learn`)
- Medical and pharmacy students struggle with memorizing hundreds of disconnected drug mechanisms.
- Interactive flashcards, mechanism step-by-step animations, and clinical case simulations generated directly from real PrimeKG graph traversals.

---

## 7. Phased Implementation Roadmap for Opencode

This roadmap provides concrete, actionable steps that can be handed to **opencode** or executed sequentially:

### Phase 1: Ingestion Scripting & Infrastructure
- [ ] Create `FarmacoGraph/scripts/ingestion/` directory.
- [ ] Implement `download_primekg.py`: Stream download `kg.csv` (Harvard Dataverse / Hugging Face).
- [ ] Implement `parse_primekg.py`: Filter, normalize names, format UUIDs, output Parquet/TSV.
- [ ] Add Neo4j constraint and index initialization script.
- [ ] Implement `etl_primekg_to_neo4j.py` with chunked UNWIND (10K batches) and progress logging.

### Phase 2: Interaction Engine & Subgraph API Update
- [ ] Update `farmacograph/repositories/graph.py` with high-performance multi-hop Cypher queries for PrimeKG data.
- [ ] Optimize `InteractionService.analyze` to query real PrimeKG `INTERACTS_WITH` edges with evidence.
- [ ] Implement `GET /api/v1/drugs/{slug}/mechanism-subgraph` endpoint for Mechanism Builder auto-generation.

### Phase 3: Mechanism Builder UX & Canvas Integration
- [ ] Complete the Node Inspector panel in `FarmacoGraph/apps/studio/src/app/mechanism-builder/page.tsx` (Handle integration, node editing, deletion).
- [ ] Add *"Auto-Load Pathway from Graph"* button in Mechanism Builder.
- [ ] Add auto-layout engine using `@dagrejs/dagre` or `@xyflow/react` layout helpers.

### Phase 4: Continuous Sync Worker (openFDA)
- [ ] Create `farmacograph/workers/fda_sync.py` to poll openFDA drug label API.
- [ ] Implement diff detection for Black Box Warnings and Contraindications.
- [ ] Build Studio UI component for reviewing and committing pending FDA updates.

### Phase 5: Production Deployment & Verification
- [ ] Run end-to-end graph validation matrix (`FarmacoGraph/tests/validation/`).
- [ ] Benchmark query response times under high-density Neo4j load (<150ms target for 5-drug polypharmacy check).
- [ ] Deploy updated Studio UI with search across all 15,000+ FDA and PrimeKG drug entities.
