// WoW-fliken: data från WoW-assistenten (Discord-boten) som kör på samma server.
//   #/wow            översikt
//   #/wow/marknad    marknad, #/wow/marknad/4306 öppnar ett item
//   #/wow/gubben     utrustning och yrken
//   #/wow/ah         inköpslistan att ha på mobilen vid AH
import { lazy, Suspense } from 'react';
import { useWow } from './api.js';
import { Fel, Laddar } from './ui.jsx';
import { HUS, sedan } from './format.js';
import Oversikt from './Oversikt.jsx';

const Marknad = lazy(() => import('./Marknad.jsx'));
const Gubben = lazy(() => import('./Gubben.jsx'));
const VidAH = lazy(() => import('./VidAH.jsx'));

const DELAR = [
  { id: '', namn: 'Översikt' },
  { id: 'marknad', namn: 'Marknad' },
  { id: 'gubben', namn: 'Gubben och yrken', kort: 'Gubben' },
  { id: 'ah', namn: 'Vid AH' },
];

function Statusrad({ data }) {
  if (!data) return <p className="mt-1 h-5 text-gray-400" aria-hidden="true" />;
  const { status, own_house: hus } = data;
  const aktiv = status.mode === 'active';
  return (
    <p className="mt-1 text-sm text-gray-400">
      {HUS[hus] || 'Alliance'}
      {' · '}assistenten är{' '}
      <span className={aktiv ? 'font-medium text-[#4ade80]' : 'font-medium text-gray-200'}>{status.mode_label}</span>
      {' · '}AH hämtat {sedan(status.last_collect)}
    </p>
  );
}

export default function WowPage({ sub = '', ga }) {
  const [del = '', ...resten] = sub.split('/');
  const aktiv = DELAR.some((d) => d.id === del) ? del : '';
  const oversikt = useWow('overview', { intervall: 60_000 });
  const navigera = (sokvag) => (ga ? ga(sokvag) : (window.location.hash = `#/wow/${sokvag}`));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-white sm:text-[30px]">WoW Forever</h1>
          <Statusrad data={oversikt.data} />
        </div>
        <nav aria-label="Delar av WoW-fliken" className="w-full sm:w-auto">
          <ul className="flex gap-1 rounded-xl bg-white/[0.03] p-1 ring-1 ring-ink-line">
            {DELAR.map((d) => (
              <li key={d.id} className="flex flex-1 sm:flex-none">
                <a
                  href={`#/wow${d.id ? `/${d.id}` : ''}`}
                  aria-current={d.id === aktiv ? 'page' : undefined}
                  className={`flex min-h-[40px] flex-1 items-center justify-center whitespace-nowrap rounded-lg px-2 text-sm font-medium transition-colors sm:px-3.5 ${
                    d.id === aktiv ? 'bg-accent-soft text-white' : 'text-gray-300 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  {d.kort ? (
                    <>
                      <span className="sm:hidden">{d.kort}</span>
                      <span className="hidden sm:inline">{d.namn}</span>
                    </>
                  ) : (
                    d.namn
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <Suspense fallback={<Laddar rader={4} />}>
        {aktiv === '' &&
          (oversikt.fel && !oversikt.data ? (
            <Fel fel={oversikt.fel} igen={oversikt.ladda} />
          ) : !oversikt.data ? (
            <Laddar rader={6} />
          ) : (
            <Oversikt data={oversikt.data} navigera={navigera} />
          ))}
        {aktiv === 'marknad' && (
          <Marknad
            itemId={resten[0] && /^\d+$/.test(resten[0]) ? Number(resten[0]) : null}
            oversikt={oversikt.data}
            navigera={navigera}
          />
        )}
        {aktiv === 'gubben' && <Gubben navigera={navigera} />}
        {aktiv === 'ah' && <VidAH navigera={navigera} />}
      </Suspense>
    </div>
  );
}
