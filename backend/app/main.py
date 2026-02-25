from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

# ИСПОЛЬЗУЕМ АБСОЛЮТНЫЕ ИМПОРТЫ ДЛЯ ЛОКАЛЬНОГО ЗАПУСКА
from app import models, database
from app.ai.analytics import analyze_crew_health

# Инициализируем таблицы в БД Neon
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Avia Performance AI System")

# Настройка CORS (чтобы Firebase мог общаться с этим сервером)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "status": "Online",
        "system": "Agent for Dynamic Analysis of Flight Crew Performance",
        "version": "1.0.0"
    }

@app.post("/upload/health-data")
async def upload_health_data(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    """
    Принимает CSV файл из Samsung Health, анализирует его и сохраняет результат в Neon.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Допускаются только CSV файлы")

    # 1. Читаем содержимое файла
    content = await file.read()
    
    # 2. Отправляем в наш AI-модуль для анализа
    analysis_result = analyze_crew_health(content, file.filename)
    
    if "error" in analysis_result:
        raise HTTPException(status_code=400, detail=analysis_result["error"])

    # 3. Сохраняем результат в Базу Данных (Neon)
    # Для теста используем фиксированный ID пользователя (потом заменим на твой)
    test_user_id = uuid.uuid4() 
    
    new_log = models.PerformanceLog(
        crew_member_id=test_user_id,
        calculation_timestamp=datetime.now(),
        performance_score=analysis_result["readiness"] * 100,
        performance_level=analysis_result["status"],
        contributing_factors=analysis_result
    )
    
    try:
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка БД: {str(e)}")

    return {
        "message": "Данные успешно проанализированы и сохранены",
        "crew_member": "Valentina (Test Mode)",
        "summary": analysis_result,
        "db_record_id": new_log.log_id
    }

@app.get("/history")
def get_performance_history(db: Session = Depends(database.get_db)):
    """Получает последние записи анализов из базы данных"""
    logs = db.query(models.PerformanceLog).order_by(models.PerformanceLog.calculation_timestamp.desc()).limit(10).all()
    return logs