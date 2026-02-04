import { useState, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';

export function LunchMenu() {
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/lunch');

      if (!response.ok) {
        throw new Error('Kunde inte hämta lunchmenyn');
      }

      const data = await response.json();
      setMenu(data);
    } catch (err) {
      console.error('Error fetching lunch menu:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchMenu} />;
  }

  if (!menu) {
    return (
      <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
        <p className="text-gray-400 text-center">Ingen meny tillgänglig</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Restaurang Tegel</h2>
        <p className="text-gray-400">Dagens lunch mån-fre 11-14</p>
      </div>

      {menu.content && (
        <div className="lunch-menu-content">
          <style>{`
            .lunch-menu-content h1 {
              font-size: 2rem;
              font-weight: bold;
              color: white;
              margin-bottom: 1rem;
            }
            .lunch-menu-content h2 {
              font-size: 1.5rem;
              font-weight: bold;
              color: #60a5fa;
              margin-top: 2rem;
              margin-bottom: 1rem;
            }
            .lunch-menu-content p {
              color: #e5e7eb !important;
              margin-bottom: 0.75rem;
              line-height: 1.6;
            }
            .lunch-menu-content p[align="CENTER"] {
              text-align: center;
              font-weight: 500;
            }
            .lunch-menu-content p span {
              color: inherit !important;
            }
            .lunch-menu-content .et_pb_text_inner {
              margin-bottom: 1.5rem;
            }
          `}</style>
          <div
            dangerouslySetInnerHTML={{ __html: menu.content }}
          />
        </div>
      )}

      {menu.lastUpdated && (
        <div className="mt-6 pt-4 border-t border-gray-700 text-sm text-gray-500 text-center">
          Hämtad: {new Date(menu.lastUpdated).toLocaleString('sv-SE')}
        </div>
      )}

      <div className="mt-4 text-center">
        <a
          href="https://www.restaurangtegel.com/lunch/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          Besök originalsidan →
        </a>
      </div>
    </div>
  );
}

export default LunchMenu;
