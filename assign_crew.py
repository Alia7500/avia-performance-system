import uuid
import random
from sqlalchemy import create_engine, text

DB_URL = "postgresql://postgres:postgres@localhost:5432/flying_db"
engine = create_engine(DB_URL)

def assign_crew_to_empty_flights():
    with engine.begin() as conn:
        # 1. Находим все рейсы с 20 мая по 12 июня, у которых НЕТ экипажа
        flights = conn.execute(text("""
            SELECT flight_id, flight_number 
            FROM flights 
            WHERE scheduled_departure >= '2026-03-16 00:00:00+00' 
              AND scheduled_departure <= '2026-10-25 23:59:59+00'
              AND flight_id NOT IN (SELECT flight_id FROM flight_assignments)
        """)).fetchall()

        if not flights:
            print("✅ Все рейсы в этом периоде уже имеют назначенный экипаж!")
            return

        print(f"✈️ Найдено рейсов БЕЗ экипажа: {len(flights)}")

        # 2. Получаем наших сотрудников
        crew_list = conn.execute(text("""
            SELECT u.user_id, fcm.position
            FROM users u
            JOIN flight_crew_members fcm ON u.user_id = fcm.user_id
        """)).fetchall()

        if not crew_list:
            print("❌ ОШИБКА: В базе нет летного состава в таблице flight_crew_members!")
            return

        # Сортируем по ролям (если должности называются чуть иначе, поправь названия)
        captains = [c.user_id for c in crew_list if c.position == 'КВС']
        copilots = [c.user_id for c in crew_list if c.position == 'Второй пилот']
        attendants = [c.user_id for c in crew_list if c.position == 'Бортпроводник']

        # Фолбэк на случай, если позиции в БД названы по-другому, возьмем всех подряд
        if not captains: captains = [c.user_id for c in crew_list]
        if not copilots: copilots = [c.user_id for c in crew_list]
        if not attendants: attendants = [c.user_id for c in crew_list]

        assignments_to_insert = []

        # 3. Назначаем состав на рейсы
        for f in flights:
            assigned_crew = []
            
            # КВС и Второй пилот
            assigned_crew.append((random.choice(captains), 'КВС'))
            assigned_crew.append((random.choice(copilots), 'Второй пилот'))
            
            # Три бортпроводника (уникальных)
            num_attendants = min(3, len(set(attendants)))
            chosen_attendants = random.sample(list(set(attendants)), num_attendants)
            for a in chosen_attendants:
                assigned_crew.append((a, 'Старший бортпроводник' if a == chosen_attendants[0] else 'Бортпроводник'))

            for member_id, role in assigned_crew:
                assignments_to_insert.append({
                    "assignment_id": str(uuid.uuid4()),
                    "flight_id": f.flight_id,
                    "crew_member_id": member_id,
                    "role_on_board": role
                })

        # 4. Сохраняем в БД
        print(f"👥 Генерируем {len(assignments_to_insert)} назначений (flight_assignments)...")
        
        chunk_size = 5000
        for i in range(0, len(assignments_to_insert), chunk_size):
            chunk = assignments_to_insert[i:i+chunk_size]
            conn.execute(text("""
                INSERT INTO flight_assignments (assignment_id, flight_id, crew_member_id, role_on_board)
                VALUES (:assignment_id, :flight_id, :crew_member_id, :role_on_board)
            """), chunk)

        print("✅ Экипажи успешно рассажены по рейсам!")

if __name__ == "__main__":
    assign_crew_to_empty_flights()