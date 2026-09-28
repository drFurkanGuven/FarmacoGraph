import os
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

os.environ["FG_ENVIRONMENT"] = "test"
os.environ["FG_DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["FG_NEO4J_ENABLED"] = "false"

from farmacograph.api.main import create_app
from farmacograph.core.container import get_container


@pytest.mark.asyncio
async def test_get_mechanism_graph_from_api():
    container = get_container()
    mock_subgraph = {
        "nodes": [
            {"id": "drug-1", "label": "Metoprolol", "type": "drug", "color": "bg-blue-600"},
            {"id": "target-1", "label": "Hedef: ADRB1", "type": "target", "color": "bg-indigo-500"},
            {"id": "pathway-1", "label": "Yolak: Adrenergic signaling", "type": "mechanism", "color": "bg-purple-500"},
            {"id": "outcome-1", "label": "Endikasyon: Hypertension", "type": "outcome", "color": "bg-emerald-500"},
            {"id": "adverse-1", "label": "Yan Etki: Bradycardia", "type": "adverse", "color": "bg-red-500"},
        ],
        "edges": [
            {"id": "e-drug-1-target-1", "source": "drug-1", "target": "target-1", "label": "TARGETS"},
            {"id": "e-target-1-pathway-1", "source": "target-1", "target": "pathway-1", "label": "PART_OF"},
            {"id": "e-drug-1-outcome-1", "source": "drug-1", "target": "outcome-1", "label": "TREATS"},
            {"id": "e-drug-1-adverse-1", "source": "drug-1", "target": "adverse-1", "label": "CAUSES"},
        ],
    }

    container.graph_repo.get_mechanism_subgraph = AsyncMock(return_value=mock_subgraph)
    app = create_app()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/mechanisms/graph/metoprolol")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["nodes"]) == 5
        assert len(data["edges"]) == 4
        assert data["nodes"][0]["label"] == "Metoprolol"
        assert data["edges"][0]["label"] == "TARGETS"
