import pandas as pd
import io
from datetime import datetime

def analyze_crew_health(file_content: bytes, file_name: str = "data.csv"):
    try:
        # 1. Декодируем файл
        raw_text = file_content.decode('utf-8', errors='ignore')
        lines = raw_text.splitlines()
        
        # 2. Ищем, где реально начинаются данные (пропускаем технический мусор)
        header_idx = -1
        for i, line in enumerate(lines[:15]):
            if 'heart_rate' in line.lower() and ',' in line:
                header_idx = i
                break
        
        if header_idx == -1:
            return {"error": "Не удалось найти структуру таблицы. Проверьте, что это файл пульса."}
        
        # 3. Читаем CSV с супер-защитой
        # usecols позволяет нам взять только те колонки, которые реально есть в заголовке, 
        # игнорируя лишние запятые в конце строк
        data_str = '\n'.join(lines[header_idx:])
        
        # Сначала читаем только заголовки, чтобы понять сколько реально колонок
        headers = lines[header_idx].split(',')
        
        df = pd.read_csv(
            io.StringIO(data_str), 
            sep=',', 
            on_bad_lines='skip', # Пропускать строки, если в них совсем всё плохо
            engine='python',
            usecols=range(len(headers)) # Читать только столько колонок, сколько в заголовке
        )

        # 4. Ищем колонку с пульсом
        target_col = None
        for col in df.columns:
            if 'heart_rate.heart_rate' in col.lower() or (col.lower() == 'heart_rate'):
                target_col = col
                break
        
        if not target_col:
            potential = [c for c in df.columns if 'heart_rate' in c.lower()]
            if potential: target_col = potential[-1]
            else: return {"error": "Колонка пульса не найдена."}

        # 5. Превращаем в числа и берем последнее значение
        values = pd.to_numeric(df[target_col], errors='coerce').dropna()

        if values.empty:
            return {"error": "В выбранной колонке нет числовых данных."}

        latest_hr = float(values.iloc[-1])
        
        # 6. Аналитика
        if 50 <= latest_hr <= 85:
            db_status, score = "Optimal", 0.98
        elif 86 <= latest_hr <= 105:
            db_status, score = "Reduced", 0.70
        else:
            db_status, score = "Critical", 0.35

        return {
            "metric": "Samsung Health HR",
            "value": latest_hr,
            "readiness_score": score,
            "status": db_status,
            "analyzed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as e:
        return {"error": f"Ошибка системы: {str(e)}"}