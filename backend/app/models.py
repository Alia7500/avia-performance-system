from sqlalchemy import Column, String, Float, DateTime, JSON, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid
# ИСПРАВЛЕНО: импортируем класс datetime напрямую
from datetime import datetime 
from app.database import Base

# --- 1. РОЛИ ---
class Role(Base):
    __tablename__ = "roles"
    role_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_name = Column(String, unique=True, nullable=False)

# --- 2. ПОЛЬЗОВАТЕЛИ (ШТАТ) ---
class User(Base):
    __tablename__ = "users"
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    patronymic = Column(String, nullable=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.role_id"), nullable=True)
    
    # Персональный медицинский базис (норма) для ИИ-агента
    baseline_hr = Column(Integer, default=70)      # Норма пульса
    baseline_sys_bp = Column(Integer, default=120) # Норма давления (сист.)
    baseline_dia_bp = Column(Integer, default=80)  # Норма давления (диаст.)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

# --- 3. ЛЕТНЫЙ СОСТАВ (ДОП. ИНФО) ---
class FlightCrewMember(Base):
    __tablename__ = "flight_crew_members"
    crew_member_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), unique=True)
    position = Column(String) # КВС, Второй пилот, Бортпроводник

# --- 4. АВИАПАРК (МС-21-300) ---
class Aircraft(Base):
    __tablename__ = "aircrafts"
    tail_number = Column(String, primary_key=True) # Например, RA-73001
    model = Column(String, default="МС-21-300")
    status = Column(String, default="Готов к вылету")

# --- 5. РЕЙСЫ (РАСПИСАНИЕ АЭРОФЛОТА) ---
class Flight(Base):
    __tablename__ = "flights"
    flight_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    flight_number = Column(String, nullable=False)
    departure_airport = Column(String, nullable=False)
    arrival_airport = Column(String, nullable=False)
    scheduled_departure = Column(DateTime(timezone=True), nullable=False)
    scheduled_arrival = Column(DateTime(timezone=True), nullable=False)
    tail_number = Column(String, ForeignKey("aircrafts.tail_number"))
    status = Column(String, default="Запланирован")

# --- 6. НАЗНАЧЕНИЯ ЭКИПАЖА (РОСТЕР) ---
class FlightAssignment(Base):
    __tablename__ = "flight_assignments"
    assignment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    flight_id = Column(UUID(as_uuid=True), ForeignKey("flights.flight_id"))
    crew_member_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    role_on_board = Column(String) # Роль конкретно на этом рейсе

# --- 7. ТЕЛЕМЕТРИЯ (ДАННЫЕ В ПОЛЕТЕ) ---
class FlightTelemetry(Base):
    __tablename__ = "flight_telemetry"
    telemetry_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    flight_id = Column(UUID(as_uuid=True), ForeignKey("flights.flight_id"))
    crew_member_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    heart_rate = Column(Integer)
    spo2 = Column(Integer)
    stress_level = Column(Integer)
    performance_score = Column(Float) # Результат работы ИИ в небе
    record_timestamp = Column(DateTime(timezone=True), default=datetime.utcnow)

# --- 8. ИСТОРИЯ АНАЛИЗА (ЗАГРУЗКИ С ЧАСОВ) ---
class PerformanceLog(Base):
    __tablename__ = "performance_analytics_log"
    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crew_member_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    calculation_timestamp = Column(DateTime(timezone=True), default=datetime.utcnow)
    performance_score = Column(Float)
    performance_level = Column(String)
    contributing_factors = Column(JSON)

# --- 9. ПРЕДПОЛЕТНЫЙ МЕДОСМОТР ---
class MedicalCheck(Base):
    __tablename__ = "preflight_medical_checks"
    check_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("flight_assignments.assignment_id"))
    medic_user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    pulse_at_check = Column(Integer)
    is_admitted = Column(Boolean, default=True)
    check_time = Column(DateTime(timezone=True), default=datetime.utcnow)