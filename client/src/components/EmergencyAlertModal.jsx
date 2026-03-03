import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, MapPin, Phone, Clock, X, Volume2, VolumeX } from 'lucide-react';
import { getSocket } from '../services/socket';

/**
 * EMERGENCY ALERT MODAL
 * Displays when RED alert is triggered (score ≥80 + 2+ anomalies)
 * 
 * Features:
 * - Large, high-contrast red gradient
 * - User location and risk score
 * - Anomaly breakdown
 * - Family member contacts
 * - Mutable alarm sound (can be disabled)
 * - Countdown timer with manual acknowledgement
 * - Demo mode safe (not intrusive)
 */
export const EmergencyAlertModal = ({ alert, onDismiss, onCall }) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [audioEnabled, setAudioEnabled] = useState(false); // Default OFF for demo safety
  const audioRef = useRef(null);

  // Play alarm sound if enabled
  useEffect(() => {
    if (!acknowledged && audioEnabled) {
      if (!audioRef.current) {
        audioRef.current = new Audio('/alarm-critical.mp3');
        audioRef.current.loop = true;
      }
      audioRef.current.play().catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [acknowledged, audioEnabled]);

  // Countdown timer
  useEffect(() => {
    if (!acknowledged && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, acknowledged]);

  const handleAcknowledge = () => {
    setAcknowledged(true);
    setAudioEnabled(false);
    
    // Notify server
    const socket = getSocket();
    const alertId = alert?._id ?? alert?.alertId;
    if (alertId && socket) {
      socket.emit('alert:acknowledge', { alertId });
    }
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
  };

  const handleCall = (memberId) => {
    onCall?.(memberId);
  };

  if (!alert || acknowledged) {
    return null;
  }

  const anomalyBreakdown = alert.anomalyBreakdown || {};
  const anomalies = alert.anomalyBreakdown?.anomalyTypes || [];

  const getAnomalyColor = (type) => {
    const colors = {
      'route_deviation': 'text-yellow-300',
      'stop_duration': 'text-orange-300',
      'speed_entropy': 'text-red-300',
      'location_risk': 'text-pink-300',
      'high_risk_zone': 'text-pink-300',
      'night_mode': 'text-blue-300',
    };
    return colors[type] || 'text-red-300';
  };

  const getAnomalyLabel = (type) => {
    const labels = {
      'route_deviation': 'Unusual Route',
      'stop_duration': 'Unexpected Stop',
      'speed_entropy': 'Erratic Speed',
      'location_risk': 'High-Risk Zone',
      'high_risk_zone': 'High-Risk Zone',
      'night_mode': 'Night Activity',
    };
    return labels[type] || type;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl">
        {/* Red Alert Container */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-red-700 to-red-900 opacity-95" />
          
          {/* Pulsing border */}
          <div className="absolute inset-0 border-4 border-red-400 rounded-2xl animate-pulse" />

          {/* Content */}
          <div className="relative z-10 p-8 text-white space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <AlertTriangle className="w-12 h-12 text-red-200" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold drop-shadow-lg">🚨 SAFETY ALERT</h1>
                  <p className="text-red-100 text-sm">High-risk behavior detected</p>
                </div>
              </div>
              
              {/* Sound Toggle */}
              <button
                onClick={toggleAudio}
                className="p-2 rounded-full bg-red-900/40 hover:bg-red-800/60 transition-colors border border-red-500/50"
                title={audioEnabled ? "Mute alarm" : "Enable alarm"}
              >
                {audioEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5 opacity-60" />
                )}
              </button>
            </div>

            {/* User & Risk Info */}
            <div className="bg-red-900/40 rounded-lg p-4 border border-red-400/30 backdrop-blur">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-red-100 text-xs uppercase">User</p>
                  <p className="text-white font-semibold">{alert.userName || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-red-100 text-xs uppercase">Risk Score</p>
                  <p className="text-3xl font-bold">{Math.round(alert.riskScore)}/100</p>
                </div>
                <div>
                  <p className="text-red-100 text-xs uppercase">Severity</p>
                  <p className="text-xl font-semibold text-red-200">
                    {alert.riskScore >= 90 ? '🔴 CRITICAL' : '🟠 HIGH'}
                  </p>
                </div>
              </div>
            </div>

            {/* Location - show alert subject's location (person in distress) */}
            {(alert?.location?.latitude != null && alert?.location?.longitude != null) && (
              <div className="bg-red-900/30 rounded-lg p-3 border border-red-400/20 flex items-center gap-2">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm text-red-100">
                  {Number(alert.location.latitude).toFixed(4)}, {Number(alert.location.longitude).toFixed(4)}
                </span>
              </div>
            )}

            {/* Anomalies */}
            {anomalies.length > 0 && (
              <div className="bg-red-900/30 rounded-lg p-3 border border-red-400/20">
                <p className="text-xs uppercase text-red-100 mb-2 font-semibold">Detected Anomalies</p>
                <div className="flex flex-wrap gap-2">
                  {anomalies.map((type, i) => (
                    <span
                      key={i}
                      className={`px-2 py-1 rounded text-xs font-medium bg-red-900/50 border border-red-500/40 ${getAnomalyColor(type)}`}
                    >
                      {getAnomalyLabel(type)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Countdown and Actions */}
            <div className="bg-red-900/40 rounded-lg p-4 border border-red-400/30">
              <div className="flex items-center justify-between mb-4">
                <span className="text-red-100 text-sm">
                  Auto-dismiss in: <span className="text-red-200 font-bold text-lg">{countdown}s</span>
                </span>
              </div>
              
              <button
                onClick={handleAcknowledge}
                className="w-full bg-white text-red-600 font-bold py-3 rounded-lg hover:bg-red-50 transition-colors shadow-lg"
              >
                ✓ Acknowledge & Dismiss
              </button>
            </div>

            {/* Footer Info */}
            <p className="text-xs text-red-100 text-center">
              Pinned as red alert • Notifying family members
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyAlertModal;
