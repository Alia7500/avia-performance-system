import random

import requests
import os
import time
import json
import sys
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone 

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

# 🔥 ВСЕ направления Аэрофлота
ALL_DESTINATIONS = {
    "AER": "Сочи (Адлер)",
    "LED": "Санкт-Петербург",
    "SVX": "Екатеринбург",
    "OVB": "Новосибирск",
    "KZN": "Казань",
    "KRR": "Краснодар",
    "UFA": "Уфа",
    "ROV": "Ростов-на-Дону",
    "VOG": "Волгоград",
    "SAM": "Самара",
    "VVO": "Владивосток",
    "KHV": "Хабаровск",
    "IKT": "Иркутск",
    "KJA": "Красноярск",
    "OMS": "Омск",
    "MRV": "Минеральные Воды",
    "STW": "Ставрополь",
    "ASF": "Астрахань",
    "MCX": "Махачкала",
    "SIP": "Симферополь",
    "PKC": "Петропавловск-Камчатский",
    "YKS": "Якутск",
    "UUS": "Южно-Сахалинск",
    "ABA": "Абакан",
    "BAX": "Барнаул",
    "KEJ": "Кемерово",
    "TOF": "Томск",
    "RGK": "Горно-Алтайск",
    "MMK": "Мурманск",
    "ARH": "Архангельск",
    "SCW": "Сыктывкар",
    "PES": "Петрозаводск",
    "PEE": "Пермь",
    "CEK": "Челябинск",
    "KUF": "Самара (Курумоч)",
    "REN": "Оренбург",
    "IJK": "Ижевск",
    "NBC": "Нижнекамск",
    "ULY": "Ульяновск",
    "NAL": "Нальчик",
    "OGZ": "Владикавказ",
    "GRV": "Грозный",
    "ESL": "Элиста",
    "BQS": "Благовещенск",
    "GDX": "Магадан",
    "DYR": "Анадырь",
    "HTA": "Чита",
    "UUD": "Улан-Удэ",
    "IAA": "Игарка",
    "VKO": "Москва (Внуково)",
    "DME": "Москва (Домодедово)",
    "TYA": "Кызыл",
}


def parse_timestamp(ts_string):
    """Конвертация строки времени в datetime-объект"""
    if not ts_string:
        return None
    try:
        ts_string = ts_string.replace('Z', '+00:00')
        return datetime.fromisoformat(ts_string)
    except ValueError:
        return ts_string


def get_real_flights(dest, date_from, date_to, departure="SVO"):
    """
    Получение рейсов из API Аэрофлота
    departure — аэропорт вылета (по умолчанию SVO)
    dest — аэропорт прибытия (или вылета для обратных рейсов)
    """
    url = "https://flights.aeroflot.ru/api/flights/1/ru/schedule"
    
    # 🔥 Определяем параметры в зависимости от направления
    if departure == "SVO":
        # Прямой рейс: SVO → dest
        params = {
            "departure": "SVO",
            "arrival": dest,
            "dateFrom": date_from,
            "dateTo": date_to,
            "connections": "0"
        }
    else:
        # Обратный рейс: dest → SVO
        params = {
            "departure": dest,
            "arrival": "SVO",
            "dateFrom": date_from,
            "dateTo": date_to,
            "connections": "0"
        }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ru-RU,ru;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://flights.aeroflot.ru/ru-ru/schedule"
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=15)
        if response.status_code != 200:
            return None
        
        data = response.json()
        flights_list = data if isinstance(data, list) else data.get('flights', data.get('data', []))
        
        return flights_list if flights_list else None
    except Exception as e:
        print(f"   💥 Ошибка: {e}")
        return None


def extract_flight_info(flight_data, requested_dest, is_outbound=True):
    """
    requested_dest — это код города (например, 'ABA')
    is_outbound — True, если летим ИЗ Москвы, False — если В Москву
    """
    try:
        f_id = flight_data.get('flightId', {})
        f_num = f"{f_id.get('carrier', 'SU')}{f_id.get('flightNumber')}"
        
        leg = flight_data.get('leg', {})
        
        # Определяем аэропорты на основе контекста запроса
        if is_outbound:
            dep_airport = "SVO"
            arr_airport = requested_dest
        else:
            dep_airport = requested_dest
            arr_airport = "SVO"

        # Достаем время (пробуем все варианты)
        dep_info = leg.get('departure', {}).get('times', {}).get('scheduledDeparture', {})
        arr_info = leg.get('arrival', {}).get('times', {}).get('scheduledArrival', {})
        
        dep_time_str = dep_info.get('local') or dep_info.get('utc') or leg.get('scheduledDepartureTime')
        arr_time_str = arr_info.get('local') or arr_info.get('utc') or leg.get('scheduledArrivalTime')
        
        dep_time = parse_timestamp(dep_time_str)
        arr_time = parse_timestamp(arr_time_str)

        if not all([f_num, dep_time, arr_time]):
            return None
        
        return {
            "flight_number": f_num,
            "departure_airport": dep_airport,
            "arrival_airport": arr_airport,
            "scheduled_departure": dep_time,
            "scheduled_arrival": arr_time,
            "status": "Запланирован"
        }
    except Exception:
        return None

def sync_single_destination(dest_code, dest_name, date_from, date_to, tails, aircraft_status):
    """Синхронизация направления с ПРАВИЛЬНЫМ распределением ВС и направлений"""
    print(f"\n{'='*70}")
    print(f"📍 СИНХРОНИЗАЦИЯ: SVO ⇄ {dest_code} ({dest_name})")
    print(f"{'='*70}")
    
    # 1. Запрашиваем данные у Аэрофлота
    outbound_raw = get_real_flights(dest_code, date_from, date_to, departure="SVO") or []
    inbound_raw = get_real_flights(dest_code, date_from, date_to, departure=dest_code) or []
    
    all_flights = []
    # Обрабатываем вылеты ИЗ Москвы
    for f in outbound_raw:
        info = extract_flight_info(f, dest_code, is_outbound=True)
        if info: all_flights.append(info)
    
    # Обрабатываем прилеты В Москву
    for f in inbound_raw:
        info = extract_flight_info(f, dest_code, is_outbound=False)
        if info: all_flights.append(info)
    
    if not all_flights:
        print("⚠️  Рейсов не найдено.")
        return 0, 0
    
    # Сортируем все рейсы (и туда, и обратно) по времени вылета
    all_flights.sort(key=lambda x: x['scheduled_departure'])
    
    inserted = 0
    errors = 0
    MIN_TURNOVER = timedelta(hours=2) # Минимум 2 часа между рейсами одного борта

    for i, flight in enumerate(all_flights, 1):
        dep_time = flight['scheduled_departure']
        dep_airport = flight['departure_airport']
        
        # Делаем времяaware (если оно еще не такое)
        if dep_time.tzinfo is None:
            dep_time = dep_time.replace(tzinfo=timezone(timedelta(hours=3)))

        assigned_tail = None
        
        # ЛОГИКА ДИСПЕТЧЕРА:
        # 1. Ищем борт, который стоит в нужном аэропорту и готов
        for tail in tails:
            status = aircraft_status[tail]
            if status['location'] == dep_airport and (status['available_at'] + MIN_TURNOVER) <= dep_time:
                assigned_tail = tail
                break
        
        # 2. Если такого нет, берем первый попавшийся свободный борт (условно "перегоняем")
        if not assigned_tail:
            for tail in tails:
                if (aircraft_status[tail]['available_at'] + timedelta(hours=4)) <= dep_time:
                    assigned_tail = tail
                    break

        if not assigned_tail:
            # Если все 170 самолетов заняты (маловероятно), берем случайный
            assigned_tail = random.choice(tails)

        # ОБНОВЛЯЕМ ГЛОБАЛЬНЫЙ СТАТУС БОРТА
        aircraft_status[assigned_tail] = {
            'available_at': flight['scheduled_arrival'],
            'location': flight['arrival_airport']
        }

        # СОХРАНЯЕМ В БАЗУ
        try:
            with engine.begin() as conn:
                conn.execute(text("""
                    INSERT INTO flights (
                        flight_number, departure_airport, arrival_airport,
                        scheduled_departure, scheduled_arrival, tail_number, status
                    )
                    VALUES (:num, :dep, :arr, :s_dep, :s_arr, :tail, :status)
                    ON CONFLICT (flight_number, scheduled_departure, departure_airport) 
                    DO UPDATE SET 
                        tail_number = EXCLUDED.tail_number,
                        arrival_airport = EXCLUDED.arrival_airport,
                        status = EXCLUDED.status
                """), {
                    "num": flight["flight_number"],
                    "dep": flight["departure_airport"],
                    "arr": flight["arrival_airport"],
                    "s_dep": flight["scheduled_departure"],
                    "s_arr": flight["scheduled_arrival"],
                    "tail": assigned_tail,
                    "status": flight["status"]
                })
                inserted += 1
                print(f"   ✅ {flight['flight_number']} ({flight['departure_airport']}->{flight['arrival_airport']}) → {assigned_tail}", end='\r')
        except Exception as e:
            errors += 1

    return inserted, errors

def main():
    """Главная функция с исправленной логикой выбора и диспетчеризации"""
    print("🚀 Парсер расписания Аэрофлота (МС-21-300)")
    print("="*70)
    
    # 1. Получаем самолёты из базы
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT tail_number FROM aircrafts 
            WHERE model = 'МС-21-300'
            ORDER BY tail_number
        """))
        tails = [r[0] for r in result.fetchall()]
    
    if not tails:
        print("❌ Нет доступных самолётов МС-21-300 в базе! Сначала создай флот.")
        return
    
    # 2. Инициализируем ГЛОБАЛЬНЫЙ статус самолётов (ОДИН РАЗ за запуск)
    moscow_tz = timezone(timedelta(hours=3))
    # Все самолёты в начале сезона стоят в Шереметьево
    aircraft_status = {
        tail: {
            'available_at': datetime(2026, 3, 8, 0, 0, tzinfo=moscow_tz),
            'location': 'SVO'
        }
        for tail in tails
    }
    
    print(f"✈️  Самолётов в строю: {len(tails)}")
    
    # 3. Настройки дат
    DATE_FROM = "2026-03-08T00:00:00"
    DATE_TO = "2026-10-25T23:59:59"
    
    # 4. Выводим список направлений для выбора
    print("\n📋 Доступные направления:")
    sorted_codes = sorted(ALL_DESTINATIONS.keys())
    for i, code in enumerate(sorted_codes, 1):
        print(f"  {i:2d}. {code:4s} — {ALL_DESTINATIONS[code]}")
    
    # 5. Спрашиваем пользователя (ВОТ ТУТ МЫ СОЗДАЕМ ПЕРЕМЕННУЮ choice)
    choice = input("\nВаш выбор (Код аэропорта или 'ALL'): ").strip().upper()
    
    # 6. Обрабатываем выбор
    if choice == 'ALL':
        total_ins = 0
        for code in sorted_codes:
            ins, err = sync_single_destination(code, ALL_DESTINATIONS[code], DATE_FROM, DATE_TO, tails, aircraft_status)
            total_ins += ins
            time.sleep(1) # Пауза чтобы не забанили
        print(f"\n🎉 Глобальная синхронизация завершена. Добавлено рейсов: {total_ins}")
        
    elif choice in ALL_DESTINATIONS:
        sync_single_destination(choice, ALL_DESTINATIONS[choice], DATE_FROM, DATE_TO, tails, aircraft_status)
        
    elif choice.isdigit():
        idx = int(choice) - 1
        if 0 <= idx < len(sorted_codes):
            code = sorted_codes[idx]
            sync_single_destination(code, ALL_DESTINATIONS[code], DATE_FROM, DATE_TO, tails, aircraft_status)
        else:
            print("❌ Неверный номер в списке")
    else:
        print(f"❌ Код '{choice}' не найден в списке направлений.")

if __name__ == "__main__":
    main()