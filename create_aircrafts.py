import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)
sys.path.append(os.path.join(BASE_DIR, "backend"))

dotenv_path = os.path.join(BASE_DIR, '.env')
if not os.path.exists(dotenv_path):
    dotenv_path = os.path.join(BASE_DIR, "backend", ".env")
load_dotenv(dotenv_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"sslmode": "require"})

def create_aircrafts():
    """Создание авиапарка МС-21-300 (170 самолётов)"""
    print("🚀 Создание авиапарка МС-21-300...")
    
    with engine.begin() as conn:
        # Удаляем старые самолеты (если есть)
        conn.execute(text("DELETE FROM aircrafts"))
        
        # МС-21 имеет регистрационные номера RA-73000, RA-73001, ... RA-73169
        aircrafts = []
        for i in range(170):
            tail = f"RA-{73000 + i}"
            aircrafts.append({
                "tail_number": tail,
                "model": "МС-21-300",
                "status": "Готов к вылету"
            })
        
        # Загружаем пачками
        for i in range(0, len(aircrafts), 50):
            batch = aircrafts[i:i+50]
            conn.execute(text("""
                INSERT INTO aircrafts (tail_number, model, status)
                VALUES (:tail_number, :model, :status)
                ON CONFLICT (tail_number) DO NOTHING
            """), batch)
            print(f"   ✅ Загружено {min(i+50, len(aircrafts))}/{len(aircrafts)} самолетов")
    
    print(f"✅ Авиапарк готов: {len(aircrafts)} самолетов МС-21-300")

if __name__ == "__main__":
    create_aircrafts()
