from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re


class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Mật khẩu phải có ít nhất 1 chữ hoa")
        if not re.search(r"[a-z]", v):
            raise ValueError("Mật khẩu phải có ít nhất 1 chữ thường")
        if not re.search(r"\d", v):
            raise ValueError("Mật khẩu phải có ít nhất 1 số")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-]", v):
            raise ValueError("Mật khẩu phải có ít nhất 1 ký tự đặc biệt")
        return v


class UserPermissions(BaseModel):
    scope: str = "self"
    can_manage_employees: bool = False
    can_manage_departments: bool = False
    can_manage_workplaces: bool = False
    can_manage_settings: bool = False
    can_manage_users: bool = False
    can_view_reports: bool = False


class UserInfo(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    is_super_admin: bool = False
    department_id: Optional[str] = None
    employee_id: Optional[str] = None
    must_change_password: bool = False
    permissions: UserPermissions = UserPermissions()

    class Config:
        from_attributes = True
