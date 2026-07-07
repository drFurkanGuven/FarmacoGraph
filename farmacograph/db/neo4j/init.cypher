// FarmacoGraph Neo4j initialization
// Run once on empty database: cypher-shell -f init.cypher
// Biomedical knowledge only — no operational data in Neo4j

// --- Constraints ---
CREATE CONSTRAINT entity_id IF NOT EXISTS
FOR (n:BiomedicalEntity) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT drug_slug IF NOT EXISTS
FOR (d:Drug) REQUIRE d.slug IS UNIQUE;

CREATE CONSTRAINT disease_slug IF NOT EXISTS
FOR (d:Disease) REQUIRE d.slug IS UNIQUE;

CREATE CONSTRAINT mechanism_fragment_slug IF NOT EXISTS
FOR (m:MechanismFragment) REQUIRE m.slug IS UNIQUE;

CREATE CONSTRAINT evidence_id IF NOT EXISTS
FOR (e:Evidence) REQUIRE e.id IS UNIQUE;

// --- Property indexes ---
CREATE INDEX drug_generic_name IF NOT EXISTS FOR (d:Drug) ON (d.generic_name);
CREATE INDEX drug_rxnorm IF NOT EXISTS FOR (d:Drug) ON (d.rxnorm);
CREATE INDEX entity_status IF NOT EXISTS FOR (n:BiomedicalEntity) ON (n.status);
CREATE INDEX entity_dataset_version IF NOT EXISTS FOR (n:BiomedicalEntity) ON (n.dataset_version);
CREATE INDEX education_content_layer IF NOT EXISTS FOR (e:EducationResource) ON (e.content_layer);
CREATE INDEX knowledge_topic_slug IF NOT EXISTS FOR (k:KnowledgeTopic) ON (k.slug);

// --- Relationship type indexes (Neo4j 5+) ---
CREATE INDEX rel_treats IF NOT EXISTS FOR ()-[r:TREATS]-() ON (r.status);
CREATE INDEX rel_causes IF NOT EXISTS FOR ()-[r:CAUSES]-() ON (r.status);
CREATE INDEX rel_inhibits IF NOT EXISTS FOR ()-[r:INHIBITS]-() ON (r.status);
CREATE INDEX rel_interacts IF NOT EXISTS FOR ()-[r:INTERACTS_WITH]-() ON (r.status);
CREATE INDEX rel_metabolized IF NOT EXISTS FOR ()-[r:METABOLIZED_BY]-() ON (r.status);
CREATE INDEX rel_mechanism_root IF NOT EXISTS FOR ()-[r:HAS_MECHANISM_ROOT]-() ON (r.status);
