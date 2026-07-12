"""
Prompt Gallery demo app.

Run with:
    cd backend/chainlit/sample
    uv run chainlit run prompt_gallery_demo.py -h

Then open http://localhost:8000

Uses a file-based SQLite DB (demo.db) so prompts survive restarts.
The tables are created on first run.
"""

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

import chainlit as cl
from chainlit.data.sql_alchemy import SQLAlchemyDataLayer

_DB_URI = "sqlite+aiosqlite:///demo.db"

# Minimal DDL — only the tables the demo actually uses.
# ponytail: inline DDL beats a full Alembic migration for a demo.
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
"""


async def _ensure_tables() -> None:
    engine = create_async_engine(_DB_URI)
    async with engine.begin() as conn:
        for stmt in _SETUP_SQL.split(";"):
            stmt = stmt.strip()
            if stmt:
                await conn.execute(text(stmt))
    await engine.dispose()


# Create tables synchronously before the Chainlit event loop starts.
asyncio.run(_ensure_tables())


@cl.data_layer
def get_data_layer():
    return SQLAlchemyDataLayer(conninfo=_DB_URI)


@cl.on_message
async def main(message: cl.Message):
    await cl.Message(
        content=f"**Echo:** {message.content}\n\n"
        "_Bookmark this message with the 🔖 icon, "
        "or open the gallery with the bookmark icon in the toolbar._"
    ).send()
