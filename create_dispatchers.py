import os
import sys
import uuid
import random
from dotenv import load_dotenv

# --- 1. НАСТРОЙКА ПУТЕЙ И ЗАГРУЗКА .ENV ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")

# Добавляем путь к бэкенду для импортов
sys.path.append(BACKEND_DIR)

# Пытаемся найти .env в корне или в папке backend
env_path = os.path.join(BASE_DIR, ".env")
if not os.path.exists(env_path):
    env_path = os.path.join(BACKEND_DIR, ".env")

load_dotenv(env_path)

# --- 2. ПРОВЕРКА ПОДКЛЮЧЕНИЯ ---
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL is None:
    print(f"❌ ОШИБКА: Файл .env не найден или в нем нет DATABASE_URL!")
    print(f"Я искал тут: {env_path}")
    sys.exit(1)

# Исправляем формат для SQLAlchemy
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

from sqlalchemy import create_engine, text
from app.core import security

engine = create_engine(DATABASE_URL)

# --- 3. ДАННЫЕ ДЛЯ ГЕНЕРАЦИИ ---
surnames = ["Романов", "Антонов", "Тарасов", "Белов", "Тихонов", "Григорьев", "Кононов", "Маслов", "Степанов", "Николаев"]
names = ["Игорь", "Олег", "Станислав", "Валерий", "Леонид", "Юрий", "Андрей", "Сергей"]
patronymics = ["Викторович", "Олегович", "Павлович", "Сергеевич", "Борисович", "Николаевич"]

def add_dispatchers():
    print("📡 Подключение к базе Neon прошло успешно.")
    print("🚀 Запуск процесса добавления диспетчеров...")
    
    with engine.begin() as conn:
        # 1. Получаем ID роли диспетчера
        role_res = conn.execute(text("SELECT role_id FROM roles WHERE role_name = 'dispatcher'")).fetchone()
        if not role_res:
            print("⚠️ Роль 'dispatcher' не найдена. Создаю её...")
            conn.execute(text("INSERT INTO roles (role_name) VALUES ('dispatcher')"))
            role_res = conn.execute(text("SELECT role_id FROM roles WHERE role_name = 'dispatcher'")).fetchone()
        
        role_id = role_res[0]

        # 2. Добавляем 50 диспетчеров
        print("--- Создание 50 учетных записей диспетчерского состава...")
        for i in range(1, 51):
            ln = random.choice(surnames)
            fn = random.choice(names)
            pn = random.choice(patronymics)
            u_id = str(uuid.uuid4())
            email = f"dispatcher_{i}@ms21-avia.ru"
            
            conn.execute(text("""
                INSERT INTO users (user_id, email, password_hash, first_name, last_name, patronymic, role_id, baseline_hr)
                VALUES (:id, :email, :pwd, :fn, :ln, :pn, :role, :hr)
                ON CONFLICT (email) DO NOTHING
            """), {
                "id": u_id, "email": email, 
                "pwd": security.get_password_hash("pass123"),
                "fn": fn, "ln": ln, "pn": pn, "role": role_id, 
                "hr": random.randint(65, 80)
            })
            
            if i % 10 == 0:
                print(f"    ...создано {i} чел.")

    print(f"✅ Готово! Диспетчеры добавлены. Логины: dispatcher_1...50@ms21-avia.ru, Пароль: pass123")

if __name__ == "__main__":
    add_dispatchers()