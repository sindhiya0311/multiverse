import { MapPin, Navigation, AlertTriangle, Home, Briefcase, Clock } from 'lucide-react';
import clsx from 'clsx';

const StatusBadge = ({ status, className }) => {
  const getStatusConfig = (status) => {
    const lowerStatus = status?.toLowerCase() || '';
    
    if (lowerStatus.includes('home')) {
      return {
        icon: Home,
        color: 'text-green-400 bg-green-400/10 border-green-400/30',
      };
    }
    if (lowerStatus.includes('office') || lowerStatus.includes('work')) {
      return {
        icon: Briefcase,
        color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
      };
    }
    if (lowerStatus.includes('travelling') || lowerStatus.includes('transit')) {
      return {
        icon: Navigation,
        color: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
      };
    }
    if (lowerStatus.includes('stopped') || lowerStatus.includes('unknown')) {
      return {
        icon: AlertTriangle,
        color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
      };
    }
    if (lowerStatus.includes('briefly')) {
      return {
        icon: Clock,
        color: 'text-night-300 bg-night-400/10 border-night-400/30',
      };
    }
    
    return {
      icon: MapPin,
      color: 'text-night-300 bg-night-400/10 border-night-400/30',
    };
  };

  const { icon: Icon, color } = getStatusConfig(status);

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border',
        color,
        className
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="truncate max-w-[200px]">{status || 'Unknown'}</span>
    </div>
  );
};

export default StatusBadge;
