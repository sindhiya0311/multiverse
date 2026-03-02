import { Route, Clock, Gauge, MapPin, Moon } from 'lucide-react';
import clsx from 'clsx';

const RiskBreakdown = ({ breakdown, className }) => {
  if (!breakdown) return null;

  const items = [
    {
      label: 'Route Deviation',
      value: breakdown.routeDeviation || 0,
      max: 30,
      icon: Route,
      color: 'text-purple-400',
    },
    {
      label: 'Stop Duration',
      value: breakdown.stopDuration || 0,
      max: 25,
      icon: Clock,
      color: 'text-amber-400',
    },
    {
      label: 'Speed Entropy',
      value: breakdown.speedEntropy || 0,
      max: 20,
      icon: Gauge,
      color: 'text-blue-400',
    },
    {
      label: 'Location Risk',
      value: breakdown.locationRisk || 0,
      max: 15,
      icon: MapPin,
      color: 'text-red-400',
    },
  ];

  const multiplier = breakdown.nightMultiplier || 1;

  return (
    <div className={clsx('space-y-3', className)}>
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <item.icon className={clsx('w-4 h-4', item.color)} />
              <span className="text-night-300">{item.label}</span>
            </div>
            <span className="text-white font-medium">
              {item.value}/{item.max}
            </span>
          </div>
          <div className="h-1.5 bg-night-800 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                item.value > item.max * 0.7
                  ? 'bg-red-500'
                  : item.value > item.max * 0.4
                  ? 'bg-amber-500'
                  : 'bg-green-500'
              )}
              style={{ width: `${(item.value / item.max) * 100}%` }}
            />
          </div>
        </div>
      ))}

      {multiplier > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-night-800">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-noctis-400" />
            <span className="text-night-300 text-sm">Night Multiplier</span>
          </div>
          <span className="text-noctis-400 font-medium">
            ×{multiplier.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
};

export default RiskBreakdown;
