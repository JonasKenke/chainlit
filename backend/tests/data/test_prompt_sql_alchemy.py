"""Unit tests for SQLAlchemy prompt gallery persistence."""
import uuid
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import create_async_engine

from chainlit.data.sql_alchemy import SQLAlchemyDataLayer
from chainlit.data.storage_clients.base import BaseStorageClient


@pytest.fixture
async def data_layer(mock_storage_client: BaseStorageClient, tmp_path: Path):
    db_file = tmp_path / "prompts_test.sqlite"
    conninfo = f"sqlite+aiosqlite:///{db_file}"
    engine = create_async_engine(conninfo)
    dl = SQLAlchemyDataLayer(conninfo=conninfo, storage_provider=mock_storage_client)
    yield dl
    await dl.close()


@pytest.fixture
def user_id():
    return str(uuid.uuid4())


@pytest.fixture
def prompt_data(user_id):
    return {
        "id": str(uuid.uuid4()),
        "title": "My prompt",
        "content": "Summarise this: {text}",
        "userId": user_id,
        "isShared": False,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z",
    }


async def test_create_and_list_prompts(data_layer, prompt_data, user_id):
    created = await data_layer.create_prompt(prompt_data)
    assert created["id"] == prompt_data["id"]

    prompts = await data_layer.list_prompts(user_id)
    assert len(prompts) == 1
    assert prompts[0]["title"] == "My prompt"


async def test_get_prompt(data_layer, prompt_data):
    await data_layer.create_prompt(prompt_data)
    fetched = await data_layer.get_prompt(prompt_data["id"])
    assert fetched is not None
    assert fetched["content"] == "Summarise this: {text}"


async def test_get_prompt_missing(data_layer):
    result = await data_layer.get_prompt("does-not-exist")
    assert result is None


async def test_update_prompt(data_layer, prompt_data, user_id):
    await data_layer.create_prompt(prompt_data)
    updated_data = {**prompt_data, "title": "Better title", "updatedAt": "2024-06-01T00:00:00Z"}
    updated = await data_layer.update_prompt(updated_data)
    assert updated["title"] == "Better title"

    # verify persistence
    fetched = await data_layer.get_prompt(prompt_data["id"])
    assert fetched is not None
    assert fetched["title"] == "Better title"


async def test_delete_prompt(data_layer, prompt_data, user_id):
    await data_layer.create_prompt(prompt_data)
    deleted = await data_layer.delete_prompt(prompt_data["id"], user_id)
    assert deleted is True

    fetched = await data_layer.get_prompt(prompt_data["id"])
    assert fetched is None


async def test_delete_wrong_user(data_layer, prompt_data):
    await data_layer.create_prompt(prompt_data)
    deleted = await data_layer.delete_prompt(prompt_data["id"], "wrong-user")
    assert deleted is False  # row count 0

    # still there
    assert await data_layer.get_prompt(prompt_data["id"]) is not None


async def test_share_prompt(data_layer, prompt_data, user_id):
    await data_layer.create_prompt(prompt_data)
    shared = {**prompt_data, "isShared": True, "updatedAt": "2024-06-01T00:00:00Z"}
    result = await data_layer.update_prompt(shared)
    assert result["isShared"] is True

    fetched = await data_layer.get_prompt(prompt_data["id"])
    assert fetched is not None
    assert fetched["isShared"] is True


async def test_list_prompts_isolation(data_layer, user_id):
    """Prompts from another user are not visible."""
    other_id = str(uuid.uuid4())
    p1 = {
        "id": str(uuid.uuid4()),
        "title": "User A",
        "content": "A",
        "userId": user_id,
        "isShared": False,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z",
    }
    p2 = {
        "id": str(uuid.uuid4()),
        "title": "User B",
        "content": "B",
        "userId": other_id,
        "isShared": False,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z",
    }
    await data_layer.create_prompt(p1)
    await data_layer.create_prompt(p2)

    result = await data_layer.list_prompts(user_id)
    assert len(result) == 1
    assert result[0]["title"] == "User A"
