import asyncio
import requests
from bleak import BleakScanner, BleakClient

# UUID из приложения Android Studio
SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb"
CHAR_UUID = "00002a37-0000-1000-8000-00805f9b34fb"
# Адрес твоего сервера!
API_URL = "https://api.avia-evm-web-app-ru.ru/crew/upload-telemetry-direct"

async def run():
    print("🔎 Ищем бортовое устройство (Galaxy Watch 4)...")
    devices = await BleakScanner.discover(timeout=10.0)
    target_device = None
    
    for d in devices:
        # Проверяем имя устройства или наличие нужного сервиса
        if d.name and "SM-R860" in d.name:
            target_device = d
            break

    if not target_device:
        print("❌ Часы не найдены. Убедитесь, что приложение на часах АКТИВНО.")
        return

    print(f"✅ Найдено: {target_device.name} [{target_device.address}]")
    print("🔄 Установка связи ACARS...")

    async with BleakClient(target_device) as client:
        print("🟢 Подключено! Канал ACARS активен.")

        def handle_telemetry(sender, data):
            try:
                # Декодируем строку "HR;SpO2;Stress"
                decoded = data.decode('utf-8').split(';')
                payload = {
                    "heart_rate": int(decoded[0]),
                    "spo2": int(decoded[1]),
                    "stress": int(decoded[2])
                }
                # Отправляем на сервер ЦУП
                res = requests.post(API_URL, json=payload, timeout=3)
                if res.status_code == 200:
                    print(f"📡 [ACARS TX] -> ЧСС: {payload['heart_rate']} | SpO2: {payload['spo2']}% | ЦУП: Доставлено")
            except Exception as e:
                print(f"⚠️ Ошибка пакета: {e}")

        # Подписываемся на обновления пульса
        await client.start_notify(CHAR_UUID, handle_telemetry)
        
        print("⏳ Ожидание телеметрии... (Нажмите Ctrl+C для остановки)")
        while True:
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(run())