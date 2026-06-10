import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, text

# Твои доступы к локальной БД PostgreSQL
DB_URL = "postgresql://postgres:postgres@localhost:5432/flying_db"
engine = create_engine(DB_URL)

# Временные рамки: от последней записи до нужного конца
START_TIME = datetime(2026, 3, 16, 17, 36, 47, tzinfo=timezone.utc)
END_TIME = datetime(2026, 6, 12, 23, 59, 0, tzinfo=timezone.utc)

def run_backfill():
    print(f"🚀 Запуск восстановления данных с {START_TIME} по {END_TIME}...")
    
    with engine.begin() as conn:
        # 1. Ищем все рейсы, которые пересекаются с нашим "окном простоя"
        flights = conn.execute(text("""
            SELECT flight_id, 
                   scheduled_departure + (COALESCE(delay_minutes, 0) * interval '1 minute') as start_fly,
                   scheduled_arrival as end_fly,
                   status
            FROM flights
            WHERE scheduled_arrival >= :start_time 
              AND (scheduled_departure + (COALESCE(delay_minutes, 0) * interval '1 minute')) <= :end_time
        """), {"start_time": START_TIME, "end_time": END_TIME}).fetchall()

        print(f"✈️ Найдено рейсов для обработки: {len(flights)}")
        
        telemetry_to_insert = []
        
        for flight in flights:
            flight_id = flight.flight_id
            
            # Защита от потери таймзоны при чтении из БД
            flight_start = flight.start_fly if flight.start_fly.tzinfo else flight.start_fly.replace(tzinfo=timezone.utc)
            flight_end = flight.end_fly if flight.end_fly.tzinfo else flight.end_fly.replace(tzinfo=timezone.utc)
            
            # Обрезаем рамки генерации, чтобы не дублировать то, что уже было до 13 мая
            sim_start = max(flight_start, START_TIME)
            sim_end = min(flight_end, END_TIME)
            
            if sim_start >= sim_end:
                continue 
                
            # Получаем экипаж этого рейса
            crew = conn.execute(text("""
                SELECT u.user_id, u.baseline_hr 
                FROM users u 
                JOIN flight_assignments fa ON u.user_id = fa.crew_member_id 
                WHERE fa.flight_id = :f_id
            """), {"f_id": flight_id}).fetchall()
            
            if not crew:
                continue
                
            # Генерируем точки с шагом в 2 минуты
            current_time = sim_start
            while current_time <= sim_end:
                for member in crew:
                    # Логика 1 в 1 как в твоем бэкенде
                    hr = member.baseline_hr + random.randint(-5, 15)
                    stress = random.randint(10, 40)
                    spo2 = random.randint(95, 99)
                    sys_bp = random.randint(110, 130)
                    dia_bp = random.randint(70, 85)
                    temp = round(random.uniform(36.4, 37.0), 1)
                    bp = f"{sys_bp}/{dia_bp}"
                    
                    perf = max(0, 100 - (abs(hr - member.baseline_hr) * 1.5) - (stress / 4))
                    
                    telemetry_to_insert.append({
                        "flight_id": flight_id,
                        "crew_member_id": member.user_id,
                        "heart_rate": hr,
                        "spo2": spo2,
                        "blood_pressure": bp,
                        "temperature": temp,
                        "stress_level": stress,
                        "performance_score": perf,
                        "record_timestamp": current_time
                    })
                
                current_time += timedelta(minutes=2)

        print(f"📊 Сгенерировано строк телеметрии: {len(telemetry_to_insert)}")
        print("💾 Начинаем пакетную вставку в БД (это займет несколько секунд)...")
        
        # Пакетная вставка, чтобы не перегружать память (кусками по 5000 записей)
        chunk_size = 5000
        for i in range(0, len(telemetry_to_insert), chunk_size):
            chunk = telemetry_to_insert[i:i+chunk_size]
            conn.execute(text("""
                INSERT INTO flight_telemetry 
                (flight_id, crew_member_id, heart_rate, spo2, blood_pressure, temperature, stress_level, performance_score, record_timestamp)
                VALUES (:flight_id, :crew_member_id, :heart_rate, :spo2, :blood_pressure, :temperature, :stress_level, :performance_score, :record_timestamp)
            """), chunk)
            
        print("✅ Вставка телеметрии завершена.")
            
        # 2. Восстанавливаем справедливые статусы рейсов
        print("🔄 Обновление статусов рейсов...")
        
        # Ставим "Завершён" всем, кто приземлился к 12 июня
        conn.execute(text("""
            UPDATE flights 
            SET status = 'Завершён',
                actual_departure = COALESCE(actual_departure, scheduled_departure)
            WHERE scheduled_arrival <= :end_time 
              AND status != 'Завершён'
        """), {"end_time": END_TIME})
        
        # Ставим "В полёте" тем, кто вылетел, но еще не сел на момент 12 июня
        conn.execute(text("""
            UPDATE flights 
            SET status = 'В полёте', 
                actual_departure = COALESCE(actual_departure, scheduled_departure) 
            WHERE (scheduled_departure + (COALESCE(delay_minutes, 0) * interval '1 minute')) <= :end_time
              AND scheduled_arrival > :end_time
              AND status NOT IN ('Завершён', 'В полёте')
        """), {"end_time": END_TIME})

if __name__ == "__main__":
    try:
        run_backfill()
        print("🎉 УРА! База данных успешно восполнена!")
    except Exception as e:
        print(f"❌ Ошибка во время выполнения: {e}")