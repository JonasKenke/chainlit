from __future__ import annotations

import asyncio
import uuid
from contextvars import ContextVar
from typing import TYPE_CHECKING

from lazify import LazyProxy

from chainlit.session import ClientType, HTTPSession, WebsocketSession

if TYPE_CHECKING:
    from chainlit.emitter import BaseChainlitEmitter
    from chainlit.step import Step
    from chainlit.user import PersistedUser, User

CL_RUN_NAMES = ["on_chat_start", "on_message", "on_audio_end"]


class ChainlitContextException(Exception):
    def __init__(self, msg="Chainlit context not found", *args, **kwargs):
        super().__init__(msg, *args, **kwargs)


class ChainlitContext:
    loop: asyncio.AbstractEventLoop
    emitter: BaseChainlitEmitter
    session: HTTPSession | WebsocketSession

    @property
    def current_step(self):
        if previous_steps := local_steps.get():
            return previous_steps[-1]

    @property
    def current_run(self):
        if previous_steps := local_steps.get():
            return next(
                (step for step in previous_steps if step.name in CL_RUN_NAMES), None
            )

    def __init__(
        self,
        session: HTTPSession | WebsocketSession,
        emitter: BaseChainlitEmitter | None = None,
    ):
        from chainlit.emitter import BaseChainlitEmitter, ChainlitEmitter

        self.loop = asyncio.get_running_loop()
        self.session = session

        if emitter:
            self.emitter = emitter
        elif isinstance(self.session, HTTPSession):
            self.emitter = BaseChainlitEmitter(self.session)
        elif isinstance(self.session, WebsocketSession):
            self.emitter = ChainlitEmitter(self.session)


context_var: ContextVar[ChainlitContext] = ContextVar("chainlit")
local_steps: ContextVar[list[Step] | None] = ContextVar("local_steps", default=None)


def init_ws_context(session_or_sid: WebsocketSession | str) -> ChainlitContext:
    if not isinstance(session_or_sid, WebsocketSession):
        session = WebsocketSession.require(session_or_sid)
    else:
        session = session_or_sid
    context = ChainlitContext(session)
    context_var.set(context)
    return context


def init_http_context(
    thread_id: str | None = None,
    user: User | PersistedUser | None = None,
    auth_token: str | None = None,
    user_env: dict[str, str] | None = None,
    client_type: ClientType = "webapp",
) -> ChainlitContext:
    from chainlit.data import get_data_layer

    session_id = str(uuid.uuid4())
    thread_id = thread_id or str(uuid.uuid4())
    session = HTTPSession(
        id=session_id,
        thread_id=thread_id,
        token=auth_token,
        user=user,
        client_type=client_type,
        user_env=user_env,
    )
    context = ChainlitContext(session)
    context_var.set(context)

    if data_layer := get_data_layer():
        if user_id := getattr(user, "id", None):
            asyncio.create_task(
                data_layer.update_thread(thread_id=thread_id, user_id=user_id)
            )

    return context


def get_context() -> ChainlitContext:
    try:
        return context_var.get()
    except LookupError as e:
        raise ChainlitContextException from e


context: ChainlitContext = LazyProxy(get_context, enable_cache=False)
