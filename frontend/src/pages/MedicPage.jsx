import React, { useEffect, useState } from 'react';
import api from '../api/config';
import html2pdf from 'html2pdf.js';
import {
  LogOut,
  Moon,
  Stethoscope,
  Search,
  UserCheck,
  UserX,
  FileText,
  Activity,
  Printer,
  CheckCircle,
  ShieldAlert,
  Loader2,
  Calendar,
  Edit3
} from 'lucide-react';

const DEFAULT_CHECK_DATA = {
  pulse: '',
  bp: '120/80',
  temp: '36.6',
  complaints: 'Нет',
  alcohol: 'Отрицательно',
  is_admitted: true
};

const cloneDefaultCheckData = () => ({ ...DEFAULT_CHECK_DATA });

const normalizeAdmissionValue = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'да', 'допущен', 'допущена'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'нет', 'отстранен', 'отстранён', 'отстранена'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

const getAdmissionStatus = (item = {}) => {
  if (item.is_admitted !== undefined && item.is_admitted !== null) {
    return normalizeAdmissionValue(item.is_admitted);
  }

  if (item.admitted !== undefined && item.admitted !== null) {
    return normalizeAdmissionValue(item.admitted);
  }

  return true;
};

const getBloodPressure = (item = {}) => item.bp || item.pressure || item.blood_pressure || '120/80';
const getTemperature = (item = {}) => item.temp || item.temperature || '36.6';
const getAlcohol = (item = {}) => item.alcohol || item.alcohol_result || 'Отрицательно';
const getComplaints = (item = {}) => item.complaints || item.desc || item.reason || 'Нет';

const formatDate = (value) => {
  if (!value) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}.${month}.${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU');
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU');
};

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
  const [checkData, setCheckData] = useState(cloneDefaultCheckData);

  const medicName = user?.fio || user?.name || user?.username || '________________';
  const reportDate = formatDate(targetDate);

  const query = searchTerm.trim().toLowerCase();
  const filteredCrew = crewList.filter((crew) => {
    if (!query) return true;
    return [crew.fio, crew.position, crew.flight_number, crew.departure]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const suspendedJournals = journals.filter((journal) => !getAdmissionStatus(journal));

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({ target_date: targetDate });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const crewResponse = await api.get(`/medic/crew?${params.toString()}`);
      const crew = Array.isArray(crewResponse.data?.crew) ? crewResponse.data.crew : [];
      const chief = Boolean(crewResponse.data?.is_chief);

      setCrewList(crew);
      setIsChief(chief);

      if (activeTab === 'documents' && chief) {
        const journalsResponse = await api.get(`/medic/journals?date=${targetDate}`);
        const loadedJournals = Array.isArray(journalsResponse.data)
          ? journalsResponse.data
          : journalsResponse.data?.journals || [];
        setJournals(loadedJournals);
      }

      if (!chief && activeTab === 'documents') {
        setActiveTab('inspection');
        setJournals([]);
      }
    } catch (error) {
      console.error(error);
      showToast('Ошибка загрузки данных', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate, searchTerm, activeTab]);

  const openCheckModal = (crew) => {
    const medData = crew.med_data || {};

    setSelectedCrew(crew);
    setCheckData(
      crew.is_checked
        ? {
            pulse: medData.pulse || '',
            bp: getBloodPressure(medData),
            temp: getTemperature(medData),
            complaints: getComplaints(medData),
            alcohol: getAlcohol(medData),
            is_admitted: getAdmissionStatus(medData)
          }
        : cloneDefaultCheckData()
    );
    setShowModal(true);
  };

  const handleSaveCheck = async () => {
    if (!selectedCrew) return;

    try {
      setLoading(true);
      await api.post('/medic/check', {
        user_id: selectedCrew.user_id,
        assignment_id: selectedCrew.assignment_id,
        ...checkData
      });
      showToast('Запись внесена в реестр');
      setShowModal(false);
      await loadData();
    } catch (error) {
      console.error(error);
      showToast('Ошибка сохранения', 'error');
    } finally {
      setLoading(false);
    }
  };

  const printDoc = (elementId, filename, orientation = 'portrait') => {
    const element = document.getElementById(elementId);

    if (!element) {
      showToast('Шаблон документа не найден', 'error');
      return;
    }

    const options = {
      margin: 10,
      filename: `${filename}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      jsPDF: { unit: 'mm', format: 'a4', orientation }
    };

    html2pdf().set(options).from(element).save();
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'} font-sans pb-20`}>
      {toast && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl font-bold text-white animate-in slide-in-from-top-10 fade-in duration-300 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-500'}`}>
          {toast.type === 'error' ? <ShieldAlert size={24} /> : <CheckCircle size={24} />}
          <span>{toast.message}</span>
        </div>
      )}

      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 px-10 flex justify-between items-center shadow-sm">
        <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-lg text-white"><Stethoscope size={24} /></div>
          Медицинский контроль МС-21
        </h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1">
            <Calendar size={18} className="text-slate-400 mr-2" />
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="bg-transparent border-none font-bold text-sm outline-none p-2 text-slate-900 dark:text-white"
            />
          </div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" title="Переключить тему">
            <Moon size={20} />
          </button>
          <button onClick={onLogout} className="p-3 bg-rose-500 text-white rounded-xl" title="Выйти">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="p-10 max-w-[1600px] mx-auto space-y-8">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск сотрудника по фамилии, должности или номеру рейса..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full p-4 pl-12 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-max shadow-sm">
          <button
            onClick={() => setActiveTab('inspection')}
            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${activeTab === 'inspection' ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}
          >
            <UserCheck size={18} /> Осмотр
          </button>
          {isChief && (
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${activeTab === 'documents' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}
            >
              <FileText size={18} /> Журналы по приказу
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-3 text-sm font-bold text-slate-400">
            <Loader2 className="animate-spin" size={18} /> Загрузка данных...
          </div>
        )}

        {activeTab === 'inspection' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCrew.map((crew, index) => {
              const medData = crew.med_data || {};
              const admitted = getAdmissionStatus(medData);

              return (
                <div
                  key={`${crew.assignment_id || crew.user_id || index}`}
                  className={`p-6 rounded-[2.5rem] border-2 transition-all ${crew.is_checked ? 'bg-emerald-50/30 border-emerald-500/30 dark:bg-emerald-950/20' : 'bg-white dark:bg-slate-800 border-transparent shadow-xl'}`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400">{crew.position}</span>
                      <h3 className="text-xl font-black leading-tight">{crew.fio}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-blue-600 font-black italic">{crew.flight_number}</div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{crew.departure}</p>
                    </div>
                  </div>

                  {crew.is_checked && (
                    <div className="flex justify-between text-xs font-bold p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-100 dark:border-emerald-900 mb-3">
                      <span>Пульс: {medData.pulse || '—'}</span>
                      <span className={admitted ? 'text-emerald-600' : 'text-rose-600'}>
                        {admitted ? 'ДОПУЩЕН' : 'ОТСТРАНЕН'}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => openCheckModal(crew)}
                    className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${crew.is_checked ? 'bg-white dark:bg-slate-900 border border-emerald-500 text-emerald-600' : 'bg-emerald-600 text-white hover:shadow-lg hover:shadow-emerald-500/20'}`}
                  >
                    {crew.is_checked ? <Edit3 size={18} /> : <Activity size={18} />}
                    {crew.is_checked ? 'Просмотр / Правка' : 'Начать осмотр'}
                  </button>
                </div>
              );
            })}

            {!loading && filteredCrew.length === 0 && (
              <div className="col-span-full p-10 bg-white dark:bg-slate-800 rounded-[2rem] text-center text-slate-400 font-bold">
                Сотрудники не найдены
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && isChief && (
          <div className="space-y-10 animate-in fade-in">
            <section className="bg-white p-10 rounded-[3rem] shadow-2xl overflow-x-auto text-slate-900">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-black uppercase">Реестр медосмотров</h2>
                  <p className="text-sm font-bold text-slate-400">Приложение №2 за {reportDate}</p>
                </div>
                <button
                  onClick={() => printDoc('official-journal', `Journal_Appx2_${targetDate}`, 'landscape')}
                  className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
                >
                  <Printer size={20} /> Печать всего журнала
                </button>
              </div>

              <div id="official-journal" className="p-4 bg-white text-black font-serif min-w-[1050px]">
                <div className="text-right text-[10px] mb-2">Приложение №2</div>
                <h3 className="text-center font-bold text-sm mb-1">ЖУРНАЛ №___</h3>
                <h3 className="text-center font-bold text-sm mb-4">ПРЕДПОЛЕТНОГО МЕДИЦИНСКОГО ОСМОТРА ЧЛЕНОВ ЭКИПАЖЕЙ</h3>
                <p className="text-center text-[11px] mb-4">Дата: {reportDate}</p>

                <table className="w-full border-collapse border border-black text-[10px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-black p-1">№</th>
                      <th className="border border-black p-1">Дата и время</th>
                      <th className="border border-black p-1">Ф.И.О.</th>
                      <th className="border border-black p-1">Должность</th>
                      <th className="border border-black p-1">№ рейса</th>
                      <th className="border border-black p-1">Пульс</th>
                      <th className="border border-black p-1">АД</th>
                      <th className="border border-black p-1">Заключение</th>
                      <th className="border border-black p-1">Врач</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journals.map((journal, index) => {
                      const admitted = getAdmissionStatus(journal);

                      return (
                        <tr key={`${journal.id || journal.assignment_id || index}`} className="text-center">
                          <td className="border border-black p-1">{index + 1}</td>
                          <td className="border border-black p-1">{formatDateTime(journal.time || journal.created_at || journal.checked_at)}</td>
                          <td className="border border-black p-1 font-bold text-left">{journal.fio}</td>
                          <td className="border border-black p-1">{journal.pos || journal.position}</td>
                          <td className="border border-black p-1 font-bold">{journal.flight || journal.flight_number}</td>
                          <td className="border border-black p-1">{journal.pulse || '—'}</td>
                          <td className="border border-black p-1">{getBloodPressure(journal)}</td>
                          <td className="border border-black p-1 font-bold">{admitted ? 'Допущен' : 'ОТСТРАНЕН'}</td>
                          <td className="border border-black p-1">{journal.medic || medicName}</td>
                        </tr>
                      );
                    })}

                    {journals.length === 0 && (
                      <tr>
                        <td colSpan="9" className="border border-black p-4 text-center">Записей за выбранную дату нет</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white p-10 rounded-[3rem] shadow-2xl overflow-x-auto text-slate-900">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-black uppercase text-rose-600">Журнал отстранений от полетов</h2>
                  <p className="text-sm font-bold text-slate-400">Приложение №4 за {reportDate}</p>
                </div>
                <button
                  onClick={() => printDoc('suspension-journal', `Journal_Appx4_${targetDate}`, 'landscape')}
                  className="bg-rose-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
                >
                  <Printer size={20} /> Печать журнала
                </button>
              </div>

              <div id="suspension-journal" className="p-4 bg-white text-black font-serif min-w-[950px]">
                <div className="text-right text-[10px] mb-2">Приложение №4</div>
                <h3 className="text-center font-bold text-sm mb-1">ЖУРНАЛ №___</h3>
                <h3 className="text-center font-bold text-sm mb-4">ОТСТРАНЕНИЙ ОТ ПОЛЕТОВ ПО МЕДИЦИНСКИМ ПОКАЗАНИЯМ</h3>
                <p className="text-center text-[11px] mb-4">Дата: {reportDate}</p>

                <table className="w-full border-collapse border border-black text-[10px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-black p-1">№</th>
                      <th className="border border-black p-1">Дата и время</th>
                      <th className="border border-black p-1">Ф.И.О.</th>
                      <th className="border border-black p-1">Должность</th>
                      <th className="border border-black p-1">№ рейса</th>
                      <th className="border border-black p-1">Причина отстранения</th>
                      <th className="border border-black p-1">Врач</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suspendedJournals.map((journal, index) => (
                      <tr key={`${journal.id || journal.assignment_id || index}`} className="text-center">
                        <td className="border border-black p-1">{index + 1}</td>
                        <td className="border border-black p-1">{formatDateTime(journal.time || journal.created_at || journal.checked_at)}</td>
                        <td className="border border-black p-1 font-bold text-left">{journal.fio}</td>
                        <td className="border border-black p-1">{journal.pos || journal.position}</td>
                        <td className="border border-black p-1 font-bold">{journal.flight || journal.flight_number}</td>
                        <td className="border border-black p-1 text-left">{getComplaints(journal)}</td>
                        <td className="border border-black p-1">{journal.medic || medicName}</td>
                      </tr>
                    ))}

                    {suspendedJournals.length === 0 && (
                      <tr>
                        <td colSpan="7" className="border border-black p-4 text-center">Отстранений за выбранную дату нет</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>

      {showModal && selectedCrew && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
            <h2 className="text-3xl font-black mb-2 leading-tight">{selectedCrew.fio}</h2>
            <p className="text-blue-600 font-bold mb-8 uppercase tracking-widest text-sm">Борт: {selectedCrew.flight_number}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Пульс</label>
                <input
                  type="number"
                  value={checkData.pulse}
                  onChange={(event) => setCheckData({ ...checkData, pulse: event.target.value })}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-mono text-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Давление</label>
                <input
                  type="text"
                  value={checkData.bp}
                  onChange={(event) => setCheckData({ ...checkData, bp: event.target.value })}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-mono text-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Температура</label>
                <input
                  type="text"
                  value={checkData.temp}
                  onChange={(event) => setCheckData({ ...checkData, temp: event.target.value })}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-mono text-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Алкотест</label>
                <select
                  value={checkData.alcohol}
                  onChange={(event) => setCheckData({ ...checkData, alcohol: event.target.value })}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Отрицательно">Отрицательно</option>
                  <option value="ПОЛОЖИТЕЛЬНО">ПОЛОЖИТЕЛЬНО</option>
                </select>
              </div>
            </div>

            <div className="mb-8">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Жалобы / причина</label>
              <input
                type="text"
                value={checkData.complaints}
                onChange={(event) => setCheckData({ ...checkData, complaints: event.target.value })}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex gap-4 mb-8">
              <button
                onClick={() => setCheckData({ ...checkData, is_admitted: true })}
                className={`flex-1 py-4 rounded-2xl font-black transition-all ${checkData.is_admitted ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
              >
                <UserCheck size={16} className="inline mr-2" />
                ДОПУСТИТЬ
              </button>
              <button
                onClick={() => setCheckData({ ...checkData, is_admitted: false })}
                className={`flex-1 py-4 rounded-2xl font-black transition-all ${!checkData.is_admitted ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
              >
                <UserX size={16} className="inline mr-2" />
                ОТСТРАНИТЬ
              </button>
            </div>

            {!checkData.is_admitted && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                <button
                  onClick={() => printDoc('suspension-appx5', `Spravka_Otstranenie_${selectedCrew.user_id || selectedCrew.assignment_id || targetDate}`, 'portrait')}
                  className="p-3 bg-rose-50 text-rose-600 rounded-xl font-bold text-xs border border-rose-200"
                >
                  <Printer size={14} className="inline mr-2" />
                  Печать справки №5
                </button>
                <button
                  onClick={() => printDoc('direction-appx1', `Napravlenie_Analiz_${selectedCrew.user_id || selectedCrew.assignment_id || targetDate}`, 'portrait')}
                  className="p-3 bg-rose-50 text-rose-600 rounded-xl font-bold text-xs border border-rose-200"
                >
                  <Printer size={14} className="inline mr-2" />
                  Печать направления №1
                </button>
              </div>
            )}

            <div className="flex gap-4">
              <button onClick={() => setShowModal(false)} className="flex-1 py-4 font-bold text-slate-400">
                Закрыть
              </button>
              <button
                onClick={handleSaveCheck}
                disabled={loading || !checkData.pulse}
                className="flex-1 py-4 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl font-black shadow-xl disabled:opacity-50"
              >
                {loading ? '...' : 'Сохранить в базу'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', left: '-10000px', top: 0, width: '210mm', background: '#fff', color: '#000' }}>
        <div id="suspension-appx5" className="p-20 bg-white text-black font-serif text-[14px] leading-7">
          <div className="text-right mb-10">ПРИЛОЖЕНИЕ № 5</div>
          <h2 className="text-center font-bold text-xl mb-10">СПРАВКА ОБ ОТСТРАНЕНИИ ОТ ПОЛЕТА</h2>

          <p className="mb-4">
            Настоящим подтверждается, что <b>{selectedCrew?.fio}</b>
          </p>
          <p className="mb-4">
            в должности <b>{selectedCrew?.position}</b>
          </p>
          <p className="mb-4">
            отстранен(а) от полета на рейсе <b>{selectedCrew?.flight_number}</b> по медицинским показаниям.
          </p>
          <p className="mb-4">
            Дата осмотра: <b>{reportDate}</b>
          </p>
          <p className="mb-4">
            Показатели: ЧСС <b>{checkData.pulse || '___'}</b>, АД <b>{checkData.bp || '___'}</b>, температура <b>{checkData.temp || '___'}</b>, алкотест <b>{checkData.alcohol || '___'}</b>.
          </p>
          <p className="mb-10">
            Причина / жалобы: <b>{checkData.complaints || 'Нет'}</b>
          </p>

          <div className="flex justify-between mt-40 border-t border-black pt-4">
            <span>М.П.</span>
            <span>Врач: ________________ / {medicName}</span>
          </div>
        </div>

        <div id="direction-appx1" className="p-20 bg-white text-black font-serif text-[14px] leading-7">
          <div className="text-right mb-10">ПРИЛОЖЕНИЕ № 1</div>
          <h2 className="text-center font-bold text-xl mb-10">НАПРАВЛЕНИЕ НА ОСВИДЕТЕЛЬСТВОВАНИЕ</h2>

          <p className="mb-6">
            Направить: <b>{selectedCrew?.fio}</b>
          </p>
          <p className="mb-6">
            Должность: <b>{selectedCrew?.position}</b>
          </p>
          <p className="mb-6">
            Рейс: <b>{selectedCrew?.flight_number}</b>
          </p>
          <p className="mb-6">
            Основание: отклонение показателей / медицинские признаки. ЧСС: <b>{checkData.pulse || '___'}</b>, АД: <b>{checkData.bp || '___'}</b>, температура: <b>{checkData.temp || '___'}</b>, алкотест: <b>{checkData.alcohol || '___'}</b>.
          </p>
          <p className="mb-10">
            Причина / жалобы: <b>{checkData.complaints || 'Нет'}</b>
          </p>

          <div className="mt-40 border-t border-black pt-4 text-center">
            Подпись должностного лица: ________________ / {medicName}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicPage;
