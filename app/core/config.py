from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Estoque"
    environment: str = "development"
    api_prefix: str = "/api"

    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 120

    legacy_api_base_url: str = "https://analise-operacional.onrender.com"

    import_secret: str
    legacy_database_url: str | None = None
    legacy_source_system: str = "analise-operacional"
    legacy_batch_size: int = 1000

    admin_username: str | None = None
    admin_password: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql+psycopg2://", 1)
        if self.database_url.startswith("postgresql://") and "+psycopg2" not in self.database_url:
            return self.database_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
