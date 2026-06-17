from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET_KEY: str = "change_me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    PUBLIC_BASE_URL: str = "http://localhost:8000"
    CORS_ORIGINS: str = "*"

    COMPANY_NAME: str = "SIP Instrumentación"
    COMPANY_ADDRESS: str = "Mailen Nº 986, Zona Chacra, Rincon de los Sauces, Neuquen."
    COMPANY_PHONE: str = "2995292190"
    COMPANY_EMAIL: str = "sipinstrumentacion@gmail.com"

    @property
    def cors_origins_list(self) -> List[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [x.strip() for x in self.CORS_ORIGINS.split(",") if x.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
