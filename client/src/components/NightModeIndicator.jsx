import { Moon, Sun } from 'lucide-react';
import { isNightTime } from '../utils/helpers';
import clsx from 'clsx';

const NightModeIndicator = ({ isActive, className }) => {
  const nightMode = isActive ?? isNightTime();

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300',
        nightMode
          ? 'bg-noctis-600/20 text-noctis-400 border border-noctis-600/30 glow-sm'
          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        className
      )}
    >
      {nightMode ? (
        <>
          <Moon className="w-4 h-4" />
          <span>Night Mode Active</span>
        </>
      ) : (
        <>
          <Sun className="w-4 h-4" />
          <span>Day Mode</span>
        </>
      )}
    </div>
  );
};

export default NightModeIndicator;
