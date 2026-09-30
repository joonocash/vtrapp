import { useCallback, useEffect, useState } from 'react';

// Vilken app (och ev. undersida) som visas ligger i adressens hash:
//   #/avgangar   #/rotspel   #/rotspel/krossen   #/cassie
//
// Hash i stället för riktiga sökvägar så att nginx inte behöver någon
// try_files-regel, och så att Cassies ?from=…-parametrar kan ligga kvar i
// query-strängen orörda. Omladdning, bakåtknapp och delade länkar landar
// därmed på rätt ställe.

export function lasRutt() {
  const ra = window.location.hash.replace(/^#\/?/, '');
  const [app = '', ...resten] = ra.split('/').filter(Boolean);
  let sub = '';
  try {
    sub = resten.map(decodeURIComponent).join('/');
  } catch {
    sub = resten.join('/');
  }
  return { app: app.toLowerCase(), sub };
}

export function useHashRutt() {
  const [rutt, setRutt] = useState(lasRutt);

  useEffect(() => {
    const uppdatera = () => setRutt(lasRutt());
    window.addEventListener('hashchange', uppdatera);
    window.addEventListener('popstate', uppdatera);
    return () => {
      window.removeEventListener('hashchange', uppdatera);
      window.removeEventListener('popstate', uppdatera);
    };
  }, []);

  // ga('rotspel/krossen') lägger en ny post i historiken så att bakåtknappen
  // tar en tillbaka. { ersatt: true } byter ut nuvarande post i stället.
  const ga = useCallback((sokvag, { ersatt = false } = {}) => {
    const url = `${window.location.pathname}${window.location.search}#/${sokvag}`;
    if (ersatt) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    setRutt(lasRutt());
  }, []);

  return [rutt, ga];
}
