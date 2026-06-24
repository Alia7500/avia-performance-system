import os
import re
import subprocess
import sys
import time

import requests

# Буква r перед строкой обязательна для Windows-пути.
ADB_PATH = r"C:\Users\Valentina\AppData\Local\Android\Sdk\platform-tools\adb.exe"
API_URL = "https://api.avia-evm-web-app-ru.ru/crew/upload-telemetry-direct"

# Строка с часов приходит так: 75;98;20 = ЧСС;SpO2;стресс
ACARS_RE = re.compile(r"(?P<hr>\d{2,3});(?P<spo2>\d{2,3});(?P<stress>\d{1,3})")

MAX_RETRIES = 3
RETRY_DELAY = 2  # секунды между попытками


def run(cmd, **kwargs):
    return subprocess.run(cmd, text=True, capture_output=True, **kwargs)


def check_adb():
    if not os.path.exists(ADB_PATH):
        print(f"❌ ADB не найден: {ADB_PATH}")
        return False

    res = run([ADB_PATH, "devices"])
    print(res.stdout.strip())
    connected = [line for line in res.stdout.splitlines() if "\tdevice" in line]
    if not connected:
        print("❌ Часы не видны как ADB device. Проверь Wi‑Fi debugging / pairing / кабель.")
        return False
    return True


def send_to_server(payload: dict) -> bool:
    
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            res = requests.post(API_URL, json=payload, timeout=5)
            if res.ok:
                print(
                    f"📡 [ACARS TX] -> ЧСС: {payload['heart_rate']} | "
                    f"SpO2: {payload['spo2']}% | stress: {payload['stress']} | ЦУП: OK"
                )
                return True

            print(f"⚠️  Сервер ответил {res.status_code}: {res.text[:300]}")
            # При 4xx (ошибка запроса) повтор не поможет — выходим сразу
            if 400 <= res.status_code < 500:
                return False

        except requests.ConnectionError as e:
            print(f"⚠️  Попытка {attempt}/{MAX_RETRIES}: нет соединения — {e}")
        except requests.Timeout:
            print(f"⚠️  Попытка {attempt}/{MAX_RETRIES}: таймаут")
        except requests.RequestException as e:
            print(f"❌ Не удалось отправить на сервер: {e}")
            return False

        if attempt < MAX_RETRIES:
            time.sleep(RETRY_DELAY)

    print("❌ Все попытки исчерпаны, пакет потерян")
    return False


def run_adb_bridge():
    print("🚀 Запуск системы имитации ACARS через ADB-шлюз...")
    if not check_adb():
        return

    print(f"📡 Канал связи установлен. Использую: {ADB_PATH}")
    print("🧹 Очистка старых данных...")
    run([ADB_PATH, "logcat", "-c"])

    # Показываем только наши теги.
    # MC21_DEBUG — видно старт сервиса и ход запроса разрешений.
    adb_command = [
        ADB_PATH,
        "logcat",
        "-v", "brief",
        "MC21_ACARS:D",
        "MC21_DEBUG:D",
        "MC21_ERROR:E",
        "*:S",
    ]

    print("🟢 ПРИЕМ ДАННЫХ АКТИВИРОВАН. Ожидаю сигнал с борта...")
    process = None

    try:
        process = subprocess.Popen(
            adb_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )

        for raw_line in process.stdout:
            line = raw_line.strip()
            if not line:
                continue

            # Выводим отладочные строки сервиса
            if "MC21_DEBUG" in line or "MC21_ERROR" in line:
                print(f"⌚ {line}")

            match = ACARS_RE.search(line)
            if not match:
                continue

            payload = {
                "heart_rate": int(match.group("hr")),
                "spo2": int(match.group("spo2")),
                "stress": int(match.group("stress")),
            }
            send_to_server(payload)

    except KeyboardInterrupt:
        print("\n🛑 Остановлено пользователем")
    except Exception as e:
        print(f"❌ Ошибка ADB-шлюза: {e}")
    finally:
        if process:
            process.terminate()
            process.wait() 


if __name__ == "__main__":
    try:
        run_adb_bridge()
    except Exception as exc:
        print(f"❌ Фатальная ошибка: {exc}")
        sys.exit(1)