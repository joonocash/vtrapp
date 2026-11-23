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

const TIMEOUT_MS = 30000;

// Avbryts efter TIMEOUT_MS, eller när signal avbryts (t.ex. när du byter flik).
export function hamta(sokvag, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const vidarebefordra = () => ctrl.abort();
  signal?.addEventListener('abort', vidarebefordra);
  return fetch(`${BAS}/${sokvag}`, { signal: ctrl.signal })
    .then(svar)
    .finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', vidarebefordra);
    });
}

export const skicka = (sokvag, metod, body) =>
  fetch(`${BAS}/${sokvag}`, {
    method: metod,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then(svar);

// Hämtar sokvag och, om intervall är satt, igen med jämna mellanrum när fliken syns.
// sokvag = null hämtar inget (t.ex. innan ett item valts).
//
// Högst en hämtning åt gången per vy: en omhämtning hoppas över om den förra inte är klar,
// och allt avbryts när vyn försvinner. Annars kan hängande anrop ta webbläsarens få
// anslutningar till servern, och då blir resten av sajten seg (avgångar, flikbyten).
export function useWow(sokvag, { intervall = 0 } = {}) {
  const [data, setData] = useState(null);
  const [fel, setFel] = useState(null);
  const [laddar, setLaddar] = useState(Boolean(sokvag));
  const aktuell = useRef(sokvag);
  const pagaende = useRef(null);

  const ladda = useCallback(
    async (tyst = false) => {
      if (!sokvag) return;
      if (pagaende.current) {
        if (tyst) return; // omhämtning medan förra pågår: hoppa över
        pagaende.current.abort();
      }
      const ctrl = new AbortController();
      pagaende.current = ctrl;
      if (!tyst) setLaddar(true);
      try {
        const d = await hamta(sokvag, ctrl.signal);
        if (aktuell.current === sokvag && !ctrl.signal.aborted) {
          setData(d);
          setFel(null);
        }
      } catch (e) {
        if (e.name !== 'AbortError' && aktuell.current === sokvag) setFel(e);
        else if (e.name === 'AbortError' && !ctrl.signal.aborted && aktuell.current === sokvag) {
          setFel(new Error('Servern svarade inte på 30 sekunder'));
        }
      } finally {
        if (pagaende.current === ctrl) pagaende.current = null;
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
    const avbryt = () => {
      pagaende.current?.abort();
      pagaende.current = null;
    };
    if (!intervall) return avbryt;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') ladda(true);
    }, intervall);
    const synlig = () => document.visibilityState === 'visible' && ladda(true);
    document.addEventListener('visibilitychange', synlig);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', synlig);
      avbryt();
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
