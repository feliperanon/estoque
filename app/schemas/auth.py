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
    role: str | None = None


class TokenWithUser(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo
