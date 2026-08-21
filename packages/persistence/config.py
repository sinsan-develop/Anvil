"""Environment-only persistence configuration."""
from dataclasses import dataclass
from typing import Mapping

class ConfigurationError(ValueError): pass


def normalize_postgresql_dsn(value: str) -> str:
    """Use the psycopg 3 SQLAlchemy dialect for unqualified PostgreSQL URLs."""
    if value.startswith("postgresql://"):
        return "postgresql+psycopg://" + value[len("postgresql://"):]
    return value

@dataclass(frozen=True, slots=True)
class DatabaseSettings:
    dsn: str
    def __post_init__(self):
        if not isinstance(self.dsn, str) or not self.dsn.startswith(("postgresql://", "postgresql+psycopg://")):
            raise ConfigurationError("a PostgreSQL DSN is required")
        object.__setattr__(self, "dsn", normalize_postgresql_dsn(self.dsn))
    def __repr__(self): return "DatabaseSettings(dsn='<redacted>')"
    @classmethod
    def from_environment(cls, environment: Mapping[str, str]):
        value = environment.get("ANVIL_DATABASE_URL")
        if not value: raise ConfigurationError("ANVIL_DATABASE_URL is required")
        return cls(value)
