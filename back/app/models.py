from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field
from datetime import date, datetime
from uuid import UUID


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role_code: str
    client_id: Optional[UUID] = None
    password: str = Field(min_length=4)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role_code: Optional[str] = None
    client_id: Optional[UUID] = None
    status: Optional[str] = None
    password: Optional[str] = None


class ClientCreate(BaseModel):
    name: str
    legal_name: Optional[str] = None
    cuit: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    country: str = "Argentina"
    notes: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    cuit: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


class EquipmentCreate(BaseModel):
    client_id: UUID
    name: str
    element: Optional[str] = None
    type_model: Optional[str] = None
    brand: Optional[str] = None
    serial_number: Optional[str] = None
    range_value: Optional[str] = None
    unit: Optional[str] = None
    size_value: Optional[str] = None
    internal_code: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    element: Optional[str] = None
    type_model: Optional[str] = None
    brand: Optional[str] = None
    serial_number: Optional[str] = None
    range_value: Optional[str] = None
    unit: Optional[str] = None
    size_value: Optional[str] = None
    internal_code: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


class PatternCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: str
    certificate_number: Optional[str] = None
    range_value: Optional[str] = None
    unit: Optional[str] = None
    calibration_date: Optional[date] = None
    recalibration_date: Optional[date] = None
    certificate_url: Optional[str] = None


class PatternUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    certificate_number: Optional[str] = None
    range_value: Optional[str] = None
    unit: Optional[str] = None
    calibration_date: Optional[date] = None
    recalibration_date: Optional[date] = None
    certificate_url: Optional[str] = None
    active: Optional[bool] = None


class TestRowIn(BaseModel):
    row_order: int
    pressure_label: str
    range_value: Optional[float] = None
    unit: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    result: Optional[str] = None
    observations: Optional[str] = None


class PatternUsageIn(BaseModel):
    pattern_id: UUID




class MetrologyResultIn(BaseModel):
    row_order: int
    point_label: Optional[str] = None
    direction: Optional[str] = "unico"
    pattern_pressure: Optional[float] = None
    instrument_reading: Optional[float] = None
    error_value: Optional[float] = None
    max_allowed_error: Optional[float] = None
    uncertainty: Optional[float] = None
    unit: Optional[str] = None
    result: Optional[str] = None
    observations: Optional[str] = None


class SensorLoopResultIn(BaseModel):
    row_order: int
    pressure_applied: Optional[float] = None
    pattern_reading: Optional[float] = None
    expected_signal: Optional[float] = None
    measured_signal: Optional[float] = None
    signal_unit: Optional[str] = "mA"
    display_reading: Optional[float] = None
    error_value: Optional[float] = None
    max_allowed_error: Optional[float] = None
    result: Optional[str] = None
    observations: Optional[str] = None


class ReliefValveResultIn(BaseModel):
    set_pressure_required: Optional[float] = None
    opening_pressure: Optional[float] = None
    tolerance_percent: Optional[float] = 5
    reclosing_pressure: Optional[float] = None
    leak_test_pressure: Optional[float] = None
    leak_test_result: Optional[str] = None
    seal_number: Optional[str] = None
    test_medium: Optional[str] = None
    ambient_temperature: Optional[str] = None
    result: Optional[str] = None
    observations: Optional[str] = None


class HydrostaticResultIn(BaseModel):
    work_pressure: Optional[float] = None
    test_pressure: Optional[float] = None
    hold_minutes: Optional[float] = None
    pressure_drop: Optional[float] = None
    test_medium: Optional[str] = None
    thickness_control: Optional[bool] = False
    thickness_method: Optional[str] = None
    thickness_values: Optional[str] = None
    result: Optional[str] = None
    observations: Optional[str] = None


class CertificateCreate(BaseModel):
    certificate_number: str
    certificate_code: str = "CE-SIP-01"
    certificate_revision: Optional[str] = None
    certificate_validity: Optional[str] = None
    document_type: Optional[str] = "Certificado de Calibración"
    template_type: Optional[str] = "general_pressure"
    md_required: Optional[bool] = False
    requires_hydraulic_chart: Optional[bool] = False
    previous_certificate_id: Optional[UUID] = None
    reissue_reason: Optional[str] = None
    responsible_name: Optional[str] = None
    responsible_license: Optional[str] = None
    asset_unit_code: Optional[str] = None
    seal_number: Optional[str] = None
    test_medium: Optional[str] = None
    ambient_temperature: Optional[str] = None
    client_id: UUID
    equipment_id: Optional[UUID] = None
    purchase_order: Optional[str] = None
    calibration_date: Optional[date] = None
    expiration_date: Optional[date] = None
    test_frequency_months: Optional[int] = None
    element: Optional[str] = None
    type_model: Optional[str] = None
    brand: Optional[str] = None
    serial_number: Optional[str] = None
    range_value: Optional[str] = None
    unit: Optional[str] = None
    size_value: Optional[str] = None
    test_type: Optional[str] = None
    reference_method: Optional[str] = None
    environmental_conditions: Optional[str] = None
    measurement_unit: Optional[str] = None
    observations: Optional[str] = None
    conclusions: Optional[str] = None
    trial_result: Optional[str] = None
    approved_result: Optional[bool] = None
    final_comments: Optional[str] = None
    is_paid: bool = False
    payment_notes: Optional[str] = None
    test_rows: List[TestRowIn] = []
    pattern_usages: List[PatternUsageIn] = []
    metrology_results: List[MetrologyResultIn] = []
    sensor_loop_results: List[SensorLoopResultIn] = []
    relief_valve_result: Optional[ReliefValveResultIn] = None
    hydrostatic_result: Optional[HydrostaticResultIn] = None


class CertificateUpdate(BaseModel):
    certificate_number: Optional[str] = None
    certificate_code: Optional[str] = None
    certificate_revision: Optional[str] = None
    certificate_validity: Optional[str] = None
    document_type: Optional[str] = None
    template_type: Optional[str] = None
    md_required: Optional[bool] = None
    requires_hydraulic_chart: Optional[bool] = None
    previous_certificate_id: Optional[UUID] = None
    reissue_reason: Optional[str] = None
    responsible_name: Optional[str] = None
    responsible_license: Optional[str] = None
    asset_unit_code: Optional[str] = None
    seal_number: Optional[str] = None
    test_medium: Optional[str] = None
    ambient_temperature: Optional[str] = None
    client_id: Optional[UUID] = None
    equipment_id: Optional[UUID] = None
    purchase_order: Optional[str] = None
    calibration_date: Optional[date] = None
    expiration_date: Optional[date] = None
    test_frequency_months: Optional[int] = None
    element: Optional[str] = None
    type_model: Optional[str] = None
    brand: Optional[str] = None
    serial_number: Optional[str] = None
    range_value: Optional[str] = None
    unit: Optional[str] = None
    size_value: Optional[str] = None
    test_type: Optional[str] = None
    reference_method: Optional[str] = None
    environmental_conditions: Optional[str] = None
    measurement_unit: Optional[str] = None
    observations: Optional[str] = None
    conclusions: Optional[str] = None
    trial_result: Optional[str] = None
    approved_result: Optional[bool] = None
    final_comments: Optional[str] = None
    is_paid: Optional[bool] = None
    payment_notes: Optional[str] = None
    test_rows: Optional[List[TestRowIn]] = None
    pattern_usages: Optional[List[PatternUsageIn]] = None
    metrology_results: Optional[List[MetrologyResultIn]] = None
    sensor_loop_results: Optional[List[SensorLoopResultIn]] = None
    relief_valve_result: Optional[ReliefValveResultIn] = None
    hydrostatic_result: Optional[HydrostaticResultIn] = None


class RejectRequest(BaseModel):
    reason: str


class AnnulRequest(BaseModel):
    reason: str


class CommentCreate(BaseModel):
    comment: str
    is_internal: bool = True
