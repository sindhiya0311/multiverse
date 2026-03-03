import { useMemo } from 'react';
import clsx from 'clsx';
import { getRiskColor, getRiskLabel } from '../utils/helpers';

const RiskMeter = ({ score = 0, size = 'lg', showLabel = true, animated = true, smoothTransition = false }) => {
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

  // Determine glow intensity based on score
  const glowIntensity = score >= 80 ? '20px' : score >= 60 ? '15px' : score >= 40 ? '10px' : '0px';
  const glowColor = score >= 80 ? color : 'transparent';

  return (
    <div className={`relative ${container}`}>
      <style>{`
        @keyframes pulse-risk {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .pulse-risk {
          animation: pulse-risk 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
      
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-night-700 transition-colors duration-1000"
        />
        
        {/* Progress circle */}
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
          className={animated ? `transition-all ease-out ${smoothTransition ? 'duration-1500' : 'duration-700'}` : ''}
          style={{
            filter: `drop-shadow(0 0 ${glowIntensity} ${glowColor})`,
          }}
        />
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={clsx(`${text} font-bold transition-colors duration-500`, 
            score >= 80 && 'pulse-risk'
          )}
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

      {/* Critical alert pulsing ring */}
      {score >= 80 && animated && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-full pulse-risk"
            style={{
              width: '90%',
              height: '90%',
              border: `2px solid ${color}`,
              opacity: 0.3,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default RiskMeter;
