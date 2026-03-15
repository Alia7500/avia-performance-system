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

# --- НАСТРОЙКА И ЗАПУСК ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
models.Base.metadata.create_all(bind=database.engine)
app = FastAPI(title="Авиа-Агент МС-21: Центр Управления")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
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
# 2. ФОНОВЫЕ ПРОЦЕССЫ (ИИ, ЗАДЕРЖКИ, РАДАР)
# ==========================================

def update_flight_statuses():
    """Следит за временем: Завершает рейсы, запускает новые и имитирует задержки"""
    db = next(database.get_db())
    now = datetime.now(timezone.utc)
    try:
        # Завершаем прилетевшие
        db.execute(text("UPDATE flights SET status = 'Завершён' WHERE status = 'В полёте' AND scheduled_arrival <= :now"), {"now": now})
        
        # Запускаем новые (с учетом задержки)
        db.execute(text("""
            UPDATE flights SET status = 'В полёте', actual_departure = COALESCE(actual_departure, scheduled_departure) 
            WHERE status IN ('Запланирован', 'Задержан') AND (scheduled_departure + (COALESCE(delay_minutes, 0) * interval '1 minute')) <= :now
        """), {"now": now})
        
        # Имитируем задержки для 15% рейсов, вылетающих в ближайший час
        db.execute(text("""
            UPDATE flights SET status = 'Задержан', delay_minutes = floor(random() * 45 + 15)::int
            WHERE status = 'Запланирован' AND scheduled_departure BETWEEN :now AND :now + INTERVAL '60 minutes' AND random() < 0.15
        """), {"now": now})
        
        db.commit()
    except Exception as e: 
        logger.error(f"Ошибка обновления статусов: {e}")
    finally: 
        db.close()

def sync_flightradar():
    """Синхронизация координат с радаром Flightradar24"""
    db = next(database.get_db())
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        res = requests.get("https://data-cloud.flightradar24.com/zones/fcgi/data.json?airline=AFL", headers=headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            for key, val in data.items():
                if key in ['full_count', 'version', 'stats'] or len(val) < 14: continue
                lat, lon, heading, flight_num = val[1], val[2], val[3], val[13]
                if flight_num:
                    db.execute(text("""
                        UPDATE flights SET current_lat = :lat, current_lon = :lon, true_track = :hdg
                        WHERE flight_number = :fnum AND status = 'В полёте'
                    """), {"lat": lat, "lon": lon, "hdg": heading, "fnum": flight_num})
            db.commit()
    except Exception as e:
        logger.error(f"Ошибка радара: {e}")
    finally:
        db.close()

def simulate_telemetry():
    """Генерация биометрии экипажей в полете"""
    db = next(database.get_db())
    now = datetime.now(timezone.utc)
    try:
        active_flights = db.execute(text("SELECT flight_id FROM flights WHERE status = 'В полёте'")).fetchall()
        for f in active_flights:
            crew = db.execute(text("SELECT u.user_id, u.baseline_hr FROM users u JOIN flight_assignments fa ON u.user_id = fa.crew_member_id WHERE fa.flight_id = :f_id"), {"f_id": f[0]}).fetchall()
            for member in crew:
                hr = member.baseline_hr + random.randint(-5, 20)
                stress = random.randint(10, 40)
                perf = max(0, 100 - (abs(hr - member.baseline_hr) * 1.5) - (stress / 4))
                db.execute(text("""INSERT INTO flight_telemetry (flight_id, crew_member_id, heart_rate, spo2, stress_level, performance_score, record_timestamp, blood_pressure, temperature)
                                   VALUES (:f, :u, :hr, :o, :s, :p, :t, :bp, :temp)"""), 
                           {"f": f[0], "u": member.user_id, "hr": hr, "o": random.randint(95, 99), "s": stress, "p": perf, "t": now, "bp": f"12{random.randint(0,8)}/80", "temp": round(random.uniform(36.5, 37.1), 1)})
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
    scheduler.add_job(simulate_telemetry, 'interval', minutes=2)
    scheduler.start()
    logger.info("🚀 Оперативный Диспетчер, Радар и ИИ-Агент запущены")

# ==========================================
# 3. API ЭНДПОИНТЫ
# ==========================================

@app.get("/", tags=["Общие"])
def read_root():
    return {"система": "Агент МС-21", "статус": "Онлайн", "версия": "5.0-FINAL"}

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
        "access_token": token, "token_type": "bearer", 
        "fio": f"{user.last_name} {user.first_name}", 
        "role": role_name, "position": position
    }

@app.get("/dispatcher/monitor", tags=["Диспетчер"])
def get_dispatcher_monitor(db: Session = Depends(database.get_db)):
    now_utc = datetime.now(timezone.utc)
    flights = db.execute(text("""
        SELECT 
            f.flight_id, f.flight_number, f.departure_airport, f.arrival_airport, f.tail_number,
            f.scheduled_departure, f.scheduled_arrival, f.status, COALESCE(f.delay_minutes, 0) as delay,
            f.current_lat, f.current_lon, f.true_track,
            (SELECT json_agg(json_build_object(
                    'uid', u.user_id, 'fio', u.last_name || ' ' || left(u.first_name, 1) || '.', 'role', fa.role_on_board,
                    'score', COALESCE((SELECT performance_score FROM flight_telemetry WHERE crew_member_id=u.user_id AND flight_id=f.flight_id ORDER BY record_timestamp DESC LIMIT 1), 0),
                    'hr', COALESCE((SELECT heart_rate FROM flight_telemetry WHERE crew_member_id=u.user_id AND flight_id=f.flight_id ORDER BY record_timestamp DESC LIMIT 1), 0),
                    'spo2', COALESCE((SELECT spo2 FROM flight_telemetry WHERE crew_member_id=u.user_id AND flight_id=f.flight_id ORDER BY record_timestamp DESC LIMIT 1), 0),
                    'bp', COALESCE((SELECT blood_pressure FROM flight_telemetry WHERE crew_member_id=u.user_id AND flight_id=f.flight_id ORDER BY record_timestamp DESC LIMIT 1), '---'),
                    'temp', COALESCE((SELECT temperature FROM flight_telemetry WHERE crew_member_id=u.user_id AND flight_id=f.flight_id ORDER BY record_timestamp DESC LIMIT 1), 0),
                    'stress', COALESCE((SELECT stress_level FROM flight_telemetry WHERE crew_member_id=u.user_id AND flight_id=f.flight_id ORDER BY record_timestamp DESC LIMIT 1), 0),
                    'history', (SELECT json_agg(json_build_object('hr', heart_rate, 'score', performance_score)) FROM (SELECT * FROM flight_telemetry WHERE crew_member_id=u.user_id AND flight_id=f.flight_id ORDER BY record_timestamp DESC LIMIT 15) as h)
                ))
                FROM flight_assignments fa JOIN users u ON fa.crew_member_id = u.user_id
                WHERE fa.flight_id = f.flight_id
            ) as crew
        FROM flights f
        WHERE f.status IN ('В полёте', 'Задержан') OR (f.scheduled_departure > :now_utc AND f.scheduled_departure < :now_utc + INTERVAL '3 hours')
        ORDER BY f.scheduled_departure ASC
    """), {"now_utc": now_utc}).fetchall()
    
    result = []
    for r in flights:
        dep_dt = r.scheduled_departure.astimezone(timezone(timedelta(hours=3)))
        arr_dt = r.scheduled_arrival.astimezone(timezone(timedelta(hours=3)))
        
        progress = 0
        if r.status == 'В полёте' and r.scheduled_departure and r.scheduled_arrival:
            total_duration = (r.scheduled_arrival - r.scheduled_departure).total_seconds()
            elapsed = (now_utc - r.scheduled_departure).total_seconds()
            if total_duration > 0:
                progress = round((elapsed / total_duration) * 100)
        
        result.append({
            "id": str(r.flight_id), "number": r.flight_number, "dep": r.departure_airport, "arr": r.arrival_airport, "tail": r.tail_number or "Резерв",
            "time_dep": dep_dt.strftime("%H:%M"), "time_arr": arr_dt.strftime("%H:%M"), 
            "status": r.status, "delay": r.delay,
            "lat": float(r.current_lat) if r.current_lat else None, "lon": float(r.current_lon) if r.current_lon else None, "heading": r.true_track,
            "progress": progress, "crew": r.crew or []
        })
    return result

@app.get("/crew/dashboard", tags=["Экипаж"])
async def get_dashboard(user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(database.get_db)):
    tele_res = db.execute(text("SELECT heart_rate, performance_score, record_timestamp FROM flight_telemetry WHERE crew_member_id = :u ORDER BY record_timestamp DESC LIMIT 20"), {"u": user.user_id}).fetchall()
    history = [{"heart_rate": r.heart_rate, "performance_score": r.performance_score, "record_timestamp": str(r.record_timestamp)} for r in tele_res]

    last_log = db.query(models.PerformanceLog).filter(models.PerformanceLog.crew_member_id == user.user_id).order_by(models.PerformanceLog.calculation_timestamp.desc()).first()
    flight_res = db.execute(text("SELECT f.flight_number, f.departure_airport, f.arrival_airport FROM flights f JOIN flight_assignments fa ON f.flight_id = fa.flight_id WHERE fa.crew_member_id = :u AND f.status IN ('Запланирован', 'Задержан', 'В полёте') ORDER BY f.scheduled_departure ASC LIMIT 1"), {"u": user.user_id}).fetchone()

    current_score = last_log.performance_score if last_log else 0
    if history: current_score = history[0]["performance_score"]

    return {
        "fio": f"{user.last_name} {user.first_name}",
        "score": round(current_score),
        "status": last_log.performance_level if last_log else "Нет данных",
        "текущий_рейс": {
            "flight_number": flight_res[0], "departure_airport": flight_res[1], "arrival_airport": flight_res[2]
        } if flight_res else None,
        "telemetry_history": history
    }

@app.get("/crew/my-flights", tags=["Экипаж"])
async def get_my_flights(user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(database.get_db)):
    result = db.execute(text("SELECT f.flight_number, f.departure_airport, f.arrival_airport, f.scheduled_departure, f.scheduled_arrival, fa.role_on_board FROM flights f JOIN flight_assignments fa ON f.flight_id = fa.flight_id WHERE fa.crew_member_id = :u ORDER BY f.scheduled_departure ASC LIMIT 50"), {"u": user.user_id}).fetchall()
    return [{"number": r.flight_number, "from": r.departure_airport, "to": r.arrival_airport, "dep": r.scheduled_departure.strftime("%d.%m %H:%M"), "arr": r.scheduled_arrival.strftime("%d.%m %H:%M"), "role": r.role_on_board} for r in result]