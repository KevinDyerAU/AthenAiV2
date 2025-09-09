import os
import pytest
from flask_jwt_extended import create_access_token
from api.app import create_app
from api.extensions import db


@pytest.fixture(autouse=True)
def mock_mq_and_db(monkeypatch):
    monkeypatch.setattr("api.utils.rabbitmq.publish_exchange", lambda *a, **k: None)
    monkeypatch.setattr("api.utils.rabbitmq.ensure_coordination_bindings", lambda: True)
    monkeypatch.setattr("api.utils.rabbitmq.publish_task", lambda *a, **k: None)
    from api.resources import conversations as conv_mod
    try:
        monkeypatch.setattr(conv_mod, "socketio", type('MockSocketIO', (), {'emit': lambda *a, **k: None})())
    except Exception:
        pass


@pytest.fixture()
def app(monkeypatch):
    os.environ["FLASK_ENV"] = "development"
    os.environ["TESTING"] = "true"
    os.environ["DATABASE_URL"] = "sqlite:///:memory:"
    app = create_app()
    app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        DB_AUTO_CREATE=True,
        JWT_SECRET_KEY="test-jwt",
    )

    # Mock Neo4j client used by conversations resource
    class MockClient:
        def run_query(self, cypher, params=None):
            # participants endpoints
            if "RETURN collect(p.id) AS participants" in cypher:
                return [[["u1", "u2"]]]
            if "MATCH (owner:User {id: $uid})-[:OWNS]->(c:Conversation {id: $cid})" in cypher and "MERGE (u)-[r:MEMBER_OF]->(c)" in cypher:
                return [["u3", "member"]]
            if "DELETE r RETURN count(r) AS removed" in cypher:
                return [[1]]
            # message search - each row should be a dict with "m" key
            if "RETURN m ORDER BY m.created_at DESC LIMIT" in cypher and "HAS_MESSAGE" in cypher:
                return [
                    {"m": {"id": "m1", "role": "user", "content": "hello vector", "created_at": 1, "agent": None}},
                    {"m": {"id": "m2", "role": "assistant", "content": "vector reply", "created_at": 2, "agent": "bot"}}
                ]
            # message create (not directly tested here)
            return []

    from api.resources import conversations as conv_mod
    monkeypatch.setattr(conv_mod, "get_client", lambda: MockClient())

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()


@pytest.fixture()
def client(app):
    return app.test_client()


def auth_headers(app):
    with app.app_context():
        token = create_access_token(identity="test-user")
    return {"Authorization": f"Bearer {token}"}


def test_message_search(app, client):
    cid = "c1"
    resp = client.get(f"/api/conversations/{cid}/messages/search?q=vector&limit=10", headers=auth_headers(app))
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["count"] == 2
    assert any("vector" in item["content"] for item in data["items"])


def test_participants_list_add_delete(app, client):
    cid = "c1"
    # list
    resp = client.get(f"/api/conversations/{cid}/participants", headers=auth_headers(app))
    assert resp.status_code == 200
    data = resp.get_json()
    assert set(data["participants"]) == {"u1", "u2"}

    # add
    resp2 = client.post(
        f"/api/conversations/{cid}/participants",
        json={"user_id": "u3"},
        headers=auth_headers(app),
    )
    assert resp2.status_code == 201
    assert resp2.get_json()["added"] == "u3"

    # delete
    resp3 = client.delete(
        f"/api/conversations/{cid}/participants/u3",
        headers=auth_headers(app),
    )
    assert resp3.status_code == 200
    assert resp3.get_json()["removed"] == 1
