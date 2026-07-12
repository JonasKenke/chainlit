"""Tests for the prompt gallery endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from chainlit.auth import get_current_user
from chainlit.config import config
from chainlit.data.base import BaseDataLayer
from chainlit.server import app
from chainlit.types import PromptDict
from chainlit.user import PersistedUser


@pytest.fixture
def test_client():
    return TestClient(app)


@pytest.fixture
def persisted_user():
    return PersistedUser(
        id="user-1",
        identifier="test@example.com",
        createdAt="2024-01-01T00:00:00Z",
    )


@pytest.fixture
def other_user():
    return PersistedUser(
        id="other-user",
        identifier="other@example.com",
        createdAt="2024-01-01T00:00:00Z",
    )


@pytest.fixture
def sample_prompt() -> PromptDict:
    return PromptDict(
        id="prompt-1",
        title="Test Prompt",
        content="Do something useful",
        userId="user-1",
        isShared=False,
        createdAt="2024-01-01T00:00:00Z",
        updatedAt="2024-01-01T00:00:00Z",
    )


@pytest.fixture
def mock_data_layer(sample_prompt):
    dl = AsyncMock(spec=BaseDataLayer)
    dl.list_prompts.return_value = [sample_prompt]
    dl.create_prompt.return_value = sample_prompt
    dl.get_prompt.return_value = sample_prompt
    dl.update_prompt.return_value = {**sample_prompt, "title": "Updated"}
    dl.delete_prompt.return_value = True
    return dl


def _enable_gallery(monkeypatch):
    monkeypatch.setattr(config.features, "prompt_gallery", True)


# ---- feature disabled (default) ----


def test_list_prompts_feature_disabled(test_client, monkeypatch):
    monkeypatch.setattr(config.features, "prompt_gallery", False)
    response = test_client.get("/project/prompts")
    assert response.status_code == 400
    assert "not enabled" in response.json()["detail"]


def test_create_prompt_feature_disabled(test_client, monkeypatch):
    monkeypatch.setattr(config.features, "prompt_gallery", False)
    response = test_client.post("/project/prompts", json={"title": "x", "content": "y"})
    assert response.status_code == 400


# ---- auth gating ----


def test_list_prompts_no_auth(test_client, monkeypatch):
    """No-auth apps use one stable gallery for all anonymous sessions."""
    _enable_gallery(monkeypatch)
    monkeypatch.setattr("chainlit.server.require_login", lambda: False)
    app.dependency_overrides[get_current_user] = lambda: None
    try:
        with patch("chainlit.server.get_data_layer") as mock_dl:
            dl_mock = MagicMock()
            dl_mock.list_prompts = AsyncMock(return_value=[])
            mock_dl.return_value = dl_mock
            response = test_client.get("/project/prompts")
        assert response.status_code == 200
        assert response.json() == []
        dl_mock.list_prompts.assert_awaited_once_with("anonymous")
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ---- CRUD happy paths ----


def test_list_prompts_ok(
    test_client, monkeypatch, persisted_user, mock_data_layer, sample_prompt
):
    _enable_gallery(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: persisted_user
    try:
        with patch("chainlit.server.get_data_layer", return_value=mock_data_layer):
            response = test_client.get("/project/prompts")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert data[0]["id"] == "prompt-1"


def test_create_prompt_ok(
    test_client, monkeypatch, persisted_user, mock_data_layer, sample_prompt
):
    _enable_gallery(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: persisted_user
    try:
        with patch("chainlit.server.get_data_layer", return_value=mock_data_layer):
            response = test_client.post(
                "/project/prompts",
                json={"title": "Test Prompt", "content": "Do something useful"},
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.json()["title"] == "Test Prompt"


def test_update_prompt_ok(test_client, monkeypatch, persisted_user, mock_data_layer):
    _enable_gallery(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: persisted_user
    try:
        with patch("chainlit.server.get_data_layer", return_value=mock_data_layer):
            response = test_client.put(
                "/project/prompts/prompt-1", json={"title": "Updated"}
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.json()["title"] == "Updated"


def test_update_prompt_not_owner(test_client, monkeypatch, other_user, mock_data_layer):
    _enable_gallery(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: other_user
    try:
        with patch("chainlit.server.get_data_layer", return_value=mock_data_layer):
            response = test_client.put(
                "/project/prompts/prompt-1", json={"title": "Hack"}
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 404


def test_delete_prompt_ok(test_client, monkeypatch, persisted_user, mock_data_layer):
    _enable_gallery(monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: persisted_user
    try:
        with patch("chainlit.server.get_data_layer", return_value=mock_data_layer):
            response = test_client.delete("/project/prompts/prompt-1")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.json()["success"] is True


def test_delete_prompt_not_found(test_client, monkeypatch, persisted_user):
    _enable_gallery(monkeypatch)
    dl = AsyncMock(spec=BaseDataLayer)
    dl.delete_prompt.return_value = False
    app.dependency_overrides[get_current_user] = lambda: persisted_user
    try:
        with patch("chainlit.server.get_data_layer", return_value=dl):
            response = test_client.delete("/project/prompts/missing")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 404


# ---- sharing ----


def test_share_prompt_ok(
    test_client, monkeypatch, persisted_user, mock_data_layer, sample_prompt
):
    _enable_gallery(monkeypatch)
    shared = {**sample_prompt, "isShared": True}
    mock_data_layer.update_prompt.return_value = shared
    app.dependency_overrides[get_current_user] = lambda: persisted_user
    try:
        with patch("chainlit.server.get_data_layer", return_value=mock_data_layer):
            response = test_client.post(
                "/project/prompts/prompt-1/share", json={"isShared": True}
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    body = response.json()
    assert body["prompt"]["isShared"] is True
    assert "/prompt/prompt-1" in body["shareUrl"]


def test_get_shared_prompt_ok(test_client, monkeypatch, mock_data_layer, sample_prompt):
    _enable_gallery(monkeypatch)
    mock_data_layer.get_prompt.return_value = {**sample_prompt, "isShared": True}
    with patch("chainlit.server.get_data_layer", return_value=mock_data_layer):
        response = test_client.get("/project/prompt/share/prompt-1")

    assert response.status_code == 200
    assert response.json()["isShared"] is True


def test_get_shared_prompt_not_shared(
    test_client, monkeypatch, mock_data_layer, sample_prompt
):
    _enable_gallery(monkeypatch)
    mock_data_layer.get_prompt.return_value = {**sample_prompt, "isShared": False}
    with patch("chainlit.server.get_data_layer", return_value=mock_data_layer):
        response = test_client.get("/project/prompt/share/prompt-1")

    assert response.status_code == 404


def test_add_shared_prompt_ok(
    test_client, monkeypatch, persisted_user, mock_data_layer, sample_prompt
):
    _enable_gallery(monkeypatch)
    mock_data_layer.get_prompt.return_value = {**sample_prompt, "isShared": True}
    new_copy = {**sample_prompt, "id": "prompt-copy", "userId": "user-1"}
    mock_data_layer.create_prompt.return_value = new_copy
    app.dependency_overrides[get_current_user] = lambda: persisted_user
    try:
        with patch("chainlit.server.get_data_layer", return_value=mock_data_layer):
            response = test_client.post("/project/prompt/share/prompt-1/add")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.json()["id"] == "prompt-copy"
