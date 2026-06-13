import asyncio
import requests
from bleak import BleakScanner, BleakClient

# UUID из кода часов
CHAR_UUID = "00002a37-0000-1000-8000-00805f9b34fb"
API_URL = "https://api.avia-evm-web-app-ru.ru/crew/upload-telemetry-direct" # Создадим этот эндпоинт

async def run_bridge():
    print("🔎 Поиск часов МС-21...")
    devices = await BleakScanner.discover()
    target = None
    for d in devices:
        if d.name and "SM-R860" in d.name: # Твои Galaxy Watch 4
            target = d
            break

    if not target:
        print("❌ Часы не найдены")
        return

    async with BleakClient(target) as client:
        print(f"✅ Подключено к бортовому устройству {target.name}")

        def notification_handler(sender, data):
            # Распаковываем данные (HR;SpO2;STRESS)
            decoded = data.decode('utf-8').split(';')
            payload = {
                "heart_rate": int(decoded[0]),
                "spo2": int(decoded[1]),
                "stress": int(decoded[2])
            }
            # Отправляем на сервер по "ACARS" (HTTP POST)
            try:
                requests.post(API_URL, json=payload, timeout=2)
                print(f"📡 ACARS: Передано -> HR: {payload['heart_rate']} SpO2: {payload['spo2']}")
            except:
                print("⚠️ Ошибка связи с ЦУП")

        await client.start_notify(CHAR_UUID, notification_handler)
        while True:
            await asyncio.sleep(1)

asyncio.run(run_bridge())