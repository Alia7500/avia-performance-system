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

# Наши внутренние модули
from app import models, database
from app.core import security
from app.ai.analytics import analyze_crew_health

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Принудительное создание/обновление таблиц в Neon
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Авиа-Агент МС-21: Система Мониторинга")

# Настройка CORS для связи с фронтендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# --- ЗАВИСИМОСТИ (БЕЗОПАСНОСТЬ) ---

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(database.get_db)):
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Ошибка авторизации")
    except JWTError:
        raise HTTPException(status_code=401, detail="Токен недействителен")
    
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user

async def get_current_admin(current_user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(database.get_db)):
    # Проверка роли через SQL запрос для точности
    role_res = db.execute(text("SELECT role_name FROM roles WHERE role_id = :rid"), {"rid": current_user.role_id}).fetchone()
    if not role_res or role_res[0] != 'administrator':
        raise HTTPException(status_code=403, detail="Требуются права Администратора")
    return current_user

# --- ФОНОВЫЕ ЗАДАЧИ ---

def simulate_flight_telemetry():
    """Фоновый агент: генерирует пульс и ИИ-анализ для тех, кто в небе"""
    db = next(database.get_db())
    now = datetime.now(timezone.utc)
    
    try:
        # Находим активные рейсы
        active_flights = db.execute(text("""
            SELECT flight_id FROM flights 
            WHERE scheduled_departure <= :now AND scheduled_arrival >= :now
        """), {"now": now}).fetchall()

        for f in active_flights:
            crew = db.execute(text("""
                SELECT u.user_id, u.baseline_hr FROM users u 
                JOIN flight_assignments fa ON u.user_id = fa.crew_member_id 
                WHERE fa.flight_id = :f_id
            """), {"f_id": f[0]}).fetchall()

            for member in crew:
                hr = member.baseline_hr + random.randint(-5, 15)
                stress = random.randint(10, 40)
                # Расчет ИИ: отклонение от нормы
                dev = abs(hr - member.baseline_hr)
                perf = max(0, 100 - (dev * 2) - (stress / 4))
                
                db.execute(text("""
                    INSERT INTO flight_telemetry (flight_id, crew_member_id, heart_rate, spo2, stress_level, performance_score, record_timestamp)
                    VALUES (:f, :u, :hr, 98, :s, :p, :ts)
                """), {"f": f[0], "u": member.user_id, "hr": hr, "s": stress, "p": perf, "ts": now})
        db.commit()
    except Exception as e:
        logger.error(f"Ошибка симуляции: {e}")
    finally:
        db.close()

def nightly_roster_sync():
    """Заглушка для ночного планировщика"""
    logger.info("🌙 Ночной цикл планирования запущен...")

@app.on_event("startup")
def start_scheduler():
    scheduler = BackgroundScheduler(timezone="Europe/Moscow")
    scheduler.add_job(simulate_flight_telemetry, 'interval', minutes=2)
    scheduler.add_job(nightly_roster_sync, 'cron', hour=0, minute=10)
    scheduler.start()
    logger.info("🚀 Фоновые ИИ-службы запущены")

# --- ЭНДПОИНТЫ API ---

@app.get("/", tags=["Общие"])
def read_root():
    return {"система": "Агент МС-21", "статус": "Онлайн", "версия": "1.1.0-FIXED"}

@app.post("/auth/login", tags=["Авторизация"])
def login(form_data: dict, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.get('username')).first()
    if not user or not security.verify_password(str(form_data.get('password')), user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный логин или пароль")
    
    # Ищем должность в таблице flight_crew_members
    crew_info = db.query(models.FlightAssignment).filter(models.FlightAssignment.crew_member_id == user.user_id).first()
    # Или напрямую из связанной таблицы (если она есть)
    position_res = db.execute(text("SELECT position FROM flight_crew_members WHERE user_id = :uid"), {"uid": user.user_id}).fetchone()
    position = position_res[0] if position_res else "Сотрудник"

    token = security.create_access_token(data={"sub": str(user.user_id)})
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "fio": f"{user.last_name} {user.first_name}",
        "position": position # ОТПРАВЛЯЕМ РЕАЛЬНУЮ ДОЛЖНОСТЬ
    }

@app.post("/admin/create_user", tags=["Администратор"])
async def admin_create_user(
    admin: Annotated[models.User, Depends(get_current_admin)], 
    user_data: dict, 
    db: Session = Depends(database.get_db)
):
    hashed_pwd = security.get_password_hash(str(user_data['password']))
    new_user = models.User(
        user_id=uuid.uuid4(),
        email=user_data['email'],
        password_hash=hashed_pwd,
        first_name=user_data['first_name'],
        last_name=user_data['last_name'],
        patronymic=user_data.get('patronymic'),
        role_id=user_data['role_id'],
        baseline_hr=user_data.get('baseline_hr', 75)
    )
    db.add(new_user)
    db.commit()
    return {"status": "успех", "message": "Сотрудник добавлен"}

@app.get("/admin/staff", tags=["Администратор"])
def get_all_staff(admin: Annotated[models.User, Depends(get_current_admin)], db: Session = Depends(database.get_db)):
    result = db.execute(text("""
        SELECT u.first_name, u.last_name, u.baseline_hr, fcm.position 
        FROM users u 
        JOIN flight_crew_members fcm ON u.user_id = fcm.user_id 
    """)).fetchall()
    return [{"first_name": r[0], "last_name": r[1], "baseline_hr": r[2], "position": r[3]} for r in result]

@app.post("/crew/upload-health", tags=["Экипаж"])
async def upload_health(
    user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(database.get_db)],
    file: UploadFile = File(...)
):
    content = await file.read()
    result = analyze_crew_health(content, user.baseline_hr)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    try:
        new_log = models.PerformanceLog(
            crew_member_id=user.user_id,
            calculation_timestamp=datetime.now(timezone.utc),
            performance_score=result["readiness_score"] * 100,
            performance_level=result["status"],
            contributing_factors=result
        )
        db.add(new_log)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка сохранения лога: {e}")
    
    return result

@app.get("/crew/dashboard", tags=["Экипаж"])
async def get_dashboard(user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(database.get_db)):
    # 1. Получаем ПОСЛЕДНИЙ рассчитанный ИИ балл (из загруженных файлов)
    last_log = db.query(models.PerformanceLog).filter(
        models.PerformanceLog.crew_member_id == user.user_id
    ).order_by(models.PerformanceLog.calculation_timestamp.desc()).first()

    # 2. Получаем историю телеметрии (для графика)
    tele_res = db.execute(text("""
        SELECT heart_rate, performance_score, record_timestamp 
        FROM flight_telemetry 
        WHERE crew_member_id = :u 
        ORDER BY record_timestamp DESC LIMIT 30
    """), {"u": user.user_id}).fetchall()
    
    # 3. Ищем текущий или ближайший рейс
    flight_res = db.execute(text("""
        SELECT f.flight_number, f.departure_airport, f.arrival_airport
        FROM flights f
        JOIN flight_assignments fa ON f.flight_id = fa.flight_id
        WHERE fa.crew_member_id = :u 
        ORDER BY f.scheduled_departure DESC LIMIT 1
    """), {"u": user.user_id}).fetchone()

    history = []
    for r in tele_res:
        history.append({
            "heart_rate": r[0],
            "performance_score": r[1],
            "record_timestamp": r[2].isoformat() if r[2] else None
        })

    # Если в небе данных нет, но есть загруженный файл - используем его для большой цифры
    current_score = last_log.performance_score if last_log else 0
    if history:
        current_score = history[0]["performance_score"]

    return {
        "fio": f"{user.last_name} {user.first_name}",
        "score": round(current_score), # Тот самый процент
        "status": last_log.performance_level if last_log else "Нет данных",
        "текущий_рейс": {
            "flight_number": flight_res[0],
            "departure_airport": flight_res[1],
            "arrival_airport": flight_res[2]
        } if flight_res else None,
        "telemetry_history": history
    }

# 2. НОВЫЙ ЭНДПОИНТ: Все рейсы конкретного сотрудника
@app.get("/crew/my-flights", tags=["Экипаж"])
async def get_my_flights(user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(database.get_db)):
    result = db.execute(text("""
        SELECT f.flight_number, f.departure_airport, f.arrival_airport, 
               f.scheduled_departure, f.scheduled_arrival, fa.role_on_board
        FROM flights f
        JOIN flight_assignments fa ON f.flight_id = fa.flight_id
        WHERE fa.crew_member_id = :u
        ORDER BY f.scheduled_departure ASC
    """), {"u": user.user_id}).fetchall()
    
    return [
        {
            "number": r[0], "from": r[1], "to": r[2], 
            "dep": r[3].strftime("%d.%m %H:%M"), 
            "arr": r[4].strftime("%d.%m %H:%M"),
            "role": r[5]
        } for r in result
    ]

@app.get("/dispatcher/monitor", tags=["Диспетчер"])
def get_fleet_status(db: Session = Depends(database.get_db)):
    now = datetime.now(timezone.utc)
    active = db.execute(text("""
        SELECT f.flight_number, f.departure_airport, f.arrival_airport, 
               AVG(ft.performance_score) as avg_readiness
        FROM flights f
        LEFT JOIN flight_telemetry ft ON f.flight_id = ft.flight_id
        WHERE f.scheduled_departure <= :now AND f.scheduled_arrival >= :now
        GROUP BY f.flight_id, f.flight_number, f.departure_airport, f.arrival_airport
    """), {"now": now}).fetchall()
    return [{"flight_number": r[0], "dep": r[1], "arr": r[2], "avg_score": r[3]} for r in active]