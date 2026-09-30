// Skelettrader i stället för en snurra — listan "finns" redan när den laddar,
// så sidan hoppar inte när datan kommer.
export function LoadingSpinner({ rader = 7 }) {
  return (
    <ul className="divide-y divide-ink-line" aria-busy="true" aria-label="Laddar avgångar">
      {Array.from({ length: rader }).map((_, i) => (
        <li key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
          <span className="h-9 w-11 animate-pulse rounded-lg bg-white/[0.06] sm:h-10 sm:w-[3.25rem]" />
          <span className="space-y-2">
            <span className="block h-3.5 w-2/3 animate-pulse rounded bg-white/[0.06]" style={{ animationDelay: `${i * 60}ms` }} />
            <span className="block h-2.5 w-1/4 animate-pulse rounded bg-white/[0.04]" />
          </span>
          <span className="h-6 w-12 animate-pulse rounded bg-white/[0.06]" />
        </li>
      ))}
    </ul>
  );
}

export default LoadingSpinner;
