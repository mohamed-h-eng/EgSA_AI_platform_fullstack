"""Automatic conversation titles, safe for Arabic and other scripts (decision D3)."""

import unicodedata

MAX_TITLE = 60
DEFAULT_TITLE = "New conversation"


def make_title(text: str, limit: int = MAX_TITLE) -> str:
    """First line of the message, whitespace collapsed, cut on a word boundary at `limit`
    CHARACTERS (never bytes), never leaving a dangling combining mark (e.g. Arabic harakat)."""
    collapsed = " ".join(text.split())
    if not collapsed:
        return DEFAULT_TITLE
    if len(collapsed) <= limit:
        return collapsed

    cut = collapsed[:limit]
    space = cut.rfind(" ")
    if space >= limit * 0.6:  # prefer a word boundary if it doesn't lose too much
        cut = cut[:space]
    # Don't end on a combining mark or a stray separator.
    while cut and (unicodedata.combining(cut[-1]) or cut[-1] in " ,.;:-–—،؛"):
        cut = cut[:-1]
    return f"{cut}…"
