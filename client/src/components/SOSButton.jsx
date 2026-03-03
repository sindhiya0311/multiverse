import { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useLocationStore } from '../store/locationStore';
import { useAlertStore } from '../store/alertStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const SOSButton = ({ className }) => {
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isTriggering, setIsTriggering] = useState(false);
  const holdTimerRef = useRef(null);
  const progressTimerRef = useRef(null);
  
  const { currentLocation } = useLocationStore();
  const { triggerSOS } = useAlertStore();

  const HOLD_DURATION = 2000;

  const startHold = () => {
    // Require current location
    if (!currentLocation) {
      toast.error('Location tracking must be active to use SOS');
      return;
    }

    setIsHolding(true);
    setHoldProgress(0);

    const startTime = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setHoldProgress(progress);
    }, 50);

    holdTimerRef.current = setTimeout(() => {
      // Directly trigger SOS after 2 seconds
      triggerSOSAlert();
    }, HOLD_DURATION);
  };

  const triggerSOSAlert = async () => {
    setIsTriggering(true);
    
    const location = currentLocation || {
      latitude: 0,
      longitude: 0,
    };

    const result = await triggerSOS(location, 'Emergency assistance needed');
    
    if (result.success) {
      toast.success('🚨 SOS alert sent to your family!');
      setIsHolding(false);
      setHoldProgress(0);
    } else {
      toast.error(result.message || 'Failed to send SOS');
    }

    setIsTriggering(false);
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const cancelHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  // SOS Button - triggers directly after 2 second hold
  return (
    <div className={clsx('relative', className)}>
      <button
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        disabled={isTriggering || !currentLocation}
        className={clsx(
          'relative w-24 h-24 rounded-full flex items-center justify-center',
          'bg-gradient-to-br from-red-600 to-red-700',
          'shadow-lg shadow-red-600/30 hover:shadow-red-600/50',
          'transition-all duration-200',
          'focus:outline-none focus:ring-4 focus:ring-red-500/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isHolding && 'scale-95',
          isTriggering && 'opacity-50 cursor-not-allowed',
          !currentLocation && 'opacity-60'
        )}
        title={!currentLocation ? 'Enable location tracking to use SOS' : 'Hold 2 sec to send SOS'}
      >
        {isHolding && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              stroke="white"
              strokeWidth="4"
              fill="none"
              opacity="0.3"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              stroke="white"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 46}
              strokeDashoffset={2 * Math.PI * 46 * (1 - holdProgress / 100)}
              className="transition-all duration-100"
            />
          </svg>
        )}
        
        <div className="flex flex-col items-center text-white">
          {isTriggering ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <>
              <AlertTriangle className="w-8 h-8 mb-1" />
              <span className="text-xs font-bold">SOS</span>
            </>
          )}
        </div>
      </button>
      
      <p className="text-center text-xs text-night-500 mt-2">
        {!currentLocation ? 'Enable tracking' : 'Hold 2 sec'}
      </p>
    </div>
  );
};

export default SOSButton;
