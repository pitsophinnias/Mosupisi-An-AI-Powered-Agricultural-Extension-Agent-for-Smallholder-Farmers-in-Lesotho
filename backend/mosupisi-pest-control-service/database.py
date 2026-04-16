"""
SQLite database setup for pest reports and action logs.
"""

import os
from sqlalchemy import create_engine, Column, String, Text, ForeignKey
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

    id            = Column(String, primary_key=True, index=True)
    user_id       = Column(String, index=True, nullable=False)
    crop          = Column(String, nullable=False)
    pest_name     = Column(String, nullable=False)
    date_observed = Column(String, nullable=False)
    location      = Column(String, nullable=False)
    severity      = Column(String, nullable=False)
    action_taken  = Column(Text,   nullable=False)
    notes         = Column(Text,   default="")
    status        = Column(String, default="monitoring")
    created_at    = Column(String, nullable=False)


class PestActionLogDB(Base):
    """
    Persists every action logged against a pest report,
    together with the AI advice generated in response.
    """
    __tablename__ = "pest_action_logs"

    id          = Column(String, primary_key=True, index=True)   # uuid
    report_id   = Column(String, ForeignKey("pest_reports.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    action      = Column(Text,   nullable=False)    # what the farmer did
    advice_en   = Column(Text,   nullable=True)     # AI advice in English
    advice_st   = Column(Text,   nullable=True)     # AI advice in Sesotho
    language    = Column(String, default="en")
    logged_at   = Column(String, nullable=False)    # ISO datetime string


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