import { useState } from 'react';
import { AlertTriangle, X, CheckCircle, Phone } from 'lucide-react';
import { useAlertStore } from '../store/alertStore';
import { formatRelativeTime } from '../utils/helpers';
import clsx from 'clsx';

const AlertBanner = ({ alert, onDismiss }) => {
  const [isResolving, setIsResolving] = useState(false);
  const { acknowledgeAlert, resolveAlert } = useAlertStore();

  const severityStyles = {
    critical: 'bg-red-900/50 border-red-500/50 text-red-200',
    high: 'bg-orange-900/50 border-orange-500/50 text-orange-200',
    medium: 'bg-amber-900/50 border-amber-500/50 text-amber-200',
    low: 'bg-blue-900/50 border-blue-500/50 text-blue-200',
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

  return (
    <div
      className={clsx(
        'rounded-lg border p-4 mb-4 animate-pulse-slow',
        severityStyles[alert.severity] || severityStyles.medium
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold">
              {alert.type === 'sos' ? 'SOS Alert' : 'Shadow Alert'} - {alert.user?.name}
            </h4>
            <span className="text-xs opacity-75">
              {formatRelativeTime(alert.triggeredAt)}
            </span>
          </div>
          
          <p className="text-sm mt-1 opacity-90">
            Risk Score: {alert.riskScore} | Severity: {alert.severity}
          </p>
          
          {alert.anomalyBreakdown?.anomalyTypes?.length > 0 && (
            <p className="text-xs mt-1 opacity-75">
              Anomalies: {alert.anomalyBreakdown.anomalyTypes.join(', ')}
            </p>
          )}

          {alert.status === 'active' && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleAcknowledge}
                className="btn btn-secondary text-xs py-1 px-2"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Acknowledge
              </button>
              <button
                onClick={() => handleResolve('safe')}
                disabled={isResolving}
                className="btn bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs py-1 px-2"
              >
                Mark Safe
              </button>
              <button
                onClick={() => handleResolve('false_alarm')}
                disabled={isResolving}
                className="btn bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-xs py-1 px-2"
              >
                False Alarm
              </button>
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-white/10 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default AlertBanner;
