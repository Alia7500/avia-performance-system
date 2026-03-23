# fix_all_flights.py
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from collections import defaultdict

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

DESTINATIONS = {
    "AER", "LED", "SVX", "OVB", "KZN", "KRR", "UFA", "ROV", "VOG", "SAM",
    "VVO", "KHV", "IKT", "KJA", "OMS", "MRV", "STW", "ASF", "MCX", "SIP",
    "PKC", "YKS", "UUS", "ABA", "BAX", "KEJ", "TOF", "RGK", "MMK", "ARH",
    "SCW", "PES", "PEE", "CEK", "KUF", "REN", "IJK", "NBC", "ULY", "NAL",
    "OGZ", "GRV", "ESL", "BQS", "GDX", "DYR", "HTA", "UUD", "IAA",
    "VKO", "DME", "TYA"
}

def fix_flights(dry_run=True):
    print(f"{'🧪 АНАЛИЗ' if dry_run else '🔧 ИСПРАВЛЕНИЕ'} рейсов...")
    print("="*80)
    
    with engine.begin() as conn:
        # Получаем ВСЕ рейсы с направлениями
        result = conn.execute(text("""
            SELECT flight_id, flight_number, departure_airport, arrival_airport, 
                   scheduled_departure, scheduled_arrival
            FROM flights 
            WHERE status = 'Запланирован'
              AND (
                  (departure_airport = 'SVO' AND arrival_airport IN :dests)
                  OR 
                  (arrival_airport = 'SVO' AND departure_airport IN :dests)
              )
            ORDER BY arrival_airport, scheduled_departure
        """), {"dests": tuple(DESTINATIONS)})
        
        flights = result.fetchall()
        
        if not flights:
            print("❌ Рейсов не найдено!")
            return
        
        # Группируем рейсы по городам
        by_city = defaultdict(list)
        for fid, fnum, dep, arr, s_dep, s_arr in flights:
            # Определяем город (не SVO)
            city = arr if dep == 'SVO' else dep
            by_city[city].append({
                'id': fid,
                'number': fnum,
                'dep': dep,
                'arr': arr,
                's_dep': s_dep,
                's_arr': s_arr
            })
        
        print(f"\n📊 Найдено городов: {len(by_city)}")
        print(f"📊 Всего рейсов: {len(flights)}\n")
        
        corrected = 0
        
        # Для каждого города: чередуем направления
        for city, city_flights in sorted(by_city.items()):
            print(f"\n📍 {city}: {len(city_flights)} рейсов")
            
            # Сортируем по времени вылета
            city_flights.sort(key=lambda x: x['s_dep'])
            
            for i, flight in enumerate(city_flights):
                # ЧЕТНЫЕ индексы (0, 2, 4...) — ИЗ Москвы
                # НЕЧЕТНЫЕ (1, 3, 5...) — В Москву
                should_be_outbound = (i % 2 == 0)
                
                current_dep = flight['dep']
                current_arr = flight['arr']
                is_outbound = (current_dep == 'SVO')
                
                # Если направление не совпадает с ожидаемым — исправляем
                if should_be_outbound != is_outbound:
                    new_dep = 'SVO' if should_be_outbound else city
                    new_arr = city if should_be_outbound else 'SVO'
                    
                    if dry_run:
                        print(f"   ⚠️  {flight['number']}: {current_dep}→{current_arr} "
                              f"⇒ {new_dep}→{new_arr} [{flight['s_dep'].strftime('%m-%d %H:%M')}]")
                    else:
                        try:
                            conn.execute(text("""
                                UPDATE flights 
                                SET departure_airport = :new_dep,
                                    arrival_airport = :new_arr
                                WHERE flight_id = :fid
                            """), {
                                "new_dep": new_dep,
                                "new_arr": new_arr,
                                "fid": flight['id']
                            })
                            print(f"   ✅ {flight['number']}: {current_dep}→{current_arr} "
                                  f"⇒ {new_dep}→{new_arr}")
                            corrected += 1
                        except Exception as e:
                            print(f"   ❌ Ошибка {flight['number']}: {e}")
                else:
                    if not dry_run:
                        print(f"   ✓ {flight['number']}: {current_dep}→{current_arr} (уже верно)")
        
        print(f"\n{'='*80}")
        print(f"📊 Результат: {'найдено кандидатов' if dry_run else 'исправлено'}: {corrected}")
        if dry_run and corrected > 0:
            print("💡 Запустите `python fix_all_flights.py --apply` для применения")
        elif dry_run:
            print("✅ Все рейсы уже сбалансированы!")

if __name__ == "__main__":
    import sys
    
    dry_run = True
    if len(sys.argv) > 1 and sys.argv[1].lower() in ('--apply', 'apply'):
        dry_run = False
        print("\n⚠️  ВНИМАНИЕ: будут изменены направления рейсов!")
        confirm = input("Введите 'yes' для подтверждения: ").strip().lower()
        if confirm != 'yes':
            print("❌ Отменено")
            sys.exit(0)
    
    fix_flights(dry_run=dry_run)