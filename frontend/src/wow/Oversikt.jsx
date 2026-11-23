// Översikten: gubben, guldet, målet, passen, fynden och vad som är på gång.
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { GULD, ItemNamn, Laddar, MINUS, PLUS, Panel, Ring, Ruta, Sparkline, Stapel, Tom, Val } from './ui.jsx';
import { useWow } from './api.js';
import { HUS, datumKort, lokalTid, pengar, saljtakt, sedan, tal, timmar, timmarSedan } from './format.js';

const plusMinus = (v) => (v == null ? '#ffffff' : v > 0 ? PLUS : v < 0 ? MINUS : '#ffffff');

function Gubbe({ data }) {
  const { char, status, gold, current_pass: pass, last_pass: forra } = data;
  if (!char) {
    return (
      <Panel titel="Ingen gubbe än" className="flex-[2_1_640px]">
        <Tom>Kör <code className="text-gray-200">/koppla</code> i Discord så hittar assistenten dina gubbar.</Tom>
      </Panel>
    );
  }
  const xpProcent = char.xp != null && char.xp_max ? (char.xp / char.xp_max) * 100 : null;
  const fler = (gold.chars || []).slice(1);
  const passRuta = pass
    ? { etikett: 'Det här passet', varde: pass.money_diff == null ? '–' : pengar(pass.money_diff, { tecken: true }),
        under: 'uppdateras vid /reload eller utloggning', farg: plusMinus(pass.money_diff) }
    : forra
      ? { etikett: 'Förra passet', varde: forra.money_diff == null ? '–' : pengar(forra.money_diff, { tecken: true }),
          under: timmar(forra.hours), farg: plusMinus(forra.money_diff) }
      : { etikett: 'Spelpass', varde: '–', under: 'räknas när Discord visar WoW' };
  const prognos = char.forecast_60;
  const sextio =
    char.level >= 60
      ? { varde: 'Klart!', under: 'level 60' }
      : prognos?.date
        ? { varde: `~${datumKort(prognos.date)}`, under: `vid ${Math.round(char.hours_per_week)} h spelande i veckan` }
        : prognos
          ? { varde: `~${timmar(prognos.play_hours)}`, under: 'spelande kvar' }
          : { varde: '–', under: 'räknas när XP-datan finns' };

  return (
    <Panel className="flex-[2_1_640px]">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-high font-display text-2xl font-semibold text-white ring-2 ring-inset ring-white/80">
          {(char.name || '?').slice(0, 1)}
        </span>
        <div className="min-w-0 flex-[1_1_200px]">
          <h2 className="font-display text-2xl font-semibold text-white">
            {char.name} {char.surname || ''}
          </h2>
          <p className="text-gray-400">
            Level {char.level ?? '?'} {char.class || ''}
            {char.zone ? ` · ${char.zone}` : ''}
          </p>
        </div>
        {status.playing ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-[#4ade80]/10 px-3 py-1.5 font-medium text-[#86efac]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-live-ping rounded-full bg-[#4ade80]" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ade80]" />
            </span>
            Spelar nu{status.playing_since ? ` · ${timmar(timmarSedan(status.playing_since))}` : ''}
          </span>
        ) : (
          <span className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-gray-300">
            Offline{char.saved_at ? ` · väskor ${sedan(char.saved_at)}` : ''}
          </span>
        )}
      </div>

      {xpProcent != null && (
        <div>
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
            <span className="tabular font-medium text-gray-200">
              {tal(char.xp)} / {tal(char.xp_max)} XP
            </span>
            {char.hours_to_next != null && (
              <span className="text-gray-400">~{timmar(char.hours_to_next)} till level {char.level + 1}</span>
            )}
          </div>
          <Stapel procent={xpProcent} hojd="h-3" farg="linear-gradient(90deg,#3f74f0,#5b8dff)" etikett={`${Math.round(xpProcent)} procent till nästa level`} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Ruta
          etikett="Guld, alla gubbar"
          varde={pengar(gold.total)}
          farg={GULD}
          under={fler.length ? `${gold.chars[0].name} ${pengar(gold.chars[0].money)} · alts ${pengar(fler.reduce((s, c) => s + c.money, 0))}` : 'från addonet'}
        />
        <Ruta {...passRuta} />
        <Ruta
          etikett="XP i timmen"
          varde={char.xp_per_hour ? tal(char.xp_per_hour) : '–'}
          under={char.xp_per_hour ? 'snitt senaste 14 dagarna' : 'kommer efter några pass'}
        />
        <Ruta etikett="Level 60" {...sextio} />
      </div>
    </Panel>
  );
}

function Guldmal({ mal }) {
  return (
    <Panel titel="Guldmål" className="flex-[1_1_320px] items-center text-center">
      {mal ? (
        <>
          <Ring procent={mal.pct}>
            <text x="70" y="68" textAnchor="middle" fill="#fff" fontFamily="Outfit, Inter, sans-serif" fontSize="28" fontWeight="600">
              {mal.pct} %
            </text>
            <text x="70" y="90" textAnchor="middle" fill="#8e99b1" fontSize="12">
              av {pengar(mal.target)}
            </text>
          </Ring>
          <div>
            <div className="font-display text-[19px] font-semibold" style={{ color: GULD }}>
              {mal.name || 'Guldmål'}
            </div>
            <p className="tabular mt-0.5 text-gray-200">{pengar(mal.total)}</p>
            <p className="mt-1 text-gray-300">
              {mal.pct >= 100
                ? 'Klart! Dags att handla.'
                : mal.hours_left != null && mal.gold_per_hour > 0
                  ? `~${timmar(mal.hours_left)} spelande kvar i din takt (${pengar(mal.gold_per_hour)}/h de senaste 14 dagarna)`
                  : mal.gold_per_hour != null && mal.gold_per_hour <= 0
                    ? 'Guldet har minskat de senaste 14 dagarna, så det går inte att räkna ut när du är framme.'
                    : 'Tiden kvar räknas ut när du spelat några timmar med addonet.'}
            </p>
          </div>
          <p className="text-xs text-gray-400">Ändra med <code className="text-gray-300">/mal</code> i Discord</p>
        </>
      ) : (
        <Tom>
          Inget mål satt. Skriv till exempel <code className="text-gray-200">/mal guld:100 vad:Mount</code> i Discord.
        </Tom>
      )}
    </Panel>
  );
}

function Fynd({ fynd, egetHus }) {
  const [hus, setHus] = useState(egetHus || 'alliance');
  // Översikten har bara ditt eget hus. De andra hämtas när du byter.
  const andra = useWow(fynd?.[hus] ? null : `deals?house=${hus}`);
  const d = fynd?.[hus] || andra.data;
  return (
    <Panel
      titel="Fynd just nu"
      under="Billigt jämfört med normalpriset, och det säljer"
      className="flex-[2_1_640px]"
      hoger={
        <Val
          etikett="Auktionshus"
          val={hus}
          onVal={setHus}
          alternativ={Object.entries(HUS).map(([id, namn]) => ({ id, namn }))}
        />
      }
    >
      {!d && andra.laddar ? (
        <Laddar rader={3} />
      ) : !d || d.hours_of_data < d.needed_hours ? (
        <Tom>
          Samlar fortfarande data ({d?.hours_of_data ?? 0} av {d?.needed_hours ?? 24} timmar). Fynd visas när det finns ett
          normalpris att jämföra med.
        </Tom>
      ) : !d.items.length ? (
        <Tom>Inga tydliga fynd i {HUS[hus]}-huset just nu (hämtat {sedan(d.fetched_at)}).</Tom>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400">
                <th className="py-2 pr-2 font-medium">Item</th>
                <th className="px-2 py-2 text-right font-medium">Nu</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Brukar</th>
                <th className="px-2 py-2 text-right font-medium">Vinst/st</th>
                <th className="hidden px-2 py-2 text-right font-medium md:table-cell">Säljer</th>
                <th className="hidden py-2 pl-2 text-right font-medium sm:table-cell">14 dagar</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((it) => (
                <tr key={it.id} className="border-t border-ink-line">
                  <td className="py-3 pr-2">
                    <ItemNamn item={it} href={`#/wow/marknad/${it.id}`} />
                  </td>
                  <td className="tabular px-2 py-3 text-right text-white">{pengar(it.now)}</td>
                  <td className="tabular hidden px-2 py-3 text-right text-gray-400 sm:table-cell">{pengar(it.normal)}</td>
                  <td className="tabular px-2 py-3 text-right font-medium text-[#4ade80]">{pengar(it.profit, { tecken: true })}</td>
                  <td className="hidden px-2 py-3 text-right text-gray-300 md:table-cell">{saljtakt(it.per_day) || '–'}</td>
                  <td className="hidden py-3 pl-2 text-right sm:table-cell">
                    <Sparkline varden={it.spark} etikett={`Lägsta pris för ${it.name || 'itemet'} senaste 14 dagarna`} />
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

function ForraPasset({ pass }) {
  if (!pass) {
    return (
      <Panel titel="Förra passet">
        <Tom>Inget spelpass än. Ett pass räknas från att Discord visar att du spelar WoW tills du slutar.</Tom>
      </Panel>
    );
  }
  const en = pass.chars.length === 1 ? pass.chars[0] : null;
  return (
    <Panel titel="Förra passet" under={`${lokalTid(pass.started_at)} · ${timmar(pass.hours)}`}>
      {!pass.chars.length ? (
        <Tom>Inga siffror från addonet för passet.</Tom>
      ) : en ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Ruta etikett="Guld" varde={en.money_diff == null ? '–' : pengar(en.money_diff, { tecken: true })} farg={plusMinus(en.money_diff)} />
          <Ruta
            etikett="Level"
            varde={en.level_before && en.level_after && en.level_after > en.level_before ? `${en.level_before} → ${en.level_after}` : en.level_after ?? '–'}
          />
          <Ruta etikett="XP" varde={en.xp_gained ? tal(en.xp_gained) : '–'} />
          <Ruta etikett="XP i timmen" varde={en.xp_per_hour ? tal(en.xp_per_hour) : '–'} />
        </div>
      ) : (
        <ul className="flex flex-col">
          {pass.chars.map((c) => (
            <li key={c.slug} className="flex justify-between gap-3 border-t border-ink-line py-2.5 first:border-0">
              <span className="text-white">{c.name}</span>
              <span className="tabular" style={{ color: plusMinus(c.money_diff) }}>
                {c.money_diff == null ? '–' : pengar(c.money_diff, { tecken: true })}
                {c.xp_gained ? <span className="text-gray-400"> · {tal(c.xp_gained)} XP</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function BastaUppgradering({ up, navigera }) {
  return (
    <Panel
      titel="Bästa uppgraderingen"
      hoger={
        <button type="button" onClick={() => navigera('gubben')} className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-white/5 px-3 text-sm font-medium text-gray-200 hover:bg-white/10">
          Alla <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </button>
      }
    >
      {up ? (
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-ink-high text-xs font-semibold" style={{ color: '#4ade80', boxShadow: 'inset 0 0 0 2px #1eff00' }}>
            +{Math.round(up.gain)}
          </span>
          <div className="min-w-0 flex-1">
            <ItemNamn item={up} />
            <div className="text-[13px] text-gray-400">
              {up.slot_label}
              {up.replaces ? ` · ersätter ${up.replaces}` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="tabular font-semibold" style={{ color: GULD }}>{pengar(up.price)}</div>
            <div className="text-xs text-gray-400">{up.affordable ? 'har råd' : 'har inte råd än'}</div>
          </div>
        </div>
      ) : (
        <Tom>Inget billigt som är bättre på AH just nu.</Tom>
      )}
    </Panel>
  );
}

function Yrken({ yrken, navigera }) {
  return (
    <Panel
      titel="Yrken"
      className="flex-[1_1_320px]"
      hoger={
        <button type="button" onClick={() => navigera('gubben')} className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-white/5 px-3 text-sm font-medium text-gray-200 hover:bg-white/10">
          Vägen <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </button>
      }
    >
      {!yrken?.length ? (
        <Tom>Inga yrken med recept. De syns i Blizzards API efter en utloggning.</Tom>
      ) : (
        yrken.map((y) => (
          <div key={y.name}>
            <div className="mb-1.5 flex justify-between">
              <span className="font-medium text-white">{y.name}</span>
              <span className="tabular text-gray-300">
                {y.skill} / {y.max || y.target}
              </span>
            </div>
            <Stapel procent={(y.skill / (y.max || y.target || 1)) * 100} etikett={`${y.name} ${y.skill} av ${y.max || y.target}`} />
            <p className="mt-2 text-[13px] text-gray-400">
              {y.at_cap
                ? 'På max för din nivå. Träna nästa nivå hos trainern.'
                : y.next
                  ? `Nästa: ${y.next.recipe} ×${y.next.count} till ${y.next.to}, ~${pengar(y.next.cost)}`
                  : 'Hittar inget billigt recept just nu.'}
            </p>
          </div>
        ))
      )}
    </Panel>
  );
}

function Salj({ salj }) {
  const summa = salj ? salj.ah_total + salj.vendor_total : 0;
  return (
    <Panel titel="Sälj från väskorna" className="flex-[1_1_320px]" hoger={salj && summa > 0 && <span className="tabular font-semibold" style={{ color: GULD }}>~{pengar(summa)}</span>}>
      {!salj ? (
        <Tom>Väskorna kommer med addonet och synken på datorn.</Tom>
      ) : !salj.items.length ? (
        <Tom>Inget i väskorna är värt att sälja just nu.</Tom>
      ) : (
        <ul className="flex flex-col">
          {salj.items.slice(0, 6).map((it) => (
            <li key={`${it.id}-${it.where}`} className="flex justify-between gap-3 border-t border-ink-line py-2.5 first:border-0">
              <span className="min-w-0">
                <span className="block truncate">
                  <ItemNamn item={it} /> <span className="text-gray-400">×{it.count}</span>
                </span>
                {it.best_time && (
                  <span className="block text-xs text-[#86efac]">
                    {it.best_time.day} runt {String(it.best_time.hour).padStart(2, '0')} brukar ge ~+{it.best_time.gain} %
                  </span>
                )}
              </span>
              <span className="whitespace-nowrap text-gray-300">
                {it.where === 'ah' ? 'AH' : 'vendor'} · <span className="tabular text-white">{pengar(it.value)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {salj?.more > 0 && <p className="text-xs text-gray-400">+{salj.more} saker till</p>}
    </Panel>
  );
}

function GuldGraf({ historik }) {
  const punkter = (historik?.points || []).map((p, i) => ({ ...p, i }));
  const med = punkter.filter((p) => p.money != null);
  if (med.length < 2) {
    return (
      <Panel titel="Guld, 30 dagar" className="flex-[1_1_320px]">
        <Tom>Grafen kommer när addonet sparat guldet några dagar.</Tom>
      </Panel>
    );
  }
  const B = 300;
  const H = 130;
  const min = Math.min(...med.map((p) => p.money));
  const max = Math.max(...med.map((p) => p.money));
  const x = (i) => (i / (punkter.length - 1)) * B;
  const y = (v) => (max === min ? H / 2 : 10 + (1 - (v - min) / (max - min)) * (H - 20));
  const linje = med.map((p) => `${x(p.i).toFixed(1)},${y(p.money).toFixed(1)}`).join(' ');
  const yta = `${x(med[0].i).toFixed(1)},${H} ${linje} ${x(med[med.length - 1].i).toFixed(1)},${H}`;
  const dagIndex = Object.fromEntries(punkter.map((p) => [String(p.day).slice(0, 10), p]));
  const prickar = (historik.passes || [])
    .map((pass) => dagIndex[new Date(pass.started_at).toISOString().slice(0, 10)])
    .filter((p) => p && p.money != null);
  const skillnad = med[med.length - 1].money - med[0].money;
  return (
    <Panel
      titel="Guld, 30 dagar"
      className="flex-[1_1_320px]"
      hoger={<span className="tabular font-medium" style={{ color: plusMinus(skillnad) }}>{pengar(skillnad, { tecken: true })}</span>}
    >
      <svg viewBox={`0 0 ${B} ${H}`} className="h-auto w-full" role="img" aria-label={`Guldet har gått från ${pengar(med[0].money)} till ${pengar(med[med.length - 1].money)} de senaste 30 dagarna`}>
        {[10, H / 2, H - 10].map((yy) => (
          <line key={yy} x1="0" x2={B} y1={yy} y2={yy} stroke="rgba(148,163,196,0.12)" />
        ))}
        <polygon points={yta} fill="rgba(255,209,102,0.12)" />
        <polyline points={linje} fill="none" stroke={GULD} strokeWidth="2.5" strokeLinejoin="round" />
        {prickar.map((p) => (
          <circle key={p.i} cx={x(p.i)} cy={y(p.money)} r="3.5" fill="#131927" stroke={GULD} strokeWidth="2" />
        ))}
      </svg>
      <p className="text-xs text-gray-400">Prickarna är spelpass. Dippar är oftast träning och köp.</p>
    </Panel>
  );
}

export default function Oversikt({ data, navigera }) {
  return (
    <div className="flex flex-wrap gap-5">
      <Gubbe data={data} />
      <Guldmal mal={data.goal} />
      <Fynd fynd={data.deals} egetHus={data.own_house} />
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
        <ForraPasset pass={data.last_pass} />
        <BastaUppgradering up={data.best_upgrade} navigera={navigera} />
      </div>
      <Yrken yrken={data.professions} navigera={navigera} />
      <Salj salj={data.sell} />
      <GuldGraf historik={data.gold_history} />
    </div>
  );
}
