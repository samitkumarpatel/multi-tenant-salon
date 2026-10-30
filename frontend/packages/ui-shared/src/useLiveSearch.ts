import { useEffect, useRef, useState } from "react";

/**
 * Keep a search draft responsive while the URL/result loader catches up. A completed
 * search must not replace newer keystrokes; external navigation still restores its query.
 */
export function useLiveSearch(query: string, onSearch: (query: string) => void, delay = 300) {
  const [draft, setDraft] = useState(query);
  const latestSearch = useRef(onSearch);
  latestSearch.current = onSearch;
  const requested = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (requested.current === query) requested.current = null;
    else setDraft(query);
  }, [query]);

  useEffect(() => {
    const value = draft.trim();
    if (value === query) return;
    timer.current = setTimeout(() => {
      requested.current = value;
      latestSearch.current(value);
    }, value ? delay : 0);
    return () => clearTimeout(timer.current);
  }, [draft, query, delay]);

  function submit() {
    clearTimeout(timer.current);
    const value = draft.trim();
    if (value === query) return;
    requested.current = value;
    latestSearch.current(value);
  }

  return [draft, setDraft, submit] as const;
}
