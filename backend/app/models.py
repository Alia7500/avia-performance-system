from sqlalchemy import Column, String, Float, DateTime, JSON, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base

class User(Base):
    __tablename__ = "users"
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.role_id"))
    # Базовые медицинские показатели для ИИ
    baseline_hr = Column(Integer, default=70)      # Твой нормальный пульс
    baseline_sys_bp = Column(Integer, default=120) # Твое нормальное давление

class Flight(Base):
    __tablename__ = "flights"
    flight_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    flight_number = Column(String)
    departure_airport = Column(String)
    arrival_airport = Column(String)
    scheduled_departure = Column(DateTime(timezone=True))
    scheduled_arrival = Column(DateTime(timezone=True))
    tail_number = Column(String, ForeignKey("aircrafts.tail_number"))
    status = Column(String)

class FlightAssignment(Base):
    __tablename__ = "flight_assignments"
    assignment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    flight_id = Column(UUID(as_uuid=True), ForeignKey("flights.flight_id"))
    crew_member_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    role_on_board = Column(String) # 'КВС', 'Бортпроводник' и т.д.

class PerformanceLog(Base):
    __tablename__ = "performance_analytics_log"
    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crew_member_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    performance_score = Column(Float)
    performance_level = Column(String) # 'Допущен', 'Отстранен'
    contributing_factors = Column(JSON)