from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class QualificationCreate(BaseModel):
    name: str
    issuing_body: Optional[str] = None
    issue_date: date
    expiry_date: Optional[date] = None
    credential_type: str
    classification: Optional[str] = None
    major: Optional[str] = None
    certificate_number: Optional[str] = None
    training_form: Optional[str] = None
    notes: Optional[str] = None


class QualificationUpdate(BaseModel):
    name: Optional[str] = None
    issuing_body: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    credential_type: Optional[str] = None
    classification: Optional[str] = None
    major: Optional[str] = None
    certificate_number: Optional[str] = None
    training_form: Optional[str] = None
    notes: Optional[str] = None


class QualificationResponse(BaseModel):
    id: str
    employee_id: str
    name: str
    issuing_body: Optional[str] = None
    issue_date: date
    expiry_date: Optional[date] = None
    credential_type: str
    classification: Optional[str] = None
    major: Optional[str] = None
    certificate_number: Optional[str] = None
    training_form: Optional[str] = None
    notes: Optional[str] = None
    employee_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
