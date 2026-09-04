const API = '/api/cassie';

export async function geocode(query) {
  const res = await fetch(`${API}/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Geokodning misslyckades');
  const data = await res.json();
  return data.results || [];
}

/**
 * @param {{lat:number, lng:number}} from
 * @param {{lat:number, lng:number}} to
 */
export async function fetchRoute(from, to) {
  const res = await fetch(`${API}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: [from.lng, from.lat], to: [to.lng, to.lat] })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Kunde inte hämta rutt');
  }
  return res.json();
}

export async function fetchSavedRoutes() {
  const res = await fetch(`${API}/routes`);
  if (!res.ok) throw new Error('Kunde inte hämta sparade rutter');
  const data = await res.json();
  return data.routes || [];
}

export async function saveRoute(payload) {
  const res = await fetch(`${API}/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Kunde inte spara rutten');
  }
  return res.json();
}
