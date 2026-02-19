from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Avia Performance API")

# Настройка CORS, чтобы фронтенд мог достучаться до бэкенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # В будущем заменим на адрес Firebase
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Active", "system": "Avia Performance Monitor"}

@app.get("/health")
def health_check():
    return {"status": "ok"}