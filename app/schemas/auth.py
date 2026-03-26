from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LegacyLoginInput(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    username: str
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    role: str | None = None
    allowed_pages: list[str] | None = None


class LocalRegisterInput(BaseModel):
    name: str
    email: str
    phone: str | None = None
    password: str
    allowed_pages: list[str] | None = None


class TokenWithUser(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo
