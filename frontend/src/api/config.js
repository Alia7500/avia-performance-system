import axios from 'axios';

export const API_URL = "https://api.avia-evm-web-app-ru.ru";

const api = axios.create({
    baseURL: API_URL,
});

// Автоматически прикрепляем токен, если он есть в памяти браузера
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;