import os
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
engine = create_engine(
    os.getenv("DATABASE_URL"),
    pool_pre_ping=True, # Проверять живое ли соединение перед запросом
    connect_args={"sslmode": "require"}
)

MIN_REST_AFTER_FLIGHT = 12
MAX_FLIGHT_HOURS_28D = 90
VALYA_ID = '11111111-1111-1111-1111-111111111111'

def assign_crews_full_logic():
    print("✈️ Запуск системы управления ресурсами 'Аэрофлот-МС21'...")
    
    # 1. Загружаем сотрудников
    with engine.connect() as conn:
        crew_data = conn.execute(text("""
            SELECT u.user_id, fcm.position, u.baseline_hr,
            (SELECT performance_level FROM performance_analytics_log 
             WHERE crew_member_id = u.user_id 
             ORDER BY calculation_timestamp DESC LIMIT 1) as medical_status
            FROM users u
            JOIN flight_crew_members fcm ON u.user_id = fcm.user_id
        """)).fetchall()

        # 2. Инициализируем "Цифровые тени"
        moscow_tz = timezone(timedelta(hours=3))
        staff_states = {
            c.user_id: {
                'location': 'SVO',
                'available_at': datetime(2026, 3, 8, 0, 0, tzinfo=moscow_tz),
                'hours_28d': 0.0,
                'pos': c.position,
                'is_healthy': (c.medical_status != 'Critical')
            } for c in crew_data
        }

        # 3. Берем рейсы
        flights = conn.execute(text("""
            SELECT flight_id, flight_number, departure_airport, arrival_airport, 
                   scheduled_departure, scheduled_arrival 
            FROM flights 
            WHERE flight_id NOT IN (SELECT flight_id FROM flight_assignments)
            ORDER BY scheduled_departure ASC
        """)).fetchall()

    print(f"📋 План на обработку: {len(flights)} рейсов.")
    assigned_count = 0

    # 4. Обрабатываем рейсы по одному
    for f in flights:
        duration = (f.scheduled_arrival - f.scheduled_departure).total_seconds() / 3600
        
        def is_eligible(uid):
            s = staff_states[uid]
            return (s['is_healthy'] and s['location'] == f.departure_airport and 
                    s['available_at'] <= f.scheduled_departure and
                    s['hours_28d'] + duration <= MAX_FLIGHT_HOURS_28D)

        eligible_ids = [uid for uid in staff_states if is_eligible(uid)]
        eligible_kvs = [uid for uid in eligible_ids if staff_states[uid]['pos'] == 'КВС']
        eligible_pilots = [uid for uid in eligible_ids if staff_states[uid]['pos'] == 'Второй пилот']
        eligible_attendants = [uid for uid in eligible_ids if 'Бортпроводник' in staff_states[uid]['pos']]

        if len(eligible_kvs) >= 1 and len(eligible_pilots) >= 1 and len(eligible_attendants) >= 6:
            selected = []
            selected.append((random.choice(eligible_kvs), "КВС"))
            selected.append((random.choice(eligible_pilots), "Второй пилот"))
            
            # Твоя логика (Валентина)
            if VALYA_ID in eligible_attendants:
                selected.append((VALYA_ID, "Старший бортпроводник"))
                others = random.sample([u for u in eligible_attendants if u != VALYA_ID], 5)
                for uid in others: selected.append((uid, "Бортпроводник"))
            else:
                att_sample = random.sample(eligible_attendants, 6)
                selected.append((att_sample[0], "Старший бортпроводник"))
                for uid in att_sample[1:]: selected.append((uid, "Бортпроводник"))

            # ЗАПИСЬ В БАЗУ (делаем COMMIT после каждого рейса для надежности)
            try:
                with engine.connect() as conn:
                    with conn.begin(): # Авто-коммит для одного рейса
                        for uid, role in selected:
                            conn.execute(text("""
                                INSERT INTO flight_assignments (flight_id, crew_member_id, role_on_board)
                                VALUES (:f_id, :u_id, :role)
                            """), {"f_id": f.flight_id, "u_id": uid, "role": role})
                            
                            # Обновляем память скрипта
                            staff_states[uid]['location'] = f.arrival_airport
                            staff_states[uid]['available_at'] = f.scheduled_arrival + timedelta(hours=MIN_REST_AFTER_FLIGHT)
                            staff_states[uid]['hours_28d'] += duration

                assigned_count += 1
                if assigned_count % 10 == 0:
                    print(f"   ✅ Скомплектовано {assigned_count} рейсов из {len(flights)}...", end='\r')
            except Exception as e:
                print(f"\n⚠️ Ошибка на рейсе {f.flight_number}: {e}. Пробую следующий...")
                continue

    print(f"\n🏁 Итог: {assigned_count} рейсов укомплектовано.")

if __name__ == "__main__":
    assign_crews_full_logic()