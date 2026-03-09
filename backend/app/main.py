from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.orm import Session
from app import models, database, core
from app.core import security
from app.ai.analytics import analyze_crew_health
import uuid
from datetime import datetime
from jose import JWTError, jwt

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="АИ-Агент Мониторинга Экипажа (МС-21)")

# Схема для извлечения токена из запросов
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# --- СИСТЕМА БЕЗОПАСНОСТИ ---

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Учетные данные недействительны")
    except JWTError:
        raise HTTPException(status_code=401, detail="Учетные данные недействительны")
    
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user

def require_admin(current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    # Ищем роль пользователя в базе
    role = db.execute(text(f"SELECT role_name FROM roles WHERE role_id = '{current_user.role_id}'")).fetchone()
    if not role or role[0] != 'administrator':
        raise HTTPException(status_code=403, detail="Доступ запрещен. Только для Администратора.")
    return current_user

# --- ЭНДПОИНТЫ ---

@app.post("/auth/login", summary="Авторизация сотрудника")
def login(form_data: dict, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data['username']).first()
    if not user or not security.verify_password(form_data['password'], user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный email или пароль")
    
    token = security.create_access_token(data={"sub": str(user.user_id)})
    return {"access_token": token, "token_type": "bearer", "user_name": f"{user.first_name} {user.last_name}"}


# РЕГИСТРАЦИЯ ТОЛЬКО ДЛЯ АДМИНА
@app.post("/admin/register_crew", summary="Оформление нового сотрудника (Только Админ)")
async def register(
    user_data: dict, 
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(require_admin) # Защита!
):
    try:
        if db.query(models.User).filter(models.User.email == user_data['email']).first():
            raise HTTPException(status_code=400, detail="Сотрудник с таким email уже числится в штате")

        hashed_pwd = security.get_password_hash(user_data['password'])
        
        # Берем роль из запроса (crew_member или medical_worker)
        target_role = user_data.get('role', 'crew_member')
        role_record = db.execute(text(f"SELECT role_id FROM roles WHERE role_name = '{target_role}' LIMIT 1")).fetchone()
        
        new_user = models.User(
            email=user_data['email'],
            password_hash=hashed_pwd,
            first_name=user_data.get('first_name'),
            last_name=user_data.get('last_name'),
            role_id=role_record[0] if role_record else None,
            # Медицинская норма человека
            baseline_hr=user_data.get('baseline_hr', 70) 
        )
        
        db.add(new_user)
        db.commit()
        return {"status": "Успех", "message": "Сотрудник успешно добавлен в реестр авиакомпании"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка базы данных: {str(e)}")

@app.post("/medical/upload-data", summary="Загрузка телеметрии и анализ ИИ")
async def upload_health_data(
    file: UploadFile = File(...), 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user) # Определяем, кто загружает
):
    content = await file.read()
    
    # ПЕРЕДАЕМ БАЗОВЫЙ ПУЛЬС ПОЛЬЗОВАТЕЛЯ В ИИ
    result = analyze_crew_health(content, current_user.baseline_hr)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    new_log = models.PerformanceLog(
        crew_member_id=current_user.user_id,
        calculation_timestamp=datetime.now(),
        performance_score=result["readiness_score"] * 100,
        performance_level=result["status"], # 'Допущен', 'Внимание', 'Отстранен'
        contributing_factors=result
    )
    db.add(new_log)
    db.commit()
    return {"сообщение": "Телеметрия обработана агентом ИИ", "результат": result}