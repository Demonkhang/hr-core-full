from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class JobPositionCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    professional_level: int = Field(1, ge=1, le=5)
    required_qualification_level: Optional[str] = None
    required_specialty: Optional[str] = None
    max_headcount: int = Field(1, ge=0)


class JobPositionUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    professional_level: Optional[int] = Field(None, ge=1, le=5)
    required_qualification_level: Optional[str] = None
    required_specialty: Optional[str] = None
    max_headcount: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class JobPositionResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    professional_level: int
    required_qualification_level: Optional[str] = None
    required_specialty: Optional[str] = None
    max_headcount: int
    is_active: bool
    current_headcount: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
