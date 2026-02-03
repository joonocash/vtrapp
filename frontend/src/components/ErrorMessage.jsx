export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 my-6">
      <div className="flex items-center">
        <svg className="w-8 h-8 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1">
          <p className="text-red-300 font-semibold text-lg">Ett fel uppstod</p>
          <p className="text-red-400 text-sm mt-1">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-4 px-5 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Försök igen
          </button>
        )}
      </div>
    </div>
  );
}

export default ErrorMessage;
