"""
SQLite database setup for pest reports.
Mirrors the pattern used in the planting guide service.
"""

import os
from sqlalchemy import create_engine, Column, String, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pest_control.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class PestReportDB(Base):
    __tablename__ = "pest_reports"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    crop = Column(String, nullable=False)
    pest_name = Column(String, nullable=False)
    date_observed = Column(String, nullable=False)
    location = Column(String, nullable=False)
    severity = Column(String, nullable=False)  # low | medium | high
    action_taken = Column(Text, nullable=False)
    notes = Column(Text, default="")
    status = Column(String, default="monitoring")  # monitoring | resolved
    created_at = Column(String, nullable=False)


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Create tables on import
create_tables()