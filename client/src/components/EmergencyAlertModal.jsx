import React, { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, Phone, Clock, X } from 'lucide-react';
import { useAlertStore } from '../store/alertStore';
import { useFamilyStore } from '../store/familyStore';
import { useLocationStore } from '../store/locationStore';
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
 * - Emergency call button (triggers SOS)
 * - Auto-play alarm sound
 * - Countdown timer to auto-acknowledge
 */
export const EmergencyAlertModal = ({ alert, onDismiss, onCall }) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [audioPlaying, setAudioPlaying] = useState(true);
  const familyMembers = useFamilyStore((state) => state.familyMembers);
  const currentLocation = useLocationStore((state) => state.currentLocation);

  // Play alarm sound on mount
  useEffect(() => {
    if (!acknowledged && audioPlaying) {
      const audio = new Audio('/alarm-critical.mp3');
      audio.loop = true;
      audio.play().catch((err) => console.log('Alarm play failed:', err));
      return () => {
        audio.pause();
        audio.currentTime = 0;
      };
    }
  }, [acknowledged, audioPlaying]);

  // Auto-acknowledge countdown
  useEffect(() => {
    if (!acknowledged && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (countdown === 0 && !acknowledged) {
      handleAcknowledge();
    }
  }, [countdown, acknowledged]);

  const handleAcknowledge = () => {
    setAcknowledged(true);
    setAudioPlaying(false);
    
    // Notify server
    const socket = getSocket();
    if (alert?._id && socket) {
      socket.emit('alert:acknowledge', { alertId: alert._id });
    }
  };

  const handleCall = (memberId) => {
    onCall?.(memberId);
    // In production, integrate with calling service
    console.log('Calling family member:', memberId);
  };

  if (!alert || acknowledged) {
    return null;
  }

  const anomalyBreakdown = alert.anomalyBreakdown || {};
  const routeDeviation = anomalyBreakdown.routeDeviation || 0;
  const stopDuration = anomalyBreakdown.stopDuration || 0;
  const speedEntropy = anomalyBreakdown.speedEntropy || 0;
  const locationRisk = anomalyBreakdown.locationRisk || 0;
  const nightMultiplier = anomalyBreakdown.nightMultiplier || 1.0;

  const anomalies = alert.anomalyBreakdown?.anomalyTypes || [];

  const getAnomalyColor = (type) => {
    const colors = {
      'route_deviation': 'text-yellow-300',
      'stop_duration': 'text-orange-300',
      'speed_entropy': 'text-red-300',
      'location_risk': 'text-pink-300',
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
      'night_mode': 'Night Activity',
    };
    return labels[type] || type;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl">
        {/* RED ALERT BACKGROUND - Critical gradient */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-red-700 to-red-900 animate-pulse" />

          {/* Animated border */}
          <div className="absolute inset-0 border-4 border-red-400 rounded-2xl animate-pulse" />

          {/* Content */}
          <div className="relative z-10 p-8 text-white">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <AlertTriangle className="w-12 h-12 text-red-200 animate-bounce" />
                  <div className="absolute inset-0 animate-ping opacity-20 bg-red-400 rounded-full" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white drop-shadow-lg">SAFETY ALERT</h1>
                  <p className="text-red-100 text-sm">High-risk activity detected</p>
                </div>
              </div>
              {/* Close button - initially disabled, enables after acknowledge */}
              <button
                onClick={onDismiss}
                disabled={!acknowledged}
                className="text-white/30 hover:text-white/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* User Information */}
            <div className="bg-red-900/40 rounded-lg p-4 mb-6 border border-red-400/30 backdrop-blur">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-red-100 text-sm">User</p>
                  <p className="text-white text-lg font-semibold">{alert.userName || 'Unknown User'}</p>
                </div>
                <div>
                  <p className="text-red-100 text-sm">Risk Score</p>
                  <p className="text-3xl font-bold text-red-200">
                    {Math.round(alert.riskScore)}/100
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-200" />
                  <span className="text-sm">
                    {alert.location?.latitude?.toFixed(4)}, {alert.location?.longitude?.toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-200" />
                  <span className="text-sm">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {alert.isNightMode && (
                  <div className="flex items-center gap-2 text-blue-300">
                    <span className="w-2 h-2 bg-blue-400 rounded-full" />
                    <span className="text-sm">Night Mode Active</span>
                  </div>
                )}
              </div>
            </div>

            {/* Risk Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <div className="bg-red-900/30 rounded p-3 border border-red-400/20">
                <p className="text-xs text-red-100 mb-1">Route Deviation</p>
                <p className="text-xl font-bold text-yellow-300">{Math.round(routeDeviation)}</p>
                <p className="text-xs text-red-100">pts</p>
              </div>
              <div className="bg-red-900/30 rounded p-3 border border-red-400/20">
                <p className="text-xs text-red-100 mb-1">Stop Duration</p>
                <p className="text-xl font-bold text-orange-300">{Math.round(stopDuration)}</p>
                <p className="text-xs text-red-100">pts</p>
              </div>
              <div className="bg-red-900/30 rounded p-3 border border-red-400/20">
                <p className="text-xs text-red-100 mb-1">Speed Entropy</p>
                <p className="text-xl font-bold text-red-300">{Math.round(speedEntropy)}</p>
                <p className="text-xs text-red-100">pts</p>
              </div>
              <div className="bg-red-900/30 rounded p-3 border border-red-400/20">
                <p className="text-xs text-red-100 mb-1">Location Risk</p>
                <p className="text-xl font-bold text-pink-300">{Math.round(locationRisk)}</p>
                <p className="text-xs text-red-100">pts</p>
              </div>
              <div className="bg-red-900/30 rounded p-3 border border-red-400/20">
                <p className="text-xs text-red-100 mb-1">Night Multiplier</p>
                <p className="text-xl font-bold text-blue-300">{nightMultiplier.toFixed(2)}x</p>
                <p className="text-xs text-red-100">mult</p>
              </div>
            </div>

            {/* Detected Anomalies */}
            <div className="mb-6">
              <p className="text-red-100 text-sm font-semibold mb-2">Detected Anomalies:</p>
              <div className="flex flex-wrap gap-2">
                {anomalies.length > 0 ? (
                  anomalies.map((anomaly) => (
                    <span
                      key={anomaly}
                      className={`px-3 py-1 rounded-full text-xs font-medium bg-red-900/40 border border-red-400/30 ${getAnomalyColor(anomaly)}`}
                    >
                      {getAnomalyLabel(anomaly)}
                    </span>
                  ))
                ) : (
                  <span className="text-red-100 text-xs">Multiple risk factors detected</span>
                )}
              </div>
            </div>

            {/* Family Response Panel */}
            {familyMembers.length > 0 && (
              <div className="bg-red-900/30 rounded-lg p-4 mb-6 border border-red-400/30 backdrop-blur">
                <p className="text-red-100 text-sm font-semibold mb-3">Contact Family Members:</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {familyMembers.map((member) => (
                    <div
                      key={member._id}
                      className="flex items-center justify-between bg-red-900/40 rounded p-2 hover:bg-red-900/60 transition"
                    >
                      <div>
                        <p className="text-white text-sm font-medium">{member.name}</p>
                        <p className="text-red-100 text-xs">{member.phone}</p>
                      </div>
                      <button
                        onClick={() => handleCall(member._id)}
                        className="bg-red-500 hover:bg-red-600 text-white p-2 rounded transition"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              {/* Main SOS Button */}
              <button
                onClick={() => {
                  handleAcknowledge();
                  onCall?.();
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
              >
                <AlertTriangle className="w-5 h-5" />
                <span>EMERGENCY - CALL RESPONSE</span>
              </button>

              {/* Acknowledge Button */}
              <button
                onClick={handleAcknowledge}
                className="bg-red-900/60 hover:bg-red-900/80 text-white font-semibold py-4 px-6 rounded-lg transition border border-red-400/50"
              >
                I'm Safe
              </button>
            </div>

            {/* Countdown Timer */}
            <div className="mt-4 text-center">
              <p className="text-red-100 text-xs">
                Auto-acknowledges in <span className="font-bold text-red-300">{countdown}s</span>
              </p>
            </div>

            {/* Mute Alarm */}
            <button
              onClick={() => setAudioPlaying(!audioPlaying)}
              className="mt-4 w-full text-red-200 hover:text-red-100 text-xs transition py-2 border-t border-red-400/30"
            >
              {audioPlaying ? '🔊 Mute Alarm' : '🔇 Unmute Alarm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyAlertModal;
