// Vid AH: inköpslistan för yrket i stort format, att bocka av med telefonen bredvid dig.
// Bockarna delas med listan under Gubben och yrken.
import { useBockar, useWow } from './api.js';
import { Fel, GULD, ItemNamn, Laddar, Panel, Tom, Val } from './ui.jsx';
import { kvalitetsfarg, pengar } from './format.js';
import { useYrke } from './Gubben.jsx';

function chip(i, klar) {
  if (klar) return { text: 'klar', klass: 'bg-white/5 text-gray-400' };
  if (i.source === 'vendor') return { text: 'vendor', klass: 'bg-accent-soft text-[#b4c8ff]' };
  if (i.now == null) return { text: 'inte ute', klass: 'bg-white/5 text-gray-300' };
  if (i.max != null && i.now > i.max) return { text: 'vänta', klass: 'bg-[#fb923c]/15 text-[#fdba74]' };
  if (i.unit != null && i.now <= i.unit) return { text: 'billigt nu', klass: 'bg-[#4ade80]/15 text-[#86efac]' };
  return { text: 'ok pris', klass: 'bg-white/5 text-gray-200' };
}

function Bevakningar() {
  const { data } = useWow('watch', { intervall: 120_000 });
  const under = (data?.items || []).filter((w) => w.under);
  if (!under.length) return null;
  return (
    <Panel titel="Under ditt pris just nu">
      <ul className="flex flex-col">
        {under.map((w) => (
          <li key={w.item_id} className="flex items-center justify-between gap-3 border-t border-ink-line py-2.5 first:border-0">
            <ItemNamn item={{ id: w.item_id, name: w.name, quality: w.quality?.toLowerCase() }} href={`#/wow/marknad/${w.item_id}`} />
            <span className="tabular text-[#86efac]">{pengar(w.now)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function VidAH({ navigera }) {
  const [yrke, setYrke] = useYrke();
  const { data, fel, laddar, ladda } = useWow(`craft${yrke ? `?prof=${encodeURIComponent(yrke)}` : ''}`, { intervall: 120_000 });
  const plan = data?.plan;
  const { bockar, vaxla } = useBockar(plan ? `wow-inkop-${plan.profession}-${plan.target}` : 'wow-inkop');

  if (fel) return <Fel fel={fel} igen={ladda} />;
  if (laddar || !data) return <Laddar rader={6} />;
  if (!plan) {
    return (
      <Panel titel="Inköpslista">
        <Tom>Inga yrken med recept. De syns i Blizzards API efter en utloggning.</Tom>
      </Panel>
    );
  }
  const lista = plan.shopping.filter((i) => i.buy > 0);
  const klara = lista.filter((i) => bockar[i.id]).length;
  const kvar = lista.filter((i) => !bockar[i.id]).reduce((s, i) => s + i.cost, 0);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <Bevakningar />
      <Panel
        titel="Inköpslista"
        under={`${plan.profession} ${plan.skill} → ${plan.target} · köp inte över maxpriset`}
        hoger={lista.length > 0 && <span className="text-[13px] text-gray-400">{klara} av {lista.length} klara</span>}
      >
        {data.professions.length > 1 && (
          <Val etikett="Yrke" val={plan.profession} onVal={setYrke} alternativ={data.professions.map((p) => ({ id: p.name, namn: p.name }))} />
        )}
        {!plan.steps.length ? (
          <Tom>Hittar ingen väg med kända priser för {plan.profession} just nu. Prisdatan kanske inte räcker än.</Tom>
        ) : !lista.length ? (
          <Tom>Du har allt som behövs i väskorna och banken.</Tom>
        ) : (
          <ul>
            {lista.map((i) => {
              const klar = Boolean(bockar[i.id]);
              const c = chip(i, klar);
              return (
                <li key={i.id} className="border-t border-ink-line first:border-0">
                  <label className="flex min-h-[60px] cursor-pointer items-center gap-3 py-2">
                    <input type="checkbox" checked={klar} onChange={() => vaxla(i.id)} className="h-6 w-6 shrink-0 accent-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium" style={{ color: klar ? '#8e99b1' : kvalitetsfarg(i.quality) }}>
                        {i.name || `Item ${i.id}`} <span className="font-normal text-gray-400">×{i.buy}</span>
                      </span>
                      <span className="block text-xs text-gray-400">
                        {i.source === 'vendor'
                          ? `vendor ${pengar(i.unit)}/st`
                          : `max ${pengar(i.max)}/st · nu ${i.now != null ? pengar(i.now) : '–'}`}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${c.klass}`}>{c.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-1 flex items-baseline justify-between border-t border-ink-line-strong pt-3">
          <span className="text-gray-300">Kvar att köpa</span>
          <span className="tabular font-display text-2xl font-semibold" style={{ color: GULD }}>
            {pengar(kvar)}
          </span>
        </div>
      </Panel>
      <button
        type="button"
        onClick={() => navigera('gubben')}
        className="min-h-[44px] self-center rounded-lg px-4 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white"
      >
        Se hela yrkesvägen
      </button>
    </div>
  );
}
