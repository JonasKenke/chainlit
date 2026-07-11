"""
Prompt Gallery Cypress E2E test app.
Uses a file-based SQLite DB so the data layer and setup share the same DB.
"""
import asyncio
import os

import chainlit as cl
from chainlit.data.sql_alchemy import SQLAlchemyDataLayer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Use in-memory SQLite so each test run starts fresh.
_DB_URI = "sqlite+aiosqlite://"
_DB_PATH = None

_SETUP_SQL = """
CREATE TABLE IF NOT EXISTS users (
    "id" TEXT PRIMARY KEY,
    "identifier" TEXT UNIQUE NOT NULL,
    "createdAt" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS threads (
    "id" TEXT PRIMARY KEY,
    "createdAt" TEXT,
    "name" TEXT,
    "userId" TEXT REFERENCES users("id"),
    "userIdentifier" TEXT,
    "tags" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS steps (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "threadId" TEXT NOT NULL REFERENCES threads("id"),
    "parentId" TEXT,
    "streaming" INTEGER NOT NULL DEFAULT 0,
    "waitForAnswer" INTEGER,
    "isError" INTEGER,
    "metadata" TEXT,
    "tags" TEXT,
    "input" TEXT,
    "output" TEXT,
    "createdAt" TEXT,
    "start" TEXT,
    "end" TEXT,
    "generation" TEXT,
    "defaultOpen" INTEGER,
    "autoCollapse" INTEGER,
    "showInput" TEXT
);
CREATE TABLE IF NOT EXISTS feedbacks (
    "id" TEXT PRIMARY KEY,
    "forId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "comment" TEXT
);
CREATE TABLE IF NOT EXISTS elements (
    "id" TEXT PRIMARY KEY,
    "threadId" TEXT,
    "type" TEXT,
    "url" TEXT,
    "chainlitKey" TEXT,
    "name" TEXT NOT NULL,
    "display" TEXT,
    "objectKey" TEXT,
    "size" TEXT,
    "page" INTEGER,
    "language" TEXT,
    "forId" TEXT,
    "mime" TEXT,
    "props" TEXT
);
CREATE TABLE IF NOT EXISTS prompts (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isShared" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);
"""


async def _ensure_tables() -> None:
    engine = create_async_engine(_DB_URI)
    async with engine.begin() as conn:
        for stmt in _SETUP_SQL.split(";"):
            stmt = stmt.strip()
            if stmt:
                await conn.execute(text(stmt))
    await engine.dispose()


asyncio.run(_ensure_tables())


@cl.data_layer
def get_data_layer():
    return SQLAlchemyDataLayer(conninfo=_DB_URI)


@cl.on_message
async def main(message: cl.Message):
    await cl.Message(content=f"Echo: {message.content}").send()
