import { LineBadge } from './DepartureRow';

// Tryck på en linje för att dölja/visa den. Scrollar i sidled på mobil i
// stället för att bryta till flera rader och trycka ner listan.
export function LineFilter({ departures, hiddenLines, onToggleLine, onShowAll }) {
  const uniqueLines = [];
  const seen = new Set();

  departures.forEach((dep) => {
    if (!seen.has(dep.line)) {
      seen.add(dep.line);
      uniqueLines.push({ line: dep.line, transportMode: dep.transportMode });
    }
  });

  // Siffror först (stigande), sedan text
  uniqueLines.sort((a, b) => {
    const aNum = parseInt(a.line);
    const bNum = parseInt(b.line);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    if (!isNaN(aNum)) return -1;
    if (!isNaN(bNum)) return 1;
    return a.line.localeCompare(b.line);
  });

  if (uniqueLines.length <= 1) return null;

  const nagotDolt = hiddenLines.size > 0;

  return (
    <div className="utan-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      {uniqueLines.map(({ line, transportMode }) => {
        const dold = hiddenLines.has(line);
        return (
          <button
            key={line}
            onClick={() => onToggleLine(line)}
            aria-pressed={!dold}
            title={dold ? `Visa linje ${line}` : `Dölj linje ${line}`}
            className="shrink-0 rounded-lg p-0.5 transition-transform active:scale-95"
          >
            <LineBadge line={line} transportMode={transportMode} size="sm" dimmed={dold} />
          </button>
        );
      })}
      {nagotDolt && (
        <button
          onClick={onShowAll}
          className="ml-1 shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
        >
          Visa alla
        </button>
      )}
    </div>
  );
}

export default LineFilter;
