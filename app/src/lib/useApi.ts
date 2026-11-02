import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { api, errorMessage } from './api';
import { useT } from './i18n';

/**
 * Loads `path` when the screen comes into view (so it is fresh after adding something on another screen) and
 * again when the language changes. `path` null: nothing to load yet.
 */
export function useApi<T>(path: string | null) {
  const { language } = useT();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const load = useCallback(
    async (pull = false) => {
      if (!path) return;
      const call = ++latest.current;
      if (pull) setRefreshing(true);
      try {
        const result = await api<T>(path);
        if (call === latest.current) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (call === latest.current) setError(errorMessage(e));
      } finally {
        if (call === latest.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // `language` is listed so a language change loads the texts again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, language],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { data, error, loading: loading && !data, refreshing, reload: () => load(true), setData };
}
