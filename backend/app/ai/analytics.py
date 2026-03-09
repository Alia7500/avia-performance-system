import pandas as pd
import io
import re
from datetime import datetime

def analyze_crew_health(file_content: bytes, user_baseline_hr: int = 70):
    try:
        text = file_content.decode('utf-8', errors='ignore')
        
        pattern = r',(\d{2,3}(?:\.\d+)?),'
        matches = re.findall(pattern, text)
        
        if not matches:
            all_numbers = re.findall(r'\b(\d{2,3}(?:\.\d+)?)\b', text)
            matches =[n for n in all_numbers if 40 <= float(n) <= 190]

        if not matches:
            return {"error": "Данные пульса не обнаружены"}

        latest_hr = float(matches[-1])
        
        # --- ПЕРСОНАЛИЗИРОВАННАЯ ЛОГИКА ИИ ---
        # Вычисляем отклонение от персональной нормы человека
        deviation = latest_hr - user_baseline_hr
        
        if deviation <= 15: # До 15 ударов выше нормы - это нормально при подготовке к рейсу
            db_status, score = "Допущен", 0.98
        elif 16 <= deviation <= 30: # Сильный стресс
            db_status, score = "Внимание", 0.70
        else: # Аномалия
            db_status, score = "Отстранен", 0.30

        return {
            "metric": "ЧСС (Анализ Samsung Watch)",
            "current_value": latest_hr,
            "baseline_value": user_baseline_hr,
            "deviation": deviation,
            "readiness_score": score,
            "status": db_status,
            "analyzed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as e:
        return {"error": f"Сбой ИИ: {str(e)}"}