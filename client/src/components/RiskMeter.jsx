import { useMemo } from 'react';
import { getRiskColor, getRiskLabel } from '../utils/helpers';

const RiskMeter = ({ score = 0, size = 'lg', showLabel = true, animated = true }) => {
  const sizeClasses = {
    sm: { container: 'w-24 h-24', text: 'text-2xl', label: 'text-xs' },
    md: { container: 'w-32 h-32', text: 'text-3xl', label: 'text-sm' },
    lg: { container: 'w-48 h-48', text: 'text-5xl', label: 'text-base' },
    xl: { container: 'w-64 h-64', text: 'text-6xl', label: 'text-lg' },
  };

  const { container, text, label } = sizeClasses[size] || sizeClasses.lg;

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const color = useMemo(() => getRiskColor(score), [score]);
  const riskLabel = useMemo(() => getRiskLabel(score), [score]);

  return (
    <div className={`relative ${container}`}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-night-800"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={animated ? 'transition-all duration-1000 ease-out' : ''}
          style={{
            filter: score >= 60 ? `drop-shadow(0 0 10px ${color})` : 'none',
          }}
        />
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`${text} font-bold transition-colors duration-500`}
          style={{ color }}
        >
          {Math.round(score)}
        </span>
        {showLabel && (
          <span
            className={`${label} font-medium mt-1 transition-colors duration-500`}
            style={{ color }}
          >
            {riskLabel}
          </span>
        )}
      </div>

      {score >= 80 && animated && (
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 rounded-full animate-pulse-ring opacity-30"
            style={{ backgroundColor: color }}
          />
        </div>
      )}
    </div>
  );
};

export default RiskMeter;
