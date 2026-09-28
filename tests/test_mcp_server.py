"""Tests for FarmacoGraph Model Context Protocol (MCP) Server."""

from farmacograph.mcp.server import FarmacoGraphMCPServer


def test_mcp_initialize():
    server = FarmacoGraphMCPServer()
    req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "clientInfo": {"name": "test-client", "version": "1.0"},
        },
    }
    resp = server.handle_request(req)
    assert resp is not None
    assert resp["id"] == 1
    assert resp["result"]["serverInfo"]["name"] == "farmacograph-mcp-server"
    assert "tools" in resp["result"]["capabilities"]


def test_mcp_tools_list():
    server = FarmacoGraphMCPServer()
    req = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
    resp = server.handle_request(req)
    assert resp is not None
    tools = resp["result"]["tools"]
    tool_names = [t["name"] for t in tools]
    assert "explain_mechanism" in tool_names
    assert "check_drug_interactions" in tool_names
    assert "compare_drugs" in tool_names
    assert "get_drug_flashcards" in tool_names
    assert "search_biomedical_knowledge" in tool_names


def test_mcp_call_explain_mechanism():
    server = FarmacoGraphMCPServer()
    req = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "explain_mechanism",
            "arguments": {"drug": "ramipril", "effect": "dry_cough"},
        },
    }
    resp = server.handle_request(req)
    assert resp is not None
    assert "content" in resp["result"]
    text = resp["result"]["content"][0]["text"]
    assert "Ramipril" in text
    assert "bradykinin" in text


def test_mcp_call_check_drug_interactions():
    server = FarmacoGraphMCPServer()
    req = {
        "jsonrpc": "2.0",
        "id": 4,
        "method": "tools/call",
        "params": {
            "name": "check_drug_interactions",
            "arguments": {"drugs": ["ramipril", "spironolactone"]},
        },
    }
    resp = server.handle_request(req)
    assert resp is not None
    text = resp["result"]["content"][0]["text"]
    assert "Hyperkalemia" in text
    assert "major" in text
