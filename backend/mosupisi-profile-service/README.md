# mosupisi-profile-service

FastAPI microservice — Farmer & Agent auth, profiles, farms, crops and pest sightings.

- **Port:** `8003`
- **Database:** SQLite (dev) → PostgreSQL (prod, change `DATABASE_URL`)
- **Auth:** JWT access tokens (30 min) + refresh tokens (7 days / 30 days with Remember Me)
- **SMS:** Africa's Talking with automatic stub fallback

---

## Quick start

```bash
cd mosupisi-profile-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # fill in your AT credentials
python run.py
```

Swagger UI: http://localhost:8003/docs

---

## API overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register a new farmer |
| POST | `/auth/login` | — | Login → access + refresh tokens |
| POST | `/auth/refresh` | — | Swap refresh token for new access token |
| POST | `/auth/forgot-password` | — | Send OTP to phone |
| POST | `/auth/reset-password` | — | Verify OTP and set new password |
| GET | `/profile/me` | ✅ | Get own profile |
| PATCH | `/profile/me` | ✅ | Update name / district / language |
| POST | `/farms/onboarding` | 🌾 Farmer | First-login: register all farms |
| GET | `/farms/` | ✅ | List my farms |
| POST | `/farms/` | 🌾 Farmer | Add a new farm |
| GET | `/farms/{id}` | ✅ | Get farm detail |
| PATCH | `/farms/{id}` | 🌾 Farmer | Update farm |
| DELETE | `/farms/{id}` | 🌾 Farmer | Soft-delete farm |
| POST | `/farms/{id}/crops/{crop_id}` | 🌾 Farmer | Add crop to farm |
| DELETE | `/farms/{id}/crops/{crop_id}` | 🌾 Farmer | Remove crop from farm |
| POST | `/farms/{id}/pests` | 🌾 Farmer | Report pest sighting |
| GET | `/farms/{id}/pests` | ✅ | List pest sightings |
| PATCH | `/farms/{id}/pests/{pid}/resolve` | 🌾 Farmer | Mark pest resolved |
| GET | `/locations/districts` | — | All 10 Lesotho districts |
| GET | `/locations/towns?district=X` | — | Towns in a district |
| GET | `/health` | — | Health check |

---

## SMS / OTP fallback

When Africa's Talking is unreachable or `AT_SANDBOX=true` with no credits,
the service automatically falls back to **stub mode** if `SMS_STUB_FALLBACK=true`.

In stub mode the `/auth/forgot-password` response includes:
```json
{
  "message": "If that number is registered, you will receive an OTP shortly.",
  "stub_otp": "483921",
  "stub_sms_body": "Your Mosupisi verification code is: 483921\nIt expires in 10 minutes..."
}
```
The frontend should detect `stub_otp` and display it in a dev-mode banner.

---

## Connecting the frontend

Add to your `.env` in the React app:
```
REACT_APP_PROFILE_SERVICE_URL=http://localhost:8003
```

Then in `src/config/api.config.js`:
```js
export const PROFILE_SERVICE_URL = process.env.REACT_APP_PROFILE_SERVICE_URL || 'http://localhost:8003';
```

---

## First-login onboarding flow

1. Farmer registers → `onboarding_complete: false` returned in token response
2. Frontend detects `onboarding_complete === false` → shows Farm Setup screen
3. Farmer picks districts/towns and crop types for each farm
4. Frontend calls `POST /farms/onboarding` with the farm list
5. Service sets `onboarding_complete = true` → farmer goes to Dashboard

---

## Scaling to PostgreSQL

Change `.env`:
```
DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/mosupisi_profile
```
Add `psycopg2-binary` to requirements. No other code changes needed.

---

## Running tests

```bash
pytest tests/ -v
```