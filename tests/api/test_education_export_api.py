"""Tests for Education Export & EdTech quiz router."""

from fastapi.testclient import TestClient
from farmacograph.api.main import app

client = TestClient(app)


def test_export_anki_tsv():
    response = client.get("/api/v1/education/export/anki?format=tsv")
    assert response.status_code == 200
    assert "text/tab-separated-values" in response.headers["content-type"]
    text = response.text
    assert "#separator:tab" in text
    assert "Ramipril" in text
    assert "High-Yield Pearl" in text


def test_generate_quiz():
    response = client.get("/api/v1/education/export/quiz?count=3")
    assert response.status_code == 200
    res = response.json()
    assert "data" in res
    assert len(res["data"]) == 3
    q1 = res["data"][0]
    assert "question_text" in q1
    assert "options" in q1
    assert len(q1["options"]) == 4
    assert "correct_option_index" in q1
    assert "high_yield_pearl" in q1
