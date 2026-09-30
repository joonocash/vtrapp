export const RATIOS = { '16x9': 16 / 9, '9x16': 9 / 16, '1x1': 1 };

/**
 * Letterboxar kartan i vald aspect-ratio med mörka bårder runt om, så att en
 * skärminspelning ser klippfärdig ut oavsett fönsterstorlek. Safe-margin-
 * guider ritas som svaga linjer i redigeringsläget och döljs under
 * uppspelning.
 *
 * Storleken räknas med container query-enheter: rutan blir så stor som
 * ryms i ytterboxen i BÅDA led (min av full bredd och höjd × ratio). Förut
 * var höjden alltid 100 % och bredden klipptes av max-width, vilket gjorde
 * att en 16:9-ram blev stående på smala skärmar.
 *
 * isolate håller Google Maps egna z-index inne i ramen, så kartkontrollerna
 * inte kan hamna ovanpå sajtens meny.
 */
export default function FramingFrame({ format, showGuides, children }) {
  const ratio = RATIOS[format] || RATIOS['16x9'];

  return (
    <div
      className="relative isolate w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-2xl"
      style={{ containerType: 'size' }}
    >
      <div
        className="relative max-w-full max-h-full"
        style={{ aspectRatio: ratio, width: `min(100cqw, 100cqh * ${ratio})` }}
      >
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
