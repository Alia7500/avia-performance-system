import React, { useState, useEffect } from 'react';
import api from '../api/config';
import html2pdf from 'html2pdf.js';
import { 
  LogOut, Sun, Moon, Stethoscope, Search, UserCheck, UserX, 
  FileText, Activity, FileWarning, Printer, CheckCircle, ShieldAlert, Loader2, Calendar, Edit3
} from 'lucide-react';

const MedicPage = ({ user, onLogout }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('inspection'); 
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [crewList, setCrewList] = useState([]);
  const [journals, setJournals] = useState([]);
  const [isChief, setIsChief] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState(null);

  const [checkData, setCheckData] = useState({
    pulse: '', bp: '120/80', temp: '36.6', complaints: 'Нет', alcohol: 'Отрицательно', is_admitted: true
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/medic/crew?target_date=${targetDate}`);
      setCrewList(res.data.crew);
      setIsChief(res.data.is_chief);
      
      if (res.data.is_chief) {
          const resJ = await api.get('/medic/journals');
          setJournals(resJ.data);
      }
    } catch (error) {
      showToast("Ошибка загрузки данных", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [targetDate]);

  const handleSaveCheck = async () => {
    try {
      setLoading(true);
      await api.post('/medic/check', {
        user_id: selectedCrew.user_id,
        assignment_id: selectedCrew.assignment_id,
        ...checkData
      });
      showToast("Запись внесена в реестр");
      setShowModal(false);
      loadData();
    } catch (error) {
      showToast("Ошибка сохранения", "error");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (elementId) => {
    const element = document.getElementById(elementId);
    const opt = {
        margin: 10,
        filename: `Journal_MC21_${targetDate}.pdf`,
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'} font-sans pb-20`}>
      
      {toast && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl font-bold text-white animate-in slide-in-from-top-10 fade-in duration-300 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-500'}`}>
          {toast.type === 'error' ? <ShieldAlert size={24}/> : <CheckCircle size={24}/>}
          <span>{toast.message}</span>
        </div>
      )}

      {/* HEADER ОСТАЕТСЯ ПРЕЖНИМ */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 px-10 flex justify-between items-center shadow-sm">
        <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-lg text-white"><Stethoscope size={24} /></div>
          Медицинский контроль МС-21
        </h1>
        <div className="flex items-center gap-4">
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl"><Moon size={20} /></button>
            <button onClick={onLogout} className="p-3 bg-rose-500 text-white rounded-xl"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="p-10 max-w-[1600px] mx-auto space-y-8">
        <div className="flex gap-4 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-max shadow-sm">
          <button onClick={() => setActiveTab('inspection')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${activeTab === 'inspection' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}><UserCheck size={18}/> Осмотр</button>
          {isChief && <button onClick={() => setActiveTab('documents')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${activeTab === 'documents' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><FileText size={18}/> Электронные журналы</button>}
        </div>

        {activeTab === 'inspection' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {crewList.filter(c => c.fio.toLowerCase().includes(searchTerm.toLowerCase())).map((c, i) => (
              <div key={i} className={`p-6 rounded-[2.5rem] border-2 transition-all ${c.is_checked ? 'bg-emerald-50/30 border-emerald-500/30' : 'bg-white dark:bg-slate-800 border-transparent shadow-xl'}`}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400">{c.position}</span>
                    <h3 className="text-xl font-black leading-tight">{c.fio}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-blue-600 font-black italic">{c.flight_number}</div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{c.departure}</p>
                  </div>
                </div>
                
                {c.is_checked ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs font-bold p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-100">
                        <span>Пульс: {c.med_data.pulse}</span>
                        <span>Статус: {c.med_data.is_admitted ? 'ДОПУЩЕН' : 'ОТСТРАНЕН'}</span>
                    </div>
                    {isChief && (
                      <button onClick={() => {setSelectedCrew(c); setShowModal(true);}} className="w-full py-2 text-blue-600 font-bold text-xs flex items-center justify-center gap-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                        <Edit3 size={14}/> Редактировать данные
                      </button>
                    )}
                  </div>
                ) : (
                  <button onClick={() => {setSelectedCrew(c); setShowModal(true);}} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2">
                    <Activity size={18}/> Начать осмотр
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* --- ЖИВЫЕ ЖУРНАЛЫ --- */}
        {activeTab === 'documents' && (
          <div className="space-y-10">
            <div id="appx2" className="bg-white p-8 rounded-[2rem] shadow-2xl text-slate-900 overflow-x-auto">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-black uppercase">Журнал предполетного медицинского осмотра (Прил. №2)</h2>
                 <button onClick={() => generatePDF('appx2')} className="p-3 bg-emerald-600 text-white rounded-xl flex items-center gap-2"><Printer size={18}/> Печать журнала</button>
              </div>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <thead className="bg-slate-100 font-bold text-center">
                  <tr>
                    <th className="border border-slate-300 p-2">№</th>
                    <th className="border border-slate-300 p-2">Дата/Время</th>
                    <th className="border border-slate-300 p-2">Ф.И.О.</th>
                    <th className="border border-slate-300 p-2">Должность</th>
                    <th className="border border-slate-300 p-2">Рейс</th>
                    <th className="border border-slate-300 p-2">Пульс</th>
                    <th className="border border-slate-300 p-2">Заключение</th>
                    <th className="border border-slate-300 p-2">Врач</th>
                  </tr>
                </thead>
                <tbody>
                  {journals.map((j, idx) => (
                    <tr key={idx} className="text-center">
                      <td className="border border-slate-300 p-2">{idx+1}</td>
                      <td className="border border-slate-300 p-2">{new Date(j.time).toLocaleString()}</td>
                      <td className="border border-slate-300 p-2 font-bold">{j.fio}</td>
                      <td className="border border-slate-300 p-2">{j.pos}</td>
                      <td className="border border-slate-300 p-2 font-mono">{j.flight}</td>
                      <td className="border border-slate-300 p-2">{j.pulse}</td>
                      <td className={`border border-slate-300 p-2 font-bold ${j.admitted ? 'text-emerald-600' : 'text-rose-600'}`}>{j.admitted ? 'Допущен' : 'ОТСТРАНЕН'}</td>
                      <td className="border border-slate-300 p-2">{j.medic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div id="appx4" className="bg-white p-8 rounded-[2rem] shadow-2xl text-slate-900">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-black uppercase text-rose-600">Журнал отстранений от полетов (Прил. №4)</h2>
                 <button onClick={() => generatePDF('appx4')} className="p-3 bg-rose-600 text-white rounded-xl flex items-center gap-2"><Printer size={18}/> Печать журнала</button>
              </div>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <thead className="bg-rose-50 font-bold text-center">
                   <tr>
                    <th className="border border-slate-300 p-2">№</th>
                    <th className="border border-slate-300 p-2">Ф.И.О.</th>
                    <th className="border border-slate-300 p-2">Должность</th>
                    <th className="border border-slate-300 p-2">Причина отстранения</th>
                    <th className="border border-slate-300 p-2">Врач (ЭЦП)</th>
                  </tr>
                </thead>
                <tbody>
                  {journals.filter(j => !j.admitted).map((j, idx) => (
                    <tr key={idx} className="text-center">
                      <td className="border border-slate-300 p-2">{idx+1}</td>
                      <td className="border border-slate-300 p-2 font-bold">{j.fio}</td>
                      <td className="border border-slate-300 p-2">{j.pos}</td>
                      <td className="border border-slate-300 p-2 text-rose-600 italic">{j.desc}</td>
                      <td className="border border-slate-300 p-2 font-bold">{j.medic} (Сертиф: #2026-X)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* МОДАЛЬНОЕ ОКНО ОСМОТРА */}
      {showModal && selectedCrew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
            <h2 className="text-2xl font-black mb-6">{selectedCrew.fio}</h2>
            
            <div className="space-y-4">
              <input type="number" placeholder="Пульс (ЧСС)" value={checkData.pulse} onChange={e => setCheckData({...checkData, pulse: e.target.value})} className="w-full p-3 border rounded-lg"/>
              <input type="text" placeholder="АД" value={checkData.bp} onChange={e => setCheckData({...checkData, bp: e.target.value})} className="w-full p-3 border rounded-lg"/>
              <input type="text" placeholder="Температура" value={checkData.temp} onChange={e => setCheckData({...checkData, temp: e.target.value})} className="w-full p-3 border rounded-lg"/>
              <select value={checkData.alcohol} onChange={e => setCheckData({...checkData, alcohol: e.target.value})} className="w-full p-3 border rounded-lg font-bold">
                <option value="Отрицательно">Алкоголь: Отрицательно</option>
                <option value="ПОЛОЖИТЕЛЬНО">Алкоголь: ПОЛОЖИТЕЛЬНО</option>
              </select>
              <input type="text" placeholder="Жалобы" value={checkData.complaints} onChange={e => setCheckData({...checkData, complaints: e.target.value})} className="w-full p-3 border rounded-lg"/>
              
              <div className="flex gap-2 pt-4 border-t">
                <button onClick={() => setCheckData({...checkData, is_admitted: true})} className={`flex-1 py-3 rounded-lg font-bold ${checkData.is_admitted ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`}><UserCheck size={16} className="inline mr-2"/>ДОПУЩЕН</button>
                <button onClick={() => setCheckData({...checkData, is_admitted: false})} className={`flex-1 py-3 rounded-lg font-bold ${!checkData.is_admitted ? 'bg-rose-600 text-white' : 'bg-gray-200'}`}><UserX size={16} className="inline mr-2"/>ОТСТРАНЕН</button>
              </div>
            </div>
            
            <div className="flex gap-4 mt-8">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-200 rounded-lg font-bold hover:bg-gray-300">Отмена</button>
              <button onClick={handleSaveCheck} disabled={loading || !checkData.pulse} className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-bold disabled:opacity-50">
                {loading ? '...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicPage;