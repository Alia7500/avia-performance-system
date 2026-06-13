import React, { useState, useEffect } from 'react';
import api from '../api/config';
import html2pdf from 'html2pdf.js';
import { 
  LogOut, Sun, Moon, Stethoscope, Search, UserCheck, UserX, 
  FileText, Activity, FileWarning, Printer, CheckCircle, ShieldAlert, Loader2
} from 'lucide-react';

const MedicPage = ({ user, onLogout }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('inspection'); // inspection, documents
  
  const [crewList, setCrewList] = useState([]);
  const [isChief, setIsChief] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Состояния для модального окна осмотра
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
      const res = await api.get('/medic/crew');
      setCrewList(res.data.crew);
      setIsChief(res.data.is_chief);
    } catch (error) {
      showToast("Ошибка загрузки расписания", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSaveCheck = async () => {
    try {
      setLoading(true);
      await api.post('/medic/check', {
        user_id: selectedCrew.user_id,
        assignment_id: selectedCrew.assignment_id,
        ...checkData
      });
      showToast(checkData.is_admitted ? "Сотрудник допущен к рейсу" : "СОТРУДНИК ОТСТРАНЕН", checkData.is_admitted ? "success" : "error");
      
      // Если отстранен, предлагаем скачать справки
      if (!checkData.is_admitted) {
        if (window.confirm("Скачать справку об отстранении и направление на анализ?")) {
            generateSuspensionDoc('suspension-cert');
            setTimeout(() => generateSuspensionDoc('direction-cert'), 2000);
        }
      }
      
      setShowModal(false);
      loadData(); // Перезагружаем список
    } catch (error) {
      showToast("Ошибка сохранения данных", "error");
    } finally {
      setLoading(false);
    }
  };

  // ГЕНЕРАТОР PDF ДОКУМЕНТОВ
  const generateSuspensionDoc = (elementId) => {
    const element = document.getElementById(elementId);
    element.style.display = 'block'; // Показываем временно для печати
    
    const opt = {
        margin: 15,
        filename: `${elementId}_${selectedCrew.fio}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: elementId.includes('journal') ? 'landscape' : 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        element.style.display = 'none'; // Прячем обратно
    });
  };

  const filteredCrew = crewList.filter(c => c.fio.toLowerCase().includes(searchTerm.toLowerCase()) || c.flight_number.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'} font-sans pb-20`}>
      
      {toast && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl font-bold text-white animate-in slide-in-from-top-10 fade-in duration-300 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-500'}`}>
          {toast.type === 'error' ? <ShieldAlert size={24}/> : <CheckCircle size={24}/>}
          <span>{toast.message}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 px-10 flex justify-between items-center shadow-sm">
        <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-lg text-white"><Stethoscope size={24} /></div>
          Медицинский контроль
        </h1>
        <div className="flex items-center gap-6">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:scale-105 transition-transform">
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-800 p-2 pr-6 rounded-2xl">
             <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-xl">{user.fio[0]}</div>
             <div className="text-left leading-tight">
                <p className="font-bold text-sm">{user.fio}</p>
                <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest">{isChief ? 'ГЛАВНЫЙ ВРАЧ' : 'МЕДРАБОТНИК'}</p>
             </div>
          </div>
          <button onClick={onLogout} className="p-4 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white dark:bg-rose-950/30 rounded-2xl font-bold transition-all flex items-center gap-2"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="p-10 max-w-[1400px] mx-auto space-y-8">
        
        {/* ВКЛАДКИ */}
        <div className="flex gap-4 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-max shadow-sm">
          <button onClick={() => setActiveTab('inspection')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'inspection' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><UserCheck size={18}/> Предрейсовый осмотр</button>
          {isChief && (
            <button onClick={() => setActiveTab('documents')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'documents' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><FileText size={18}/> Журналы и Отчеты (Главный врач)</button>
          )}
        </div>

        {/* --- ВКЛАДКА: ОСМОТР --- */}
        {activeTab === 'inspection' && (
          <div className="animate-in fade-in">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
              <div className="relative w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input type="text" placeholder="Поиск по ФИО или рейсу..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
              </div>
              <div className="text-sm font-bold text-slate-500">
                {isChief ? "Отображается весь штат авиакомпании" : "Отображаются рейсы на сегодня"}
              </div>
            </div>

            {loading ? <div className="text-center py-20"><Loader2 className="animate-spin inline-block text-emerald-500" size={48}/></div> : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredCrew.map((c, i) => (
                  <div key={i} className={`p-6 rounded-[2rem] shadow-lg border transition-all group ${c.is_checked ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-500'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${c.is_checked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{c.position}</span>
                        <h3 className={`text-xl font-black mt-2 leading-tight ${c.is_checked ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{c.fio}</h3>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-black italic tracking-tighter ${c.is_checked ? 'text-emerald-500/50' : 'text-blue-600'}`}>{c.flight_number}</span>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Вылет: {c.departure}</p>
                      </div>
                    </div>
                    
                    {c.is_checked ? (
                      <button disabled className="w-full mt-4 py-3 bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-500 border border-emerald-200/50 dark:border-emerald-800/30 font-bold rounded-xl flex items-center justify-center gap-2 cursor-not-allowed">
                        <CheckCircle size={18}/> Осмотр пройден
                      </button>
                    ) : (
                      <button 
                        onClick={() => { setSelectedCrew(c); setShowModal(true); setCheckData({...checkData, pulse: '', is_admitted: true}); }} 
                        className="w-full mt-4 py-3 bg-slate-50 dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-bold rounded-xl hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white transition-colors flex items-center justify-center gap-2">
                        <Activity size={18}/> Провести осмотр
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- ВКЛАДКА: ДОКУМЕНТЫ (Только для Гл.Врача) --- */}
        {activeTab === 'documents' && isChief && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-700">
               <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6"><FileText size={32}/></div>
               <h3 className="text-2xl font-black uppercase mb-2">Журнал медосмотров</h3>
               <p className="text-slate-500 mb-8">ПРИЛОЖЕНИЕ №2 к Порядку. Журнал предсменного (предполетного) медицинского осмотра.</p>
               <button onClick={() => {setSelectedCrew({fio: 'Журнал_Общий'}); generateSuspensionDoc('journal-preflight');}} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700"><Printer size={20}/> Сформировать PDF</button>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-xl border border-rose-200 dark:border-rose-900/50">
               <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6"><FileWarning size={32}/></div>
               <h3 className="text-2xl font-black uppercase mb-2">Журнал отстранений</h3>
               <p className="text-slate-500 mb-8">ПРИЛОЖЕНИЕ №4 к Порядку. Журнал отстранения от полетов (дежурств) летного состава.</p>
               <button onClick={() => {setSelectedCrew({fio: 'Журнал_Отстранений'}); generateSuspensionDoc('journal-suspension');}} className="w-full py-4 bg-rose-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-rose-700"><Printer size={20}/> Сформировать PDF</button>
            </div>
          </div>
        )}
      </main>

      {/* --- МОДАЛЬНОЕ ОКНО ОСМОТРА --- */}
      {showModal && selectedCrew && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl p-8 max-w-lg w-full border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight">{selectedCrew.fio}</h2>
                <p className="text-blue-600 font-bold text-sm uppercase">Рейс: {selectedCrew.flight_number}</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Activity size={24}/></div>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Пульс (ЧСС)</label><input type="number" placeholder="Например: 72" value={checkData.pulse} onChange={e => setCheckData({...checkData, pulse: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-lg outline-none focus:ring-2 focus:ring-emerald-500"/></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">АД (Давление)</label><input type="text" value={checkData.bp} onChange={e => setCheckData({...checkData, bp: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-lg outline-none focus:ring-2 focus:ring-emerald-500"/></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Температура</label><input type="text" value={checkData.temp} onChange={e => setCheckData({...checkData, temp: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono outline-none focus:ring-2 focus:ring-emerald-500"/></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Тест на алкоголь</label>
                  <select value={checkData.alcohol} onChange={e => setCheckData({...checkData, alcohol: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="Отрицательно">Отрицательно</option>
                    <option value="ПОЛОЖИТЕЛЬНО">Положительно (ПРОМИЛЛЕ)</option>
                  </select>
                </div>
              </div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Жалобы</label><input type="text" value={checkData.complaints} onChange={e => setCheckData({...checkData, complaints: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"/></div>
              
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-2 block">Медицинское заключение</label>
                <div className="flex gap-4">
                  <button onClick={() => setCheckData({...checkData, is_admitted: true})} className={`flex-1 py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all ${checkData.is_admitted ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><UserCheck size={20}/> ДОПУЩЕН</button>
                  <button onClick={() => setCheckData({...checkData, is_admitted: false})} className={`flex-1 py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all ${!checkData.is_admitted ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><UserX size={20}/> ОТСТРАНЕН</button>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 mt-8">
              <button onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 transition">Отмена</button>
              <button onClick={handleSaveCheck} disabled={loading || !checkData.pulse} className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Внести в протокол'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* СКРЫТЫЕ ШАБЛОНЫ ДОКУМЕНТОВ ДЛЯ ГЕНЕРАЦИИ PDF (ГОСТ)                       */}
      {/* ========================================================================= */}
      {selectedCrew && (
        <div style={{ display: 'none' }}>
          
          {/* ДОКУМЕНТ 1: НАПРАВЛЕНИЕ НА ОСВИДЕТЕЛЬСТВОВАНИЕ */}
          <div id="direction-cert" className="bg-white text-black p-10 font-serif text-sm">
            <div className="text-right font-bold mb-10">ПРИЛОЖЕНИЕ № 1<br/>к Порядку<br/>(рекомендуемый образец)</div>
            <h2 className="text-center font-bold text-lg mb-2">НАПРАВЛЕНИЕ</h2>
            <p className="text-center mb-10 leading-tight">на медицинское освидетельствование на состояние опьянения (алкогольного,<br/>наркотического или иного токсического) с обязательным проведением<br/>подтверждающих химико-токсикологических исследований...</p>
            
            <p className="mb-2">1. Фамилия, имя, отчество лица, направляемого на освидетельствование</p>
            <div className="border-b border-black font-bold text-center pb-1 mb-6">{selectedCrew.fio}</div>
            
            <p className="mb-2">2. Место работы, должность</p>
            <div className="border-b border-black font-bold text-center pb-1 mb-6">ПАО "Аэрофлот", {selectedCrew.position}</div>
            
            <p className="mb-2">3. Причина направления на освидетельствование</p>
            <div className="border-b border-black font-bold text-center pb-1 mb-6">Подозрение на состояние опьянения (Показатели: {checkData.bp}, Пульс: {checkData.pulse})</div>
            
            <p className="mb-2">4. Дата и время (московское) выдачи направления</p>
            <div className="border-b border-black font-bold text-center pb-1 mb-6">{new Date().toLocaleString('ru-RU')}</div>
            
            <p className="mb-2">5. Фамилия, имя, отчество, должность лица, выдавшего направление</p>
            <div className="border-b border-black font-bold text-center pb-1 mb-16">{user.fio}, Главный врач</div>
            
            <div className="flex justify-between mt-10">
              <div className="w-1/2">М.П. (при наличии)</div>
              <div className="w-1/2 border-t border-black text-center pt-1 text-xs">Подпись должностного лица</div>
            </div>
          </div>

          {/* ДОКУМЕНТ 2: СПРАВКА ОБ ОТСТРАНЕНИИ */}
          <div id="suspension-cert" className="bg-white text-black p-10 font-serif text-sm">
            <div className="text-right font-bold mb-10">ПРИЛОЖЕНИЕ № 5<br/>к Порядку<br/>(рекомендуемый образец)</div>
            <h2 className="text-center font-bold text-lg mb-2">СПРАВКА № {Math.floor(Math.random() * 1000)}</h2>
            <p className="text-center mb-10 font-bold">ОБ ОТСТРАНЕНИИ ОТ ПОЛЕТА (ДЕЖУРСТВА)</p>
            
            <div className="border border-black p-2 w-48 text-center mb-10 font-bold">Штамп<br/>мед. учреждения</div>
            
            <div className="border-b border-black font-bold text-center pb-1">{selectedCrew.fio}, {selectedCrew.position}, ПАО "Аэрофлот"</div>
            <p className="text-center text-xs mb-8">(фамилия, инициалы, должность, наименование организации)</p>
            
            <p className="mb-4">отстранен от полета (дежурства) на предполетном (предсменном) медицинском осмотре</p>
            <p className="mb-8 font-bold">«{new Date().getDate()}» {new Date().toLocaleString('ru', { month: 'long' })} 20{new Date().getFullYear().toString().substr(-2)} г. {new Date().getHours()} ч {new Date().getMinutes()} мин.</p>
            
            <p className="mb-2">Предварительный диагноз</p>
            <div className="border-b border-black font-bold pb-1 mb-6">Гипертонический криз / Аритмия (Отклонение витальных показателей)</div>
            
            <p className="mb-2">Краткие объективные данные</p>
            <div className="border-b border-black font-bold pb-1 mb-10">АД: {checkData.bp}, Пульс: {checkData.pulse} уд/мин, Темп: {checkData.temp} °C. Жалобы: {checkData.complaints}</div>
            
            <div className="flex justify-between items-end mt-16">
              <div className="w-1/3">М.П.</div>
              <div className="w-1/3 border-b border-black"></div>
              <div className="w-1/3 border-b border-black text-right font-bold">{user.fio}</div>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <div className="w-1/3"></div>
              <div className="w-1/3 text-center">(подпись)</div>
              <div className="w-1/3 text-right">(расшифровка)</div>
            </div>
          </div>

          {/* ДОКУМЕНТ 3: ЖУРНАЛ ПРЕДПОЛЕТНОГО ОСМОТРА */}
          <div id="journal-preflight" className="bg-white text-black p-5 font-serif text-[10px]">
            <h2 className="text-center font-bold text-sm mb-4">ЖУРНАЛ №___<br/>ПРЕДПОЛЕТНОГО МЕДИЦИНСКОГО ОСМОТРА ЧЛЕНОВ ЭКИПАЖЕЙ</h2>
            <table className="w-full border-collapse border border-black text-center">
              <thead>
                <tr>
                  <th className="border border-black p-1">№</th>
                  <th className="border border-black p-1">Дата и время</th>
                  <th className="border border-black p-1">Ф.И.О.</th>
                  <th className="border border-black p-1">Должность</th>
                  <th className="border border-black p-1">№ рейса</th>
                  <th className="border border-black p-1">Жалобы</th>
                  <th className="border border-black p-1">Пульс</th>
                  <th className="border border-black p-1">АД</th>
                  <th className="border border-black p-1">Алкоголь</th>
                  <th className="border border-black p-1">Заключение</th>
                  <th className="border border-black p-1">Подпись врача</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-1">1</td>
                  <td className="border border-black p-1">{new Date().toLocaleString('ru-RU')}</td>
                  <td className="border border-black p-1">Иванов И.И.</td>
                  <td className="border border-black p-1">КВС</td>
                  <td className="border border-black p-1">SU1491</td>
                  <td className="border border-black p-1">Нет</td>
                  <td className="border border-black p-1">72</td>
                  <td className="border border-black p-1">120/80</td>
                  <td className="border border-black p-1">Отриц.</td>
                  <td className="border border-black p-1 font-bold">Допущен</td>
                  <td className="border border-black p-1">{user.fio}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
};

export default MedicPage;