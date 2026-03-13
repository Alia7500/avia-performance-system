import os
import sys
import uuid
import random
from datetime import datetime
from dotenv import load_dotenv

# --- МАГИЯ ПУТЕЙ (Чтобы Python всё увидел) ---
# Находим путь к папке, где лежит этот файл
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Добавляем в систему поиска саму папку и папку backend
sys.path.append(BASE_DIR)
sys.path.append(os.path.join(BASE_DIR, "backend"))

# Теперь загружаем настройки
dotenv_path = os.path.join(BASE_DIR, '.env')
if not os.path.exists(dotenv_path):
    dotenv_path = os.path.join(BASE_DIR, "backend", ".env")
load_dotenv(dotenv_path)

# --- ИМПОРТЫ ПОСЛЕ НАСТРОЙКИ ПУТЕЙ ---
from sqlalchemy import create_engine, text
try:
    from app.core import security
except ImportError:
    # Если запуск идет изнутри папки backend
    from backend.app.core import security

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

# --- ДАННЫЕ ДЛЯ ГЕНЕРАЦИИ ---
surnames_m = ["Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов", "Михайлов", "Новиков", "Федоров", "Морозов", "Волков", "Алексеев", "Лебедев", "Семенов", "Егоров", "Павлов", "Козлов", "Степанов", "Николаев", "Орлов", "Андреев", "Макаров", "Никитин", "Захаров"]
surnames_f = [s + "а" if not s.endswith("ов") else s[:-2] + "ова" for s in surnames_m]

names_m = ["Александр", "Сергей", "Дмитрий", "Алексей", "Андрей", "Максим", "Евгений", "Владимир", "Иван", "Михаил", "Николай", "Игорь", "Артем", "Денис", "Павел"]
names_f = ["Мария", "Елена", "Ольга", "Наталья", "Екатерина", "Анна", "Татьяна", "Юлия", "Анастасия", "Ирина", "Светлана", "Виктория", "Дарья"]

patronymics_m = ["Александрович", "Сергеевич", "Дмитриевич", "Алексеевич", "Андреевич", "Викторович", "Михайлович", "Николаевич", "Игоревич", "Владимирович"]
patronymics_f = ["Александровна", "Сергеевна", "Дмитриевна", "Алексеевна", "Андреевна", "Викторовна", "Михайловна", "Николаевна", "Игоревна", "Владимировна"]

def generate_full_name(gender='m'):
    if gender == 'm':
        return random.choice(surnames_m), random.choice(names_m), random.choice(patronymics_m)
    return random.choice(surnames_f), random.choice(names_f), random.choice(patronymics_f)

def create_staff():
    print("🚀 Запуск процесса оформления штата авиакомпании...")
    
    with engine.begin() as conn:
        # 1. Проверяем/создаем роли (обязательно для внешних ключей)
        print("--- Проверка ролей в системе...")
        conn.execute(text("INSERT INTO roles (role_name) VALUES ('administrator'), ('crew_member'), ('medical_worker'), ('dispatcher') ON CONFLICT DO NOTHING"))
        
        roles = {r[1]: r[0] for r in conn.execute(text("SELECT role_id, role_name FROM roles")).fetchall()}

        # 2. ТЫ (Валентина)
        val_id = '11111111-1111-1111-1111-111111111111'
        conn.execute(text("""
            INSERT INTO users (user_id, email, password_hash, first_name, last_name, patronymic, role_id, baseline_hr)
            VALUES (:id, 'valya@avia.ru', :pwd, 'Валентина', 'Жердева', 'Александровна', :role, 75)
            ON CONFLICT (email) DO NOTHING
        """), {
            "id": val_id, "pwd": security.get_password_hash("admin123"),
            "role": roles['administrator'],
        })
        conn.execute(text("INSERT INTO flight_crew_members (user_id, position) VALUES (:id, 'Старший бортпроводник') ON CONFLICT DO NOTHING"), {"id": val_id})

        # 3. ГЕНЕРАЦИЯ 1200 ЧЕЛОВЕК
        print(f"--- Генерация 1200 сотрудников...")
        for i in range(1200):
            gender = 'm' if i < 500 else 'f'
            ln, fn, pn = generate_full_name(gender)
            
            # Распределение: 300 пилотов, 800 бортпроводников, 100 медиков
            if i < 300:
                r_name, pos = 'crew_member', ("КВС" if i < 150 else "Второй пилот")
            elif i < 1100:
                r_name, pos = 'crew_member', "Бортпроводник"
            else:
                r_name, pos = 'medical_worker', "Врач-терапевт"

            u_id = str(uuid.uuid4())
            email = f"staff_{i}@ms21-avia.ru"
            
            conn.execute(text("""
                INSERT INTO users (user_id, email, password_hash, first_name, last_name, patronymic, role_id, baseline_hr)
                VALUES (:id, :email, :pwd, :fn, :ln, :pn, :role, :hr)
            """), {
                "id": u_id, "email": email, "pwd": security.get_password_hash("pass123"),
                "fn": fn, "ln": ln, "pn": pn, "role": roles[r_name], "hr": random.randint(62, 85)
            })

            if r_name == 'crew_member':
                conn.execute(text("INSERT INTO flight_crew_members (user_id, position) VALUES (:id, :pos)"), {"id": u_id, "pos": pos})

            if i % 200 == 0:
                print(f"    ... оформлено {i} чел.")

    print(f"✅ Готово! Штат из 1201 сотрудника внесен в базу данных.")

if __name__ == "__main__":
    create_staff()