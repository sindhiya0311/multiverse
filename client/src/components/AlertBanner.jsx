import { useState } from 'react';
import { AlertTriangle, X, CheckCircle, Phone, Clock } from 'lucide-react';
import { useAlertStore } from '../store/alertStore';
import { formatRelativeTime, formatDate } from '../utils/helpers';
import clsx from 'clsx';

const AlertBanner = ({ alert, onDismiss }) => {
  const [isResolving, setIsResolving] = useState(false);
  const { acknowledgeAlert, resolveAlert } = useAlertStore();

  const severityStyles = {
    critical: 'bg-gradient-to-r from-red-900 to-red-800 border-red-500/60 shadow-lg shadow-red-500/20',
    high: 'bg-gradient-to-r from-orange-900 to-orange-800 border-orange-500/60 shadow-lg shadow-orange-500/20',
    medium: 'bg-gradient-to-r from-amber-900 to-amber-800 border-amber-500/60 shadow-lg shadow-amber-500/20',
    low: 'bg-gradient-to-r from-blue-900 to-blue-800 border-blue-500/60 shadow-lg shadow-blue-500/20',
  };

  const textColors = {
    critical: 'text-red-100',
    high: 'text-orange-100',
    medium: 'text-amber-100',
    low: 'text-blue-100',
  };

  const handleAcknowledge = async () => {
    await acknowledgeAlert(alert._id || alert.alertId);
  };

  const handleResolve = async (resolution) => {
    setIsResolving(true);
    await resolveAlert(alert._id || alert.alertId, resolution);
    setIsResolving(false);
    onDismiss?.();
  };

  const severity = alert.severity || 'medium';
  
  return (
    <div
      className={clsx(
        'rounded-lg border p-4 mb-4 backdrop-blur-sm',
        'transition-all duration-300 hover:shadow-xl',
        severityStyles[severity] || severityStyles.medium
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <div className={clsx(
            'flex items-center justify-center w-6 h-6 rounded-full',
            severity === 'critical' && 'bg-red-500/30 animate-pulse',
            severity === 'high' && 'bg-orange-500/30 animate-pulse',
            severity === 'medium' && 'bg-amber-500/20',
            severity === 'low' && 'bg-blue-500/20'
          )}>
            <AlertTriangle className={clsx('w-4 h-4', textColors[severity])} />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <h4 className={clsx('font-semibold text-lg', textColors[severity])}>
                {alert.type === 'sos' ? '🚨 SOS Emergency' : '⚠️ Safety Alert'} 
              </h4>
            </div>
            <button
              onClick={onDismiss}
              className="text-white/60 hover:text-white/90 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {alert.user?.name && (
            <p className={clsx('text-sm font-medium mb-2', textColors[severity])}>
              {alert.user.name}
            </p>
          )}
          
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 text-sm opacity-90">
              <Clock className="w-4 h-4" />
              <span>{formatDate(alert.triggeredAt)}</span>
            </div>
            
            <div className="text-sm">
              <span className="font-medium">Risk Score:</span>
              <span className={clsx(
                'ml-2 font-bold',
                alert.riskScore >= 80 && 'text-red-300',
                alert.riskScore >= 60 && alert.riskScore < 80 && 'text-orange-300',
                alert.riskScore >= 40 && alert.riskScore < 60 && 'text-amber-300'
              )}>
                {alert.riskScore}/100
              </span>
            </div>
          </div>
          
          {alert.anomalyBreakdown?.anomalyTypes?.length > 0 && (
            <div className="mb-3 p-2 bg-black/20 rounded text-xs">
              <p className="font-medium mb-1">Detected Anomalies:</p>
              <div className="flex flex-wrap gap-2">
                {alert.anomalyBreakdown.anomalyTypes.map((type, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-white/10 rounded text-white/80"
                  >
                    {type.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {alert.status === 'active' && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleAcknowledge}
                className={clsx(
                  'btn items-center gap-1 text-xs py-1.5 px-3 rounded',
                  'bg-white/10 hover:bg-white/20 text-white transition-colors'
                )}
              >
                <CheckCircle className="w-3 h-3" />
                Acknowledge
              </button>
              <button
                onClick={() => handleResolve('safe')}
                disabled={isResolving}
                className={clsx(
                  'btn items-center gap-1 text-xs py-1.5 px-3 rounded',
                  'bg-green-500/20 hover:bg-green-500/30 text-green-300 transition-colors disabled:opacity-50'
                )}
              >
                <CheckCircle className="w-3 h-3" />
                Safe
              </button>
              <button
                onClick={() => handleResolve('false_alarm')}
                disabled={isResolving}
                className={clsx(
                  'btn items-center gap-1 text-xs py-1.5 px-3 rounded',
                  'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 transition-colors disabled:opacity-50'
                )}
              >
                <CheckCircle className="w-3 h-3" />
                False Alarm
              </button>
            </div>
          )}
          
          {alert.status === 'acknowledged' && (
            <p className="text-xs text-white/60">✓ Acknowledged by {alert.acknowledgedBy?.name || 'family member'}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertBanner;
