import pandas as pd
import io
from datetime import datetime

def analyze_crew_health(file_content: bytes, file_name: str = "data.csv"):
    try:
        # 1. Декодируем файл
        raw_text = file_content.decode('utf-8', errors='ignore')
        lines = raw_text.splitlines()
        
        # 2. Ищем строку, где начинаются заголовки (пропускаем метаданные Самсунга)
        header_idx = -1
        for i, line in enumerate(lines[:15]): # смотрим первые 15 строк
            if 'heart_rate' in line.lower() and ',' in line:
                header_idx = i
                break
        
        if header_idx == -1:
            return {"error": "Не удалось найти структуру таблицы в файле"}
        
        # 3. Читаем CSV с «защитой от дурака»
        # engine='python' и on_bad_lines='skip' позволяют игнорировать лишние запятые
        data_io = io.StringIO('\n'.join(lines[header_idx:]))
        df = pd.read_csv(
            data_io, 
            on_bad_lines='skip', 
            engine='python', 
            sep=',', 
            index_col=False
        )

        # 4. Ищем колонку с пульсом
        target_col = None
        for col in df.columns:
            # Ищем колонку, где есть heart_rate, но нет слова 'count'
            if 'heart_rate.heart_rate' in col.lower() or (col.lower() == 'heart_rate'):
                target_col = col
                break
        
        if not target_col:
            # Попытка №2: берем любую колонку со словом heart_rate
            potential = [c for c in df.columns if 'heart_rate' in c.lower()]
            if potential:
                target_col = potential[-1]
            else:
                return {"error": "Колонка пульса не найдена. Попробуйте другой файл."}

        # 5. Чистим данные от мусора и берем последнее значение
        values = pd.to_numeric(df[target_col], errors='coerce').dropna()

        if values.empty:
            return {"error": "В файле нет числовых данных о пульсе"}

        latest_hr = float(values.iloc[-1]) # Самый свежий замер
        
        # 6. Аналитика (Медицинские нормы)
        score = 0.5
        status = "Unknown"
        
        if 50 <= latest_hr <= 80:
            score = 0.98
            status = "Optimal (Ready for Flight)"
        elif 81 <= latest_hr <= 95:
            score = 0.75
            status = "Caution (Elevated Heart Rate)"
        else:
            score = 0.40
            status = "Critical (Not Recommended for Flight)"

        return {
            "metric": "Samsung Health HR Monitor",
            "value": latest_hr,
            "readiness_score": score,
            "status": status,
            "analyzed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as e:
        return {"error": f"Ошибка обработки: {str(e)}"}