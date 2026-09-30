import { AlertTriangle } from 'lucide-react';

export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-red-500/10 text-red-300">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <p className="font-display text-lg font-medium text-white">Kunde inte hämta avgångar</p>
        <p className="mt-1 text-sm text-gray-400">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
        >
          Försök igen
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
