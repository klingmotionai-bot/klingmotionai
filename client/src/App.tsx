import { useState } from 'react';
import PulsatingDots from '@/components/ui/pulsating-loader';

export default function App() {
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateClick = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#1d1d1b] flex flex-col items-center justify-center p-6">
      <button
        type="button"
        onClick={handleCreateClick}
        disabled={isLoading}
        className="min-w-[200px] px-6 py-3 rounded-lg bg-[#00ffcc] text-[#1d1d1b] font-medium disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transition opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#00ffcc]/50"
      >
        {isLoading ? (
          <span className="inline-flex items-center justify-center">
            <PulsatingDots />
          </span>
        ) : (
          'Create'
        )}
      </button>
    </div>
  );
}
