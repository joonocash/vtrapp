// Affärer: vad du köpt och sålt på AH enligt fakturorna i brevlådan, och vad flipparna gav.
import { useState } from 'react';
import { useWow } from './api.js';
import { Fel, GULD, ItemNamn, Laddar, MINUS, PLUS, Panel, Ruta, Tom, Val } from './ui.jsx';
import { lokalTid, pengar, tal } from './format.js';

const PERIODER = [
  { id: '7', namn: '7 dagar' },
  { id: '30', namn: '30 dagar' },
  { id: '0', namn: 'Allt' },
];

const farg = (v) => (v == null ? '#ffffff' : v > 0 ? PLUS : v < 0 ? MINUS : '#ffffff');

function Veckor({ veckor }) {
  if (!veckor?.length) return null;
  const max = Math.max(1, ...veckor.flatMap((v) => [v.sold_net, v.bought]));
  const B = 300;
  const H = 120;
  const bredd = B / veckor.length;
  return (
    <Panel titel="Per vecka" under="Sålt efter avgift och köpt, senaste 8 veckorna" className="flex-[1_1_320px]">
      <svg viewBox={`0 0 ${B} ${H + 18}`} className="h-auto w-full" role="img" aria-label="Sålt och köpt per vecka">
        {veckor.map((v, i) => {
          const x = i * bredd;
          const hs = (v.sold_net / max) * H;
          const hk = (v.bought / max) * H;
          const d = new Date(v.week);
          return (
            <g key={v.week}>
              <rect x={x + bredd * 0.15} y={H - hs} width={bredd * 0.32} height={hs} rx="2" fill={GULD} />
              <rect x={x + bredd * 0.53} y={H - hk} width={bredd * 0.32} height={hk} rx="2" fill="#5b8dff" />
              <text x={x + bredd / 2} y={H + 14} textAnchor="middle" fill="#8e99b1" fontSize="10">
                {d.getDate()}/{d.getMonth() + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 text-[13px] text-gray-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: GULD }} aria-hidden="true" /> Sålt
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden="true" /> Köpt
        </span>
      </div>
    </Panel>
  );
}

export default function Affarer() {
  const [period, setPeriod] = useState('7');
  const { data, fel, laddar, ladda } = useWow(`affarer?days=${period}`);

  if (fel) return <Fel fel={fel} igen={ladda} />;
  if (laddar || !data) return <Laddar rader={5} />;
  if (!data.has_data) {
    return (
      <Panel titel="Inga affärer än">
        <Tom>
          Addonet läser fakturorna när du öppnar brevlådan i spelet ("Auction successful" och "Auction won"). Det kräver
          addon-version 1.3.0. Kör <code className="text-gray-200">installera.ps1</code> igen om du inte gjort det, öppna
          brevlådan och logga ut.
        </Tom>
      </Panel>
    );
  }
  const t = data.totals;
  const flippar = data.items.filter((i) => i.flip_profit != null);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-400">Från fakturorna i brevlådan, för alla dina gubbar.</p>
        <Val etikett="Period" val={period} onVal={setPeriod} alternativ={PERIODER} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Ruta etikett="Sålt efter avgift" varde={pengar(t.sold_net)} farg={GULD} under={`${t.sold_count} affärer`} />
        <Ruta etikett="Köpt" varde={pengar(t.bought)} under={`${t.bought_count} affärer`} />
        <Ruta
          etikett="Vinst på flippar"
          varde={t.flip_profit ? pengar(t.flip_profit, { tecken: true }) : '–'}
          farg={farg(t.flip_profit)}
          under="det du både köpt och sålt"
        />
        <Ruta etikett="AH:s avgift" varde={pengar(t.cut)} under="5 % av försäljningen" />
      </div>

      <div className="flex flex-wrap gap-5">
        <Panel titel="Per item" className="flex-[2_1_640px] self-start">
          {!data.items.length ? (
            <Tom>Inga affärer under perioden.</Tom>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400">
                    <th className="py-2 pr-2 font-medium">Item</th>
                    <th className="px-2 py-2 text-right font-medium">Köpt</th>
                    <th className="px-2 py-2 text-right font-medium">Sålt</th>
                    <th className="py-2 pl-2 text-right font-medium">Vinst</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.slice(0, 25).map((i) => (
                    <tr key={`${i.id}-${i.name}`} className="border-t border-ink-line">
                      <td className="py-2.5 pr-2">
                        <ItemNamn item={i} href={i.id ? `#/wow/marknad/${i.id}` : undefined} />
                      </td>
                      <td className="tabular px-2 py-2.5 text-right text-gray-300">
                        {i.bought_n ? (
                          <>
                            {tal(i.bought_n)} st
                            <span className="block text-xs text-gray-400">{pengar(i.bought_cost / i.bought_n)}/st</span>
                          </>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right text-gray-300">
                        {i.sold_n ? (
                          <>
                            {tal(i.sold_n)} st
                            <span className="block text-xs text-gray-400">{pengar(i.avg_sell)}/st</span>
                          </>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td className="tabular py-2.5 pl-2 text-right font-medium" style={{ color: farg(i.flip_profit) }}>
                        {i.flip_profit != null ? pengar(i.flip_profit, { tecken: true }) : <span className="text-gray-400">–</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {flippar.length === 0 && data.items.length > 0 && (
            <p className="text-xs text-gray-400">Vinst räknas när du både köpt och sålt samma item.</p>
          )}
        </Panel>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <Veckor veckor={data.weeks} />
          <Panel titel="Senaste">
            <ul className="flex flex-col">
              {data.recent.slice(0, 10).map((r, n) => (
                <li key={n} className="flex items-center gap-3 border-t border-ink-line py-2 first:border-0">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.kind === 'sell' ? 'bg-[#ffd166]/15 text-[#ffd166]' : 'bg-accent-soft text-[#b4c8ff]'
                    }`}
                  >
                    {r.kind === 'sell' ? 'Sålt' : 'Köpt'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      <ItemNamn item={r} /> <span className="text-gray-400">×{r.quantity}</span>
                    </span>
                    <span className="block text-xs text-gray-400">{lokalTid(r.arrived)}</span>
                  </span>
                  <span className="tabular text-white">{pengar(r.kind === 'sell' ? r.price - r.cut : r.price)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
