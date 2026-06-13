import uuid
from sqlalchemy import create_engine, text

# Подключение к БД
engine = create_engine("postgresql://postgres:postgres@localhost:5432/flying_db")

def apply_smart_roster():
    with engine.begin() as conn:
        print("🔍 Собираем эталонные составы из майской недели (12.03 - 12.05)...")
        
        # 1. Получаем карту: flight_number -> список (user_id, role)
        template_query = text("""
            SELECT f.flight_number, fa.crew_member_id, fa.role_on_board
            FROM flights f
            JOIN flight_assignments fa ON f.flight_id = fa.flight_id
            WHERE f.scheduled_departure >= '2026-03-12' AND f.scheduled_departure <= '2026-05-12'
        """)
        
        templates = {}
        for row in conn.execute(template_query):
            f_num, u_id, role = row
            if f_num not in templates:
                templates[f_num] = []
            templates[f_num].append((u_id, role))
            
        print(f"✅ Собрано шаблонов для {len(templates)} уникальных номеров рейсов.")

        # 2. Находим все рейсы без экипажа начиная с 13 мая
        print("✈️ Ищем рейсы для заполнения...")
        target_flights = conn.execute(text("""
            SELECT flight_id, flight_number 
            FROM flights 
            WHERE scheduled_departure >= '2026-05-13'
              AND flight_id NOT IN (SELECT flight_id FROM flight_assignments)
        """)).fetchall()

        new_assignments = []
        assigned_count = 0
        fallback_count = 0

        # Получаем запасной пул пользователей на случай, если номера рейса нет в шаблоне
        all_users = [r[0] for r in conn.execute(text("SELECT user_id FROM users LIMIT 100")).fetchall()]

        for f_id, f_num in target_flights:
            if f_num in templates:
                # Копируем состав из шаблона
                for u_id, role in templates[f_num]:
                    new_assignments.append({
                        "id": str(uuid.uuid4()),
                        "f_id": f_id,
                        "u_id": u_id,
                        "role": role
                    })
                assigned_count += 1
            else:
                # Если такого номера рейса раньше не было, назначаем рандомно (фолбэк)
                import random
                crew = random.sample(all_users, 5)
                roles = ['КВС', 'Второй пилот', 'Старший бортпроводник', 'Бортпроводник', 'Бортпроводник']
                for i in range(5):
                    new_assignments.append({
                        "id": str(uuid.uuid4()),
                        "f_id": f_id,
                        "u_id": crew[i],
                        "role": roles[i]
                    })
                fallback_count += 1

            # Вставка пачками
            if len(new_assignments) >= 2000:
                conn.execute(text("""
                    INSERT INTO flight_assignments (assignment_id, flight_id, crew_member_id, role_on_board)
                    VALUES (:id, :f_id, :u_id, :role)
                """), new_assignments)
                new_assignments = []

        if new_assignments:
            conn.execute(text("""
                INSERT INTO flight_assignments (assignment_id, flight_id, crew_member_id, role_on_board)
                VALUES (:id, :f_id, :u_id, :role)
            """), new_assignments)

        print(f"🎉 Готово!")
        print(f"📊 По шаблону назначено: {assigned_count} рейсов.")
        print(f"🎲 Рандомно (новые рейсы): {fallback_count} рейсов.")

if __name__ == "__main__":
    apply_smart_roster()