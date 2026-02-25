import pandas as pd
import io
from datetime import datetime

def analyze_crew_health(file_content: bytes, file_name: str = "data.csv"):
    try:
        # 1. Читаем файл, пробуем разные кодировки
        try:
            text = file_content.decode('utf-8')
        except:
            text = file_content.decode('cp1251', errors='ignore')
            
        lines = text.splitlines()
        
        # 2. Ищем строку, где реально начинаются данные
        header_idx = 0
        for i, line in enumerate(lines[:20]):
            if line.count(',') > 5 or line.count(';') > 5:
                header_idx = i
                break
        
        # 3. Читаем таблицу с авто-определением разделителя (запятая или точка с запятой)
        df = pd.read_csv(io.StringIO('\n'.join(lines[header_idx:])), sep=None, engine='python', on_bad_lines='skip')

        # 4. ИЩЕМ ПУЛЬС ЛЮБЫМ СПОСОБОМ
        target_col = None
        
        # Сначала ищем по названию
        for col in df.columns:
            if 'heart_rate' in col.lower() and 'count' not in col.lower():
                target_col = col
                break
        
        # Если по названию не нашли, ищем колонку, где среднее значение похоже на пульс (60-100)
        if target_col is None:
            for col in df.columns:
                numeric_col = pd.to_numeric(df[col], errors='coerce').dropna()
                if not numeric_col.empty and 40 < numeric_col.mean() < 120:
                    target_col = col
                    break

        if target_col is None:
            return {"error": f"Не удалось найти данные пульса. Колонки в файле: {list(df.columns[:5])}"}

        # 5. Чистим данные
        valid_data = pd.to_numeric(df[target_col], errors='coerce').dropna()
        
        if valid_data.empty:
            return {"error": "Колонка найдена, но в ней нет чисел."}

        latest_hr = float(valid_data.iloc[-1])
        
        # 6. Итоговая оценка
        if 50 <= latest_hr <= 85:
            db_status, score = "Optimal", 0.98
        elif 86 <= latest_hr <= 105:
            db_status, score = "Reduced", 0.70
        else:
            db_status, score = "Critical", 0.35

        return {
            "metric": "Samsung Health Data",
            "value": latest_hr,
            "readiness_score": score,
            "status": db_status,
            "analyzed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as e:
        return {"error": f"Ошибка: {str(e)}"}