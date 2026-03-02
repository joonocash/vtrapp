import { getLineColor } from '../utils/lineColors';

export function LineFilter({ departures, hiddenLines, onToggleLine }) {
  // Get unique lines with their transport modes
  const uniqueLines = [];
  const seen = new Set();

  departures.forEach((dep) => {
    if (!seen.has(dep.line)) {
      seen.add(dep.line);
      uniqueLines.push({ line: dep.line, transportMode: dep.transportMode });
    }
  });

  // Sort lines: numbers first (ascending), then text
  uniqueLines.sort((a, b) => {
    const aNum = parseInt(a.line);
    const bNum = parseInt(b.line);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    if (!isNaN(aNum)) return -1;
    if (!isNaN(bNum)) return 1;
    return a.line.localeCompare(b.line);
  });

  if (uniqueLines.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {uniqueLines.map(({ line, transportMode }) => {
        const color = getLineColor(line, transportMode);
        const isHidden = hiddenLines.has(line);

        return (
          <button
            key={line}
            onClick={() => onToggleLine(line)}
            className="transition-all duration-150 rounded-md font-bold text-sm px-3 py-1.5 min-w-[40px] text-center"
            style={{
              backgroundColor: isHidden ? '#374151' : color.bg,
              color: isHidden ? '#6b7280' : color.text,
              opacity: isHidden ? 0.5 : 1,
              border: isHidden ? '1px solid #4b5563' : '1px solid transparent',
            }}
          >
            {line}
          </button>
        );
      })}
    </div>
  );
}

export default LineFilter;
