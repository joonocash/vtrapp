/** Nedräkning 3-2-1 innan uppspelningen kör igång, så man hinner starta OBS. */
export default function Countdown({ value }) {
  if (!value) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
      <span
        key={value}
        className="cassie-countdown-pop text-white text-9xl font-bold"
        style={{ textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}
      >
        {value}
      </span>
    </div>
  );
}
