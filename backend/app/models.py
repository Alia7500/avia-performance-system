from sqlalchemy import Column, String, Float, DateTime, JSON, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .database import Base

class User(Base):
    __tablename__ = "users"
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String) # 'crew_member', 'admin', etc

class PerformanceLog(Base):
    __tablename__ = "performance_analytics_log"
    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crew_member_id = Column(UUID(as_uuid=True))
    calculation_timestamp = Column(DateTime)
    performance_score = Column(Float)
    performance_level = Column(String)
    contributing_factors = Column(JSON) # Сюда запишем детали из CSV