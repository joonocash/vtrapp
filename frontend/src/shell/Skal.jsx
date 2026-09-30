import { useEffect, useState } from 'react';
import { APPAR, SAJTNAMN } from './appar.js';

function Logga({ appNamn }) {
  return (
    <a href="#/avgangar" className="group flex min-w-0 items-center gap-2.5" aria-label={`${SAJTNAMN} – startsidan`}>
      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-[#7aa2ff] to-[#3f5fe0] shadow-[0_6px_20px_-6px_rgba(91,141,255,0.7)] ring-1 ring-white/20">
        <svg viewBox="0 0 64 64" className="h-[18px] w-[18px]" aria-hidden="true">
          <path d="M16 20 L32 46 L48 20" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#ffd166] ring-2 ring-ink" />
      </span>
      <span className="font-display text-[19px] font-semibold tracking-tight text-white md:hidden lg:inline">{SAJTNAMN}</span>
      {appNamn && (
        <span className="flex min-w-0 items-center gap-2.5 md:hidden">
          <span className="h-4 w-px bg-white/15" aria-hidden="true" />
          <span className="truncate text-[15px] font-medium text-gray-300">{appNamn}</span>
        </span>
      )}
    </a>
  );
}

function Klocka() {
  const [nu, setNu] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNu(new Date()), 5000);
    return () => clearInterval(id);
  }, []);
  const tid = nu.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const dag = nu.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="flex items-baseline gap-2 text-right">
      <span className="hidden text-xs capitalize text-gray-500 lg:inline">{dag}</span>
      <span className="tabular font-display text-lg font-medium tracking-tight text-gray-200">{tid}</span>
    </div>
  );
}

function Toppbar({ aktiv }) {
  return (
    <header className="relative top-0 z-40 pt-[env(safe-area-inset-top)] md:sticky md:border-b md:border-ink-line md:bg-ink/75 md:backdrop-blur-xl">
      <div
        className={`mx-auto flex h-[var(--topbar-h)] items-center gap-6 px-4 sm:px-6 ${
          aktiv?.bredd === 'full' ? 'max-w-none' : 'max-w-6xl'
        }`}
      >
        <Logga appNamn={aktiv?.namn} />

        <nav aria-label="Appar" className="hidden md:block">
          <ul className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1 ring-1 ring-ink-line">
            {APPAR.map((app) => {
              const Ikon = app.ikon;
              const ar = app.id === aktiv?.id;
              return (
                <li key={app.id}>
                  <a
                    href={`#/${app.id}`}
                    data-tab={app.namn}
                    aria-current={ar ? 'page' : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:px-3.5 ${
                      ar
                        ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                        : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-100'
                    }`}
                  >
                    <Ikon className={`h-4 w-4 ${ar ? 'text-accent' : ''}`} strokeWidth={2.2} aria-hidden="true" />
                    {app.namn}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto shrink-0">
          <Klocka />
        </div>
      </div>
    </header>
  );
}

function Bottenmeny({ aktiv }) {
  return (
    <nav
      aria-label="Appar"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-line bg-ink/95 pb-[var(--safe-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid h-[var(--bottomnav-h)] max-w-lg grid-cols-5">
        {APPAR.map((app) => {
          const Ikon = app.ikon;
          const ar = app.id === aktiv?.id;
          return (
            <li key={app.id} className="flex">
              <a
                href={`#/${app.id}`}
                data-tab-mobil={app.namn}
                aria-current={ar ? 'page' : undefined}
                className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium"
              >
                <span
                  className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${
                    ar ? 'bg-accent-soft text-white' : 'text-gray-500'
                  }`}
                >
                  <Ikon className={`h-[21px] w-[21px] ${ar ? 'text-accent' : ''}`} strokeWidth={ar ? 2.3 : 2} aria-hidden="true" />
                </span>
                <span className={ar ? 'text-white' : 'text-gray-500'}>{app.namn}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Bredd och luft runt innehållsytan per app, se "bredd" i appar.js.
// 'smal' (Imposter) går kant-i-kant på mobil utan luft uppe/nere, så spelet
// fyller exakt höjden mellan toppbaren och bottenmenyn.
const BREDD = {
  normal: 'max-w-6xl px-4 pt-2 pb-[calc(var(--bottomnav-h)+var(--safe-bottom)+1.5rem)] sm:px-6 sm:pt-4 md:pb-12 md:pt-8',
  smal: 'max-w-xl px-0 pt-0 pb-[calc(var(--bottomnav-h)+var(--safe-bottom))] sm:px-6 sm:pt-4 sm:pb-[calc(var(--bottomnav-h)+var(--safe-bottom)+1.5rem)] md:pb-12 md:pt-8',
  // Som normal men med smalare kant på mobil — Agenters 5×5-bräde behöver
  // varenda pixel för långa ord.
  spel: 'max-w-6xl px-2 pt-2 pb-[calc(var(--bottomnav-h)+var(--safe-bottom)+1.5rem)] sm:px-6 sm:pt-4 md:pb-12 md:pt-8',
  full: 'max-w-none px-3 pt-2 pb-[calc(var(--bottomnav-h)+var(--safe-bottom)+1.5rem)] sm:px-6 sm:pt-4 md:py-6',
};

export default function Skal({ aktiv, children }) {
  return (
    <div className="skal-glod min-h-[100dvh]">
      <Toppbar aktiv={aktiv} />
      <main className={`mx-auto w-full ${BREDD[aktiv?.bredd] || BREDD.normal}`}>
        {children}
      </main>
      <Bottenmeny aktiv={aktiv} />
    </div>
  );
}
