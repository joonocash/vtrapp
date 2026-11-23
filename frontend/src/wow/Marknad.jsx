// Marknaden: sök ett item, prisgraf för tre hus, bästa tid att köpa, mellan husen,
// flip-kalkylator och bevakningar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { hamta, skicka, useWow } from './api.js';
import { Fel, ItemNamn, Laddar, MINUS, PLUS, Panel, Tom, Val } from './ui.jsx';
import {
  HUS, WOWHEAD, flip, grafSkala, heatFarg, kvalitetsfarg, parsePris, pengar, pengarAxel, prisText, saljtakt, sedan, tal,
} from './format.js';

const HUSFARG = { alliance: '#5b8dff', horde: '#fb923c', neutral: '#2dd4bf' };
const SPANN = [
  { id: '24h', namn: '24 h' },
  { id: '14d', namn: '14 d' },
  { id: 'all', namn: 'Allt' },
];

function Sok({ navigera, valt }) {
  const [q, setQ] = useState('');
  const [traffar, setTraffar] = useState([]);
  const [oppen, setOppen] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setTraffar([]);
      return undefined;
    }
    const ctrl = new AbortController();
    timer.current = setTimeout(() => {
      hamta(`search?q=${encodeURIComponent(q.trim())}`, ctrl.signal)
        .then((r) => {
          setTraffar(r || []);
          setOppen(true);
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer.current);
      ctrl.abort();
    };
  }, [q]);

  const valj = (id) => {
    setOppen(false);
    setQ('');
    navigera(`marknad/${id}`);
  };

  return (
    <div className="relative flex-[1_1_280px]">
      <label htmlFor="wow-sok" className="sr-only">
        Sök item
      </label>
      <div className="flex items-center gap-2.5 rounded-xl bg-ink px-3.5 ring-1 ring-inset ring-ink-line-strong focus-within:ring-accent">
        <Search className="h-[18px] w-[18px] text-gray-400" aria-hidden="true" />
        <input
          id="wow-sok"
          type="search"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => traffar.length && setOppen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && traffar[0]) valj(traffar[0].id);
            if (e.key === 'Escape') setOppen(false);
          }}
          placeholder={valt ? `Sök ett annat item än ${valt}` : 'Sök item, t.ex. Silk Cloth'}
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-gray-500 focus:outline-none"
        />
      </div>
      {oppen && traffar.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-ink-line-strong bg-ink-raised p-1 shadow-panel">
          {traffar.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => valj(t.id)}
                className="flex min-h-[44px] w-full items-center rounded-lg px-3 text-left hover:bg-ink-high"
                style={{ color: kvalitetsfarg(t.quality) }}
              >
                {t.name || `Item ${t.id}`}
              </button>
            </li>
          ))}
        </ul>
      )}
      {oppen && q.trim().length >= 2 && traffar.length === 0 && (
        <p className="absolute inset-x-0 top-full z-20 mt-1.5 rounded-xl border border-ink-line bg-ink-raised p-3 text-sm text-gray-400">
          Hittar inget med det namnet.
        </p>
      )}
    </div>
  );
}

function HusRutor({ item }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {item.houses.map((h) => {
        const andel = h.now != null && h.normal ? Math.round((h.now / h.normal - 1) * 100) : null;
        return (
          <div key={h.key} className="min-w-[120px] rounded-xl bg-ink-high px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
              <span className="h-[3px] w-2.5 rounded-sm" style={{ background: HUSFARG[h.key] }} aria-hidden="true" />
              {HUS[h.key]}
            </div>
            <div className="tabular font-display text-xl font-semibold text-white">{h.now != null ? pengar(h.now) : 'inte ute'}</div>
            <div className="text-xs" style={{ color: andel != null && andel <= -15 ? PLUS : '#8e99b1' }}>
              {andel == null
                ? h.last_seen
                  ? `senast ute ${sedan(h.last_seen)}`
                  : 'ingen data'
                : andel <= -3
                  ? `${-andel} % under normalt`
                  : andel >= 3
                    ? `${andel} % över normalt`
                    : 'normalt'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Prisgraf({ item, spann, setSpann, egetHus }) {
  const B = 660;
  const H = 240;
  const skala = useMemo(() => grafSkala(item.history, B, H), [item]);
  const eget = item.houses.find((h) => h.key === egetHus) || item.houses[0];
  const datum = (t) => {
    const d = new Date(t);
    return spann === '24h' ? `${String(d.getHours()).padStart(2, '0')}:00` : `${d.getDate()}/${d.getMonth() + 1}`;
  };
  return (
    <Panel
      titel="Lägsta pris per st"
      under={`${item.name || `Item ${item.id}`}${item.vendor_sell ? ` · vendor ${pengar(item.vendor_sell)}` : ''}`}
      className="flex-[2_1_640px]"
      hoger={<Val etikett="Tidsperiod" val={spann} onVal={setSpann} alternativ={SPANN} />}
    >
      {!skala ? (
        <Tom>Ingen prishistorik för den här perioden.</Tom>
      ) : (
        <svg viewBox={`0 0 ${B} ${H}`} className="h-auto w-full" role="img" aria-label={`Pris för ${item.name || 'itemet'} i tre auktionshus`}>
          {skala.rutnat.map((r) => (
            <g key={r.y}>
              <line x1={skala.vanster} x2={skala.hoger} y1={r.y} y2={r.y} stroke="rgba(148,163,196,0.12)" />
              <text x={skala.vanster - 6} y={r.y + 4} textAnchor="end" fill="#8e99b1" fontSize="11">
                {pengarAxel(r.v)}
              </text>
            </g>
          ))}
          {['neutral', 'horde', 'alliance'].map((k) =>
            skala.linjer[k] ? (
              <polyline
                key={k}
                points={skala.linjer[k]}
                fill="none"
                stroke={HUSFARG[k]}
                strokeWidth={k === egetHus ? 3 : 2}
                strokeDasharray={k === 'neutral' ? '6 4' : undefined}
                strokeLinejoin="round"
              />
            ) : null,
          )}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const t = skala.t0 + (skala.t1 - skala.t0) * f;
            return (
              <text key={f} x={skala.x(t)} y={H - 4} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'} fill="#8e99b1" fontSize="11">
                {datum(t)}
              </text>
            );
          })}
        </svg>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-gray-300">
        {Object.keys(HUS).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span
              className="w-4"
              style={{ borderTop: `3px ${k === 'neutral' ? 'dashed' : 'solid'} ${HUSFARG[k]}` }}
              aria-hidden="true"
            />
            {HUS[k]}
          </span>
        ))}
        <span className="ml-auto">
          Normalt i {HUS[eget.key]}: {pengar(eget.normal)}
          {eget.per_day != null ? ` · ${saljtakt(eget.per_day)}` : ''}
        </span>
      </div>
    </Panel>
  );
}

function Varmekarta({ itemId, egetHus }) {
  const { data, fel, laddar } = useWow(`item/${itemId}/heatmap?house=${egetHus}`);
  const finns = (data?.cells || []).flat().filter((c) => c != null);
  const min = finns.length ? Math.min(...finns) : 1;
  const max = finns.length ? Math.max(...finns) : 1;
  const tid = (x) => `${x.day} runt ${String(x.hour).padStart(2, '0')}`;
  return (
    <Panel titel="Bästa tid att köpa" className="flex-[1_1_320px]">
      {laddar ? (
        <Laddar rader={2} />
      ) : fel ? (
        <Tom>Kunde inte hämta värmekartan.</Tom>
      ) : !finns.length ? (
        <Tom>Ingen data för det här itemet i {HUS[egetHus]}-huset än.</Tom>
      ) : (
        <>
          <p className="text-gray-300">
            {data.best && data.worst ? (
              <>
                Billigast <span className="font-medium text-white">{tid(data.best)}</span> ({data.best.pct} %). Dyrast{' '}
                {tid(data.worst)} (+{data.worst.pct} %).
              </>
            ) : (
              'För lite data för att se ett mönster än.'
            )}
          </p>
          <div role="img" aria-label="Pris per veckodag och timme. Starkare blå är billigare." className="flex flex-col gap-[3px]">
            {data.cells.map((rad, d) => (
              <div key={data.days[d]} className="flex items-center gap-[3px]">
                <span className="w-7 text-[11px] text-gray-400">{data.days[d]}</span>
                {rad.map((c, h) => (
                  <span
                    key={h}
                    className="h-4 flex-1 rounded-[3px]"
                    style={{ background: heatFarg(c, min, max) }}
                    title={c == null ? `${data.days[d]} ${h}:00, ingen data` : `${data.days[d]} ${h}:00, ${Math.round((c - 1) * 100)} %`}
                  />
                ))}
              </div>
            ))}
            <div className="flex justify-between pl-[31px] text-[11px] text-gray-400" aria-hidden="true">
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>23</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Dyrare</span>
            <span className="h-2 flex-1 rounded bg-gradient-to-r from-ink-high to-accent" aria-hidden="true" />
            <span>Billigare</span>
          </div>
          {!data.enough && (
            <p className="text-xs text-gray-400">
              Bygger fortfarande upp data ({tal(data.samples)} timmar hittills). Mönstret blir säkrare för varje vecka.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

function MellanHusen() {
  const { data, fel, laddar } = useWow('arbitrage');
  return (
    <Panel
      titel="Mellan husen"
      under={`Köp billigt i ${HUS[data?.from] || 'ditt hus'}, lägg ut i Blackwater (15 % avgift avdragen)`}
      className="flex-[1_1_320px]"
    >
      {laddar ? (
        <Laddar rader={3} />
      ) : fel ? (
        <Tom>Kunde inte hämta jämförelsen.</Tom>
      ) : !data.items.length ? (
        <Tom>Inget som lönar sig att flytta just nu.</Tom>
      ) : (
        <ul className="flex flex-col">
          {data.items.slice(0, 6).map((it) => (
            <li key={it.id} className="flex items-center gap-3 border-t border-ink-line py-2.5 first:border-0">
              <div className="min-w-0 flex-1">
                <ItemNamn item={it} href={`#/wow/marknad/${it.id}`} />
                <div className="text-xs text-gray-400">
                  {pengar(it.buy)} → {pengar(it.sell)}
                  {it.per_day != null ? ` · ${saljtakt(it.per_day)} där` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular font-semibold text-[#4ade80]">{pengar(it.profit, { tecken: true })}</div>
                <div className="text-xs text-gray-400">per st</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-400">Insättningsavgiften tillkommer, och ett annat hus kan ha få köpare.</p>
    </Panel>
  );
}

function Prisfalt({ id, etikett, varde, onChange }) {
  const fel = varde !== '' && parsePris(varde) == null;
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-gray-400">
      {etikett}
      <input
        id={id}
        inputMode="decimal"
        value={varde}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={fel}
        placeholder="t.ex. 38s"
        className={`h-11 min-w-0 rounded-[10px] bg-ink px-2.5 text-[15px] text-white ring-1 ring-inset focus:outline-none focus:ring-accent ${
          fel ? 'ring-[#f87171]' : 'ring-ink-line-strong'
        }`}
      />
    </label>
  );
}

function Kalkylator({ item, egetHus }) {
  const eget = item?.houses.find((h) => h.key === egetHus);
  const neutral = item?.houses.find((h) => h.key === 'neutral');
  const [kop, setKop] = useState('');
  const [salj, setSalj] = useState('');
  const [antal, setAntal] = useState('20');
  const [var_, setVar] = useState('eget');

  useEffect(() => {
    if (!item) return;
    setKop(prisText(eget?.now ?? eget?.normal));
    setSalj(prisText(eget?.normal ?? eget?.now));
    // bara när ett nytt item valts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const r = flip({ kop: parsePris(kop) || 0, salj: parsePris(salj) || 0, antal, avgift: var_ === 'eget' ? 0.05 : 0.15 });
  const takt = (var_ === 'eget' ? eget : neutral)?.per_day;
  const dagar = takt ? r.antal / takt : null;
  return (
    <Panel
      titel="Flip-kalkylator"
      under={item ? item.name : 'Välj ett item eller skriv in priser'}
      className="flex-[1_1_320px]"
      hoger={
        <Val
          etikett="Var du säljer"
          val={var_}
          onVal={setVar}
          alternativ={[
            { id: 'eget', namn: HUS[egetHus] || 'Mitt hus' },
            { id: 'neutral', namn: 'Blackwater' },
          ]}
        />
      }
    >
      <div className="grid grid-cols-3 gap-2.5">
        <Prisfalt id="flip-kop" etikett="Köp per st" varde={kop} onChange={setKop} />
        <Prisfalt id="flip-salj" etikett="Sälj per st" varde={salj} onChange={setSalj} />
        <label htmlFor="flip-antal" className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-gray-400">
          Antal
          <input
            id="flip-antal"
            type="number"
            min="1"
            value={antal}
            onChange={(e) => setAntal(e.target.value)}
            className="h-11 min-w-0 rounded-[10px] bg-ink px-2.5 text-[15px] text-white ring-1 ring-inset ring-ink-line-strong focus:outline-none focus:ring-accent"
          />
        </label>
      </div>
      <div className="flex flex-col gap-1.5 rounded-xl bg-ink-high p-3.5">
        <div className="flex justify-between text-gray-300">
          <span>AH-avgift {var_ === 'eget' ? '5' : '15'} %</span>
          <span className="tabular">{pengar(-r.avgift)}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>Säljer på</span>
          <span>{dagar == null ? 'okänt' : dagar < 1 ? 'under en dag' : `~${Math.ceil(dagar)} dagar`}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-medium text-white">Vinst</span>
          <span className="tabular font-display text-[22px] font-semibold" style={{ color: r.vinst >= 0 ? PLUS : MINUS }}>
            {pengar(r.vinst, { tecken: true })}
          </span>
        </div>
      </div>
    </Panel>
  );
}

function Bevakning({ item }) {
  const { data, fel, laddar, ladda, setData } = useWow('watch');
  const [pris, setPris] = useState('');
  const [skickar, setSkickar] = useState(false);
  const [meddelande, setMeddelande] = useState('');
  const koppar = parsePris(pris);

  const lagg = async (e) => {
    e.preventDefault();
    if (!item || !koppar) return;
    setSkickar(true);
    setMeddelande('');
    try {
      setData(await skicka('watch', 'POST', { item_id: item.id, max_price: koppar }));
      setPris('');
    } catch (err) {
      setMeddelande(err.message);
    } finally {
      setSkickar(false);
    }
  };
  const ta = async (id) => {
    try {
      await skicka(`watch/${id}`, 'DELETE');
      ladda(true);
    } catch (err) {
      setMeddelande(err.message);
    }
  };

  return (
    <Panel titel="Bevakning" under="Boten säger till i Discord när något ligger under ditt pris, medan du spelar" className="flex-[1_1_320px]">
      <form onSubmit={lagg} className="flex items-end gap-2">
        <Prisfalt id="bevaka-pris" etikett={item ? `Maxpris för ${item.name}` : 'Välj ett item först'} varde={pris} onChange={setPris} />
        <button
          type="submit"
          disabled={!item || !koppar || skickar}
          className="h-11 shrink-0 rounded-[10px] bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-40"
        >
          Bevaka
        </button>
      </form>
      {meddelande && <p className="text-sm text-[#f87171]">{meddelande}</p>}
      {laddar ? (
        <Laddar rader={2} />
      ) : fel ? (
        <Tom>Kunde inte hämta bevakningarna.</Tom>
      ) : !data.items.length ? (
        <Tom>Inga bevakningar än.</Tom>
      ) : (
        <ul className="flex flex-col">
          {data.items.map((w) => (
            <li key={w.item_id} className="flex items-center gap-3 border-t border-ink-line py-2 first:border-0">
              <div className="min-w-0 flex-1">
                <ItemNamn item={{ id: w.item_id, name: w.name, quality: w.quality?.toLowerCase() }} href={`#/wow/marknad/${w.item_id}`} />
                <div className="text-xs text-gray-400">under {pengar(w.max_price)}</div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  w.under ? 'bg-[#4ade80]/15 text-[#86efac]' : 'bg-white/5 text-gray-300'
                }`}
              >
                {w.now == null ? 'inte ute' : w.under ? `ligger på ${pengar(w.now)}` : `nu ${pengar(w.now)}`}
              </span>
              <button
                type="button"
                onClick={() => ta(w.item_id)}
                aria-label={`Ta bort bevakningen på ${w.name || 'itemet'}`}
                className="grid h-11 w-11 place-items-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Startlista({ egetHus }) {
  const { data, laddar } = useWow(`deals?house=${egetHus}`);
  return (
    <Panel titel="Välj ett item" under={`Sök ovan, eller börja med fynden i ${HUS[egetHus]}-huset`} className="flex-[2_1_640px]">
      {laddar ? (
        <Laddar rader={4} />
      ) : !data?.items?.length ? (
        <Tom>Inga fynd just nu. Sök på ett item du vill kolla.</Tom>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.items.map((it) => (
            <li key={it.id}>
              <a href={`#/wow/marknad/${it.id}`} className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl bg-ink-high px-3.5 py-2.5 hover:bg-[#1d2740]">
                <span className="min-w-0 truncate font-medium" style={{ color: kvalitetsfarg(it.quality) }}>
                  {it.name || `Item ${it.id}`}
                </span>
                <span className="tabular whitespace-nowrap text-sm text-gray-300">
                  {pengar(it.now)} <span className="text-[#4ade80]">{pengar(it.profit, { tecken: true })}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function Marknad({ itemId, oversikt, navigera }) {
  const egetHus = oversikt?.own_house || 'alliance';
  const [spann, setSpann] = useState('14d');
  const item = useWow(itemId ? `item/${itemId}?span=${spann}` : null);
  const visat = item.data && item.data.id === itemId ? item.data : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="panel flex flex-wrap items-center gap-4 p-4 sm:px-5">
        <Sok navigera={navigera} valt={visat?.name} />
        {visat && <HusRutor item={visat} />}
      </div>
      {item.fel && <Fel fel={item.fel} igen={item.ladda} />}
      <div className="flex flex-wrap gap-5">
        {!itemId ? (
          <Startlista egetHus={egetHus} />
        ) : !visat ? (
          <Panel className="flex-[2_1_640px]">
            <Laddar rader={5} />
          </Panel>
        ) : (
          <Prisgraf item={visat} spann={spann} setSpann={setSpann} egetHus={egetHus} />
        )}
        {itemId ? (
          <Varmekarta itemId={itemId} egetHus={egetHus} />
        ) : (
          <Panel titel="Bästa tid att köpa" className="flex-[1_1_320px]">
            <Tom>Välj ett item så visas när på veckan det brukar vara billigast.</Tom>
          </Panel>
        )}
        <MellanHusen />
        <Kalkylator item={visat} egetHus={egetHus} />
        <Bevakning item={visat} />
      </div>
      {visat && (
        <p className="text-xs text-gray-400">
          Priserna är lägsta pris per styck.{' '}
          <a href={`${WOWHEAD}${visat.id}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Öppna {visat.name || 'itemet'} på Wowhead
          </a>
        </p>
      )}
    </div>
  );
}
