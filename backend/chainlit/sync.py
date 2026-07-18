import asyncio
import threading
from collections.abc import Coroutine
from typing import Any, ParamSpec, TypeVar

from asyncer import asyncify

from chainlit.context import context_var

make_async = asyncify

T_Retval = TypeVar("T_Retval")
T_ParamSpec = ParamSpec("T_ParamSpec")
T = TypeVar("T")


def run_sync(co: Coroutine[Any, Any, T_Retval]) -> T_Retval:
    """Run the coroutine synchronously.

    Requires nest_asyncio to be applied when called from within a running
    event loop (which Chainlit does at CLI startup).
    """

    # Copy the current context
    current_context = context_var.get()

    # Define a wrapper coroutine that sets the context before running the original coroutine
    async def context_preserving_coroutine():
        # Set the copied context to the coroutine
        context_var.set(current_context)
        return await co

    # Execute from the main thread in the main event loop
    if threading.current_thread() == threading.main_thread():
        return asyncio.get_running_loop().run_until_complete(
            context_preserving_coroutine()
        )
    else:  # Execute from a thread in the main event loop
        result = asyncio.run_coroutine_threadsafe(
            context_preserving_coroutine(), loop=current_context.loop
        )
        return result.result()
