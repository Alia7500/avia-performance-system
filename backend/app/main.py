import os
import uuid
import random
import logging
import requests
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from apscheduler.schedulers.background import BackgroundScheduler

# --- НАШИ МОДУЛИ ---
from app import models, database
from app.core import security
from app.ai.analytics import analyze_crew_health

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Создание таблиц
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Авиа-Агент МС-21: Центр Управления")

# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# ==========================================
# 1. БЕЗОПАСНОСТЬ И АВТОРИЗАЦИЯ
# ==========================================

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
    role = db.execute(text("SELECT role_name FROM roles WHERE role_id = :rid"), {"rid": current_user.role_id}).fetchone()
    if not role or role[0] != 'administrator':
        raise HTTPException(status_code=403, detail="Требуются права Администратора")
    return current_user


# ==========================================
# 2. ФОНОВЫЕ ПРОЦЕССЫ (СИМУЛЯЦИЯ, ЗАДЕРЖКИ И РАДАР)
# ==========================================

def update_flight_statuses():
    """Только честные статусы по расписанию, никаких случайных задержек"""
    db = next(database.get_db())
    now = datetime.now(timezone.utc)
    try:
        db.execute(text("UPDATE flights SET status = 'Завершён' WHERE status = 'В полёте' AND scheduled_arrival <= :now"), {"now": now})
        
        db.execute(text("""
            UPDATE flights SET status = 'В полёте', actual_departure = COALESCE(actual_departure, scheduled_departure) 
            WHERE status IN ('Запланирован', 'Задержан') AND (scheduled_departure + (COALESCE(delay_minutes, 0) * interval '1 minute')) <= :now
        """), {"now": now})
        db.commit()
    except Exception as e: logger.error(e)
    finally: db.close()

def sync_flightradar():
    """Каждую минуту берем реальные координаты Аэрофлота с FlightRadar24"""
    try:
        db = next(database.get_db())
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        res = requests.get("https://data-cloud.flightradar24.com/zones/fcgi/data.json?airline=AFL", headers=headers, timeout=10)
        
        if res.status_code == 200:
            data = res.json()
            for key, val in data.items():
                if key in['full_count', 'version', 'stats']: continue
                lat, lon, heading, flight_num = val[1], val[2], val[3], val[13]
                
                if flight_num:
                    db.execute(text("""
                        UPDATE flights 
                        SET current_lat = :lat, current_lon = :lon, true_track = :hdg
                        WHERE flight_number = :fnum AND status = 'В полёте'
                    """), {"lat": lat, "lon": lon, "hdg": heading, "fnum": flight_num})
            db.commit()
    except Exception as e:
        logger.error(f"Ошибка FlightRadar: {e}")
    finally:
        db.close()

def simulate_flight_telemetry():
    """Генерация биометрии в полете"""
    db = next(database.get_db())
    now = datetime.now(timezone.utc)
    try:
        active_flights = db.execute(text("SELECT flight_id FROM flights WHERE status = 'В полёте'")).fetchall()
        for f in active_flights:
            crew = db.execute(text("""
                SELECT u.user_id, u.baseline_hr FROM users u 
                JOIN flight_assignments fa ON u.user_id = fa.crew_member_id 
                WHERE fa.flight_id = :f_id
            """), {"f_id": f[0]}).fetchall()

            for member in crew:
                hr = member.baseline_hr + random.randint(-5, 20)
                stress = random.randint(10, 40)
                perf = max(0, 100 - (abs(hr - member.baseline_hr) * 1.5) - (stress / 4))
                db.execute(text("""
                    INSERT INTO flight_telemetry (flight_id, crew_member_id, heart_rate, spo2, stress_level, performance_score, record_timestamp)
                    VALUES (:f, :u, :hr, 98, :s, :p, :ts)
                """), {"f": f[0], "u": member.user_id, "hr": hr, "s": stress, "p": perf, "ts": now})
        db.commit()
    except Exception as e:
        logger.error(f"Ошибка симуляции: {e}")
    finally:
        db.close()

@app.on_event("startup")
def start_scheduler():
    scheduler = BackgroundScheduler(timezone="Europe/Moscow")
    scheduler.add_job(update_flight_statuses, 'interval', minutes=1)
    scheduler.add_job(sync_flightradar, 'interval', minutes=1)
    scheduler.add_job(simulate_flight_telemetry, 'interval', minutes=2)
    scheduler.start()
    logger.info("🚀 Оперативный Диспетчер, Радар и ИИ-Агент запущены")


# ==========================================
# 3. API ЭНДПОИНТЫ
# ==========================================

@app.get("/", tags=["Общие"])
def read_root():
    return {"система": "Агент МС-21", "статус": "Онлайн", "версия": "4.0.0-FINAL"}

@app.post("/auth/login", tags=["Авторизация"])
def login(form_data: dict, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.get('username')).first()
    if not user or not security.verify_password(str(form_data.get('password')), user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный логин или пароль")
    
    role_res = db.execute(text("SELECT role_name FROM roles WHERE role_id = :rid"), {"rid": user.role_id}).fetchone()
    role_name = role_res[0] if role_res else "crew_member"
    
    pos_res = db.execute(text("SELECT position FROM flight_crew_members WHERE user_id = :uid"), {"uid": user.user_id}).fetchone()
    position = pos_res[0] if pos_res else ("Диспетчер ЦУП" if role_name == 'dispatcher' else "Администратор")

    token = security.create_access_token(data={"sub": str(user.user_id)})
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "fio": f"{user.last_name} {user.first_name}", 
        "role": role_name, 
        "position": position
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
def get_all_staff(db: Session = Depends(database.get_db)):
    result = db.execute(text("""
        SELECT u.first_name, u.last_name, u.baseline_hr, fcm.position 
        FROM users u 
        JOIN flight_crew_members fcm ON u.user_id = fcm.user_id 
        LIMIT 100
    """)).fetchall()
    return[{"first_name": r[0], "last_name": r[1], "baseline_hr": r[2], "position": r[3]} for r in result]

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
    # 1. История телеметрии
    tele_res = db.execute(text("""
        SELECT heart_rate, performance_score, record_timestamp 
        FROM flight_telemetry 
        WHERE crew_member_id = :u 
        ORDER BY record_timestamp DESC LIMIT 20
    """), {"u": user.user_id}).fetchall()
    history = [{"heart_rate": r[0], "performance_score": r[1], "record_timestamp": str(r[2])} for r in tele_res]

    # 2. Последний ИИ-расчет
    last_log = db.query(models.PerformanceLog).filter(
        models.PerformanceLog.crew_member_id == user.user_id
    ).order_by(models.PerformanceLog.calculation_timestamp.desc()).first()

    # 3. Ближайший рейс
    flight_res = db.execute(text("""
        SELECT f.flight_number, f.departure_airport, f.arrival_airport
        FROM flights f
        JOIN flight_assignments fa ON f.flight_id = fa.flight_id
        WHERE fa.crew_member_id = :u 
        AND f.status IN ('Запланирован', 'Задержан', 'В полёте')
        ORDER BY f.scheduled_departure ASC LIMIT 1
    """), {"u": user.user_id}).fetchone()

    current_score = last_log.performance_score if last_log else 0
    if history: current_score = history[0]["performance_score"]

    return {
        "fio": f"{user.last_name} {user.first_name}",
        "score": round(current_score),
        "status": last_log.performance_level if last_log else "Нет данных",
        "текущий_рейс": {
            "flight_number": flight_res[0],
            "departure_airport": flight_res[1],
            "arrival_airport": flight_res[2]
        } if flight_res else None,
        "telemetry_history": history
    }

@app.get("/crew/my-flights", tags=["Экипаж"])
async def get_my_flights(user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(database.get_db)):
    result = db.execute(text("""
        SELECT f.flight_number, f.departure_airport, f.arrival_airport, 
               f.scheduled_departure, f.scheduled_arrival, fa.role_on_board
        FROM flights f
        JOIN flight_assignments fa ON f.flight_id = fa.flight_id
        WHERE fa.crew_member_id = :u
        ORDER BY f.scheduled_departure ASC LIMIT 50
    """), {"u": user.user_id}).fetchall()
    
    return [
        {
            "number": r[0], "from": r[1], "to": r[2], 
            "dep": r[3].strftime("%d.%m %H:%M"), "arr": r[4].strftime("%d.%m %H:%M"),
            "role": r[5]
        } for r in result
    ]

@app.get("/history", tags=["Экипаж"])
async def get_history(user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(database.get_db)):
    logs = db.execute(text("""
        SELECT calculation_timestamp, performance_score, performance_level 
        FROM performance_analytics_log 
        WHERE crew_member_id = :u 
        ORDER BY calculation_timestamp DESC LIMIT 50
    """), {"u": user.user_id}).fetchall()
    
    return [
        {
            "calculation_timestamp": r[0].isoformat() if r[0] else None, 
            "performance_score": r[1], 
            "performance_level": r[2]
        } for r in logs
    ]

@app.get("/dispatcher/monitor", tags=["Диспетчер"])
def get_dispatcher_monitor(db: Session = Depends(database.get_db)):
    now = datetime.now(timezone.utc)
    active_flights = db.execute(text("""
        SELECT f.flight_id, f.flight_number, f.departure_airport, f.arrival_airport, f.tail_number,
               to_char(f.scheduled_departure at time zone 'Europe/Moscow', 'HH24:MI') as time_dep,
               to_char(f.scheduled_arrival at time zone 'Europe/Moscow', 'HH24:MI') as time_arr,
               f.status, COALESCE(f.delay_minutes, 0) as delay,
               to_char(COALESCE(f.actual_departure, f.scheduled_departure) at time zone 'Europe/Moscow', 'HH24:MI') as actual_dep,
               f.current_lat, f.current_lon, f.true_track,
               (SELECT json_agg(json_build_object(
                    'uid', u.user_id, 'fio', u.last_name || ' ' || left(u.first_name, 1) || '.', 
                    'role', fa.role_on_board,
                    'score', COALESCE((SELECT performance_score FROM flight_telemetry WHERE crew_member_id = u.user_id AND flight_id = f.flight_id ORDER BY record_timestamp DESC LIMIT 1), 0),
                    'hr', COALESCE((SELECT heart_rate FROM flight_telemetry WHERE crew_member_id = u.user_id AND flight_id = f.flight_id ORDER BY record_timestamp DESC LIMIT 1), 0),
                    'history', (SELECT json_agg(json_build_object('hr', heart_rate, 'score', performance_score)) FROM (SELECT heart_rate, performance_score FROM flight_telemetry WHERE crew_member_id = u.user_id AND flight_id = f.flight_id ORDER BY record_timestamp DESC LIMIT 20) as hist)
                )) FROM flight_assignments fa JOIN users u ON fa.crew_member_id = u.user_id WHERE fa.flight_id = f.flight_id
               ) as crew_list
        FROM flights f
        WHERE f.status IN ('В полёте', 'Задержан') OR (f.scheduled_departure <= :limit AND f.scheduled_departure >= :now)
        ORDER BY f.scheduled_departure ASC
    """), {"now": now, "limit": now + timedelta(hours=2)}).fetchall()

    return[{
        "id": str(r[0]), "number": r[1], "dep": r[2], "arr": r[3], "tail": r[4] or "Резерв", 
        "time_dep": r[5], "time_arr": r[6], "status": r[7], "delay": r[8], "actual_dep": r[9],
        "lat": float(r[10]) if r[10] else None, "lon": float(r[11]) if r[11] else None, "heading": r[12], 
        "crew": r[13] or[]
    } for r in active_flights]