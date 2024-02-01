from dataclasses import dataclass
from typing import Any, Dict

from ..client import client

# TODO: Handle returned cookies
# CookieJar?


@dataclass
class LoginResult:
    success: bool
    token: str = ""


class AuthAgent:
    async def login(self, username: str, password: str) -> LoginResult:
        data = {"username": username, "password": password}

        try:
            res: Dict[str, Any] = await client.post("/login", json=data)
            token = res.get("token")
            if not token:
                raise Exception(res["err"])
            return LoginResult(success=True, token=token)
        except Exception as e:
            print(e)
            return LoginResult(success=False)

    async def logout(self) -> bool:
        try:
            res: Dict[str, Any] = await client.post("/logout")
            if not res.get("success"):
                raise Exception(res["err"])
            return True
        except Exception as e:
            print(e)
            return False

    async def check_token(self) -> bool:
        try:
            res: Dict[str, Any] = await client.get("/checkToken")
            token = res.get("token")
            if not token:
                raise Exception(res["err"])
            return True
        except Exception as e:
            print(e)
            return False


auth_agent = AuthAgent()