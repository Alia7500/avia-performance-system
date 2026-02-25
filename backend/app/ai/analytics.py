import pandas as pd
import io
from datetime import datetime

def analyze_crew_health(file_content: bytes, file_name: str = "data.csv"):
    try:
        raw_text = file_content.decode('utf-8', errors='ignore')
        lines = raw_text.splitlines()
        
        header_idx = -1
        for i, line in enumerate(lines[:15]):
            if 'heart_rate' in line.lower() and ',' in line:
                header_idx = i
                break
        
        if header_idx == -1:
            return {"error": "Не удалось найти структуру таблицы в файле"}
        
        df = pd.read_csv(io.StringIO('\n'.join(lines[header_idx:])), on_bad_lines='skip', engine='python')

        target_col = None
        for col in df.columns:
            if 'heart_rate.heart_rate' in col.lower() or (col.lower() == 'heart_rate'):
                target_col = col
                break
        
        if not target_col:
            potential = [c for c in df.columns if 'heart_rate' in c.lower()]
            if potential: target_col = potential[-1]
            else: return {"error": "Колонка пульса не найдена"}

        values = pd.to_numeric(df[target_col], errors='coerce').dropna()
        if values.empty:
            return {"error": "В файле нет числовых данных о пульсе"}

        latest_hr = float(values.iloc[-1])
        
        # --- ИСПРАВЛЕННАЯ ЛОГИКА ДЛЯ БАЗЫ ДАННЫХ ---
        # Мы должны возвращать только: 'Optimal', 'Acceptable', 'Reduced', 'Critical'
        if 50 <= latest_hr <= 80:
            db_status = "Optimal"
            display_text = "Ready for Flight"
            score = 0.98
        elif 81 <= latest_hr <= 95:
            db_status = "Reduced"
            display_text = "Elevated Stress"
            score = 0.70
        else:
            db_status = "Critical"
            display_text = "High Fatigue"
            score = 0.35

        return {
            "metric": "Samsung Health HR",
            "value": latest_hr,
            "readiness_score": score,
            "status": db_status, # Это пойдет в ENUM базы
            "display_status": display_text, # А это для красоты
            "analyzed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as e:
        return {"error": f"Ошибка: {str(e)}"}