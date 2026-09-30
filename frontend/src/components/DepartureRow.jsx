import { getLineColor } from '../utils/lineColors';

// Linjebricka i Västtrafiks färger. Används både i listan och i filtret.
export function LineBadge({ line, transportMode, size = 'md', dimmed = false }) {
  const color = getLineColor(line, transportMode);
  const sizes = {
    sm: 'h-7 min-w-[2.25rem] px-2 text-[13px] rounded-md',
    md: 'h-9 min-w-[2.75rem] px-2.5 text-base rounded-lg sm:h-10 sm:min-w-[3.25rem] sm:text-lg',
  };
  return (
    <span
      className={`inline-grid shrink-0 place-items-center font-bold leading-none tracking-tight tabular ${sizes[size]}`}
      style={{
        backgroundColor: dimmed ? 'transparent' : color.bg,
        color: dimmed ? '#6b768e' : color.text,
        boxShadow: dimmed
          ? 'inset 0 0 0 1.5px rgba(148,163,196,0.25)'
          : 'inset 0 -2px 0 rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.3)',
      }}
    >
      {line}
    </span>
  );
}

function klockslag(iso) {
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

// Minuter kvar, "Nu" eller klockslag (över en timme bort). Samma regler som
// formatDepartureTime, men uppdelat så siffran kan vara stor och "min" liten.
function tidKvar(iso, nu) {
  const min = Math.round((new Date(iso) - nu) / 60000);
  if (min <= 0) return { typ: 'nu' };
  if (min < 60) return { typ: 'min', varde: String(min) };
  return { typ: 'klocka', varde: klockslag(iso) };
}

function Status({ delay, isRealtime }) {
  if (!isRealtime) return <span className="text-xs text-gray-500">tidtabell</span>;
  if (delay > 0) {
    const sen = delay > 3;
    return (
      <span
        className={`rounded-md px-1.5 py-0.5 text-xs font-semibold tabular ${
          sen ? 'bg-red-500/15 text-red-300' : 'bg-amber-400/15 text-amber-300'
        }`}
      >
        +{delay} min
      </span>
    );
  }
  if (delay < 0) {
    return <span className="rounded-md bg-sky-400/15 px-1.5 py-0.5 text-xs font-semibold text-sky-300 tabular">{delay} min</span>;
  }
  return <span className="text-xs font-medium text-emerald-400/90">i tid</span>;
}

export function DepartureRow({ departure, nu = new Date() }) {
  const { line, direction, scheduledTime, realtimeTime, delay, canceled, platform, transportMode, isRealtime } =
    departure;

  const tidAttVisa = isRealtime ? realtimeTime : scheduledTime;
  const kvar = tidKvar(tidAttVisa, nu);
  const flyttad = isRealtime && delay !== 0 && scheduledTime && realtimeTime;

  return (
    <li
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors sm:gap-4 sm:px-5 sm:py-3.5 ${
        canceled ? 'bg-red-500/[0.04]' : 'hover:bg-white/[0.025]'
      }`}
    >
      <LineBadge line={line} transportMode={transportMode} dimmed={canceled} />

      <div className="min-w-0">
        <p
          className={`truncate text-[15px] font-semibold sm:text-base ${
            canceled ? 'text-gray-500 line-through decoration-red-400/60' : 'text-gray-50'
          }`}
        >
          {direction}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400 sm:text-[13px]">
          {platform && <span>Läge {platform}</span>}
          {platform && <span className="text-gray-600">·</span>}
          {flyttad ? (
            <span className="tabular">
              <s className="text-gray-600">{klockslag(scheduledTime)}</s> {klockslag(realtimeTime)}
            </span>
          ) : (
            <span className="tabular">{klockslag(tidAttVisa)}</span>
          )}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 text-right">
        {canceled ? (
          <span className="rounded-md bg-red-500/15 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-red-300">
            Inställd
          </span>
        ) : (
          <>
            {kvar.typ === 'nu' && (
              <span className="flex items-center gap-1.5 font-display text-xl font-semibold text-emerald-300 sm:text-2xl">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-live-ping rounded-full bg-emerald-400" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Nu
              </span>
            )}
            {kvar.typ === 'min' && (
              <span className="font-display leading-none text-white">
                <span className="text-2xl font-semibold tabular sm:text-[28px]">{kvar.varde}</span>
                <span className="ml-1 text-sm font-medium text-gray-400">min</span>
              </span>
            )}
            {kvar.typ === 'klocka' && (
              <span className="font-display text-xl font-semibold leading-none text-gray-200 tabular sm:text-2xl">
                {kvar.varde}
              </span>
            )}
            <Status delay={delay} isRealtime={isRealtime} />
          </>
        )}
      </div>
    </li>
  );
}

export default DepartureRow;
