import { useState, useEffect } from 'react';
import { Moon } from 'lucide-react';

/**
 * Presentation-ready loading screen
 * Shows branded splash with smooth fade-out
 */
const LoadingScreen = ({ onComplete, minDuration = 1200 }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onComplete?.(), 400);
    }, minDuration);
    return () => clearTimeout(timer);
  }, [minDuration, onComplete]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[10000] bg-night-950 flex flex-col items-center justify-center transition-opacity duration-400"
      role="status"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-8">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-noctis-500 to-noctis-700 flex items-center justify-center shadow-lg shadow-noctis-600/30 animate-pulse">
            <Moon className="w-10 h-10 text-white" strokeWidth={2} />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-noctis-500/40 animate-ping opacity-20" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">NOCTIS</h1>
          <p className="text-night-400 text-sm mt-1">Predictive Night Safety OS</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-noctis-500"
              style={{
                animation: 'loading-dot 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes loading-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
