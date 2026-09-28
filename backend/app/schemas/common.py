from typing import Annotated

from fastapi import Query
from pydantic import BaseModel


class Page[T](BaseModel):
    """Standard list response (.agent/rules/backend-architecture.md)."""

    items: list[T]
    total: int
    page: int
    page_size: int


class PageParams(BaseModel):
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PageParams:
    return PageParams(page=page, page_size=page_size)
