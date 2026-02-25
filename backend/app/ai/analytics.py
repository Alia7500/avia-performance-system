import pandas as pd
import io
from datetime import datetime

def analyze_crew_health(file_content: bytes, file_name: str = "data.csv"):
    try:
        # 1. Читаем файл как текст
        raw_text = file_content.decode('utf-8', errors='ignore')
        lines = raw_text.splitlines()
        
        # 2. Ищем строку, где начинаются реальные заголовки (обычно там есть 'source,tag_id')
        header_idx = 0
        for i, line in enumerate(lines[:10]): # смотрим первые 10 строк
            if 'source,tag_id' in line or 'heart_rate' in line.lower() and line.count(',') > 5:
                header_idx = i
                break
        
        # Читаем CSV, пропуская метаданные Самсунга
        df = pd.read_csv(io.StringIO('\n'.join(lines[header_idx:])))

        # 3. Пытаемся найти колонку с пульсом
        # Мы ищем колонку, в которой есть слово 'heart_rate' (в любом регистре)
        target_col = None
        for col in df.columns:
            if 'heart_rate' in col.lower() and 'count' not in col.lower():
                target_col = col
                break
        
        if not target_col:
            return {"error": f"Колонка с пульсом не найдена. Названия в файле: {list(df.columns[:5])}"}

        # 4. Извлекаем цифры и чистим их
        # Превращаем всё в числа, мусор станет NaN, который мы удалим
        df[target_col] = pd.to_numeric(df[target_col], errors='coerce')
        valid_data = df[target_col].dropna()

        if valid_data.empty:
            return {"error": "Числовые значения пульса не найдены. Возможно, файл пуст."}

        # Берем САМОЕ ПОСЛЕДНЕЕ (свежее) значение
        latest_hr = float(valid_data.iloc[-1])
        
        # 5. Аналитика Агента
        score = 0.5
        status = "Unknown"
        
        if 50 <= latest_hr <= 85:
            score = 0.98
            status = "Optimal (Ready for Flight)"
        elif 86 <= latest_hr <= 105:
            score = 0.70
            status = "Elevated Stress / Fatigue"
        else:
            score = 0.35
            status = "Critical Status (Medical Consultation Required)"

        return {
            "metric": "Real-time Heart Rate Analysis",
            "value": latest_hr,
            "readiness_score": score,
            "status": status,
            "analyzed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as e:
        return {"error": f"Критическая ошибка анализа: {str(e)}"}