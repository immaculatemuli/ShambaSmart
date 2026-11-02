import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getItem, setItem } from './storage';
import { SW } from './sw';

// The app in English or Kiswahili. Texts are written in English in the code and looked up in SW; anything not
// translated yet shows in English. {name} in a text is filled in from `vars`. The choice is kept on the device, and
// sent to the server (X-Language) so alerts, crop calendars and photo checks come back in the same language.
export type Language = 'en' | 'sw';
const KEY = 'shambasmart.language';

let current: Language = 'en';

/** The text in the chosen language (also usable outside screens, e.g. in an error from a helper). */
export function t(text: string, vars?: Record<string, string | number>) {
  const chosen = current === 'sw' ? (SW[text] ?? text) : text;
  return vars ? chosen.replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? String(vars[key]) : whole)) : chosen;
}

export const currentLanguage = () => current;

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; ready: boolean }>({
  language: 'en',
  setLanguage: () => {},
  ready: false,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<Language>(current);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getItem(KEY).then((saved) => {
      if (saved === 'sw' || saved === 'en') {
        current = saved;
        setState(saved);
      }
      setReady(true);
    });
  }, []);

  const setLanguage = useCallback((next: Language) => {
    current = next;
    setState(next);
    void setItem(KEY, next);
  }, []);

  const value = useMemo(() => ({ language, setLanguage, ready }), [language, setLanguage, ready]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** In a screen: `t` for its texts; the screen shows again in the new language when it is changed. */
export function useT() {
  const { language, setLanguage, ready } = useContext(LanguageContext);
  // `language` is read so the returned function changes (and screens using it update) with the language.
  const tr = useCallback((text: string, vars?: Record<string, string | number>) => (language ? t(text, vars) : text), [language]);
  return { t: tr, language, setLanguage, ready };
}
