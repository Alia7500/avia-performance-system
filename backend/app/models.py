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
    role = Column(String, default="crew_member")

class Flight(Base):
    __tablename__ = "flights"
    flight_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    flight_number = Column(String, unique=True)
    departure = Column(String)
    arrival = Column(String)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String, default="scheduled") # scheduled, active, completed

class FlightAssignment(Base):
    __tablename__ = "flight_assignments"
    id = Column(Integer, primary_key=True)
    flight_id = Column(UUID(as_uuid=True), ForeignKey("flights.flight_id"))
    crew_member_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))

class PerformanceLog(Base):
    __tablename__ = "performance_analytics_log"
    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crew_member_id = Column(UUID(as_uuid=True))
    calculation_timestamp = Column(DateTime)
    performance_score = Column(Float)
    performance_level = Column(String)
    contributing_factors = Column(JSON)