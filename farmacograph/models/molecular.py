"""Molecular and physiologic entity models."""

from __future__ import annotations

from farmacograph.models.base import BiomedicalEntity
from farmacograph.models.enums import EntityType


class TargetProtein(BiomedicalEntity):
    entity_type: EntityType = EntityType.TARGET_PROTEIN
    gene_symbol: str | None = None
    protein_type: str | None = None
    function: str | None = None


class Gene(BiomedicalEntity):
    entity_type: EntityType = EntityType.GENE
    gene_symbol: str
    chromosome: str | None = None
    function: str | None = None


class Receptor(BiomedicalEntity):
    entity_type: EntityType = EntityType.RECEPTOR
    family: str
    subtype: str | None = None
    endogenous_ligand: str | None = None


class Enzyme(BiomedicalEntity):
    entity_type: EntityType = EntityType.ENZYME
    ec_number: str | None = None
    is_cyp: bool = False
    cyp_family: str | None = None
    is_ugt: bool = False
    ugt_family: str | None = None


class Transporter(BiomedicalEntity):
    entity_type: EntityType = EntityType.TRANSPORTER
    transporter_type: str = "efflux"
    substrate_note: str | None = None


class Pathway(BiomedicalEntity):
    entity_type: EntityType = EntityType.PATHWAY
    pathway_type: str | None = None


class PhysiologicalProcess(BiomedicalEntity):
    entity_type: EntityType = EntityType.PHYSIOLOGICAL_PROCESS
    direction: str = "modulate"
    organ_system: str | None = None


class Organ(BiomedicalEntity):
    entity_type: EntityType = EntityType.ORGAN
    system: str
    laterality: str = "na"


class CellType(BiomedicalEntity):
    entity_type: EntityType = EntityType.CELL_TYPE
    organ_id: str | None = None
    function: str | None = None
