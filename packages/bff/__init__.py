"""Server-only same-origin BFF client package."""

from .client import BffResponse, ServerBffClient, browser_api_url

__all__ = ["BffResponse", "ServerBffClient", "browser_api_url"]
