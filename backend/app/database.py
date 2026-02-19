from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv() # Загружаем переменные из .env файла

# Получаем ссылку на БД из переменных окружения
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Создаем движок подключения
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Создаем фабрику сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для моделей
Base = declarative_base()

# Функция для получения сессии (будем использовать в API)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()