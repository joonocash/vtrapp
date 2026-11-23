// Farm: guld per timme per zon från din egen loot, och vad som är värt att farma på din level.
import { useWow } from './api.js';
import { Fel, GULD, ItemNamn, Laddar, Panel, Tom } from './ui.jsx';
import { pengar, saljtakt, timmar } from './format.js';

const SORT = { tyg: 'Tyg', örter: 'Örter', malm: 'Malm', läder: 'Läder' };

function Zoner({ zoner, dagar }) {
  return (
    <Panel titel="Din loot per zon" under={`Senaste ${dagar} dagarna · guld per timme räknas på aktiv farmtid`} className="flex-[1_1_100%]">
      {!zoner.length ? (
        <Tom>
          Ingen loot än. Addonet räknar loot per zon från version 1.3.0. Farma en stund, logga ut eller skriv{' '}
          <code className="text-gray-200">/assistent</code>, så dyker det upp här.
        </Tom>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400">
                <th className="py-2 pr-2 font-medium">Zon</th>
                <th className="px-2 py-2 text-right font-medium">Guld/h</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Farmtid</th>
                <th className="px-2 py-2 text-right font-medium">Totalt</th>
                <th className="hidden py-2 pl-2 font-medium md:table-cell">Mest värt</th>
              </tr>
            </thead>
            <tbody>
              {zoner.map((z) => (
                <tr key={z.zone} className="border-t border-ink-line align-top">
                  <td className="py-3 pr-2 font-medium text-white">{z.zone}</td>
                  <td className="tabular px-2 py-3 text-right font-semibold" style={{ color: z.gold_per_hour ? GULD : '#8e99b1' }}>
                    {z.gold_per_hour ? pengar(z.gold_per_hour) : '–'}
                  </td>
                  <td className="hidden px-2 py-3 text-right text-gray-300 sm:table-cell">{timmar(z.farm_hours)}</td>
                  <td className="tabular px-2 py-3 text-right text-white">{pengar(z.total)}</td>
                  <td className="hidden py-3 pl-2 md:table-cell">
                    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {z.top.slice(0, 3).map((i) => (
                        <span key={i.id} className="whitespace-nowrap">
                          <ItemNamn item={i} /> <span className="text-gray-400">×{i.count}</span>
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Tips({ picks }) {
  return (
    <Panel
      titel={picks.level ? `Värt att farma på level ${picks.level}` : 'Värt att farma'}
      under="Sorterat på pris och hur bra det säljer i ditt hus"
      className="flex-[1_1_100%]"
    >
      {!picks.items.length ? (
        <Tom>Hittar inget med priser för din level just nu.</Tom>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {picks.items.map((e) => (
            <li key={e.id} className="flex flex-col gap-2 rounded-xl bg-ink-high p-4">
              <div className="flex items-start justify-between gap-2">
                <ItemNamn item={e} href={`#/wow/marknad/${e.id}`} />
                <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-300">{SORT[e.kind] || e.kind}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="tabular font-display text-xl font-semibold" style={{ color: GULD }}>
                  {pengar(e.normal)}
                  <span className="text-sm font-normal text-gray-400">/st</span>
                </span>
                <span className="text-xs text-gray-400">{e.per_day != null ? saljtakt(e.per_day) : ''}</span>
              </div>
              <ul className="flex flex-col gap-0.5 text-[13px] text-gray-300">
                {e.spots.slice(0, 3).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <div className="mt-auto text-xs text-gray-400">
                Mobs/zoner lvl {e.levels[0]}–{e.levels[1]}
                {e.profession ? ` · ${e.profession} ${e.skill}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
      {picks.skipped?.length > 0 && (
        <p className="text-sm text-gray-300">
          Med ett samlaryrke:{' '}
          {picks.skipped.map((e, n) => (
            <span key={e.id}>
              {n > 0 && ', '}
              {e.name} ({e.profession} {e.skill}, ~{pengar(e.normal)})
            </span>
          ))}
        </p>
      )}
      <p className="text-xs text-gray-400">Platserna är från vanilla och kan skilja sig i Forever.</p>
    </Panel>
  );
}

export default function Farm() {
  const { data, fel, laddar, ladda } = useWow('farm');
  if (fel) return <Fel fel={fel} igen={ladda} />;
  if (laddar || !data) return <Laddar rader={5} />;
  return (
    <div className="flex flex-wrap gap-5">
      <Zoner zoner={data.zones} dagar={data.zone_days} />
      <Tips picks={data.picks} />
    </div>
  );
}
