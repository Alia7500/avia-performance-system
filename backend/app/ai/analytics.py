import pandas as pd
import io
from datetime import datetime

def analyze_crew_health(file_content: bytes, file_name: str = "data.csv"):
    try:
        # Декодируем байты в текст
        text_data = file_content.decode('utf-8')
        
        # Читаем CSV, пропуская первую техническую строку Самсунга
        # sep=',' так как на скриншоте запятые
        df = pd.read_csv(io.StringIO(text_data), skiprows=1)

        # Твое точное название колонки из скриншота:
        hr_col = 'com.samsung.health.heart_rate.heart_rate'

        if hr_col in df.columns:
            # Берем последнее значение (самое свежее)
            # dropna() уберет пустые ячейки, если они есть
            valid_rates = df[hr_col].dropna()
            if valid_rates.empty:
                return {"error": "В файле нет числовых данных о пульсе"}
                
            latest_hr = float(valid_rates.iloc[0])
            
            # Логика анализа работоспособности
            if 55 <= latest_hr <= 80:
                score = 0.98
                status = "Optimal (Rested)"
            elif 81 <= latest_hr <= 95:
                score = 0.75
                status = "Warning (Elevated Stress)"
            else:
                score = 0.40
                status = "Critical (High Fatigue/Stress)"
                
            return {
                "metric": "Heart Rate",
                "value": latest_hr,
                "readiness_score": score,
                "status": status,
                "timestamp": datetime.now().isoformat()
            }
        
        return {"error": f"Колонка {hr_col} не найдена в файле. Проверьте формат."}

    except Exception as e:
        return {"error": f"Ошибка обработки: {str(e)}"}