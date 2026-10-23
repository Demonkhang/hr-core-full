from sqlalchemy import Column, Integer, String, Text, ForeignKey, Date, Numeric
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class ContractType:
    PROBATION = "probation"                    # Thử việc
    DEFINITE_TERM = "definite_term"            # Xác định thời hạn (1 - 3 năm)
    INDEFINITE_TERM = "indefinite_term"        # Không xác định thời hạn
    INTERNSHIP = "internship"                  # Thực tập / Học nghề
    COLLABORATOR = "collaborator"              # Cộng tác viên / Khoán việc

    ALL = [PROBATION, DEFINITE_TERM, INDEFINITE_TERM, INTERNSHIP, COLLABORATOR]


class ContractStatus:
    ACTIVE = "active"                          # Đang hiệu lực
    PENDING_RENEWAL = "pending_renewal"        # Chờ gia hạn / tái ký
    RENEWED = "renewed"                        # Đã tái ký
    EXPIRED = "expired"                        # Đã hết hạn
    TERMINATED = "terminated"                  # Đã chấm dứt / thanh lý

    ALL = [ACTIVE, PENDING_RENEWAL, RENEWED, EXPIRED, TERMINATED]


class ContractAppendixChangeType:
    SALARY = "salary"                          # Điều chỉnh lương / phụ cấp
    POSITION = "position"                      # Thay đổi vị trí / chức danh
    WORKPLACE = "workplace"                    # Thay đổi địa điểm làm việc
    TERM_EXTENSION = "term_extension"          # Gia hạn thời hạn hợp đồng
    OTHER = "other"                            # Nội dung khác

    ALL = [SALARY, POSITION, WORKPLACE, TERM_EXTENSION, OTHER]


class Contract(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "contracts"

    employee_id = Column(ForeignKey("employees.id"), nullable=False, index=True)
    contract_number = Column(String(50), unique=True, nullable=False, index=True)
    contract_type = Column(String(30), nullable=False, default=ContractType.DEFINITE_TERM, index=True)
    contract_sequence = Column(Integer, default=1)  # Lần ký 1, Lần ký 2
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=True, index=True)  # NULL đối với HĐ không xác định thời hạn
    signing_date = Column(Date, nullable=False)
    signatory_name = Column(String(100), nullable=True)
    signatory_title = Column(String(100), nullable=True)
    job_title = Column(String(100), nullable=True)
    department_id = Column(ForeignKey("departments.id"), nullable=True, index=True)
    workplace_id = Column(ForeignKey("workplaces.id"), nullable=True, index=True)
    basic_salary = Column(Numeric(15, 2), nullable=True)
    salary_rate = Column(Integer, default=100)  # % hưởng lương (vd: 85% thử việc)
    allowance_amount = Column(Numeric(15, 2), default=0)
    working_hours_description = Column(String(255), nullable=True)
    status = Column(String(30), nullable=False, default=ContractStatus.ACTIVE, index=True)
    termination_date = Column(Date, nullable=True)
    termination_reason = Column(Text, nullable=True)
    file_attachment_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)

    employee = relationship("Employee", back_populates="contracts")
    department = relationship("Department")
    workplace = relationship("Workplace")
    appendices = relationship(
        "ContractAppendix",
        back_populates="contract",
        cascade="all, delete-orphan",
        order_by="ContractAppendix.signing_date.asc()",
    )


class ContractAppendix(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "contract_appendices"

    contract_id = Column(ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True)
    appendix_number = Column(String(50), nullable=False)
    effective_date = Column(Date, nullable=False)
    change_type = Column(String(30), nullable=False, default=ContractAppendixChangeType.OTHER)
    content = Column(Text, nullable=False)
    new_basic_salary = Column(Numeric(15, 2), nullable=True)
    new_end_date = Column(Date, nullable=True)
    file_attachment_url = Column(String(500), nullable=True)
    signing_date = Column(Date, nullable=False)

    contract = relationship("Contract", back_populates="appendices")
