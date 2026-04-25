from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import Base, engine
from app.models import notification  # registers all tables
from app.routers import notifications, push, internal

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    from app.scheduler.daily_jobs import run_all_daily_jobs
    import logging

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_all_daily_jobs,
        CronTrigger(
            hour=settings.DAILY_CHECK_HOUR,
            minute=settings.DAILY_CHECK_MINUTE,
            timezone="Africa/Johannesburg",
        ),
        id="daily_jobs",
        replace_existing=True,
    )
    scheduler.start()
    logging.getLogger(__name__).info(
        "Scheduler started — daily jobs at %02d:%02d CAT",
        settings.DAILY_CHECK_HOUR, settings.DAILY_CHECK_MINUTE,
    )
    yield
    scheduler.shutdown()


app = FastAPI(
    title="Mosupisi Notification Service",
    description="Weather alerts, planting reminders, pest risk, push and SMS notifications.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notifications.router)
app.include_router(push.router)
app.include_router(internal.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "service": "mosupisi-notification-service"}