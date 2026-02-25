import io
import re
from datetime import datetime

def analyze_crew_health(file_content: bytes, file_name: str = "data.csv"):
    try:
        # 1. Пытаемся прочитать файл как текст
        text = file_content.decode('utf-8', errors='ignore')
        
        # 2. Ищем ВСЕ числа в файле, которые похожи на пульс (от 40 до 190)
        # Ищем числа, перед которыми стоит запятая (как в твоем CSV)
        pattern = r',(\d{2,3}(?:\.\d+)?),'
        matches = re.findall(pattern, text)
        
        # Если не нашли с запятыми, ищем просто любые числа в этом диапазоне
        if not matches:
            all_numbers = re.findall(r'\b(\d{2,3}(?:\.\d+)?)\b', text)
            matches = [n for n in all_numbers if 40 <= float(n) <= 190]

        if not matches:
            return {"error": f"Данные не найдены. Первые 50 символов файла: {text[:50]}"}

        # 3. Берем самое последнее число (свежий замер)
        latest_hr = float(matches[-1])
        
        # 4. Аналитика
        if 50 <= latest_hr <= 82:
            db_status, score = "Optimal", 0.98
        elif 83 <= latest_hr <= 100:
            db_status, score = "Reduced", 0.72
        else:
            db_status, score = "Critical", 0.35

        return {
            "version": "4.0-ULTRA", # Для проверки обновления
            "metric": "Samsung Health HR",
            "value": latest_hr,
            "readiness_score": score,
            "status": db_status,
            "analyzed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as e:
        return {"error": f"Критический сбой ИИ: {str(e)}"}