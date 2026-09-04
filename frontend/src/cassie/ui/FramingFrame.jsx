const RATIOS = { '16x9': 16 / 9, '9x16': 9 / 16, '1x1': 1 };

/**
 * Letterboxar kartan i vald aspect-ratio med mörka bårder runt om, så att en
 * skärminspelning ser klippfärdig ut oavsett fönsterstorlek. Safe-margin-
 * guider ritas som svaga linjer i redigeringsläget och döljs under
 * uppspelning.
 */
export default function FramingFrame({ format, showGuides, children }) {
  const ratio = RATIOS[format] || RATIOS['16x9'];

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-lg">
      <div className="relative h-full max-w-full" style={{ aspectRatio: ratio }}>
        {children}

        {showGuides && (
          <div className="pointer-events-none absolute inset-0 z-10">
            <div className="absolute inset-[6%] border border-dashed border-white/30" />
            <div className="absolute inset-0 border border-white/10" />
          </div>
        )}
      </div>
    </div>
  );
}
