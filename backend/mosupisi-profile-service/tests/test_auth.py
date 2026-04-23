import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db.database import Base, get_db

engine = create_engine("sqlite:///./test_profile.db", connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
Base.metadata.create_all(bind=engine)
client = TestClient(app)

FARMER = {"full_name": "Thabo Mokoena", "phone_number": "57123456", "password": "secret123", "language": "st"}

def test_health():
    assert client.get("/health").json()["status"] == "ok"

def test_register():
    r = client.post("/auth/register", json=FARMER)
    assert r.status_code == 201
    assert r.json()["role"] == "farmer"

def test_duplicate_phone():
    assert client.post("/auth/register", json=FARMER).status_code == 409

def test_login():
    r = client.post("/auth/login", json={"phone_number": "57123456", "password": "secret123"})
    assert r.status_code == 200
    assert "access_token" in r.json()

def test_wrong_password():
    r = client.post("/auth/login", json={"phone_number": "57123456", "password": "wrong"})
    assert r.status_code == 401

def test_profile():
    token = client.post("/auth/login", json={"phone_number": "57123456", "password": "secret123"}).json()["access_token"]
    r = client.get("/profile/me", headers={"Authorization": f"Bearer {token}"})
    assert r.json()["full_name"] == "Thabo Mokoena"

def test_districts():
    assert "Maseru" in client.get("/locations/districts").json()["districts"]

def test_towns():
    assert "Roma" in client.get("/locations/towns?district=Maseru").json()["towns"]