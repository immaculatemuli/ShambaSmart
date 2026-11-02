import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { useT } from './i18n';
import type { Catalog } from './types';

// Crops, counties and markets from the server, loaded once (and again when the language changes, for crop names).
const CatalogContext = createContext<{ catalog: Catalog | null; error: boolean; retry: () => void }>({
  catalog: null,
  error: false,
  retry: () => {},
});

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { language } = useT();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    api<Catalog>('/catalog')
      .then((next) => {
        setCatalog(next);
        setError(false);
      })
      .catch(() => setError(true));
  }, [language, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return <CatalogContext.Provider value={{ catalog, error, retry }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const { catalog, error, retry } = useContext(CatalogContext);
  const cropName = useCallback((key: string | null | undefined) => (key ? (catalog?.crops.find((c) => c.key === key)?.name ?? key) : ''), [catalog]);
  return { catalog, error, retry, cropName };
}
