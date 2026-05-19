import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Importa todos os modelos para que o Alembic os detecte
from app.db.base import Base
import app.models.user  # noqa: F401
import app.models.client  # noqa: F401
import app.models.meeting  # noqa: F401
import app.models.procedure  # noqa: F401
import app.models.property  # noqa: F401
import app.models.quote  # noqa: F401
import app.models.financial  # noqa: F401
import app.models.communication  # noqa: F401
import app.models.integration  # noqa: F401

target_metadata = Base.metadata

# Lê a URL síncrona do env (usada pelo Alembic)
DATABASE_URL_SYNC = os.environ.get("DATABASE_URL_SYNC")
if DATABASE_URL_SYNC:
    config.set_main_option("sqlalchemy.url", DATABASE_URL_SYNC)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
