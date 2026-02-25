from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app import models, database, core
from app.core import security
from app.ai.analytics import analyze_crew_health
import uuid
from datetime import datetime

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Avia Performance Backend")

# --- ЭНДПОИНТЫ АВТОРИЗАЦИИ ---

@app.post("/auth/register")
def register(user_data: dict, db: Session = Depends(database.get_db)):
    hashed_pwd = security.get_password_hash(user_data['password'])
    new_user = models.User(
        email=user_data['email'],
        password_hash=hashed_pwd,
        first_name=user_data['first_name'],
        last_name=user_data['last_name']
    )
    db.add(new_user)
    db.commit()
    return {"message": "User created"}

@app.post("/auth/login")
def login(form_data: dict, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data['username']).first()
    if not user or not security.verify_password(form_data['password'], user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    token = security.create_access_token(data={"sub": str(user.user_id)})
    return {"access_token": token, "token_type": "bearer"}

# --- ЭНДПОИНТЫ ДАННЫХ ---

@app.post("/upload/health-data")
async def upload_health_data(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    content = await file.read()
    result = analyze_crew_health(content, file.filename)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # В реальности тут мы достаем user_id из токена, пока используем твой ID
    VALENTINA_ID = "99999999-9999-4999-9999-999999999999"
    
    new_log = models.PerformanceLog(
        crew_member_id=VALENTINA_ID,
        calculation_timestamp=datetime.now(),
        performance_score=result["readiness_score"] * 100,
        performance_level=result["status"],
        contributing_factors=result
    )
    db.add(new_log)
    db.commit()
    return result

@app.get("/crew/my-status")
def get_status(db: Session = Depends(database.get_db)):
    # Получаем последнюю запись из базы для Валентины
    status = db.query(models.PerformanceLog).order_by(models.PerformanceLog.calculation_timestamp.desc()).first()
    return status