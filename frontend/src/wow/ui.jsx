// Små byggstenar för WoW-flikens vyer.
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { WOWHEAD, kvalitetsfarg, sparkPunkter } from './format.js';

export const GULD = '#ffd166';
export const PLUS = '#4ade80';
export const MINUS = '#f87171';

export function Panel({ titel, under, hoger, children, className = '', as: Tag = 'section' }) {
  return (
    <Tag className={`panel flex min-w-0 flex-col gap-4 p-5 sm:p-6 ${className}`} aria-label={typeof titel === 'string' ? titel : undefined}>
      {(titel || hoger) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {titel && <h2 className="font-display text-[17px] font-semibold text-white">{titel}</h2>}
            {under && <p className="mt-0.5 text-[13px] text-gray-400">{under}</p>}
          </div>
          {hoger}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function Ruta({ etikett, varde, under, farg = '#ffffff' }) {
  return (
    <div className="rounded-xl bg-ink-high px-4 py-3.5">
      <div className="text-xs font-medium text-gray-400">{etikett}</div>
      <div className="tabular mt-1 font-display text-[22px] font-semibold leading-tight" style={{ color: farg }}>
        {varde}
      </div>
      {under && <div className="mt-0.5 text-xs text-gray-400">{under}</div>}
    </div>
  );
}

// Utan href öppnas itemet på Wowhead. Med href (t.ex. #/wow/marknad/4306) stannar man i fliken.
export function ItemNamn({ item, href, className = '' }) {
  if (!item) return null;
  const namn = item.name || `Item ${item.id}`;
  return (
    <a
      href={href || `${WOWHEAD}${item.id}`}
      {...(href ? {} : { target: '_blank', rel: 'noreferrer' })}
      className={`font-medium hover:underline ${className}`}
      style={{ color: kvalitetsfarg(item.quality) }}
    >
      {namn}
    </a>
  );
}

export function Sparkline({ varden, bredd = 100, hojd = 28, etikett }) {
  const { punkter, sista } = sparkPunkter(varden, bredd, hojd);
  if (!punkter) return <span className="text-xs text-gray-500">–</span>;
  return (
    <svg viewBox={`0 0 ${bredd} ${hojd}`} width={bredd} height={hojd} role="img" aria-label={etikett || 'Prisutveckling'}>
      <polyline points={punkter} fill="none" stroke="#5b8dff" strokeWidth="2" strokeLinejoin="round" />
      {sista && <circle cx={sista.x} cy={sista.y} r="3" fill={GULD} />}
    </svg>
  );
}

export function Ring({ procent, storlek = 150, children }) {
  const r = 56;
  const omkrets = 2 * Math.PI * r;
  const del = Math.max(0, Math.min(100, procent || 0)) / 100;
  return (
    <svg viewBox="0 0 140 140" width={storlek} height={storlek} role="img" aria-label={`${Math.round(procent || 0)} procent`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="#182032" strokeWidth="12" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={GULD}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${omkrets * del} 999`}
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 600ms ease' }}
      />
      {children}
    </svg>
  );
}

export function Stapel({ procent, farg = '#5b8dff', hojd = 'h-2', etikett }) {
  return (
    <div className={`${hojd} overflow-hidden rounded-full bg-ink`} role="img" aria-label={etikett || `${Math.round(procent)} procent`}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, procent))}%`, background: farg, transition: 'width 600ms ease' }} />
    </div>
  );
}

export function Val({ alternativ, val, onVal, etikett }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[10px] bg-ink p-[3px]" role="group" aria-label={etikett}>
      {alternativ.map((a) => (
        <button
          key={a.id}
          type="button"
          aria-pressed={a.id === val}
          onClick={() => onVal(a.id)}
          className={`min-h-[36px] rounded-lg px-3 text-sm font-medium transition-colors ${
            a.id === val ? 'bg-ink-high text-white' : 'text-gray-400 hover:text-gray-100'
          }`}
        >
          {a.namn}
        </button>
      ))}
    </div>
  );
}

export function Tom({ children }) {
  return <p className="text-sm text-gray-400">{children}</p>;
}

export function Laddar({ rader = 3 }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rader }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-ink-high" />
      ))}
    </div>
  );
}

export function Fel({ fel, igen }) {
  const ingenToken = fel?.status === 503;
  const nere = fel?.status === 502;
  return (
    <div className="panel flex flex-col items-start gap-3 p-6">
      <div className="flex items-center gap-2 text-white">
        <AlertTriangle className="h-5 w-5 text-[#fb923c]" aria-hidden="true" />
        <span className="font-display text-lg font-semibold">
          {ingenToken ? 'WoW-fliken är inte kopplad än' : nere ? 'WoW-assistenten svarar inte' : 'Något gick fel'}
        </span>
      </div>
      <p className="max-w-xl text-sm text-gray-300">
        {fel?.tips ||
          (nere
            ? 'Boten kanske startar om efter en deploy. Prova igen om en minut.'
            : String(fel?.message || fel))}
      </p>
      {igen && (
        <button
          type="button"
          onClick={() => igen()}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Försök igen
        </button>
      )}
    </div>
  );
}
