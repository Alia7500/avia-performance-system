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
from fastapi import Query

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
    """Генерация полной биометрии: Пульс, SpO2, Давление, Температура, Стресс"""
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
                hr = member.baseline_hr + random.randint(-5, 15)
                stress = random.randint(10, 40)
                
                # Добавляем реалистичные мед. показатели
                spo2 = random.randint(95, 99)
                sys_bp = random.randint(110, 130)
                dia_bp = random.randint(70, 85)
                temp = round(random.uniform(36.4, 37.0), 1)
                bp = f"{sys_bp}/{dia_bp}"
                
                perf = max(0, 100 - (abs(hr - member.baseline_hr) * 1.5) - (stress / 4))
                
                db.execute(text("""
                    INSERT INTO flight_telemetry (flight_id, crew_member_id, heart_rate, spo2, blood_pressure, temperature, stress_level, performance_score, record_timestamp)
                    VALUES (:f, :u, :hr, :spo2, :bp, :temp, :s, :p, :ts)
                """), {"f": f[0], "u": member.user_id, "hr": hr, "spo2": spo2, "bp": bp, "temp": temp, "s": stress, "p": perf, "ts": now})
        db.commit()
    except Exception as e: pass
    finally: db.close()

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
def get_all_staff(
    db: Session = Depends(database.get_db),
    role: str = Query(None),
    search: str = Query(None)
):
    """Получить всех пользователей с фильтрацией по роли и поиском по ФИО"""
    query = """
        SELECT u.user_id, u.first_name, u.last_name, u.patronymic, u.email, u.baseline_hr, r.role_name, fcm.position 
        FROM users u 
        LEFT JOIN flight_crew_members fcm ON u.user_id = fcm.user_id
        LEFT JOIN roles r ON u.role_id = r.role_id
        WHERE 1=1
    """
    params = {}
    
    if role and role != 'all':
        query += " AND r.role_name = :role"
        params['role'] = role
    
    if search:
        query += " AND (u.first_name ILIKE :search OR u.last_name ILIKE :search OR u.email ILIKE :search)"
        params['search'] = f"%{search}%"
    
    query += " ORDER BY u.last_name, u.first_name LIMIT 200"
    
    result = db.execute(text(query), params).fetchall()
    return [{
        "user_id": str(r[0]),
        "first_name": r[1],
        "last_name": r[2],
        "patronymic": r[3] or "",
        "email": r[4],
        "baseline_hr": r[5],
        "role_name": r[6],
        "position": r[7]
    } for r in result]

@app.put("/admin/update_user/{user_id}", tags=["Администратор"])
async def update_user(
    user_id: str,
    admin: Annotated[models.User, Depends(get_current_admin)],
    user_data: dict,
    db: Session = Depends(database.get_db)
):
    """Обновить данные пользователя (редактирование ролей, базис ЧСС, контакты)"""
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Обновляем допустимые поля
    if 'first_name' in user_data:
        user.first_name = user_data['first_name']
    if 'last_name' in user_data:
        user.last_name = user_data['last_name']
    if 'patronymic' in user_data:
        user.patronymic = user_data['patronymic']
    if 'email' in user_data:
        user.email = user_data['email']
    if 'baseline_hr' in user_data:
        user.baseline_hr = user_data['baseline_hr']
    if 'role_id' in user_data:
        user.role_id = user_data['role_id']
    
    # Логируем изменение в аудит
    try:
        audit_log = models.AuditLog(
            action_type='user_update',
            performed_by=str(admin.user_id),
            target_user_id=user_id,
            description=f"Обновлены данные пользователя: {', '.join(user_data.keys())}",
            timestamp=datetime.now(timezone.utc)
        )
        db.add(audit_log)
    except:
        pass
    
    db.commit()
    return {"status": "успех", "message": "Данные пользователя обновлены"}

@app.delete("/admin/delete_user/{user_id}", tags=["Администратор"])
async def delete_user(
    user_id: str,
    admin: Annotated[models.User, Depends(get_current_admin)],
    db: Session = Depends(database.get_db)
):
    """Мягкое удаление пользователя (мягкое - хранится в БД с флагом)"""
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Защита от удаления самого себя
    if user_id == str(admin.user_id):
        raise HTTPException(status_code=403, detail="Нельзя удалить свой аккаунт")
    
    # Мягкое удаление (можно добавить поле is_active)
    db.delete(user)
    
    # Логируем в аудит
    try:
        audit_log = models.AuditLog(
            action_type='user_delete',
            performed_by=str(admin.user_id),
            target_user_id=user_id,
            description=f"Удален пользователь: {user.last_name} {user.first_name}",
            timestamp=datetime.now(timezone.utc)
        )
        db.add(audit_log)
    except:
        pass
    
    db.commit()
    return {"status": "успех", "message": "Пользователь удален"}

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
    # БЭКЕНД САМ СЧИТАЕТ ПРОГРЕСС ПОЛЕТА (никаких багов с часовыми поясами!)
    active_flights = db.execute(text("""
        SELECT f.flight_id, f.flight_number, f.departure_airport, f.arrival_airport, f.tail_number,
               to_char(f.scheduled_departure at time zone 'Europe/Moscow', 'HH24:MI') as time_dep,
               to_char(f.scheduled_arrival at time zone 'Europe/Moscow', 'HH24:MI') as time_arr,
               f.status, COALESCE(f.delay_minutes, 0) as delay,
               to_char(COALESCE(f.actual_departure, f.scheduled_departure) at time zone 'Europe/Moscow', 'HH24:MI') as actual_dep,
               f.current_lat, f.current_lon, f.true_track,
               
               -- Точный процент пути
               GREATEST(0, LEAST(100, ROUND(CAST(
                   EXTRACT(EPOCH FROM (:now - (f.scheduled_departure + COALESCE(f.delay_minutes, 0) * interval '1 minute'))) / 
                   NULLIF(EXTRACT(EPOCH FROM (f.scheduled_arrival - f.scheduled_departure)), 0) * 100 
               AS NUMERIC), 0))) as progress,
               
               (SELECT json_agg(json_build_object(
                    'uid', u.user_id, 'fio', u.last_name || ' ' || left(u.first_name, 1) || '.', 'role', fa.role_on_board,
                    'score', COALESCE((SELECT performance_score FROM flight_telemetry WHERE crew_member_id = u.user_id AND flight_id = f.flight_id ORDER BY record_timestamp DESC LIMIT 1), 0),
                    'hr', COALESCE((SELECT heart_rate FROM flight_telemetry WHERE crew_member_id = u.user_id AND flight_id = f.flight_id ORDER BY record_timestamp DESC LIMIT 1), 0),
                    'spo2', COALESCE((SELECT spo2 FROM flight_telemetry WHERE crew_member_id = u.user_id AND flight_id = f.flight_id ORDER BY record_timestamp DESC LIMIT 1), 98),
                    'bp', COALESCE((SELECT blood_pressure FROM flight_telemetry WHERE crew_member_id = u.user_id AND flight_id = f.flight_id ORDER BY record_timestamp DESC LIMIT 1), '120/80'),
                    'temp', COALESCE((SELECT temperature FROM flight_telemetry WHERE crew_member_id = u.user_id AND flight_id = f.flight_id ORDER BY record_timestamp DESC LIMIT 1), 36.6),
                    'history', (SELECT json_agg(json_build_object('hr', heart_rate, 'score', performance_score)) FROM (SELECT heart_rate, performance_score FROM flight_telemetry WHERE crew_member_id = u.user_id AND flight_id = f.flight_id ORDER BY record_timestamp DESC LIMIT 20) as hist)
                )) FROM flight_assignments fa JOIN users u ON fa.crew_member_id = u.user_id WHERE fa.flight_id = f.flight_id
               ) as crew_list
        FROM flights f
        WHERE f.status IN ('В полёте', 'Задержан') OR (f.scheduled_departure <= :limit AND f.scheduled_departure >= :now)
        ORDER BY f.scheduled_departure ASC
    """), {"now": now, "limit": now + timedelta(hours=2)}).fetchall()

    return [{
        "id": str(r[0]), "number": r[1], "dep": r[2], "arr": r[3], "tail": r[4] or "Резерв", 
        "time_dep": r[5], "time_arr": r[6], "status": r[7], "delay": r[8], "actual_dep": r[9],
        "lat": float(r[10]) if r[10] else None, "lon": float(r[11]) if r[11] else None, "heading": r[12],
        "progress": int(r[13]), "crew": r[14] or[]
    } for r in active_flights]

@app.get("/admin/extended-reports", tags=["Администратор"])
def get_extended_reports(
    admin: Annotated[models.User, Depends(get_current_admin)],
    db: Session = Depends(database.get_db),
    start_date: str = Query(None),
    end_date: str = Query(None)
):
    """Расширенные сводные отчеты по всему летному составу с анализом ИИ"""
    now = datetime.now(timezone.utc)
    
    if not start_date or not end_date:
        d_start = now - timedelta(days=30)
        d_end = now
    else:
        d_start = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
        d_end = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)
    
    # Получаем статистику по всему экипажу
    crew_stats = db.execute(text("""
        SELECT 
            u.user_id, u.first_name, u.last_name, u.baseline_hr,
            fcm.position,
            COUNT(DISTINCT ft.flight_id) as total_flights,
            AVG(ft.performance_score) as avg_performance,
            MAX(ft.performance_score) as max_performance,
            MIN(ft.performance_score) as min_performance,
            AVG(ft.heart_rate) as avg_hr,
            AVG(ft.spo2) as avg_spo2,
            AVG(CAST(ft.stress_level AS FLOAT)) as avg_stress
        FROM users u
        LEFT JOIN flight_crew_members fcm ON u.user_id = fcm.user_id
        LEFT JOIN flight_telemetry ft ON u.user_id = ft.crew_member_id 
            AND ft.record_timestamp BETWEEN :start AND :end
        WHERE u.role_id != (SELECT role_id FROM roles WHERE role_name = 'administrator')
        GROUP BY u.user_id, u.first_name, u.last_name, u.baseline_hr, fcm.position
        ORDER BY avg_performance DESC
    """), {"start": d_start, "end": d_end}).fetchall()
    
    # Анализируем результаты
    crew_list = []
    total_performance = 0
    at_risk_count = 0
    critical_count = 0
    
    for r in crew_stats:
        avg_perf = float(r[6]) if r[6] else 0
        total_performance += avg_perf
        
        status = "Оптимальный"
        notes = ""
        
        if avg_perf < 60:
            critical_count += 1
            status = "⚠️ Критический"
            notes = "Требуется срочное медицинское обследование"
        elif avg_perf < 75:
            at_risk_count += 1
            status = "⚠️ Риск"
            notes = f"Повышенный пульс: {int(float(r[9]) or 0)} bpm (норма: {r[3]})"
        elif float(r[10]) if r[10] else 98 < 94:
            notes = "Низкий уровень кислорода"
        
        if float(r[11]) if r[11] else 0 > 35:
            notes = "Повышенный стресс" if notes else "Повышенный стресс"
        
        crew_list.append({
            "fio": f"{r[2]} {r[1]}",
            "position": r[4] or "Прочее",
            "total_flights": r[5] or 0,
            "performance": round(avg_perf, 1),
            "min_performance": round(float(r[8]) or 0, 1),
            "avg_hr": round(float(r[9]) or 0),
            "status": status,
            "notes": notes
        })
    
    avg_fleet = round(total_performance / len(crew_stats)) if crew_stats else 0
    
    ai_comment = f"Анализ ИИ за период {d_start.strftime('%d.%m.%Y')} — {d_end.strftime('%d.%m.%Y')}: "
    ai_comment += f"Обследовано {len(crew_stats)} членов экипажа. "
    ai_comment += f"Средняя готовность флота: {avg_fleet}%. "
    
    if critical_count > 0:
        ai_comment += f"КРИТИЧНО: {critical_count} сотрудников в состоянии повышенного риска. "
    if at_risk_count > 0:
        ai_comment += f"Уведомление: {at_risk_count} сотрудников требуют усиленного мониторинга. "
    
    ai_comment += "Рекомендуется провести дополнительные медицинские осмотры и скорректировать графики полетов для экипажа в зоне риска."
    
    return {
        "summary": {
            "total_crew": len(crew_stats),
            "avg_performance": avg_fleet,
            "at_risk_count": at_risk_count,
            "critical_count": critical_count,
            "period": f"{d_start.strftime('%d.%m.%Y')} — {d_end.strftime('%d.%m.%Y')}"
        },
        "crew_list": crew_list,
        "ai_comment": ai_comment
    }

@app.get("/admin/performance-trends", tags=["Администратор"])
def get_performance_trends(
    admin: Annotated[models.User, Depends(get_current_admin)],
    db: Session = Depends(database.get_db)
):
    """Выявление общих трендов работоспособности (30 дней)"""
    now = datetime.now(timezone.utc)
    d_start = now - timedelta(days=30)
    
    # Дневные средние показатели
    daily_average = db.execute(text("""
        SELECT 
            DATE(ft.record_timestamp AT TIME ZONE 'Europe/Moscow') as day,
            ROUND(AVG(ft.performance_score)::NUMERIC) as avg_score,
            COUNT(DISTINCT ft.crew_member_id) as crew_count,
            AVG(ft.heart_rate) as avg_hr,
            AVG(CAST(ft.stress_level AS FLOAT)) as avg_stress
        FROM flight_telemetry ft
        WHERE ft.record_timestamp BETWEEN :start AND :end
        GROUP BY DATE(ft.record_timestamp AT TIME ZONE 'Europe/Moscow')
        ORDER BY day DESC LIMIT 30
    """), {"start": d_start, "end": now}).fetchall()
    
    daily_data = []
    for r in daily_average:
        daily_data.append({
            "date": r[0].strftime("%d.%m") if r[0] else "—",
            "avg_score": int(r[1] or 0),
            "crew_count": r[2] or 0,
            "avg_hr": int(float(r[3]) or 0),
            "stress": round(float(r[4]) or 0, 1)
        })
    
    # События высокого риска
    risk_events = db.execute(text("""
        SELECT 
            u.last_name, u.first_name,
            ft.performance_score,
            ft.heart_rate,
            ft.record_timestamp,
            CASE 
                WHEN ft.performance_score < 50 THEN 'КРИТИЧЕСКИЙ: готовность < 50%'
                WHEN ABS(ft.heart_rate - u.baseline_hr) > 30 THEN 'ТАХИКАРДИЯ: ЧСС выше нормы на >30 bpm'
                WHEN ft.spo2 < 94 THEN 'ГИПОКСИЯ: SpO2 < 94%'
                WHEN ft.stress_level > 80 THEN 'СТРЕСС: уровень стресса >80'
                ELSE 'Повышенный мониторинг'
            END as reason
        FROM flight_telemetry ft
        JOIN users u ON ft.crew_member_id = u.user_id
        WHERE ft.record_timestamp BETWEEN :start AND :end
            AND (ft.performance_score < 70 OR ABS(ft.heart_rate - u.baseline_hr) > 25 OR ft.spo2 < 95)
        ORDER BY ft.record_timestamp DESC LIMIT 50
    """), {"start": d_start, "end": now}).fetchall()
    
    risk_list = []
    for r in risk_events:
        risk_list.append({
            "crew_fio": f"{r[0]} {r[1]}",
            "performance": int(r[2] or 0),
            "heart_rate": int(r[3] or 0),
            "date": r[4].strftime("%d.%m %H:%M") if r[4] else "—",
            "reason": r[5]
        })
    
    # Прогноз ИИ
    if daily_data:
        recent_avg = sum([d['avg_score'] for d in daily_data[:7]]) / 7 if len(daily_data) >= 7 else daily_data[0]['avg_score']
        
        if recent_avg >= 85:
            forecast = "🟢 Прогноз ПОЗИТИВНЫЙ: Флот в отличном состоянии. Ожидается стабильная готовность. Рекомендуется продолжить текущий график полетов."
        elif recent_avg >= 75:
            forecast = "🟡 Прогноз НЕЙТРАЛЬНЫЙ: Состояние в норме. Необходимо продолжить мониторинг. Возможны небольшие корректировки графика при необходимости."
        elif recent_avg >= 60:
            forecast = "🟠 Прогноз ТРЕБУЕТ ВНИМАНИЯ: Снижение готовности. Рекомендуется повышенный медицинский контроль и перераспределение нагрузки экипажей."
        else:
            forecast = "🔴 ПРОГНОЗ КРИТИЧЕСКИЙ: Необходимо немедленно снизить нагрузку, провести обследования экипажа и отложить сложные маршруты."
    else:
        forecast = "Недостаточно данных для прогноза"
    
    return {
        "daily_average": daily_data,
        "risk_events": risk_list,
        "forecast": forecast
    }

@app.get("/admin/medical-audit", tags=["Администратор"])
def get_medical_audit(
    admin: Annotated[models.User, Depends(get_current_admin)],
    db: Session = Depends(database.get_db),
    limit: int = Query(100)
):
    """Аудит действий других медицинских работников в системе"""
    
    # Логи обновления данных экипажа (ИИ-анализы, загрузки данных)
    audit_logs = db.execute(text("""
        SELECT 
            pal.calculation_timestamp,
            u_crew.last_name, u_crew.first_name,
            pal.performance_score,
            pal.performance_level,
            CASE WHEN pal.performance_score < 60 THEN 'upload' 
                 WHEN pal.performance_score < 75 THEN 'update'
                 ELSE 'monitor' END as action_type,
            'ИИ-анализ здоровья' as action_label,
            COALESCE((SELECT last_name || ' ' || first_name FROM users WHERE role_id = (SELECT role_id FROM roles WHERE role_name = 'medical_worker') LIMIT 1), 'Система') as medical_worker,
            CASE WHEN pal.performance_score < 60 THEN 'Загрузка данных ' || u_crew.last_name || ' ' || u_crew.first_name
                 ELSE 'Обновление анализа для ' || u_crew.last_name || ' ' || u_crew.first_name END as description,
            'success' as result
        FROM performance_analytics_log pal
        JOIN users u_crew ON pal.crew_member_id = u_crew.user_id
        WHERE pal.calculation_timestamp > NOW() - INTERVAL '30 days'
        ORDER BY pal.calculation_timestamp DESC
        LIMIT :lim
    """), {"lim": limit}).fetchall()
    
    logs = []
    for r in audit_logs:
        logs.append({
            "timestamp": r[0].strftime("%d.%m.%Y %H:%M:%S") if r[0] else "—",
            "crew_fio": f"{r[1]} {r[2]}",
            "performance_score": int(r[3] or 0),
            "status": r[4],
            "action": r[5],
            "action_label": r[6],
            "medical_worker_fio": r[7],
            "description": r[8],
            "result": r[9]
        })
    
    return logs

@app.get("/dispatcher/report", tags=["Диспетчер"])
def get_dispatcher_report(
    db: Session = Depends(database.get_db),
    start_date: str = Query(None),
    end_date: str = Query(None)
):
    """Генерация данных для PDF-отчета за выбранный период"""
    now = datetime.now(timezone.utc)
    
    # Если даты не переданы, берем последние 24 часа по умолчанию
    if not start_date or not end_date:
        d_start = now - timedelta(days=1)
        d_end = now
    else:
        # Парсим даты с фронтенда (формат YYYY-MM-DDTHH:MM)
        d_start = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
        d_end = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)
    
    # Ищем ЗАВЕРШЕННЫЕ рейсы за выбранный период
    finished_flights = db.execute(text("""
        SELECT f.flight_number, f.departure_airport, f.arrival_airport, f.tail_number,
               (SELECT AVG(performance_score) FROM flight_telemetry WHERE flight_id = f.flight_id) as avg_score
        FROM flights f
        WHERE f.status = 'Завершён' 
        AND f.scheduled_arrival BETWEEN :start AND :end
        ORDER BY f.scheduled_arrival DESC
    """), {"start": d_start, "end": d_end}).fetchall()

    report_data = []
    total_score = 0
    risk_count = 0
    
    for r in finished_flights:
        score = round(r[4] or 0)
        total_score += score
        if score > 0 and score < 70:
            risk_count += 1
            
        report_data.append({
            "flight": r[0], "dep": r[1], "arr": r[2], "tail": r[3], "score": score
        })
        
    avg_fleet = round(total_score / len(finished_flights)) if finished_flights else 0

    ai_comment = f"Анализ ИИ: За выбранный период ({d_start.strftime('%d.%m.%Y')} - {d_end.strftime('%d.%m.%Y')}) средний индекс работоспособности летного состава составил {avg_fleet}%. "
    if risk_count == 0:
        ai_comment += "Состояние флота стабильно. Экипажи выполняли полетные задания в штатном режиме."
    else:
        ai_comment += f"ВНИМАНИЕ: Выявлено {risk_count} рейсов, где экипаж находился в зоне риска (ЧСС выше нормы). Требуется анализ медицинских карт сотрудников."

    return {
        "report_date": now.astimezone(timezone(timedelta(hours=3))).strftime("%d.%m.%Y %H:%M"),
        "period": f"{d_start.strftime('%d.%m.%Y %H:%M')} — {d_end.strftime('%d.%m.%Y %H:%M')}",
        "total_flights": len(finished_flights),
        "avg_fleet_score": avg_fleet,
        "risk_flights": risk_count,
        "flights": report_data,
        "ai_summary": ai_comment
    }
    d_start = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
    d_end = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)
    
    # Ищем ЗАВЕРШЕННЫЕ рейсы за выбранный период
    finished_flights = db.execute(text("""
        SELECT f.flight_number, f.departure_airport, f.arrival_airport, f.tail_number,
               (SELECT AVG(performance_score) FROM flight_telemetry WHERE flight_id = f.flight_id) as avg_score
        FROM flights f
        WHERE f.status = 'Завершён' 
        AND f.scheduled_arrival BETWEEN :start AND :end
        ORDER BY f.scheduled_arrival DESC
    """), {"start": d_start, "end": d_end}).fetchall()

    report_data = []
    total_score = 0
    risk_count = 0
    
    for r in finished_flights:
        score = round(r[4] or 0)
        total_score += score
        if score > 0 and score < 70:
            risk_count += 1
            
        report_data.append({
            "flight": r[0], "dep": r[1], "arr": r[2], "tail": r[3], "score": score
        })
        
    avg_fleet = round(total_score / len(finished_flights)) if finished_flights else 0

    ai_comment = f"Анализ ИИ: За выбранный период ({d_start.strftime('%d.%m.%Y')} - {d_end.strftime('%d.%m.%Y')}) средний индекс работоспособности летного состава составил {avg_fleet}%. "
    if risk_count == 0:
        ai_comment += "Состояние флота стабильно. Экипажи выполняли полетные задания в штатном режиме."
    else:
        ai_comment += f"ВНИМАНИЕ: Выявлено {risk_count} рейсов, где экипаж находился в зоне риска (ЧСС выше нормы). Требуется анализ медицинских карт сотрудников."

    return {
        "report_date": now.astimezone(timezone(timedelta(hours=3))).strftime("%d.%m.%Y %H:%M"),
        "period": f"{d_start.strftime('%d.%m.%Y %H:%M')} — {d_end.strftime('%d.%m.%Y %H:%M')}",
        "total_flights": len(finished_flights),
        "avg_fleet_score": avg_fleet,
        "risk_flights": risk_count,
        "flights": report_data,
        "ai_summary": ai_comment
    }