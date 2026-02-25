from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uuid
from datetime import datetime
from typing import Annotated

from app import models, database
from app.ai.analytics import analyze_crew_health

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Avia Performance AI System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload/health-data")
async def upload_health_data(
    file: UploadFile = File(...), # Важно: именно так для Swagger
    db: Session = Depends(database.get_db)
):
    # 1. Читаем файл
    content = await file.read()
    
    # 2. Анализируем
    result = analyze_crew_health(content, file.filename)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # 3. Сохраняем в Neon
    #new_log = models.PerformanceLog(
    #    crew_member_id=uuid.uuid4(),
    #    calculation_timestamp=datetime.now(),
    #    performance_score=result["readiness_score"] * 100,
    #    performance_level=result["status"],  # Здесь теперь будет четко 'Optimal', 'Reduced' или 'Critical'
    #    contributing_factors=result
    #)
    # Используем твой созданный ID капитана
    VALENTINA_ID = "99999999-9999-4999-9999-999999999999"
    
    new_log = models.PerformanceLog(
        crew_member_id=VALENTINA_ID, # Теперь база примет этот ID
        calculation_timestamp=datetime.now(),
        performance_score=result["readiness_score"] * 100,
        performance_level=result["status"],
        contributing_factors=result
    )
    
    db.add(new_log)
    db.commit()

    return {
        "message": "Анализ завершен",
        "result": result
    }

@app.get("/")
def read_root():
    return {"status": "Online"}

@app.get("/history")
def get_performance_history(db: Session = Depends(database.get_db)):
    """Получает последние записи анализов из базы данных"""
    logs = db.query(models.PerformanceLog).order_by(models.PerformanceLog.calculation_timestamp.desc()).limit(10).all()
    return logs