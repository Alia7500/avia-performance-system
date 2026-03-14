import React, { useState } from 'react';
import api from '../api/config';

const Login = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/auth/login', { username: email, password: password });
            localStorage.setItem('token', res.data.access_token);
            onLogin(res.data); // Передаем данные пользователя (имя, роль) в главный файл
        } catch (err) {
            alert("Ошибка: Неверный логин или пароль");
        }
    };

    return (
        <div className="login-box">
            <h1>АЭРОФЛОТ | МС-21</h1>
            <p>Система мониторинга работоспособности</p>
            <form onSubmit={handleLogin}>
                <input type="email" placeholder="Email (staff_1@ms21-avia.ru)" onChange={e => setEmail(e.target.value)} required />
                <input type="password" placeholder="Пароль" onChange={e => setPassword(e.target.value)} required />
                <button type="submit">Войти в систему</button>
            </form>
        </div>
    );
};

export default Login;