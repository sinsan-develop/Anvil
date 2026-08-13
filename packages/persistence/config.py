"""Environment-only persistence configuration."""
from dataclasses import dataclass
from typing import Mapping

class ConfigurationError(ValueError): pass

@dataclass(frozen=True, slots=True)
class DatabaseSettings:
    dsn: str
    def __post_init__(self):
        if not isinstance(self.dsn, str) or not self.dsn.startswith(("postgresql://", "postgresql+psycopg://")):
            raise ConfigurationError("a PostgreSQL DSN is required")
    def __repr__(self): return "DatabaseSettings(dsn='<redacted>')"
    @classmethod
    def from_environment(cls, environment: Mapping[str, str]):
        value = environment.get("ANVIL_DATABASE_URL")
        if not value: raise ConfigurationError("ANVIL_DATABASE_URL is required")
        return cls(value)
