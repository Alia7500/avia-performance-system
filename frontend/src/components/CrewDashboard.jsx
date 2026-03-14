import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const CrewDashboard = ({ user }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await api.get('/crew/dashboard');
                setData(res.data.telemetry_history);
            } catch (e) { console.error("Ошибка загрузки ИИ-данных", e); }
        };
        fetchHealth();
    }, []);

    return (
        <div className="dashboard">
            <h2>Добро пожаловать, {user.fio}!</h2>
            <div className="status-grid">
                <div className="card">
                    <h3>Текущая готовность (ИИ)</h3>
                    <div className="index-val">{data.length > 0 ? data[0].performance_score : '--'}%</div>
                </div>
                <div className="card chart">
                    <h3>Динамика ЧСС (Samsung Watch)</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={data}>
                            <XAxis dataKey="record_timestamp" hide />
                            <YAxis domain={[50, 110]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="heart_rate" stroke="#ff0000" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default CrewDashboard;