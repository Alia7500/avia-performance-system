import pandas as pd
import io
from datetime import datetime

def analyze_crew_health(file_content: bytes, file_name: str = "data.csv"):
    try:
        # 1. Декодируем и чистим файл от лишних строк Samsung
        raw_text = file_content.decode('utf-8', errors='ignore')
        lines = raw_text.splitlines()
        
        # Ищем, где реально начинаются данные (строка с "source,tag_id")
        start_line = 0
        for i, line in enumerate(lines):
            if 'heart_rate' in line and ',' in line:
                start_line = i
                break
        
        # Читаем CSV только с нужного места
        df = pd.read_csv(io.StringIO('\n'.join(lines[start_line:])))

        # 2. Ищем колонку с пульсом (она может называться по-разному)
        hr_col = 'com.samsung.health.heart_rate.heart_rate'
        
        if hr_col not in df.columns:
            # Если точное имя не найдено, ищем любую колонку со словом "heart_rate"
            potential_cols = [c for c in df.columns if 'heart_rate' in c.lower() and 'count' not in c.lower()]
            if potential_cols:
                hr_col = potential_cols[-1] # Берем последнюю подходящую
            else:
                return {"error": f"Колонка не найдена. Доступны: {list(df.columns[:3])}"}

        # 3. ПРЕВРАЩАЕМ В ЧИСЛА (самый важный момент)
        # errors='coerce' превратит мусор в NaN, а потом мы их выкинем
        df[hr_col] = pd.to_numeric(df[hr_col], errors='coerce')
        valid_series = df[hr_col].dropna()

        if valid_series.empty:
            return {"error": "Числовые данные не найдены в колонке. Проверьте формат файла."}

        # Берем САМОЕ ПОСЛЕДНЕЕ значение в файле (самый свежий замер)
        latest_hr = float(valid_series.iloc[-1])
        
        # 4. ЛОГИКА АГЕНТА (Медицинские критерии)
        if 50 <= latest_hr <= 85:
            score = 0.98
            status = "Optimal (Ready for Flight)"
        elif 86 <= latest_hr <= 100:
            score = 0.70
            status = "Warning (High Stress/Fatigue)"
        else:
            score = 0.30
            status = "Critical (Not Fit for Duty)"
            
        return {
            "metric": "Heart Rate Analysis",
            "value": latest_hr,
            "readiness_score": score,
            "status": status,
            "analyzed_at": datetime.now().isoformat()
        }

    except Exception as e:
        return {"error": f"Ошибка парсинга: {str(e)}"}