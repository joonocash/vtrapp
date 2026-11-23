// Gubben och yrken: utrustningen plats för plats med uppgraderingar från AH,
// och billigaste vägen att levla yrket med inköpslista.
import { useEffect, useState } from 'react';
import { ArrowUp, Smartphone } from 'lucide-react';
import { useBockar, useWow } from './api.js';
import { Fel, GULD, ItemNamn, Laddar, Panel, Stapel, Tom, Val } from './ui.jsx';
import { kvalitetsfarg, pengar } from './format.js';

const STEGFARG = { orange: '#fb923c', yellow: '#ffd166', green: '#4ade80' };

function Utrustning() {
  const { data, fel, laddar, ladda } = useWow('gear');
  const [vald, setVald] = useState(null);

  useEffect(() => {
    if (!data?.slots?.length || vald) return;
    const forsta = data.slots.find((s) => s.upgrades.length) || data.slots[0];
    setVald(forsta.slot);
  }, [data, vald]);

  if (fel) return <Fel fel={fel} igen={ladda} />;
  if (laddar || !data) {
    return (
      <Panel titel="Utrustning" className="flex-[2_1_640px]">
        <Laddar rader={6} />
      </Panel>
    );
  }
  if (!data.slots.length) {
    return (
      <Panel titel="Utrustning" className="flex-[2_1_640px]">
        <Tom>Jag vet inte vilken gubbe du kör. Kör <code className="text-gray-200">/koppla</code> i Discord.</Tom>
      </Panel>
    );
  }
  const plats = data.slots.find((s) => s.slot === vald) || data.slots[0];
  const harUtrustning = data.slots.some((s) => s.item);

  return (
    <>
      <Panel
        titel="Utrustning"
        under={
          harUtrustning
            ? 'Gröna pilar = bättre och billigt på AH just nu. Klicka på en plats.'
            : 'Utrustningen hämtas från Blizzard efter att du loggat ut.'
        }
        className="flex-[2_1_640px]"
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {data.slots.map((s) => {
            const ar = s.slot === plats.slot;
            const farg = s.item ? kvalitetsfarg(s.item.quality) : '#4d5770';
            const basta = s.upgrades[0];
            return (
              <button
                key={s.slot}
                type="button"
                aria-pressed={ar}
                onClick={() => setVald(s.slot)}
                className={`flex min-h-[56px] items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                  ar ? 'bg-[#1d2740] ring-2 ring-inset ring-accent' : 'bg-ink-high hover:bg-[#1d2740]'
                }`}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] bg-ink text-xs font-semibold"
                  style={{ color: farg, boxShadow: `inset 0 0 0 2px ${farg}` }}
                  aria-hidden="true"
                >
                  {s.label.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-gray-400">{s.label}</span>
                  <span className="block truncate font-medium" style={{ color: s.item ? farg : '#8e99b1' }}>
                    {s.item ? s.item.name || `Item ${s.item.id}` : 'Inget'}
                  </span>
                </span>
                {basta && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#4ade80]/15 px-2 py-1 text-xs font-semibold text-[#86efac]">
                    <ArrowUp className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    {Math.round(basta.gain)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel className="flex-[1_1_320px]">
        <div>
          <p className="text-xs font-medium text-gray-400">{plats.label}</p>
          <h2 className="mt-0.5 font-display text-[19px] font-semibold" style={{ color: plats.item ? kvalitetsfarg(plats.item.quality) : '#ffffff' }}>
            {plats.item ? plats.item.name || `Item ${plats.item.id}` : 'Tom plats'}
          </h2>
          {plats.item?.stats && <p className="mt-1 text-[13px] text-gray-300">{plats.item.stats}</p>}
        </div>
        <div className="h-px bg-ink-line" />
        <h3 className="text-[13px] font-semibold text-white">
          På AH nu, för {data.char?.class || 'din klass'} lvl {data.info?.level ?? '?'}–{(data.info?.level ?? 0) + 2}
        </h3>
        {plats.upgrades.length ? (
          <ul className="flex flex-col gap-2">
            {plats.upgrades.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-xl bg-ink-high p-2.5">
                <div className="min-w-0 flex-1">
                  <ItemNamn item={u} />
                  <div className="text-xs text-gray-400">
                    {u.stats}
                    {u.req > (data.info?.level ?? 0) ? ` · kräver lvl ${u.req}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular font-semibold" style={{ color: GULD }}>{pengar(u.price)}</div>
                  <div className="text-xs text-[#86efac]">+{Math.round(u.gain)} poäng</div>
                  {!u.affordable && <div className="text-xs text-gray-400">har inte råd än</div>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Tom>Inget billigt som är bättre just nu.</Tom>
        )}
        <p className="mt-auto text-xs text-gray-400">
          Poängen bygger på enkla leveling-vikter för din klass. AH visar{' '}
          {data.info?.gear_known ?? 0} av {data.info?.gear_listed ?? 0} utrustningsitems med kända stats.
        </p>
      </Panel>
    </>
  );
}

export function useYrke() {
  const [yrke, setYrke] = useState(() => {
    try {
      return localStorage.getItem('wow-yrke') || '';
    } catch {
      return '';
    }
  });
  const valj = (namn) => {
    setYrke(namn);
    try {
      localStorage.setItem('wow-yrke', namn);
    } catch {
      // spelar ingen roll
    }
  };
  return [yrke, valj];
}

function Yrkesvag({ navigera }) {
  const [yrke, setYrke] = useYrke();
  const { data, fel, laddar, ladda } = useWow(`craft${yrke ? `?prof=${encodeURIComponent(yrke)}` : ''}`);
  const plan = data?.plan;
  const { bockar, vaxla, rensa } = useBockar(plan ? `wow-inkop-${plan.profession}-${plan.target}` : 'wow-inkop');

  if (fel) return <Fel fel={fel} igen={ladda} />;
  if (laddar || !data) {
    return (
      <Panel titel="Yrken" className="flex-[1_1_100%]">
        <Laddar rader={4} />
      </Panel>
    );
  }
  if (!plan) {
    return (
      <Panel titel="Yrken" className="flex-[1_1_100%]">
        <Tom>Inga yrken med recept. De syns i Blizzards API efter en utloggning.</Tom>
      </Panel>
    );
  }
  const totalStegkostnad = plan.steps.reduce((s, x) => s + x.cost, 0) || 1;
  const kvar = plan.shopping.filter((i) => i.buy > 0 && !bockar[i.id]).reduce((s, i) => s + i.cost, 0);

  return (
    <Panel
      titel={`Billigaste vägen till ${plan.target}`}
      under="Dagens AH-priser · det du har i väskor och bank är avdraget"
      className="flex-[1_1_100%]"
      hoger={
        data.professions.length > 1 && (
          <Val
            etikett="Yrke"
            val={plan.profession}
            onVal={setYrke}
            alternativ={data.professions.map((p) => ({ id: p.name, namn: `${p.name} ${p.skill}` }))}
          />
        )
      }
    >
      {plan.needs_training && (
        <p className="rounded-xl bg-[#fb923c]/10 px-3.5 py-2.5 text-sm text-[#fdba74]">
          Du är på max för din nivå. Träna nästa nivå hos trainern först (upp till {plan.target}).
        </p>
      )}
      {!plan.steps.length ? (
        <Tom>Hittar inget recept med kända priser som ger skill-up härifrån. Prisdatan kanske inte räcker än.</Tom>
      ) : (
        <ol className="flex flex-wrap gap-2.5">
          {plan.steps.map((s) => (
            <li key={`${s.from}-${s.recipe}`} className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5 rounded-xl bg-ink-high p-3.5">
              <div className="flex justify-between text-xs font-medium text-gray-400">
                <span className="tabular">
                  {s.from} → {s.to}
                </span>
                <span className="tabular">~{pengar(s.cost)}</span>
              </div>
              <div className="font-medium text-white">
                {s.recipe} <span className="text-gray-400">×{s.count}</span>
              </div>
              <Stapel procent={(s.cost / totalStegkostnad) * 100} farg={STEGFARG[s.color]} hojd="h-1.5" etikett={`${Math.round((s.cost / totalStegkostnad) * 100)} procent av kostnaden`} />
              <div className="text-xs text-gray-400">
                {s.color === 'orange' ? 'Orange, alltid skill-up' : s.color === 'yellow' ? 'Gul, oftast skill-up' : 'Grön, ibland skill-up'}
                {s.learn ? ' · lär dig hos trainern' : ''}
              </div>
            </li>
          ))}
        </ol>
      )}
      {plan.stuck_at != null && (
        <p className="text-sm text-gray-300">Vid {plan.stuck_at} tar de billiga recepten slut. Kolla trainern efter nya recept.</p>
      )}

      {plan.shopping.length > 0 && (
        <div className="flex flex-wrap gap-6">
          <div className="min-w-0 flex-[2_1_420px]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-white">Inköpslista</h3>
              {Object.values(bockar).some(Boolean) && (
                <button type="button" onClick={rensa} className="min-h-[36px] rounded-lg px-2 text-xs text-gray-400 hover:text-white">
                  Avmarkera alla
                </button>
              )}
            </div>
            <ul>
              {plan.shopping.map((i) => {
                const klar = i.buy === 0 || bockar[i.id];
                return (
                  <li key={i.id} className="border-t border-ink-line">
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 py-1">
                      <input
                        type="checkbox"
                        checked={Boolean(klar)}
                        disabled={i.buy === 0}
                        onChange={() => vaxla(i.id)}
                        className="h-[18px] w-[18px] accent-accent"
                      />
                      <span className="min-w-0 flex-1 truncate" style={{ color: klar ? '#8e99b1' : kvalitetsfarg(i.quality) }}>
                        {i.name || `Item ${i.id}`} <span className="text-gray-400">×{i.buy || i.need}</span>
                      </span>
                      <span className="hidden text-xs text-gray-400 sm:inline">
                        har {i.have}
                        {i.source === 'vendor' ? ' · vendor' : ''}
                      </span>
                      <span className="tabular w-20 text-right text-white">{i.buy ? pengar(i.cost) : 'har allt'}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="flex flex-[1_1_220px] flex-col gap-2 self-start rounded-xl bg-ink-high p-4">
            <div className="text-xs font-medium text-gray-400">Kvar att köpa</div>
            <div className="tabular font-display text-[28px] font-semibold" style={{ color: GULD }}>
              {pengar(kvar)}
            </div>
            <p className="text-[13px] text-gray-300">Hela vägen kostar ungefär {pengar(plan.total_cost)} med det craftade vendorvärdet avdraget.</p>
            <button
              type="button"
              onClick={() => navigera('ah')}
              className="mt-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong"
            >
              <Smartphone className="h-4 w-4" aria-hidden="true" /> Öppna vid AH
            </button>
          </div>
        </div>
      )}
      {!plan.used_known && (
        <p className="text-xs text-gray-400">Bygger på trainer-recept, eftersom Blizzard inte visar exakt vilka recept du kan.</p>
      )}
    </Panel>
  );
}

export default function Gubben({ navigera }) {
  return (
    <div className="flex flex-wrap gap-5">
      <Utrustning />
      <Yrkesvag navigera={navigera} />
    </div>
  );
}
