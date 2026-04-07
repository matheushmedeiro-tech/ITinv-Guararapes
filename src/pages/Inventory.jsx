import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/api/apiClient';

const defaultAppState = {
  equipment: [
    {
      id: '1',
      name: 'Workstation A1',
      type: 'Computer',
      origin: 'Warehouse',
      formatted: true,
      configured: true,
      status: 'OK',
      problemDescription: '',
      loaned: false,
      loanTo: '',
      loanDate: ''
    },
    {
      id: '2',
      name: 'Reception Monitor',
      type: 'Monitor',
      origin: 'New stock',
      formatted: false,
      configured: false,
      status: 'Problem',
      problemType: 'Screen issue',
      problemDescription: 'Flickering screen during startup.',
      loaned: true,
      loanTo: 'Finance',
      loanDate: '2026-04-01'
    },
    {
      id: '3',
      name: 'Finance Notebook',
      type: 'Notebook',
      origin: 'Lease',
      formatted: true,
      configured: false,
      status: 'OK',
      problemType: '',
      problemDescription: '',
      loaned: false,
      loanTo: '',
      loanDate: ''
    }
  ],
  equipmentTypes: ['Computer', 'Monitor', 'Notebook', 'Printer', 'Other'],
  origins: ['Warehouse', 'New stock', 'Lease', 'Office', 'Repair'],
  problemTypes: ['Screen issue', 'Battery', 'Performance', 'Network', 'Other']
};

const normalizeAppState = (state) => ({
  ...state,
  equipment: (state.equipment || []).map((item) => ({
    loaned: false,
    loanTo: '',
    loanDate: '',
    ...item
  })),
  equipmentTypes: state.equipmentTypes || defaultAppState.equipmentTypes,
  origins: state.origins || defaultAppState.origins,
  problemTypes: state.problemTypes || defaultAppState.problemTypes
});

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const getTodayDateValue = () => new Date().toISOString().slice(0, 10);

const formatLoanDuration = (loanDate) => {
  if (!loanDate) return '';
  const date = new Date(loanDate);
  if (Number.isNaN(date.getTime())) return loanDate;

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return `Hoje (${date.toLocaleDateString('pt-BR')})`;
  return `Desde ${date.toLocaleDateString('pt-BR')} (${diffDays} dia${diffDays !== 1 ? 's' : ''})`;
};

const initialFormState = {
  name: '',
  type: '',
  origin: '',
  formatted: false,
  configured: false,
  status: 'OK',
  problemType: '',
  problemDescription: '',
  loaned: false,
  loanTo: '',
  loanDate: ''
};

export default function Inventory() {
  const [appState, setAppState] = useState(defaultAppState);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState('');
  const [selectedProblemType, setSelectedProblemType] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(initialFormState);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState('equipment');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemEmoji, setNewItemEmoji] = useState('📦');
  
  // Autocomplete states
  const [typeInputValue, setTypeInputValue] = useState('');
  const [typeShowDropdown, setTypeShowDropdown] = useState(false);
  const [originInputValue, setOriginInputValue] = useState('');
  const [originShowDropdown, setOriginShowDropdown] = useState(false);
  const [problemTypeInputValue, setProblemTypeInputValue] = useState('');
  const [problemTypeShowDropdown, setProblemTypeShowDropdown] = useState(false);

  const typeDropdownRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const originDropdownRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const problemTypeDropdownRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  useEffect(() => {
    const loadState = async () => {
      try {
        const remoteState = await apiClient.get('/api/app-state');
        setAppState(normalizeAppState(remoteState));
        setBackendAvailable(true);
      } catch (error) {
        console.warn('Failed to load backend state:', error);
      } finally {
        setIsLoadingState(false);
      }
    };

    loadState();
  }, []);

  useEffect(() => {
    if (isLoadingState || !backendAvailable) return;

    const syncState = async () => {
      try {
        await apiClient.post('/api/app-state', appState);
      } catch (error) {
        console.warn('Failed to sync state to backend:', error);
        setBackendAvailable(false);
      }
    };

    syncState();
  }, [appState, backendAvailable, isLoadingState]);

  useEffect(() => {
    if (!isModalOpen) return;

    /**
     * @param {MouseEvent} event
     */
    const handleClickOutside = (event) => {
      const target = event.target;
      if (typeShowDropdown && typeDropdownRef.current && target instanceof Node && !typeDropdownRef.current.contains(target)) {
        setTypeShowDropdown(false);
      }
      if (originShowDropdown && originDropdownRef.current && target instanceof Node && !originDropdownRef.current.contains(target)) {
        setOriginShowDropdown(false);
      }
      if (problemTypeShowDropdown && problemTypeDropdownRef.current && target instanceof Node && !problemTypeDropdownRef.current.contains(target)) {
        setProblemTypeShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModalOpen, typeShowDropdown, originShowDropdown, problemTypeShowDropdown]);

  const filteredEquipment = useMemo(() => {
    return appState.equipment
      .filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
      .filter((item) => (selectedType ? item.type === selectedType : true))
      .filter((item) => (selectedOrigin ? item.origin === selectedOrigin : true))
      .filter((item) => (selectedProblemType ? item.problemType === selectedProblemType : true));
  }, [appState.equipment, search, selectedType, selectedOrigin, selectedProblemType]);

  const totalCount = appState.equipment.length;
  const totalProblems = appState.equipment.filter((item) => item.status === 'Problem').length;
  const totalReady = appState.equipment.filter((item) => item.status === 'OK').length;

  const openAddForm = () => {
    setEditingId(null);
    setFormValues(initialFormState);
    setIsModalOpen(true);
  };

  const openEditForm = (item) => {
    setEditingId(item.id);
    setFormValues({
      name: item.name,
      type: item.type,
      origin: item.origin,
      formatted: item.formatted,
      configured: item.configured,
      status: item.status,
      problemType: item.problemType || appState.problemTypes[0] || 'Other',
      problemDescription: item.problemDescription || '',
      loaned: item.loaned ?? false,
      loanTo: item.loanTo || '',
      loanDate: item.loaned ? item.loanDate || getTodayDateValue() : ''
    });
    setIsModalOpen(true);
  };

  const closeForm = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormValues(initialFormState);
  };

  const saveEquipment = (event) => {
    event.preventDefault();
    
    // Validar campos obrigatórios
    if (!formValues.name.trim()) return;
    if (!formValues.type) return;
    if (!formValues.origin) return;
    if (formValues.status === 'Problem' && !formValues.problemType) return;
    if (formValues.loaned && !formValues.loanTo.trim()) return;
    
    const payload = {
      ...formValues,
      name: formValues.name.trim(),
      origin: formValues.origin.trim(),
      problemType: formValues.status === 'Problem' ? formValues.problemType : '',
      problemDescription: formValues.status === 'Problem' ? formValues.problemDescription.trim() : '',
      loaned: formValues.loaned,
      loanTo: formValues.loaned ? formValues.loanTo.trim() : '',
      loanDate: formValues.loaned ? formValues.loanDate || getTodayDateValue() : ''
    };

    if (editingId) {
      setAppState((prev) => ({
        ...prev,
        equipment: prev.equipment.map((item) =>
          item.id === editingId ? { ...item, ...payload, id: editingId } : item
        )
      }));
    } else {
      setAppState((prev) => ({
        ...prev,
        equipment: [{ ...payload, id: generateId() }, ...prev.equipment]
      }));
    }
    closeForm();
  };

  const deleteEquipment = (id) => {
    setAppState((prev) => ({
      ...prev,
      equipment: prev.equipment.filter((item) => item.id !== id)
    }));
  };

  const resolveEquipment = (id) => {
    setAppState((prev) => ({
      ...prev,
      equipment: prev.equipment.map((item) =>
        item.id === id
          ? { ...item, status: 'OK', problemDescription: item.problemDescription || '', problemType: item.problemType || prev.problemTypes[0] }
          : item
      )
    }));
  };

  const reopenEquipment = (id) => {
    setAppState((prev) => ({
      ...prev,
      equipment: prev.equipment.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'Problem',
              problemType: item.problemType || prev.problemTypes[0] || 'Other',
              problemDescription: item.problemDescription || ''
            }
          : item
      )
    }));
  };

  const addManageItem = (event) => {
    event.preventDefault();
    const name = newItemLabel.trim();
    if (!name) return;

    setAppState((prev) => {
      const next = { ...prev };
      if (manageTab === 'equipment') {
        if (!next.equipmentTypes.includes(name)) {
          next.equipmentTypes = [...next.equipmentTypes, name];
        }
      } else if (manageTab === 'origin') {
        if (!next.origins.includes(name)) {
          next.origins = [...next.origins, name];
        }
      } else {
        if (!next.problemTypes.includes(name)) {
          next.problemTypes = [...next.problemTypes, name];
        }
      }
      return next;
    });
    setNewItemLabel('');
    setNewItemEmoji('📦');
  };

  const removeManageItem = (value) => {
    setAppState((prev) => {
      const next = { ...prev };
      if (manageTab === 'equipment') {
        next.equipmentTypes = prev.equipmentTypes.filter((item) => item !== value);
      } else if (manageTab === 'origin') {
        next.origins = prev.origins.filter((item) => item !== value);
      } else {
        next.problemTypes = prev.problemTypes.filter((item) => item !== value);
      }
      return next;
    });
  };

  const manageItems =
    manageTab === 'equipment'
      ? appState.equipmentTypes
      : manageTab === 'origin'
      ? appState.origins
      : appState.problemTypes;

  // Autocomplete filters
  const filteredTypes = appState.equipmentTypes.filter((type) =>
    type.toLowerCase().includes(typeInputValue.toLowerCase())
  );
  
  const filteredOrigins = appState.origins.filter((origin) =>
    origin.toLowerCase().includes(originInputValue.toLowerCase())
  );
  
  const filteredProblems = appState.problemTypes.filter((problem) =>
    problem.toLowerCase().includes(problemTypeInputValue.toLowerCase())
  );

  // Reset autocomplete when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setTypeInputValue(formValues.type);
      setOriginInputValue(formValues.origin);
      setProblemTypeInputValue(formValues.problemType);
    }
  }, [isModalOpen, formValues.type, formValues.origin, formValues.problemType]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Inventário de TI</p>
            <h1 className="text-3xl font-semibold">Painel de equipamentos</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={openAddForm} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition">
              + Novo equipamento
            </button>
            <button onClick={() => setManageOpen((open) => !open)} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition">
              {manageOpen ? 'Fechar tipos' : 'Gerenciar tipos'}
            </button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3 mb-6">
          <article className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
            <span className="text-sm text-slate-500">Total de equipamentos</span>
            <p className="mt-2 text-3xl font-semibold">{totalCount}</p>
          </article>
          <article className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
            <span className="text-sm text-slate-500">Com problemas</span>
            <p className="mt-2 text-3xl font-semibold text-rose-600">{totalProblems}</p>
          </article>
          <article className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
            <span className="text-sm text-slate-500">Prontos</span>
            <p className="mt-2 text-3xl font-semibold text-emerald-600">{totalReady}</p>
          </article>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex-1 min-w-0">
              <label className="text-sm text-slate-500">Buscar por nome</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Pesquisar equipamento..."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-slate-500">Filtrar por tipo</span>
                <select
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">Todos os tipos</option>
                  {appState.equipmentTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-slate-500">Filtrar por origem</span>
                <select
                  value={selectedOrigin}
                  onChange={(event) => setSelectedOrigin(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">Todas as origens</option>
                  {appState.origins.map((origin) => (
                    <option key={origin} value={origin}>{origin}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-slate-500">Filtrar por problema</span>
                <select
                  value={selectedProblemType}
                  onChange={(event) => setSelectedProblemType(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">Todos os problemas</option>
                  {appState.problemTypes.map((problemType) => (
                    <option key={problemType} value={problemType}>{problemType}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm border border-slate-200">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-4 text-left">Nome</th>
                <th className="px-4 py-4 text-left">Tipo</th>
                <th className="px-4 py-4 text-left">Origem</th>
                <th className="px-4 py-4 text-left">Emprestado</th>
                <th className="px-4 py-4 text-left">Destino</th>
                <th className="px-4 py-4 text-left">Desde</th>
                <th className="px-4 py-4 text-left">Formatado</th>
                <th className="px-4 py-4 text-left">Configurado</th>
                <th className="px-4 py-4 text-left">Status</th>
                <th className="px-4 py-4 text-left">Problema</th>
                <th className="px-4 py-4 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipment.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-4">{item.name}</td>
                  <td className="px-4 py-4">{item.type}</td>
                  <td className="px-4 py-4">{item.origin}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.loaned ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {item.loaned ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td className="px-4 py-4">{item.loaned ? item.loanTo || '-' : '-'}</td>
                  <td className="px-4 py-4">{item.loaned ? formatLoanDuration(item.loanDate) : '-'}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.formatted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {item.formatted ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {item.configured ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">{item.status === 'Problem' ? `${item.problemType}${item.problemDescription ? ` - ${item.problemDescription}` : ''}` : '-'}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => openEditForm(item)} className="rounded-full bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition">
                        Editar
                      </button>
                      <button onClick={() => deleteEquipment(item.id)} className="rounded-full bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200 transition">
                        Remover
                      </button>
                      {item.status === 'Problem' ? (
                        <button onClick={() => resolveEquipment(item.id)} className="rounded-full bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition">
                          Resolver
                        </button>
                      ) : (
                        <button onClick={() => reopenEquipment(item.id)} className="rounded-full bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition">
                          Reabrir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEquipment.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-500">Nenhum equipamento encontrado.</div>
          )}
        </section>

        {manageOpen && (
          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Gerenciar</p>
                <h2 className="text-xl font-semibold">Tipos e origens</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setManageTab('equipment')} className={`rounded-full px-4 py-2 text-sm ${manageTab === 'equipment' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  Tipos
                </button>
                <button onClick={() => setManageTab('origin')} className={`rounded-full px-4 py-2 text-sm ${manageTab === 'origin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  Origens
                </button>
                <button onClick={() => setManageTab('problem')} className={`rounded-full px-4 py-2 text-sm ${manageTab === 'problem' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  Problemas
                </button>
              </div>
            </div>
            <form onSubmit={addManageItem} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              {manageTab === 'equipment' && (
                <input value={newItemEmoji} onChange={(e) => setNewItemEmoji(e.target.value)} className="w-16 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-center text-xl" maxLength={2} />
              )}
              <input
                value={newItemLabel}
                onChange={(event) => setNewItemLabel(event.target.value)}
                placeholder={`Adicionar novo ${manageTab === 'equipment' ? 'tipo' : manageTab === 'origin' ? 'origem' : 'tipo de problema'}`}
                className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500"
              />
              <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700">
                Adicionar
              </button>
            </form>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {manageItems.map((item) => (
                <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span>{item}</span>
                  <button onClick={() => removeManageItem(item)} className="text-sm font-semibold text-rose-600 hover:text-rose-800">
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Formulário</p>
                <h2 className="text-2xl font-semibold">{editingId ? 'Editar equipamento' : 'Adicionar equipamento'}</h2>
              </div>
              <button onClick={closeForm} className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200">
                Fechar
              </button>
            </div>
            <form onSubmit={saveEquipment} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-slate-700">Nome</span>
                  <input
                    name="name"
                    value={formValues.name}
                    onChange={(event) => setFormValues({ ...formValues, name: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        const input = document.querySelector('[role="type-input"]');
                        if (input instanceof HTMLInputElement) input.focus();
                      }
                    }}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500"
                    required
                  />
                </label>
                <div className="block">
                  <span className="text-sm text-slate-700">Tipo</span>
                  <div ref={typeDropdownRef} className="relative mt-2">
                    <input
                      type="text"
                      role="type-input"
                      value={typeInputValue}
                      onChange={(event) => {
                        setTypeInputValue(event.target.value);
                        setTypeShowDropdown(true);
                      }}
                      onMouseDown={() => setTypeShowDropdown(true)}
                      onKeyDown={(event) => {
                        if (event.key === 'Tab' || event.key === 'Enter') {
                          event.preventDefault();
                          if (filteredTypes.length > 0) {
                            const selected = filteredTypes[0];
                            setFormValues({ ...formValues, type: selected });
                            setTypeInputValue(selected);
                            setTypeShowDropdown(false);
                            if (event.key === 'Enter') {
                              const input = document.querySelector('[name="origin"]');
                              if (input instanceof HTMLInputElement) input.focus();
                            }
                          }
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500"
                      placeholder="Digite ou selecione..."
                    />
                    {typeShowDropdown && filteredTypes.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-300 rounded-2xl shadow-lg z-10">
                        {filteredTypes.map((type) => (
                          <div
                            key={type}
                            onClick={() => {
                              setFormValues({ ...formValues, type });
                              setTypeInputValue(type);
                              setTypeShowDropdown(false);
                            }}
                            className="px-4 py-3 hover:bg-slate-100 cursor-pointer"
                          >
                            {type}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="block">
                  <span className="text-sm text-slate-700">Origem</span>
                  <div ref={originDropdownRef} className="relative mt-2">
                    <input
                      type="text"
                      name="origin"
                      value={originInputValue}
                      onChange={(event) => {
                        setOriginInputValue(event.target.value);
                        setOriginShowDropdown(true);
                      }}
                      onMouseDown={() => setOriginShowDropdown(true)}
                      onKeyDown={(event) => {
                        if (event.key === 'Tab' || event.key === 'Enter') {
                          event.preventDefault();
                          if (filteredOrigins.length > 0) {
                            const selected = filteredOrigins[0];
                            setFormValues({ ...formValues, origin: selected });
                            setOriginInputValue(selected);
                            setOriginShowDropdown(false);
                            if (event.key === 'Enter') {
                              const check = document.querySelector('[name="formatted"]');
                              if (check instanceof HTMLInputElement) check.focus();
                            }
                          }
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500"
                      placeholder="Digite ou selecione..."
                    />
                    {originShowDropdown && filteredOrigins.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-300 rounded-2xl shadow-lg z-10">
                        {filteredOrigins.map((origin) => (
                          <div
                            key={origin}
                            onClick={() => {
                              setFormValues({ ...formValues, origin });
                              setOriginInputValue(origin);
                              setOriginShowDropdown(false);
                            }}
                            className="px-4 py-3 hover:bg-slate-100 cursor-pointer"
                          >
                            {origin}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="formatted"
                      checked={formValues.formatted}
                      onChange={(event) => setFormValues({ ...formValues, formatted: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                    Formatado
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="configured"
                      checked={formValues.configured}
                      onChange={(event) => setFormValues({ ...formValues, configured: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                    Configurado
                  </label>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-slate-700">Status</span>
                  <select
                    value={formValues.status}
                    onChange={(event) => {
                      const nextStatus = event.target.value;
                      setFormValues((prev) => ({
                        ...prev,
                        status: nextStatus,
                        problemType: nextStatus === 'Problem' ? prev.problemType || appState.problemTypes[0] : prev.problemType,
                        problemDescription: nextStatus === 'Problem' ? prev.problemDescription : prev.problemDescription
                      }));
                    }}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500"
                  >
                    <option value="OK">OK</option>
                    <option value="Problem">Problem</option>
                  </select>
                </label>
                <div className="block">
                  <span className="text-sm text-slate-700">Tipo de problema</span>
                  <div ref={problemTypeDropdownRef} className="relative mt-2">
                    <input
                      type="text"
                      name="problemType"
                      value={problemTypeInputValue}
                      onChange={(event) => {
                        setProblemTypeInputValue(event.target.value);
                        setProblemTypeShowDropdown(true);
                      }}
                      onMouseDown={() => setProblemTypeShowDropdown(true)}
                      onKeyDown={(event) => {
                        if (event.key === 'Tab' || event.key === 'Enter') {
                          event.preventDefault();
                          if (filteredProblems.length > 0) {
                            const selected = filteredProblems[0];
                            setFormValues({ ...formValues, problemType: selected });
                            setProblemTypeInputValue(selected);
                            setProblemTypeShowDropdown(false);
                            if (event.key === 'Enter') {
                              const input = document.querySelector('[name="problemDescription"]');
                              if (input instanceof HTMLTextAreaElement) input.focus();
                            }
                          }
                        }
                      }}
                      disabled={formValues.status !== 'Problem'}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500 disabled:bg-slate-100"
                      placeholder="Digite ou selecione..."
                    />
                    {problemTypeShowDropdown && filteredProblems.length > 0 && formValues.status === 'Problem' && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-300 rounded-2xl shadow-lg z-10">
                        {filteredProblems.map((problem) => (
                          <div
                            key={problem}
                            onClick={() => {
                              setFormValues({ ...formValues, problemType: problem });
                              setProblemTypeInputValue(problem);
                              setProblemTypeShowDropdown(false);
                            }}
                            className="px-4 py-3 hover:bg-slate-100 cursor-pointer"
                          >
                            {problem}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <label className="block">
                  <span className="text-sm text-slate-700">Descrição do problema</span>
                  <textarea
                    name="problemDescription"
                    value={formValues.problemDescription}
                    onChange={(event) => setFormValues({ ...formValues, problemDescription: event.target.value })}
                    onKeyDown={(event) => {
                      // Ctrl+Enter ou Cmd+Enter para submeter
                      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true }));
                      }
                    }}
                    className="mt-2 h-28 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500"
                    disabled={formValues.status !== 'Problem'}
                    placeholder={formValues.status === 'Problem' ? 'Descreva o problema...' : 'Mude o status para Problem para detalhar o problema.'}
                    required={formValues.status === 'Problem'}
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={formValues.loaned}
                    onChange={(event) =>
                      setFormValues((prev) => ({
                        ...prev,
                        loaned: event.target.checked,
                        loanTo: event.target.checked ? prev.loanTo : '',
                        loanDate: event.target.checked ? prev.loanDate || getTodayDateValue() : ''
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  />
                  Emprestado
                </label>
              </div>
              {formValues.loaned && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-slate-700">Destino / Setor</span>
                    <select
                      value={formValues.loanTo}
                      onChange={(event) => setFormValues({ ...formValues, loanTo: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500"
                      required
                    >
                      <option value="">Selecione um setor</option>
                      {appState.origins.map((origin) => (
                        <option key={origin} value={origin}>{origin}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm text-slate-700">Data do empréstimo</span>
                    <input
                      type="date"
                      value={formValues.loanDate}
                      onChange={(event) => setFormValues({ ...formValues, loanDate: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500"
                    />
                  </label>
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeForm} className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
                  Salvar equipamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
