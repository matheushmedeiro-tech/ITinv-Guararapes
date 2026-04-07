import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/api/apiClient';

const DEBOUNCE_MS = 800;

/** @param {Record<string, any>} state */
const normalizeAppState = (state) => ({
  ...state,
  equipment: (state.equipment || []).map((/** @type {any} */ { loaned, loanTo, loanDate, category, quantity, ...item }) => ({
    problemType: '',
    problemDescription: '',
    ...item
  })),
  equipmentTypes: state.equipmentTypes?.length ? state.equipmentTypes : [],
  origins: state.origins?.length ? state.origins : [],
  problemTypes: state.problemTypes?.length ? state.problemTypes : [],
  stockItems: (state.stockItems || []).map((/** @type {any} */ item) => ({
    minQuantity: 0,
    notes: '',
    ...item,
    name: item.name || item.type || '',
    totalQuantity: Math.max(0, Number(item.totalQuantity) || 0)
  })),
  stockLoans: (state.stockLoans || []).map((/** @type {any} */ loan) => ({
    notes: '',
    ...loan,
    quantity: Math.max(1, Number(loan.quantity) || 1)
  })),
  stockTypes: state.stockTypes?.length ? state.stockTypes : [],
  stockLocations: state.stockLocations?.length ? state.stockLocations : [],
  stockLoanDestinations: state.stockLoanDestinations?.length ? state.stockLoanDestinations : []
});

const emptyAppState = {
  equipment: [],
  equipmentTypes: [],
  origins: [],
  problemTypes: [],
  stockItems: [],
  stockLoans: [],
  stockTypes: [],
  stockLocations: [],
  stockLoanDestinations: []
};

export function useAppState() {
  const [appState, setAppState] = useState(emptyAppState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [saveError, setSaveError] = useState(/** @type {string | null} */ (null));
  const debounceRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const hasMounted = useRef(false);

  // Load state from backend on mount
  useEffect(() => {
    (async () => {
      try {
        const remote = await apiClient.get('/api/app-state');
        setAppState(normalizeAppState(remote));
        setBackendAvailable(true);
      } catch (e) {
        console.warn('Failed to load backend state:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Debounced save to backend
  useEffect(() => {
    if (isLoading) return;

    // Skip the first render after loading (server data being set)
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    if (!backendAvailable) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        await apiClient.post('/api/app-state', appState);
      } catch {
        setSaveError('Falha ao salvar alterações no servidor.');
        setBackendAvailable(false);
      } finally {
        setIsSaving(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [appState, backendAvailable, isLoading]);

  const dismissError = useCallback(() => setSaveError(null), []);

  return { appState, setAppState, isLoading, isSaving, backendAvailable, saveError, dismissError };
}
