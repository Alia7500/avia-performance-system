import pandas as pd
import io
from datetime import datetime

def analyze_crew_health(file_content: bytes, file_name: str = "data.csv"):
    """
    Универсальный анализатор данных экипажа (Пульс, Шаги, Кислород).
    """
    try:
        # Пробуем читать CSV (пропускаем 1 строку для Samsung Health)
        try:
            df = pd.read_csv(io.BytesIO(file_content), skiprows=1)
            if df.columns.size < 2: # Если колонок слишком мало, пробуем без пропуска
                df = pd.read_csv(io.BytesIO(file_content))
        except:
            df = pd.read_csv(io.BytesIO(file_content))

        # 1. Если это ПУЛЬС (heart_rate)
        hr_col = 'com.samsung.health.heart_rate.heart_rate'
        if hr_col in df.columns:
            val = df[hr_col].dropna().iloc[0]
            status = "Normal" if 55 <= val <= 95 else "Warning"
            return {"metric": "Heart Rate", "value": float(val), "status": status, "readiness": 0.95 if status == "Normal" else 0.7}

        # 2. Если это ШАГОМЕР (steps)
        if 'step_count' in df.columns:
            val = df['step_count'].dropna().iloc[0]
            readiness = 1.0 - (val / 20000) # Усталость от шагов
            return {"metric": "Activity Steps", "value": int(val), "status": "OK", "readiness": max(0.1, readiness)}

        # 3. Если это КИСЛОРОД (SpO2)
        spo2_col = 'com.samsung.health.oxygen_saturation.spo2'
        if spo2_col in df.columns:
            val = df[spo2_col].dropna().iloc[0]
            return {"metric": "Oxygen (SpO2)", "value": float(val), "status": "Optimal" if val >= 95 else "Low", "readiness": 1.0 if val >= 95 else 0.5}

        return {"error": f"Формат файла {file_name} не распознан или пуст"}

    except Exception as e:
        return {"error": f"Ошибка обработки: {str(e)}"}