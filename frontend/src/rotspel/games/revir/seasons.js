// Happys revir — årstid och tid på dygnet. Ren logik, inga DOM-anrop.
//
// Testa andra lägen med query-parametern ?revir=vinter-natt (eller var-morgon, sommar-kvall, host-dag).

export const SEASONS = {
  var: { label: 'vår', shape: 'petal', colors: ['#F7B6CC', '#FBD5E2', '#FFFFFF', '#F6D458'], extra: 'Rabatten',
    greet: ['Det luktar vår i reviret!', 'Påskliljorna är tillbaka.'] },
  sommar: { label: 'sommar', shape: 'flower', colors: ['#FFFFFF', '#F6D458', '#F5A1BA'], extra: 'Badstranden',
    greet: ['Sommar! Perfekt för att ligga i skuggan.', 'Varmt i tassarna i dag.'] },
  host: { label: 'höst', shape: 'leaf', colors: ['#E07A2E', '#C9502D', '#E8B33A', '#A8662C'], extra: 'Lövhögen',
    greet: ['Höstlöv! Bästa vädret att nosa i.', 'Det prasslar i reviret i dag.'] },
  vinter: { label: 'vinter', shape: 'snow', colors: ['#FFFFFF', '#E4F0FA'], extra: 'Snöhögen',
    greet: ['Brr, tassarna fryser!', 'Snö i reviret!'] },
}

export const TOD_GREET = {
  morgon: ['God morgon! Frukost först, sen revir.', 'Morgonpromenad i reviret?'],
  dag: [],
  kvall: ['Kvällspromenad i reviret?', 'Snart läggdags…'],
  natt: ['Borde inte vi sova?', 'Nattpatrull i reviret.'],
}

// override: t.ex. 'vinter-natt'
export function currentSeason(date = new Date(), override = '') {
  const o = String(override || '').split('-')[0]
  if (SEASONS[o]) return o
  const m = date.getMonth()
  return m < 2 || m === 11 ? 'vinter' : m < 5 ? 'var' : m < 8 ? 'sommar' : 'host'
}

export function currentTod(date = new Date(), override = '') {
  const o = String(override || '').split('-')[1]
  if (TOD_GREET[o]) return o
  const t = date.getHours()
  return t >= 5 && t < 10 ? 'morgon' : t >= 10 && t < 17 ? 'dag' : t >= 17 && t < 22 ? 'kvall' : 'natt'
}

export function seasonSvg(shape, c) {
  if (shape === 'leaf')
    return `<svg viewBox="0 0 24 24"><path d="M12 2C5.5 7 5 14 12 22C19 14 18.5 7 12 2Z" fill="${c}" stroke="#1F2E1B" stroke-width="1.2"/><path d="M12 6V21" stroke="#1F2E1B" stroke-width="1" stroke-linecap="round"/></svg>`
  if (shape === 'snow')
    return `<svg viewBox="0 0 24 24"><g stroke-linecap="round"><path d="M12 3V21M4.2 7.5L19.8 16.5M4.2 16.5L19.8 7.5" stroke="#6F8FA8" stroke-width="3.6"/><path d="M12 3V21M4.2 7.5L19.8 16.5M4.2 16.5L19.8 7.5" stroke="${c}" stroke-width="2"/></g></svg>`
  if (shape === 'petal')
    return `<svg viewBox="0 0 24 24"><path d="M12 2C17 7 17 15 12 22C7 15 7 7 12 2Z" fill="${c}" stroke="#1F2E1B" stroke-width="1.1"/></svg>`
  return `<svg viewBox="0 0 24 24"><g fill="#FFFFFF" stroke="#1F2E1B" stroke-width="1">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="12" cy="6.5" rx="3.2" ry="5" transform="rotate(${a} 12 12)"/>`).join('')}</g><circle cx="12" cy="12" r="3.2" fill="#F6D458" stroke="#1F2E1B" stroke-width="1"/></svg>`
}
