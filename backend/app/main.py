import os
import uuid
import random
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, List

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from apscheduler.schedulers.background import BackgroundScheduler

# Наши модули
from app import models, database
from app.core import security
from app.ai.analytics import analyze_crew_health

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Авто-создание таблиц при запуске
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Авиа-Агент МС-21: Система Мониторинга")

# Настройка CORS для связи с Фронтендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# --- СИСТЕМА БЕЗОПАСНОСТИ ---

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(database.get_db)):
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Невалидный токен")
    except JWTError:
        raise HTTPException(status_code=401, detail="Ошибка авторизации")
    
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Сотрудник не найден")
    return user

async def get_current_admin(current_user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(database.get_db)):
    # Проверка роли через SQL (самый надежный способ)
    role = db.execute(text(f"SELECT role_name FROM roles WHERE role_id = :rid"), {"rid": current_user.role_id}).fetchone()
    if not role or role[0] != 'administrator':
        raise HTTPException(status_code=403, detail="Доступ только для Администратора")
    return current_user

# --- ИИ-СИМУЛЯТОР ТЕЛЕМЕТРИИ В НЕБЕ ---

def simulate_flight_telemetry():
    """Фоновый процесс: каждые 2 минуты генерирует пульс для тех, кто в полете"""
    db = next(database.get_db())
    now = datetime.now(timezone.utc)
    
    try:
        # Находим рейсы, которые сейчас в воздухе
        active_flights = db.execute(text("""
            SELECT flight_id FROM flights 
            WHERE scheduled_departure <= :now AND scheduled_arrival >= :now
        """), {"now": now}).fetchall()

        for f in active_flights:
            # Получаем экипаж рейса
            crew = db.execute(text("""
                SELECT u.user_id, u.baseline_hr FROM users u 
                JOIN flight_assignments fa ON u.user_id = fa.crew_member_id 
                WHERE fa.flight_id = :f_id
            """), {"f_id": f[0]}).fetchall()

            for member in crew:
                # Имитация работы датчиков часов
                hr = member[1] + random.randint(-5, 15)
                stress = random.randint(10, 45)
                # ИИ-расчет работоспособности
                dev = abs(hr - member[1])
                perf = max(0, 100 - (dev * 1.8) - (stress * 0.3))
                
                db.execute(text("""
                    INSERT INTO flight_telemetry 
                    (flight_id, crew_member_id, heart_rate, spo2, stress_level, performance_score, record_timestamp)
                    VALUES (:f, :u, :hr, :o, :s, :p, :t)
                """), {
                    "f": f[0], "u": member[0], "hr": hr, "o": random.randint(95, 99), 
                    "s": stress, "p": perf, "t": now
                })
        db.commit()
    except Exception as e:
        logger.error(f"Ошибка симулятора: {e}")
    finally:
        db.close()

def nightly_roster_sync():
    """Ночное планирование (заглушка для расширения)"""
    logger.info("🌙 Ночной диспетчер проверил расписание.")

@app.on_event("startup")
def start_scheduler():
    scheduler = BackgroundScheduler(timezone="Europe/Moscow")
    scheduler.add_job(simulate_flight_telemetry, 'interval', minutes=2)
    scheduler.add_job(nightly_roster_sync, 'cron', hour=0, minute=10)
    scheduler.start()

# --- API ЭНДПОИНТЫ ---

@app.get("/", tags=["Общие"])
def read_root():
    return {"система": "Авиа-Агент МС-21", "статус": "Работает"}

@app.post("/auth/login", tags=["Авторизация"])
def login(form_data: dict, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.get('username')).first()
    if not user or not security.verify_password(str(form_data.get('password')), user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный логин или пароль")
    
    token = security.create_access_token(data={"sub": str(user.user_id)})
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "fio": f"{user.last_name} {user.first_name}"
    }

@app.get("/admin/staff", tags=["Администратор"])
def get_all_staff(db: Session = Depends(database.get_db)):
    result = db.execute(text("""
        SELECT u.first_name, u.last_name, u.baseline_hr, fcm.position 
        FROM users u 
        JOIN flight_crew_members fcm ON u.user_id = fcm.user_id 
    """)).fetchall()
    # ПРЕВРАЩАЕМ В СПИСОК СЛОВАРЕЙ (Это уберет ошибку ValueError)
    return [{"first_name": r[0], "last_name": r[1], "baseline_hr": r[2], "position": r[3]} for r in result]

@app.get("/crew/dashboard", tags=["Экипаж"])
async def get_dashboard(user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(database.get_db)):
    """Личный кабинет сотрудника"""
    # 1. Последние 20 записей телеметрии (для графиков)
    tele_res = db.execute(text("""
        SELECT heart_rate, performance_score, record_timestamp 
        FROM flight_telemetry 
        WHERE crew_member_id = :u 
        ORDER BY record_timestamp DESC LIMIT 20
    """), {"u": user.user_id}).fetchall()
    
    # 2. Текущий рейс
    flight_res = db.execute(text("""
        SELECT f.flight_number, f.departure_airport, f.arrival_airport
        FROM flights f
        JOIN flight_assignments fa ON f.flight_id = fa.flight_id
        WHERE fa.crew_member_id = :u AND f.scheduled_departure <= NOW() AND f.scheduled_arrival >= NOW()
        LIMIT 1
    """), {"u": user.user_id}).fetchone()

    return {
        "fio": f"{user.last_name} {user.first_name}",
        "текущий_рейс": {"flight_number": flight_res[0], "departure_airport": flight_res[1], "arrival_airport": flight_res[2]} if flight_res else None,
        "telemetry_history": [
            {"heart_rate": r[0], "performance_score": float(r[1]), "record_timestamp": r[2].isoformat()} 
            for r in tele_res
        ]
    }

@app.post("/crew/upload-health", tags=["Экипаж"])
async def upload_health(
    user: Annotated[models.User, Depends(get_current_user)],
    db: Session = Depends(database.get_db),
    file: UploadFile = File(...)
):
    """Анализ данных Samsung Watch (исправленный порядок аргументов)"""
    content = await file.read()
    result = analyze_crew_health(content, user.baseline_hr)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # Запись в лог аналитики
    new_log = models.PerformanceLog(
        log_id=uuid.uuid4(),
        crew_member_id=user.user_id,
        calculation_timestamp=datetime.now(),
        performance_score=float(result["readiness_score"]) * 100,
        performance_level=result["status"],
        contributing_factors=result
    )
    db.add(new_log)
    db.commit()
    return result

@app.get("/dispatcher/monitor", tags=["Диспетчер"])
def monitor_flights(user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(database.get_db)):
    """Общий мониторинг всех рейсов в небе"""
    now = datetime.now(timezone.utc)
    active = db.execute(text("""
        SELECT f.flight_number, f.departure_airport, f.arrival_airport, 
               AVG(ft.performance_score) as avg_readiness
        FROM flights f
        LEFT JOIN flight_telemetry ft ON f.flight_id = ft.flight_id
        WHERE f.scheduled_departure <= :now AND f.scheduled_arrival >= :now
        GROUP BY f.flight_id, f.flight_number, f.departure_airport, f.arrival_airport
    """), {"now": now}).fetchall()
    
    return [
        {"flight_number": r[0], "dep": r[1], "arr": r[2], "avg_readiness": float(r[3]) if r[3] else 0} 
        for r in active
    ]