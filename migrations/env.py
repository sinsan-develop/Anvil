import os
from alembic import context
from sqlalchemy import engine_from_config, pool
from packages.persistence.config import normalize_postgresql_dsn
config = context.config
dsn = os.environ.get("ANVIL_DATABASE_URL")
if dsn: config.set_main_option("sqlalchemy.url", normalize_postgresql_dsn(dsn).replace("%", "%%"))
def run_migrations_offline():
    context.configure(url=config.get_main_option("sqlalchemy.url"), literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction(): context.run_migrations()
def run_migrations_online():
    engine = engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction(): context.run_migrations()
run_migrations_offline() if context.is_offline_mode() else run_migrations_online()
