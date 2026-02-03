import { formatDepartureTime } from '../utils/dateFormatter';
import { getLineColor } from '../utils/lineColors';

function getDelayColor(delay) {
  if (delay === 0) return 'text-green-400';
  if (delay <= 3) return 'text-yellow-400';
  return 'text-red-400';
}

export function DepartureRow({ departure }) {
  const {
    line,
    direction,
    scheduledTime,
    realtimeTime,
    delay,
    canceled,
    platform,
    transportMode,
    isRealtime
  } = departure;

  const timeToShow = isRealtime ? realtimeTime : scheduledTime;
  const lineColor = getLineColor(line, transportMode);

  return (
    <div className="flex items-center py-4 px-5 border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
      {/* Line Badge with Color */}
      <div className="flex items-center space-x-4 min-w-[100px]">
        <div
          className="px-4 py-2 rounded-md font-bold text-lg shadow-lg"
          style={{
            backgroundColor: lineColor.bg,
            color: lineColor.text
          }}
        >
          {line}
        </div>
      </div>

      {/* Direction */}
      <div className="flex-1 px-6">
        <p className="font-semibold text-white text-lg">{direction}</p>
        {platform && (
          <p className="text-sm text-gray-400 mt-1">Läge {platform}</p>
        )}
      </div>

      {/* Time and Status */}
      <div className="text-right min-w-[120px]">
        {canceled ? (
          <span className="text-red-400 font-semibold text-lg">Inställd</span>
        ) : (
          <>
            <div className="text-3xl font-bold text-white">
              {formatDepartureTime(timeToShow)}
            </div>
            {delay !== 0 && isRealtime && (
              <div className={`text-xs font-medium mt-1 ${getDelayColor(delay)}`}>
                +{delay} min
              </div>
            )}
            {isRealtime && delay === 0 && (
              <div className="text-xs text-green-400 mt-1">i tid</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DepartureRow;
