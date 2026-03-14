import os
import uuid
import random
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from apscheduler.schedulers.background import BackgroundScheduler

# Импорт наших модулей
from app import models, database, core
from app.core import security
from app.ai.analytics import analyze_crew_health

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация таблиц в Neon
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Агент ИИ: Система Мониторинга Экипажей МС-21")

# Настройка CORS
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
            raise HTTPException(status_code=401, detail="Ошибка авторизации")
    except JWTError:
        raise HTTPException(status_code=401, detail="Токен недействителен")
    
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user

async def get_current_admin(current_user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(database.get_db)):
    # Проверка роли через таблицу roles
    role = db.execute(text(f"SELECT role_name FROM roles WHERE role_id = '{current_user.role_id}'")).fetchone()
    if not role or role[0] != 'administrator':
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуются права Администратора.")
    return current_user

# --- ФОНОВЫЕ ЗАДАЧИ (ИИ И ДИСПЕТЧЕР) ---

def simulate_flight_telemetry():
    """Имитация датчиков здоровья экипажей, которые сейчас в полете"""
    db = next(database.get_db())
    now = datetime.now(timezone.utc)
    
    # Ищем активные рейсы
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
            # Генерация показателей вокруг нормы сотрудника
            hr = member.baseline_hr + random.randint(-5, 15)
            stress = random.randint(10, 40)
            # Расчет работоспособности (ИИ)
            deviation = abs(hr - member.baseline_hr)
            perf = max(0, 100 - (deviation * 2) - (stress / 4))
            
            db.execute(text("""
                INSERT INTO flight_telemetry (flight_id, crew_member_id, heart_rate, spo2, stress_level, performance_score)
                VALUES (:f, :u, :hr, :o, :s, :p)
            """), {"f": f[0], "u": member.user_id, "hr": hr, "o": random.randint(95, 99), "s": stress, "p": perf})
    db.commit()
    db.close()

def nightly_roster_sync():
    """Автоматическое назначение экипажей каждую ночь в 00:10"""
    logger.info("🌙 Ночной диспетчер: начало планирования на завтра...")
    db = next(database.get_db())
    try:
        # Логика: находим пустые рейсы на следующие 24 часа и заполняем их
        # Используем логику из нашего скрипта assign_crews.py (упрощенно)
        db.execute(text("SELECT 1")) # Заглушка для расширения
        db.commit()
    finally:
        db.close()

@app.on_event("startup")
def start_scheduler():
    scheduler = BackgroundScheduler(timezone="Europe/Moscow")
    # Каждые 2 минуты - жизнь в небе
    scheduler.add_job(simulate_flight_telemetry, 'interval', minutes=2)
    # Каждую ночь в 00:10 - планирование
    scheduler.add_job(nightly_roster_sync, 'cron', hour=0, minute=10)
    scheduler.start()

# --- ЭНДПОИНТЫ API ---

@app.get("/", tags=["Общие"])
def read_root():
    return {"система": "Агент МС-21", "статус": "Онлайн", "время": datetime.now()}

@app.post("/auth/login", tags=["Авторизация"])
def login(form_data: dict, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.get('username')).first()
    if not user or not security.verify_password(form_data.get('password'), user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный логин или пароль")
    
    token = security.create_access_token(data={"sub": str(user.user_id)})
    return {"access_token": token, "token_type": "bearer", "fio": f"{user.last_name} {user.first_name}"}

@app.post("/admin/create_user", tags=["Администратор"])
def admin_create_user(
    admin: Annotated[models.User, Depends(get_current_admin)], # Переместили вперед
    user_data: dict, 
    db: Session = Depends(database.get_db)
):
    """Только админ может создавать персонал"""
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
def get_all_staff(db: Session = Depends(database.get_db)):
    # Возвращаем список всех 1200 человек
    result = db.execute(text("""
        SELECT u.first_name, u.last_name, u.baseline_hr, fcm.position 
        FROM users u 
        JOIN flight_crew_members fcm ON u.user_id = fcm.user_id 
        LIMIT 100
    """)).fetchall()
    return result

@app.post("/crew/upload-health", tags=["Экипаж"])
async def upload_health(
    user: Annotated[models.User, Depends(get_current_user)], # В начало (без default)
    db: Annotated[Session, Depends(database.get_db)],      # Тоже через Annotated (красивее)
    file: UploadFile = File(...)                           # В конец (есть default)
):
    """Загрузка данных с Samsung Watch"""
    content = await file.read()
    result = analyze_crew_health(content, user.baseline_hr)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # Сохраняем в лог
    new_log = models.PerformanceLog(
        crew_member_id=user.user_id,
        calculation_timestamp=datetime.now(),
        performance_score=result["readiness_score"] * 100,
        performance_level=result["status"],
        contributing_factors=result
    )
    db.add(new_log)
    db.commit()
    return result

@app.get("/dispatcher/monitor", tags=["Диспетчер"])
def get_fleet_status(db: Session = Depends(database.get_db)):
    """Мониторинг всех рейсов в воздухе для диспетчера"""
    now = datetime.now(timezone.utc)
    active = db.execute(text("""
        SELECT f.flight_number, f.departure_airport, f.arrival_airport, 
               AVG(ft.performance_score) as avg_readiness
        FROM flights f
        LEFT JOIN flight_telemetry ft ON f.flight_id = ft.flight_id
        WHERE f.scheduled_departure <= :now AND f.scheduled_arrival >= :now
        GROUP BY f.flight_id
    """), {"now": now}).fetchall()
    return active