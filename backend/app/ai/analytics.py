import re
from datetime import datetime

def analyze_crew_health(file_content: bytes, user_baseline_hr: int = 75):
    try:
        # 1. Декодируем файл в текст, игнорируя ошибки кодировки
        text = file_content.decode('utf-8', errors='ignore')
        
        # 2. Ищем все числа, которые похожи на пульс (от 40 до 180)
        # Ищем цифры после запятой или в начале строки
        hr_values = re.findall(r'(?:^|,|;)(\d{2,3}(?:\.\d+)?)(?:,|;|$)', text)
        
        # Фильтруем только те, что реально могут быть пульсом человека
        valid_hr = [float(v) for v in hr_values if 40 <= float(v) <= 180]
        
        if not valid_hr:
            return {"error": "В файле не найдено подходящих данных пульса (40-180 bpm)"}

        # Берем среднее за последние замеры для стабильности
        latest_hr = sum(valid_hr[-5:]) / len(valid_hr[-5:])
        
        # РЕЗУЛЬТАТ ДЛЯ ИИ
        diff = latest_hr - user_baseline_hr
        if diff <= 15:
            status, score = "Optimal", 0.98
        elif diff <= 25:
            status, score = "Reduced", 0.75
        else:
            status, score = "Critical", 0.40

        return {
            "metric": "Samsung Watch HR",
            "value": round(latest_hr, 1),
            "readiness_score": score,
            "status": status,
            "analyzed_at": datetime.now().isoformat(),
            "data_points": len(valid_hr)
        }
    except Exception as e:
        return {"error": f"Ошибка ИИ-модуля: {str(e)}"}