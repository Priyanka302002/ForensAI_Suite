import os
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import create_engine, Column, String, Float, Text, DateTime, JSON
from sqlalchemy.orm import declarative_base, sessionmaker

# Database Configuration
# Connect to PostgreSQL if DATABASE_URL is defined, otherwise fallback to SQLite for local development
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./forensic_shield.db"
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Handle SQLite vs PostgreSQL engine arguments
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True if not DATABASE_URL.startswith("sqlite") else False
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class CaseModel(Base):
    __tablename__ = "cases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_number = Column(String(64), unique=True, index=True, nullable=False)
    raw_transcript = Column(Text, nullable=False)
    
    # Nested Biometric Feature Details
    face_shape_desc = Column(String(255), nullable=True)
    face_shape_confidence = Column(Float, default=1.0)
    
    eyes_desc = Column(String(255), nullable=True)
    eyes_confidence = Column(Float, default=1.0)
    
    nose_desc = Column(String(255), nullable=True)
    nose_confidence = Column(Float, default=1.0)
    
    mouth_desc = Column(String(255), nullable=True)
    mouth_confidence = Column(Float, default=1.0)
    
    distinguishing_features = Column(JSON, default=list)
    image_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "case_number": self.case_number,
            "raw_transcript": self.raw_transcript,
            "structured_profile": {
                "face_shape": {
                    "description": self.face_shape_desc or "Not described",
                    "confidence": float(self.face_shape_confidence if self.face_shape_confidence is not None else 0.0),
                },
                "eyes": {
                    "description": self.eyes_desc or "Not described",
                    "confidence": float(self.eyes_confidence if self.eyes_confidence is not None else 0.0),
                },
                "nose": {
                    "description": self.nose_desc or "Not described",
                    "confidence": float(self.nose_confidence if self.nose_confidence is not None else 0.0),
                },
                "mouth": {
                    "description": self.mouth_desc or "Not described",
                    "confidence": float(self.mouth_confidence if self.mouth_confidence is not None else 0.0),
                },
                "distinguishing_features": self.distinguishing_features or [],
            },
            "image_url": self.image_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
