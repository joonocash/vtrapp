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
    <div className="flex items-center py-3 sm:py-4 px-3 sm:px-5 border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
      {/* Line Badge with Color */}
      <div className="flex-shrink-0">
        <div
          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-md font-bold text-base sm:text-lg shadow-lg min-w-[48px] text-center"
          style={{
            backgroundColor: lineColor.bg,
            color: lineColor.text
          }}
        >
          {line}
        </div>
      </div>

      {/* Direction */}
      <div className="flex-1 min-w-0 px-3 sm:px-6">
        <p className="font-semibold text-white text-sm sm:text-lg truncate">{direction}</p>
        {platform && (
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">Läge {platform}</p>
        )}
      </div>

      {/* Time and Status */}
      <div className="text-right flex-shrink-0 ml-2">
        {canceled ? (
          <span className="text-red-400 font-semibold text-sm sm:text-lg">Inställd</span>
        ) : (
          <>
            <div className="text-xl sm:text-3xl font-bold text-white">
              {formatDepartureTime(timeToShow)}
            </div>
            {delay !== 0 && isRealtime && (
              <div className={`text-xs font-medium mt-0.5 sm:mt-1 ${getDelayColor(delay)}`}>
                +{delay} min
              </div>
            )}
            {isRealtime && delay === 0 && (
              <div className="text-xs text-green-400 mt-0.5 sm:mt-1">i tid</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DepartureRow;
