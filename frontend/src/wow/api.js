// Pratar med VTR-backendens /api/wow, som i sin tur hämtar från WoW-assistenten på servern.
import { useCallback, useEffect, useRef, useState } from 'react';

const BAS = '/api/wow';

async function svar(r) {
  let data = null;
  try {
    data = await r.json();
  } catch {
    // inget JSON i svaret
  }
  if (!r.ok) {
    const fel = new Error(data?.error || `Fel ${r.status}`);
    fel.status = r.status;
    fel.tips = data?.tips;
    throw fel;
  }
  return data;
}

export const hamta = (sokvag, signal) => fetch(`${BAS}/${sokvag}`, { signal }).then(svar);

export const skicka = (sokvag, metod, body) =>
  fetch(`${BAS}/${sokvag}`, {
    method: metod,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then(svar);

// Hämtar sokvag och, om intervall är satt, igen med jämna mellanrum när fliken syns.
// sokvag = null hämtar inget (t.ex. innan ett item valts).
export function useWow(sokvag, { intervall = 0 } = {}) {
  const [data, setData] = useState(null);
  const [fel, setFel] = useState(null);
  const [laddar, setLaddar] = useState(Boolean(sokvag));
  const aktuell = useRef(sokvag);

  const ladda = useCallback(
    async (tyst = false) => {
      if (!sokvag) return;
      const ctrl = new AbortController();
      if (!tyst) setLaddar(true);
      try {
        const d = await hamta(sokvag, ctrl.signal);
        if (aktuell.current === sokvag) {
          setData(d);
          setFel(null);
        }
      } catch (e) {
        if (e.name !== 'AbortError' && aktuell.current === sokvag) setFel(e);
      } finally {
        if (aktuell.current === sokvag) setLaddar(false);
      }
    },
    [sokvag],
  );

  useEffect(() => {
    aktuell.current = sokvag;
    setData(null);
    setFel(null);
    if (!sokvag) {
      setLaddar(false);
      return undefined;
    }
    ladda();
    if (!intervall) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') ladda(true);
    }, intervall);
    const synlig = () => document.visibilityState === 'visible' && ladda(true);
    document.addEventListener('visibilitychange', synlig);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', synlig);
    };
  }, [sokvag, intervall, ladda]);

  return { data, fel, laddar, ladda, setData };
}

// Bockar i inköpslistan sparas i webbläsaren, så Gubben-vyn och Vid AH delar dem.
export function useBockar(nyckel) {
  const lasa = () => {
    try {
      return JSON.parse(localStorage.getItem(nyckel) || '{}');
    } catch {
      return {};
    }
  };
  const [bockar, setBockar] = useState(lasa);
  useEffect(() => {
    setBockar(lasa());
    const andrad = (e) => e.key === nyckel && setBockar(lasa());
    window.addEventListener('storage', andrad);
    return () => window.removeEventListener('storage', andrad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nyckel]);
  const vaxla = (id) =>
    setBockar((gamla) => {
      const nya = { ...gamla, [id]: !gamla[id] };
      try {
        localStorage.setItem(nyckel, JSON.stringify(nya));
      } catch {
        // privat läge eller fullt: bockarna lever bara tills sidan laddas om
      }
      return nya;
    });
  const rensa = () => {
    try {
      localStorage.removeItem(nyckel);
    } catch {
      // se ovan
    }
    setBockar({});
  };
  return { bockar, vaxla, rensa };
}
