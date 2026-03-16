import os
import sys
import uuid
import random
from datetime import datetime
from dotenv import load_dotenv

# --- МАГИЯ ПУТЕЙ ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)
sys.path.append(os.path.join(BASE_DIR, "backend"))

dotenv_path = os.path.join(BASE_DIR, '.env')
if not os.path.exists(dotenv_path):
    dotenv_path = os.path.join(BASE_DIR, "backend", ".env")
load_dotenv(dotenv_path)

from sqlalchemy import create_engine, text
try:
    from app.core import security
except ImportError:
    from backend.app.core import security

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Добавляем защиту от разрыва соединения (pool_pre_ping)
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"sslmode": "require"})

# --- ДАННЫЕ ДЛЯ ГЕНЕРАЦИИ ---
surnames_m =["Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов", "Михайлов", "Новиков", "Федоров", "Морозов", "Волков", "Алексеев", "Лебедев", "Семенов", "Егоров", "Павлов", "Козлов", "Степанов", "Николаев", "Орлов", "Андреев", "Макаров", "Никитин", "Захаров"]
surnames_f =[s + "а" if not s.endswith("ов") else s[:-2] + "ова" for s in surnames_m]

names_m =["Александр", "Сергей", "Дмитрий", "Алексей", "Андрей", "Максим", "Евгений", "Владимир", "Иван", "Михаил", "Николай", "Игорь", "Артем", "Денис", "Павел"]
names_f =["Мария", "Елена", "Ольга", "Наталья", "Екатерина", "Анна", "Татьяна", "Юлия", "Анастасия", "Ирина", "Светлана", "Виктория", "Дарья"]

patronymics_m =["Александрович", "Сергеевич", "Дмитриевич", "Алексеевич", "Андреевич", "Викторович", "Михайлович", "Николаевич", "Игоревич", "Владимирович"]
patronymics_f =["Александровна", "Сергеевна", "Дмитриевна", "Алексеевна", "Андреевна", "Викторовна", "Михайловна", "Николаевна", "Игоревна", "Владимировна"]

def generate_full_name(gender='m'):
    if gender == 'm': return random.choice(surnames_m), random.choice(names_m), random.choice(patronymics_m)
    return random.choice(surnames_f), random.choice(names_f), random.choice(patronymics_f)

def create_staff():
    print("🚀 Запуск процесса оформления штата авиакомпании...")
    
    # СУПЕР-ОПТИМИЗАЦИЯ: Хешируем пароль ОДИН РАЗ (это сэкономит нам 5 минут работы)
    print("🔐 Подготовка ключей шифрования...")
    admin_pwd = security.get_password_hash("admin123")
    common_pwd = security.get_password_hash("pass123")
    
    with engine.begin() as conn:
        print("--- Проверка ролей в системе...")
        conn.execute(text("INSERT INTO roles (role_name) VALUES ('administrator'), ('crew_member'), ('medical_worker'), ('dispatcher') ON CONFLICT DO NOTHING"))
        roles = {r[1]: r[0] for r in conn.execute(text("SELECT role_id, role_name FROM roles")).fetchall()}

        # 1. ТЫ (Валентина)
        val_id = '11111111-1111-1111-1111-111111111111'
        conn.execute(text("""
            INSERT INTO users (user_id, email, password_hash, first_name, last_name, patronymic, role_id, baseline_hr)
            VALUES (:id, 'valya@avia.ru', :pwd, 'Валентина', 'Жердяева', 'Сергеевна', :role, 75)
            ON CONFLICT (email) DO NOTHING
        """), {"id": val_id, "pwd": admin_pwd, "role": roles['administrator']})
        conn.execute(text("INSERT INTO flight_crew_members (user_id, position) VALUES (:id, 'Старший бортпроводник') ON CONFLICT DO NOTHING"), {"id": val_id})

        # 2. ГЕНЕРАЦИЯ 1200 ЧЕЛОВЕК ПАЧКАМИ
        print(f"--- Генерация 1200 сотрудников (загрузка пачками по 200)...")
        all_users = []
        crew_members =[]
        
        for i in range(1200):
            gender = 'm' if i < 500 else 'f'
            ln, fn, pn = generate_full_name(gender)
            
            if i < 300: r_name, pos = 'crew_member', ("КВС" if i < 150 else "Второй пилот")
            elif i < 1100: r_name, pos = 'crew_member', "Бортпроводник"
            else: r_name, pos = 'medical_worker', "Врач-терапевт"

            u_id = str(uuid.uuid4())
            email = f"staff_{i}@ms21-avia.ru"
            
            all_users.append({
                "id": u_id, "email": email, "pwd": common_pwd,
                "fn": fn, "ln": ln, "pn": pn, "role": roles[r_name], "hr": random.randint(62, 85)
            })

            if r_name == 'crew_member':
                crew_members.append({"id": u_id, "pos": pos})

            # Отправляем в базу пачкой каждые 200 человек, чтобы Neon не "поперхнулся"
            if len(all_users) >= 200:
                conn.execute(text("""
                    INSERT INTO users (user_id, email, password_hash, first_name, last_name, patronymic, role_id, baseline_hr)
                    VALUES (:id, :email, :pwd, :fn, :ln, :pn, :role, :hr)
                    ON CONFLICT DO NOTHING
                """), all_users)
                if crew_members:
                    conn.execute(text("INSERT INTO flight_crew_members (user_id, position) VALUES (:id, :pos) ON CONFLICT DO NOTHING"), crew_members)
                
                print(f"    ... загружено в базу {i + 1} чел.")
                all_users = []
                crew_members =[]
                        # 3. ДООТПРАВЛЯЕМ "ОСТАТКИ" (Тех, кто не влез в ровную пачку 200)
        if all_users:
            print("--- Отправка финального блока сотрудников...")
            conn.execute(text("""
                INSERT INTO users (user_id, email, password_hash, first_name, last_name, patronymic, role_id, baseline_hr)
                VALUES (:id, :email, :pwd, :fn, :ln, :pn, :role, :hr)
                ON CONFLICT DO NOTHING
            """), all_users)
            
        if crew_members:
            conn.execute(text("""
                INSERT INTO flight_crew_members (user_id, position) 
                VALUES (:id, :pos) 
                ON CONFLICT DO NOTHING
            """), crew_members)

    print(f"✅ База наполнена! В штате 1201 сотрудник.")

if __name__ == "__main__":
    create_staff()