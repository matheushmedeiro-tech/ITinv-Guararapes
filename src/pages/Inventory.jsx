import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useAppState } from '@/hooks/useAppState';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getTodayDateValue = () => new Date().toISOString().slice(0, 10);
const normalizeText = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  return diffDays === 0
    ? `Hoje (${date.toLocaleDateString('pt-BR')})`
    : `${date.toLocaleDateString('pt-BR')} (${diffDays}d)`;
};

// ─── Initial form states ─────────────────────────────────────────────────────
const initialPatrimonioForm = {
  name: '', type: '', origin: '',
  formatted: false, configured: false,
  status: 'OK', problemType: '', problemDescription: ''
};
const initialStockItemForm = { type: '', origin: '', totalQuantity: 1, minQuantity: 0, notes: '' };
const initialLoanForm = { quantity: 1, loanTo: '', loanDate: '', notes: '' };

export default function Inventory() {
  const { appState, setAppState, isLoading: isLoadingState, isSaving, saveError, dismissError } = useAppState();
  const { logout } = useAuth();

  // ── Panel toggle ─────────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState('patrimonio');

  // ── Patrimônio state ──────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState('');
  const [selectedProblemType, setSelectedProblemType] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(initialPatrimonioForm);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState('equipment');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemEmoji, setNewItemEmoji] = useState('📦');

  // ── Estoque state ─────────────────────────────────────────────────────────
  const [stockSearch, setStockSearch] = useState('');
  const [stockTypeFilter, setStockTypeFilter] = useState('');
  const [stockView, setStockView] = useState('items'); // 'items' | 'loans'
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [editingStockId, setEditingStockId] = useState(null);
  const [stockItemForm, setStockItemForm] = useState(initialStockItemForm);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanTargetItem, setLoanTargetItem] = useState(null);
  const [loanForm, setLoanForm] = useState(initialLoanForm);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnTargetLoan, setReturnTargetLoan] = useState(null);
  const [returnQty, setReturnQty] = useState(1);
  const [stockManageOpen, setStockManageOpen] = useState(false);
  const [stockManageTab, setStockManageTab] = useState('type');
  const [newStockTypeLabel, setNewStockTypeLabel] = useState('');
  const [newStockLocationLabel, setNewStockLocationLabel] = useState('');
  const [newStockLoanDestinationLabel, setNewStockLoanDestinationLabel] = useState('');
  
  // ── Autocomplete refs/state (patrimônio form) ─────────────────────────────
  const [typeInputValue, setTypeInputValue] = useState('');
  const [typeShowDropdown, setTypeShowDropdown] = useState(false);
  const [originInputValue, setOriginInputValue] = useState('');
  const [originShowDropdown, setOriginShowDropdown] = useState(false);
  const [problemTypeInputValue, setProblemTypeInputValue] = useState('');
  const [problemTypeShowDropdown, setProblemTypeShowDropdown] = useState(false);
  const typeDropdownRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const originDropdownRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const problemTypeDropdownRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return;
      if (isReturnModalOpen) { closeReturnModal(); return; }
      if (isLoanModalOpen) { closeLoanModal(); return; }
      if (isStockModalOpen) { closeStockModal(); return; }
      if (isModalOpen) { closeForm(); return; }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  });

  useEffect(() => {
    if (!isModalOpen) return;
    const handler = (event) => {
      const target = event.target;
      if (typeShowDropdown && typeDropdownRef.current && target instanceof Node && !typeDropdownRef.current.contains(target)) setTypeShowDropdown(false);
      if (originShowDropdown && originDropdownRef.current && target instanceof Node && !originDropdownRef.current.contains(target)) setOriginShowDropdown(false);
      if (problemTypeShowDropdown && problemTypeDropdownRef.current && target instanceof Node && !problemTypeDropdownRef.current.contains(target)) setProblemTypeShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isModalOpen, typeShowDropdown, originShowDropdown, problemTypeShowDropdown]);

  // ── Patrimônio computed ───────────────────────────────────────────────────
  const filteredEquipment = useMemo(() =>
    appState.equipment
      .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
      .filter((i) => (selectedType ? i.type === selectedType : true))
      .filter((i) => (selectedOrigin ? i.origin === selectedOrigin : true))
      .filter((i) => (selectedProblemType ? i.problemType === selectedProblemType : true)),
    [appState.equipment, search, selectedType, selectedOrigin, selectedProblemType]
  );

  const totalCount = appState.equipment.length;
  const totalProblems = appState.equipment.filter((i) => i.status === 'Problem').length;
  const totalReady = appState.equipment.filter((i) => i.status === 'OK').length;

  const openAddForm = () => { setEditingId(null); setFormValues(initialPatrimonioForm); setIsModalOpen(true); };

  const openEditForm = (item) => {
    setEditingId(item.id);
    setFormValues({
      name: item.name,
      type: item.type,
      origin: item.origin,
      formatted: item.formatted,
      configured: item.configured,
      status: item.status,
      problemType: item.problemType || appState.problemTypes[0] || '',
      problemDescription: item.problemDescription || ''
    });
    setIsModalOpen(true);
  };

  const closeForm = () => { setIsModalOpen(false); setEditingId(null); setFormValues(initialPatrimonioForm); };

  const saveEquipment = (event) => {
    event.preventDefault();
    if (!formValues.name.trim() || !formValues.type || !formValues.origin) return;
    if (formValues.status === 'Problem' && !formValues.problemType) return;
    const payload = {
      ...formValues,
      name: formValues.name.trim(),
      origin: formValues.origin.trim(),
      problemType: formValues.status === 'Problem' ? formValues.problemType : '',
      problemDescription: formValues.status === 'Problem' ? formValues.problemDescription.trim() : ''
    };
    if (editingId) {
      setAppState((prev) => ({ ...prev, equipment: prev.equipment.map((i) => i.id === editingId ? { ...i, ...payload, id: editingId } : i) }));
    } else {
      setAppState((prev) => ({ ...prev, equipment: [{ ...payload, id: crypto.randomUUID() }, ...prev.equipment] }));
    }
    closeForm();
  };

  const deleteEquipment = (id) => {
    if (!window.confirm('Deseja remover este equipamento permanentemente?')) return;
    setAppState((prev) => ({ ...prev, equipment: prev.equipment.filter((i) => i.id !== id) }));
  };

  const resolveEquipment = (id) => setAppState((prev) => ({
    ...prev, equipment: prev.equipment.map((i) => i.id === id ? { ...i, status: 'OK' } : i)
  }));

  const reopenEquipment = (id) => setAppState((prev) => ({
    ...prev, equipment: prev.equipment.map((i) => i.id === id ? { ...i, status: 'Problem', problemType: i.problemType || prev.problemTypes[0] || 'Other' } : i)
  }));

  const addManageItem = (event) => {
    event.preventDefault();
    const name = newItemLabel.trim();
    if (!name) return;
    setAppState((prev) => {
      const next = { ...prev };
      if (manageTab === 'equipment' && !next.equipmentTypes.includes(name)) next.equipmentTypes = [...next.equipmentTypes, name];
      else if (manageTab === 'origin' && !next.origins.includes(name)) next.origins = [...next.origins, name];
      else if (manageTab === 'problem' && !next.problemTypes.includes(name)) next.problemTypes = [...next.problemTypes, name];
      return next;
    });
    setNewItemLabel('');
    setNewItemEmoji('📦');
  };

  const removeManageItem = (value) => {
    const itemLabel = manageTab === 'equipment' ? 'tipo' : manageTab === 'origin' ? 'origem' : 'tipo de problema';
    if (!window.confirm(`Deseja remover ${itemLabel} "${value}"?`)) return;
    setAppState((prev) => {
      const next = { ...prev };
      if (manageTab === 'equipment') next.equipmentTypes = prev.equipmentTypes.filter((i) => i !== value);
      else if (manageTab === 'origin') next.origins = prev.origins.filter((i) => i !== value);
      else next.problemTypes = prev.problemTypes.filter((i) => i !== value);
      return next;
    });
  };

  const manageItems = manageTab === 'equipment' ? appState.equipmentTypes : manageTab === 'origin' ? appState.origins : appState.problemTypes;

  // Autocomplete filters
  const filteredTypes = appState.equipmentTypes.filter((t) => t.toLowerCase().includes(typeInputValue.toLowerCase()));
  const filteredOrigins = appState.origins.filter((o) => o.toLowerCase().includes(originInputValue.toLowerCase()));
  const filteredProblems = appState.problemTypes.filter((p) => p.toLowerCase().includes(problemTypeInputValue.toLowerCase()));

  // Reset autocomplete when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setTypeInputValue(formValues.type);
      setOriginInputValue(formValues.origin);
      setProblemTypeInputValue(formValues.problemType);
    }
  }, [isModalOpen, formValues.type, formValues.origin, formValues.problemType]);

  // ── Estoque computed + handlers ───────────────────────────────────────────
  const getLoanedQty = (itemId) => appState.stockLoans.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.quantity, 0);
  const getAvailableQty = (item) => item.totalQuantity - getLoanedQty(item.id);

  const filteredStockItems = useMemo(() =>
    appState.stockItems
      .filter((i) => i.type.toLowerCase().includes(stockSearch.toLowerCase()))
      .filter((i) => (stockTypeFilter ? i.type === stockTypeFilter : true)),
    [appState.stockItems, stockSearch, stockTypeFilter]
  );

  const filteredLoans = useMemo(() =>
    appState.stockLoans
      .filter((l) => !stockSearch || l.itemType.toLowerCase().includes(stockSearch.toLowerCase()))
      .filter((l) => !stockTypeFilter || l.itemType === stockTypeFilter),
    [appState.stockLoans, stockSearch, stockTypeFilter]
  );

  const stockTotalItems = appState.stockItems.length;
  const stockTotalLoaned = appState.stockLoans.reduce((s, l) => s + l.quantity, 0);
  const stockTotalAvailable = appState.stockItems.reduce((s, i) => s + getAvailableQty(i), 0);
  const stockBelowMin = appState.stockItems.filter((i) => i.minQuantity > 0 && getAvailableQty(i) < i.minQuantity).length;

  const openStockAdd = () => { setEditingStockId(null); setStockItemForm(initialStockItemForm); setIsStockModalOpen(true); };
  const openStockEdit = (item) => {
    setEditingStockId(item.id);
    setStockItemForm({ type: item.type, origin: item.origin, totalQuantity: item.totalQuantity, minQuantity: item.minQuantity, notes: item.notes || '' });
    setIsStockModalOpen(true);
  };
  const closeStockModal = () => { setIsStockModalOpen(false); setEditingStockId(null); setStockItemForm(initialStockItemForm); };

  const saveStockItem = (event) => {
    event.preventDefault();
    if (!stockItemForm.type || !stockItemForm.origin.trim()) return;
    const qty = Math.max(1, Number(stockItemForm.totalQuantity) || 1);

    // A stock type must always stay bound to the same first location.
    const existingSameType = appState.stockItems.find(
      (i) => i.type === stockItemForm.type && i.id !== editingStockId
    );
    if (existingSameType && normalizeText(existingSameType.origin) !== normalizeText(stockItemForm.origin)) {
      window.alert(`O tipo "${stockItemForm.type}" já está vinculado ao local "${existingSameType.origin}".`);
      return;
    }

    if (!editingStockId) {
      const existing = appState.stockItems.find(
        (i) => i.type === stockItemForm.type
      );
      if (existing) {
        setAppState((prev) => ({ ...prev, stockItems: prev.stockItems.map((i) => i.id === existing.id ? { ...i, totalQuantity: i.totalQuantity + qty } : i) }));
        closeStockModal();
        return;
      }
      setAppState((prev) => ({ ...prev, stockItems: [{ ...stockItemForm, name: stockItemForm.type, totalQuantity: qty, id: crypto.randomUUID() }, ...prev.stockItems] }));
    } else {
      setAppState((prev) => ({ ...prev, stockItems: prev.stockItems.map((i) => i.id === editingStockId ? { ...i, ...stockItemForm, name: stockItemForm.type, totalQuantity: qty } : i) }));
    }
    closeStockModal();
  };

  const deleteStockItem = (id) => {
    if (!window.confirm('Deseja remover este item de estoque permanentemente?')) return;
    setAppState((prev) => ({
      ...prev,
      stockItems: prev.stockItems.filter((i) => i.id !== id),
      stockLoans: prev.stockLoans.filter((l) => l.itemId !== id)
    }));
  };

  const openLoanModal = (item) => { setLoanTargetItem(item); setLoanForm({ ...initialLoanForm, quantity: 1, loanDate: getTodayDateValue() }); setIsLoanModalOpen(true); };
  const closeLoanModal = () => { setIsLoanModalOpen(false); setLoanTargetItem(null); setLoanForm(initialLoanForm); };

  const saveLoan = (event) => {
    event.preventDefault();
    if (!loanTargetItem || !loanForm.loanTo.trim()) return;
    const qty = Math.max(1, Number(loanForm.quantity) || 1);
    if (qty > getAvailableQty(loanTargetItem)) return;
    setAppState((prev) => ({
      ...prev,
      stockLoans: [...prev.stockLoans, {
        id: crypto.randomUUID(), itemId: loanTargetItem.id, itemName: loanTargetItem.type,
        itemType: loanTargetItem.type, quantity: qty,
        loanTo: loanForm.loanTo.trim(), loanDate: loanForm.loanDate || getTodayDateValue(), notes: loanForm.notes || ''
      }]
    }));
    closeLoanModal();
  };

  const openReturnModal = (loan) => { setReturnTargetLoan(loan); setReturnQty(loan.quantity); setIsReturnModalOpen(true); };
  const closeReturnModal = () => { setIsReturnModalOpen(false); setReturnTargetLoan(null); setReturnQty(1); };

  const confirmReturn = (event) => {
    event.preventDefault();
    if (!returnTargetLoan) return;
    const qty = Math.min(Math.max(1, Number(returnQty) || 1), returnTargetLoan.quantity);
    setAppState((prev) => ({
      ...prev,
      stockLoans: qty >= returnTargetLoan.quantity
        ? prev.stockLoans.filter((l) => l.id !== returnTargetLoan.id)
        : prev.stockLoans.map((l) => l.id === returnTargetLoan.id ? { ...l, quantity: l.quantity - qty } : l)
    }));
    closeReturnModal();
  };

  const addStockType = (event) => {
    event.preventDefault();
    const name = newStockTypeLabel.trim();
    if (!name || appState.stockTypes.includes(name)) return;
    setAppState((prev) => ({ ...prev, stockTypes: [...prev.stockTypes, name] }));
    setNewStockTypeLabel('');
  };
  const removeStockType = (name) => {
    if (!window.confirm(`Deseja remover o tipo "${name}"?`)) return;
    setAppState((prev) => ({ ...prev, stockTypes: prev.stockTypes.filter((t) => t !== name) }));
  };

  const addStockLocation = (event) => {
    event.preventDefault();
    const name = newStockLocationLabel.trim();
    if (!name || appState.stockLocations.includes(name)) return;
    setAppState((prev) => ({ ...prev, stockLocations: [...prev.stockLocations, name] }));
    setNewStockLocationLabel('');
  };
  const removeStockLocation = (name) => {
    if (!window.confirm(`Deseja remover o local "${name}"?`)) return;
    setAppState((prev) => ({ ...prev, stockLocations: prev.stockLocations.filter((l) => l !== name) }));
  };

  const addStockLoanDestination = (event) => {
    event.preventDefault();
    const name = newStockLoanDestinationLabel.trim();
    if (!name || appState.stockLoanDestinations.includes(name)) return;
    setAppState((prev) => ({ ...prev, stockLoanDestinations: [...prev.stockLoanDestinations, name] }));
    setNewStockLoanDestinationLabel('');
  };
  const removeStockLoanDestination = (name) => {
    if (!window.confirm(`Deseja remover o destino "${name}"?`)) return;
    setAppState((prev) => ({ ...prev, stockLoanDestinations: prev.stockLoanDestinations.filter((d) => d !== name) }));
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Save status indicator */}
        {isSaving && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2 text-sm text-white shadow-lg">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> Salvando...
          </div>
        )}

        {/* Error banner */}
        {saveError && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-2xl bg-rose-600 px-5 py-3 text-sm text-white shadow-lg">
            <span>{saveError}</span>
            <button onClick={dismissError} className="font-bold hover:underline">✕</button>
          </div>
        )}

        {/* Header + panel toggle */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Inventário de TI</p>
            <h1 className="text-3xl font-semibold">Painel de equipamentos</h1>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex rounded-2xl border border-slate-300 overflow-hidden">
            <button onClick={() => setActivePanel('patrimonio')} className={`px-6 py-2 text-sm font-semibold transition ${activePanel === 'patrimonio' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
              Patrimônio
            </button>
            <button onClick={() => setActivePanel('estoque')} className={`px-6 py-2 text-sm font-semibold transition border-l border-slate-300 ${activePanel === 'estoque' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
              Estoque
            </button>
          </div>
          <button onClick={logout} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">
            Sair
          </button>
          </div>
        </header>

        {/* ════════════════ PAINEL PATRIMÔNIO ════════════════ */}
        {activePanel === 'patrimonio' && (
          <>
            <div className="flex flex-wrap gap-3 mb-6">
              <button onClick={openAddForm} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition">+ Novo equipamento</button>
              <button onClick={() => setManageOpen((o) => !o)} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition">
                {manageOpen ? 'Fechar tipos' : 'Gerenciar tipos'}
              </button>
            </div>

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
                <div>
                  <label className="text-sm text-slate-500">Buscar por nome</label>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-500" placeholder="Pesquisar equipamento..." />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-sm text-slate-500">Tipo</span>
                    <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-500">
                      <option value="">Todos os tipos</option>
                      {appState.equipmentTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm text-slate-500">Origem</span>
                    <select value={selectedOrigin} onChange={(e) => setSelectedOrigin(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-500">
                      <option value="">Todas as origens</option>
                      {appState.origins.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm text-slate-500">Problema</span>
                    <select value={selectedProblemType} onChange={(e) => setSelectedProblemType(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-500">
                      <option value="">Todos os problemas</option>
                      {appState.problemTypes.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl bg-white shadow-sm border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-4 text-left">Nome</th>
                      <th className="px-4 py-4 text-left">Tipo</th>
                      <th className="px-4 py-4 text-left">Origem</th>
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
                        <td className="px-4 py-4 font-medium">{item.name}</td>
                        <td className="px-4 py-4">{item.type}</td>
                        <td className="px-4 py-4">{item.origin}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.formatted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.formatted ? 'Sim' : 'Não'}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.configured ? 'Sim' : 'Não'}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{item.status}</span>
                        </td>
                        <td className="px-4 py-4 text-slate-500 text-xs max-w-[180px]">{item.status === 'Problem' ? `${item.problemType}${item.problemDescription ? ` — ${item.problemDescription}` : ''}` : '—'}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => openEditForm(item)} className="rounded-full bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition">Editar</button>
                            <button onClick={() => deleteEquipment(item.id)} className="rounded-full bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200 transition">Remover</button>
                            {item.status === 'Problem'
                              ? <button onClick={() => resolveEquipment(item.id)} className="rounded-full bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition">Resolver</button>
                              : <button onClick={() => reopenEquipment(item.id)} className="rounded-full bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition">Reabrir</button>
                            }
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredEquipment.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">Nenhum equipamento encontrado.</div>}
            </section>

            {manageOpen && (
              <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Gerenciar</p>
                    <h2 className="text-xl font-semibold">Tipos e origens</h2>
                  </div>
                  <div className="flex gap-2">
                    {['equipment', 'origin', 'problem'].map((tab) => (
                      <button key={tab} onClick={() => setManageTab(tab)} className={`rounded-full px-4 py-2 text-sm ${manageTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        {tab === 'equipment' ? 'Tipos' : tab === 'origin' ? 'Origens' : 'Problemas'}
                      </button>
                    ))}
                  </div>
                </div>
                <form onSubmit={addManageItem} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  {manageTab === 'equipment' && <input value={newItemEmoji} onChange={(e) => setNewItemEmoji(e.target.value)} className="w-16 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-center text-xl" maxLength={2} />}
                  <input value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)} placeholder={`Adicionar ${manageTab === 'equipment' ? 'tipo' : manageTab === 'origin' ? 'origem' : 'tipo de problema'}`} className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" />
                  <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700">Adicionar</button>
                </form>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {manageItems.map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span>{item}</span>
                      <button onClick={() => removeManageItem(item)} className="text-sm font-semibold text-rose-600 hover:text-rose-800">Remover</button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ════════════════ PAINEL ESTOQUE ════════════════ */}
        {activePanel === 'estoque' && (
          <>
            <div className="flex flex-wrap gap-3 mb-6">
              <button onClick={openStockAdd} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition">+ Adicionar item</button>
              <button onClick={() => setStockManageOpen((o) => !o)} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition">
                {stockManageOpen ? 'Fechar tipos' : 'Gerenciar tipos'}
              </button>
            </div>

            <section className="grid gap-4 sm:grid-cols-4 mb-6">
              <article className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
                <span className="text-sm text-slate-500">Itens cadastrados</span>
                <p className="mt-2 text-3xl font-semibold">{stockTotalItems}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
                <span className="text-sm text-slate-500">Disponível</span>
                <p className="mt-2 text-3xl font-semibold text-emerald-600">{stockTotalAvailable}</p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
                <span className="text-sm text-slate-500">Emprestado</span>
                <p className="mt-2 text-3xl font-semibold text-amber-600">{stockTotalLoaned}</p>
              </article>
              <article className={`rounded-3xl bg-white p-5 shadow-sm border ${stockBelowMin > 0 ? 'border-rose-300' : 'border-slate-200'}`}>
                <span className="text-sm text-slate-500">Abaixo do mínimo</span>
                <p className={`mt-2 text-3xl font-semibold ${stockBelowMin > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{stockBelowMin}</p>
              </article>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200 mb-6">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                  <button onClick={() => setStockView('items')} className={`px-4 py-2 text-sm font-medium ${stockView === 'items' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Todos os itens</button>
                  <button onClick={() => setStockView('loans')} className={`px-4 py-2 text-sm font-medium border-l border-slate-200 ${stockView === 'loans' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    Emprestados
                    {stockTotalLoaned > 0 && <span className={`ml-2 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold ${stockView === 'loans' ? 'bg-white text-slate-900' : 'bg-amber-500 text-white'}`}>{stockTotalLoaned}</span>}
                  </button>
                </div>
                <input value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} className="flex-1 min-w-[180px] rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-500" placeholder="Buscar por tipo..." />
                <select value={stockTypeFilter} onChange={(e) => setStockTypeFilter(e.target.value)} className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-500">
                  <option value="">Todos os tipos</option>
                  {appState.stockTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </section>

            {stockView === 'items' && (
              <section className="overflow-hidden rounded-3xl bg-white shadow-sm border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-4 text-left">Tipo</th>
                        <th className="px-4 py-4 text-left">Local</th>
                        <th className="px-4 py-4 text-center">Disponível</th>
                        <th className="px-4 py-4 text-center">Emprestado</th>
                        <th className="px-4 py-4 text-center">Total</th>
                        <th className="px-4 py-4 text-left">Obs</th>
                        <th className="px-4 py-4 text-left">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStockItems.map((item) => {
                        const loaned = getLoanedQty(item.id);
                        const available = item.totalQuantity - loaned;
                        const belowMin = item.minQuantity > 0 && available < item.minQuantity;
                        return (
                          <tr key={item.id} className={`border-t border-slate-100 ${belowMin ? 'bg-rose-50' : ''}`}>
                            <td className="px-4 py-4 font-medium">{item.type}</td>
                            <td className="px-4 py-4 text-slate-500">{item.origin}</td>
                            <td className="px-4 py-4 text-center">
                              <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold ${available <= 0 ? 'bg-rose-100 text-rose-700' : belowMin ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{available}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              {loaned > 0 ? <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold bg-amber-100 text-amber-700">{loaned}</span> : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-4 text-center font-semibold">{item.totalQuantity}</td>
                            <td className="px-4 py-4 text-slate-500 text-xs max-w-[140px]">{item.notes || '—'}</td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button onClick={() => openLoanModal(item)} disabled={available <= 0} className="rounded-full bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition disabled:opacity-40 disabled:cursor-not-allowed">Emprestar</button>
                                <button onClick={() => openStockEdit(item)} className="rounded-full bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition">Editar</button>
                                <button onClick={() => deleteStockItem(item.id)} className="rounded-full bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200 transition">Remover</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredStockItems.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">Nenhum item encontrado.</div>}
              </section>
            )}

            {stockView === 'loans' && (
              <section className="overflow-hidden rounded-3xl bg-white shadow-sm border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-4 text-left">Tipo</th>
                        <th className="px-4 py-4 text-center">Qtd emprestada</th>
                        <th className="px-4 py-4 text-left">Destino</th>
                        <th className="px-4 py-4 text-left">Data</th>
                        <th className="px-4 py-4 text-left">Obs</th>
                        <th className="px-4 py-4 text-left">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLoans.map((loan) => (
                        <tr key={loan.id} className="border-t border-slate-100">
                          <td className="px-4 py-4 font-medium">{loan.itemType}</td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold bg-amber-100 text-amber-700">{loan.quantity}</span>
                          </td>
                          <td className="px-4 py-4">{loan.loanTo}</td>
                          <td className="px-4 py-4 text-slate-500">{formatDate(loan.loanDate)}</td>
                          <td className="px-4 py-4 text-slate-500 text-xs">{loan.notes || '—'}</td>
                          <td className="px-4 py-4">
                            <button onClick={() => openReturnModal(loan)} className="rounded-full bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition">Devolver</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredLoans.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">Nenhum empréstimo ativo.</div>}
              </section>
            )}

            {stockManageOpen && (
              <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Gerenciar</p>
                  <h2 className="text-xl font-semibold">Tipos e locais do estoque</h2>
                </div>
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setStockManageTab('type')} className={`rounded-full px-4 py-2 text-sm ${stockManageTab === 'type' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Tipos</button>
                  <button onClick={() => setStockManageTab('location')} className={`rounded-full px-4 py-2 text-sm ${stockManageTab === 'location' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Locais</button>
                  <button onClick={() => setStockManageTab('destination')} className={`rounded-full px-4 py-2 text-sm ${stockManageTab === 'destination' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Destinos</button>
                </div>
                {stockManageTab === 'type' && (
                  <>
                    <form onSubmit={addStockType} className="flex gap-3 mb-5">
                      <input value={newStockTypeLabel} onChange={(e) => setNewStockTypeLabel(e.target.value)} placeholder="Adicionar novo tipo..." className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" />
                      <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700">Adicionar</button>
                    </form>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {appState.stockTypes.map((t) => (
                        <div key={t} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span>{t}</span>
                          <button onClick={() => removeStockType(t)} className="text-sm font-semibold text-rose-600 hover:text-rose-800">Remover</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {stockManageTab === 'location' && (
                  <>
                    <form onSubmit={addStockLocation} className="flex gap-3 mb-5">
                      <input value={newStockLocationLabel} onChange={(e) => setNewStockLocationLabel(e.target.value)} placeholder="Adicionar novo local..." className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" />
                      <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700">Adicionar</button>
                    </form>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {appState.stockLocations.map((l) => (
                        <div key={l} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span>{l}</span>
                          <button onClick={() => removeStockLocation(l)} className="text-sm font-semibold text-rose-600 hover:text-rose-800">Remover</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {stockManageTab === 'destination' && (
                  <>
                    <form onSubmit={addStockLoanDestination} className="flex gap-3 mb-5">
                      <input value={newStockLoanDestinationLabel} onChange={(e) => setNewStockLoanDestinationLabel(e.target.value)} placeholder="Adicionar novo destino..." className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" />
                      <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700">Adicionar</button>
                    </form>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {appState.stockLoanDestinations.map((d) => (
                        <div key={d} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span>{d}</span>
                          <button onClick={() => removeStockLoanDestination(d)} className="text-sm font-semibold text-rose-600 hover:text-rose-800">Remover</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}

      </div>

      {/* ════════ MODAL PATRIMÔNIO ════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Formulário</p>
                <h2 className="text-2xl font-semibold">{editingId ? 'Editar equipamento' : 'Adicionar equipamento'}</h2>
              </div>
              <button onClick={closeForm} className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200">Fechar</button>
            </div>
            <form onSubmit={saveEquipment} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-slate-700">Nome</span>
                  <input name="name" value={formValues.name} onChange={(e) => setFormValues({ ...formValues, name: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" required />
                </label>
                <div className="block">
                  <span className="text-sm text-slate-700">Tipo</span>
                  <div ref={typeDropdownRef} className="relative mt-2">
                    <input type="text" role="type-input" value={typeInputValue}
                      onChange={(e) => { setTypeInputValue(e.target.value); setTypeShowDropdown(true); }}
                      onMouseDown={() => setTypeShowDropdown(true)}
                      onKeyDown={(e) => { if ((e.key === 'Tab' || e.key === 'Enter') && filteredTypes.length > 0) { e.preventDefault(); const s = filteredTypes[0]; setFormValues({ ...formValues, type: s }); setTypeInputValue(s); setTypeShowDropdown(false); } }}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" placeholder="Digite ou selecione..." />
                    {typeShowDropdown && filteredTypes.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-300 rounded-2xl shadow-lg z-10">
                        {filteredTypes.map((t) => <div key={t} onClick={() => { setFormValues({ ...formValues, type: t }); setTypeInputValue(t); setTypeShowDropdown(false); }} className="px-4 py-3 hover:bg-slate-100 cursor-pointer">{t}</div>)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="block">
                  <span className="text-sm text-slate-700">Origem</span>
                  <div ref={originDropdownRef} className="relative mt-2">
                    <input type="text" name="origin" value={originInputValue}
                      onChange={(e) => { setOriginInputValue(e.target.value); setOriginShowDropdown(true); }}
                      onMouseDown={() => setOriginShowDropdown(true)}
                      onKeyDown={(e) => { if ((e.key === 'Tab' || e.key === 'Enter') && filteredOrigins.length > 0) { e.preventDefault(); const s = filteredOrigins[0]; setFormValues({ ...formValues, origin: s }); setOriginInputValue(s); setOriginShowDropdown(false); } }}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" placeholder="Digite ou selecione..." />
                    {originShowDropdown && filteredOrigins.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-300 rounded-2xl shadow-lg z-10">
                        {filteredOrigins.map((o) => <div key={o} onClick={() => { setFormValues({ ...formValues, origin: o }); setOriginInputValue(o); setOriginShowDropdown(false); }} className="px-4 py-3 hover:bg-slate-100 cursor-pointer">{o}</div>)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="formatted" checked={formValues.formatted} onChange={(e) => setFormValues({ ...formValues, formatted: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                    Formatado
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="configured" checked={formValues.configured} onChange={(e) => setFormValues({ ...formValues, configured: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                    Configurado
                  </label>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-slate-700">Status</span>
                  <select value={formValues.status} onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500">
                    <option value="OK">OK</option>
                    <option value="Problem">Problem</option>
                  </select>
                </label>
                <div className="block">
                  <span className="text-sm text-slate-700">Tipo de problema</span>
                  <div ref={problemTypeDropdownRef} className="relative mt-2">
                    <input type="text" name="problemType" value={problemTypeInputValue}
                      onChange={(e) => { setProblemTypeInputValue(e.target.value); setProblemTypeShowDropdown(true); }}
                      onMouseDown={() => setProblemTypeShowDropdown(true)}
                      onKeyDown={(e) => { if ((e.key === 'Tab' || e.key === 'Enter') && filteredProblems.length > 0) { e.preventDefault(); const s = filteredProblems[0]; setFormValues({ ...formValues, problemType: s }); setProblemTypeInputValue(s); setProblemTypeShowDropdown(false); } }}
                      disabled={formValues.status !== 'Problem'}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500 disabled:bg-slate-100" placeholder="Digite ou selecione..." />
                    {problemTypeShowDropdown && filteredProblems.length > 0 && formValues.status === 'Problem' && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-300 rounded-2xl shadow-lg z-10">
                        {filteredProblems.map((p) => <div key={p} onClick={() => { setFormValues({ ...formValues, problemType: p }); setProblemTypeInputValue(p); setProblemTypeShowDropdown(false); }} className="px-4 py-3 hover:bg-slate-100 cursor-pointer">{p}</div>)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <label className="block">
                <span className="text-sm text-slate-700">Descrição do problema</span>
                <textarea name="problemDescription" value={formValues.problemDescription} onChange={(e) => setFormValues({ ...formValues, problemDescription: e.target.value })} className="mt-2 h-24 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500 resize-none" disabled={formValues.status !== 'Problem'} placeholder={formValues.status === 'Problem' ? 'Descreva o problema...' : 'Selecione status Problem para detalhar.'} required={formValues.status === 'Problem'} />
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeForm} className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">Salvar equipamento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════ MODAL ESTOQUE ════════ */}
      {isStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-semibold">{editingStockId ? 'Editar item' : 'Adicionar ao estoque'}</h2>
              <button onClick={closeStockModal} className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200">Fechar</button>
            </div>
            {!editingStockId && (
              <p className="text-xs text-slate-500 mb-4 bg-slate-50 rounded-xl px-3 py-2">Se o tipo já existir, a quantidade será somada automaticamente no mesmo local do primeiro cadastro.</p>
            )}
            <form onSubmit={saveStockItem} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-slate-700">Tipo</span>
                  <select value={stockItemForm.type} onChange={(e) => {
                    const selectedType = e.target.value;
                    const fixedLocation = appState.stockItems.find((i) => i.type === selectedType)?.origin;
                    setStockItemForm((prev) => ({ ...prev, type: selectedType, origin: fixedLocation || prev.origin }));
                  }} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" required>
                    <option value="">Selecionar tipo...</option>
                    {appState.stockTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm text-slate-700">Local</span>
                  <select value={stockItemForm.origin} disabled={Boolean(stockItemForm.type && appState.stockItems.find((i) => i.type === stockItemForm.type && i.id !== editingStockId))} onChange={(e) => setStockItemForm({ ...stockItemForm, origin: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500 disabled:bg-slate-100" required>
                    <option value="">Selecionar local...</option>
                    {appState.stockLocations.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-slate-700">{editingStockId ? 'Quantidade total' : 'Quantidade a adicionar'}</span>
                  <input type="number" min="1" value={stockItemForm.totalQuantity} onChange={(e) => setStockItemForm({ ...stockItemForm, totalQuantity: Number(e.target.value) || 1 })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" required />
                </label>
                <label className="block">
                  <span className="text-sm text-slate-700">Mínimo em estoque</span>
                  <input type="number" min="0" value={stockItemForm.minQuantity} onChange={(e) => setStockItemForm({ ...stockItemForm, minQuantity: Number(e.target.value) || 0 })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm text-slate-700">Observações</span>
                <input value={stockItemForm.notes} onChange={(e) => setStockItemForm({ ...stockItemForm, notes: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" placeholder="Opcional..." />
              </label>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={closeStockModal} className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════ MODAL EMPRÉSTIMO ════════ */}
      {isLoanModalOpen && loanTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest">Empréstimo</p>
                <h2 className="text-xl font-semibold">{loanTargetItem.name}</h2>
                <p className="text-sm text-slate-500">Disponível: <strong>{getAvailableQty(loanTargetItem)}</strong> unidades</p>
              </div>
              <button onClick={closeLoanModal} className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200">Fechar</button>
            </div>
            <form onSubmit={saveLoan} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-slate-700">Quantidade</span>
                  <input type="number" min="1" max={getAvailableQty(loanTargetItem)} value={loanForm.quantity} onChange={(e) => setLoanForm({ ...loanForm, quantity: Number(e.target.value) || 1 })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" required />
                </label>
                <label className="block">
                  <span className="text-sm text-slate-700">Data</span>
                  <input type="date" value={loanForm.loanDate} onChange={(e) => setLoanForm({ ...loanForm, loanDate: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm text-slate-700">Destino / Setor</span>
                <select value={loanForm.loanTo} onChange={(e) => setLoanForm({ ...loanForm, loanTo: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" required>
                  <option value="">Selecione o setor...</option>
                  {appState.stockLoanDestinations.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-slate-700">Observações</span>
                <input value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" placeholder="Opcional..." />
              </label>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={closeLoanModal} className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600">Confirmar empréstimo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════ MODAL DEVOLUÇÃO ════════ */}
      {isReturnModalOpen && returnTargetLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest">Devolução</p>
                <h2 className="text-xl font-semibold">{returnTargetLoan.itemName}</h2>
                <p className="text-sm text-slate-500">Emprestado para: <strong>{returnTargetLoan.loanTo}</strong> — {returnTargetLoan.quantity} un.</p>
              </div>
              <button onClick={closeReturnModal} className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200">Fechar</button>
            </div>
            <form onSubmit={confirmReturn} className="grid gap-4">
              <label className="block">
                <span className="text-sm text-slate-700">Quantidade devolvida</span>
                <input type="number" min="1" max={returnTargetLoan.quantity} value={returnQty} onChange={(e) => setReturnQty(Number(e.target.value) || 1)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-slate-500" required />
                {Number(returnQty) < returnTargetLoan.quantity && <p className="mt-1 text-xs text-amber-600">Devolução parcial: {returnTargetLoan.quantity - Number(returnQty)} unidade(s) permanecem emprestadas.</p>}
              </label>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={closeReturnModal} className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700">Confirmar devolução</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

