import pandas as pd
import io
import re
from datetime import datetime

def analyze_crew_health(file_content: bytes, file_name: str = "data.csv"):
    try:
        # 1. Декодируем файл
        raw_text = file_content.decode('utf-8', errors='ignore')
        lines = raw_text.splitlines()
        
        found_heart_rates = []

        # 2. Ищем строки с данными (где много запятых и есть цифры)
        for line in lines:
            if line.count(',') > 10:
                # Разбиваем строку по запятым и убираем пробелы
                parts = [p.strip() for p in line.split(',')]
                
                # Ищем в частях строки то, что похоже на пульс (число от 40 до 180)
                # Перебираем с КОНЦА строки, так как пульс обычно в конце
                for part in reversed(parts):
                    try:
                        # Убираем лишние кавычки и пробуем превратить в число
                        clean_part = part.replace('"', '').replace("'", "")
                        val = float(clean_part)
                        
                        if 40 <= val <= 190:
                            found_heart_rates.append(val)
                            break # Нашли пульс в этой строке, идем к следующей
                    except:
                        continue

        if not found_heart_rates:
            return {"error": "Не удалось извлечь данные пульса. Проверьте содержимое файла."}

        # 3. Берем самый свежий пульс (последний в списке)
        latest_hr = found_heart_rates[-1]
        
        # 4. Аналитика
        if 55 <= latest_hr <= 80:
            db_status, score = "Optimal", 0.98
        elif 81 <= latest_hr <= 98:
            db_status, score = "Reduced", 0.70
        else:
            db_status, score = "Critical", 0.35

        return {
            "metric": "Samsung Watch Heart Rate",
            "value": latest_hr,
            "readiness_score": score,
            "status": db_status,
            "analyzed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "data_points_analyzed": len(found_heart_rates)
        }

    except Exception as e:
        return {"error": f"Ошибка сканирования: {str(e)}"}