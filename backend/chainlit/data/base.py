from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Optional

from chainlit.types import (
    Feedback,
    PaginatedResponse,
    Pagination,
    ThreadDict,
    ThreadFilter,
)

from .utils import queue_until_user_message

if TYPE_CHECKING:
    from chainlit.element import Element, ElementDict
    from chainlit.step import StepDict
    from chainlit.user import PersistedUser, User


class BaseDataLayer(ABC):
    """Base class for data persistence."""

    @abstractmethod
    async def get_user(self, identifier: str) -> Optional["PersistedUser"]:
        pass

    @abstractmethod
    async def create_user(self, user: "User") -> Optional["PersistedUser"]:
        pass

    @abstractmethod
    async def delete_feedback(
        self,
        feedback_id: str,
    ) -> bool:
        pass

    @abstractmethod
    async def upsert_feedback(
        self,
        feedback: Feedback,
    ) -> str:
        pass

    @queue_until_user_message()
    @abstractmethod
    async def create_element(self, element: "Element"):
        pass

    @abstractmethod
    async def get_element(
        self, thread_id: str, element_id: str
    ) -> Optional["ElementDict"]:
        pass

    @queue_until_user_message()
    @abstractmethod
    async def delete_element(self, element_id: str, thread_id: str | None = None):
        pass

    @queue_until_user_message()
    @abstractmethod
    async def create_step(self, step_dict: "StepDict"):
        pass

    @queue_until_user_message()
    @abstractmethod
    async def update_step(self, step_dict: "StepDict"):
        pass

    @queue_until_user_message()
    @abstractmethod
    async def delete_step(self, step_id: str):
        pass

    @abstractmethod
    async def get_thread_author(self, thread_id: str) -> str:
        return ""

    @abstractmethod
    async def delete_thread(self, thread_id: str):
        pass

    @abstractmethod
    async def list_threads(
        self, pagination: "Pagination", filters: "ThreadFilter"
    ) -> "PaginatedResponse[ThreadDict]":
        pass

    @abstractmethod
    async def get_thread(self, thread_id: str) -> Optional["ThreadDict"]:
        pass

    @abstractmethod
    async def update_thread(
        self,
        thread_id: str,
        name: str | None = None,
        user_id: str | None = None,
        metadata: dict | None = None,
        tags: list[str] | None = None,
    ):
        pass

    @abstractmethod
    async def build_debug_url(self) -> str:
        pass

    @abstractmethod
    async def close(self) -> None:
        pass

    @abstractmethod
    async def get_favorite_steps(self, user_id: str) -> list["StepDict"]:
        pass

    async def set_step_favorite(
        self, step_dict: "StepDict", favorite: bool
    ) -> "StepDict":
        metadata = step_dict.get("metadata") or {}
        metadata["favorite"] = favorite
        step_dict["metadata"] = metadata
        await self.update_step(step_dict)
        return step_dict
