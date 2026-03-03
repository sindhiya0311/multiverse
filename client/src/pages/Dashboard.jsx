import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDemoStore } from '../store/demoStore';
import { useLocationStore } from '../store/locationStore';
import { useFamilyStore } from '../store/familyStore';
import { useAlertStore } from '../store/alertStore';
import { emitLocationUpdate, getSocket } from '../services/socket';
import api from '../services/api';
import {
  RiskMeter,
  NightModeIndicator,
  StatusBadge,
  AlertBanner,
  SOSButton,
  LiveMap,
  RiskBreakdown,
  EmergencyAlertModal,
} from '../components';
import { Users, MapPin, Activity, Bell } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuthStore();
  const { demoMode } = useDemoStore();
  const { currentLocation, riskData, contextData, startTracking, stopTracking } =
    useLocationStore();
  const { familyMembers, fetchFamilyMembers } = useFamilyStore();
  const { familyAlerts, fetchFamilyAlerts, addAlert } = useAlertStore();
  const [taggedLocations, setTaggedLocations] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [emergencyAlert, setEmergencyAlert] = useState(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());

  useEffect(() => {
    fetchFamilyMembers();
    fetchFamilyAlerts(true);
    fetchTaggedLocations();

    const socket = getSocket();
    if (!socket) return;

    // Listen for RED alerts from server
    socket.on('alert:red', (alertData) => {
      setEmergencyAlert(alertData);
      setShowEmergencyModal(true);
      
      // Play notification sound
      const audio = new Audio('/notification-alert.mp3');
      audio.play().catch(() => {});
      
      // Add to alerts store
      addAlert({
        _id: alertData.alertId,
        type: 'shadow',
        severity: alertData.severity,
        riskScore: alertData.riskScore,
        location: alertData.location,
        anomalyBreakdown: alertData.anomalyBreakdown,
        isNightMode: alertData.isNightMode,
        timestamp: alertData.timestamp,
        status: 'active',
      });
    });

    // Listen for family alerts
    socket.on('alert:family', (alertData) => {
      fetchFamilyAlerts(true);
    });

    const alertInterval = setInterval(() => {
      fetchFamilyAlerts(true);
    }, 30000);

    return () => {
      clearInterval(alertInterval);
      if (socket) {
        socket.off('alert:red');
        socket.off('alert:family');
      }
    };
  }, [fetchFamilyMembers, fetchFamilyAlerts, addAlert]);

  useEffect(() => {
    if (isTracking && currentLocation) {
      emitLocationUpdate(currentLocation);
    }
  }, [currentLocation, isTracking]);

  const fetchTaggedLocations = async () => {
    try {
      const response = await api.get('/tagged-locations');
      setTaggedLocations(response.data.data.locations);
    } catch (error) {
      console.error('Failed to fetch tagged locations:', error);
    }
  };

  const toggleTracking = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
    setIsTracking(!isTracking);
  };

  const handleEmergencyCall = async (memberId = null) => {
    if (!emergencyAlert) return;
    
    try {
      // Trigger SOS through API
      await api.post('/alerts/sos', {
        latitude: emergencyAlert.location.latitude,
        longitude: emergencyAlert.location.longitude,
        message: 'Emergency alert confirmed - immediate response needed',
      });

      if (memberId) {
        // Call implementation here
      }
    } catch (error) {
      console.error('Failed to trigger SOS:', error);
    }
  };

  const handleDismissAlert = (alertId) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
  };

  const riskScore = riskData?.score || user?.currentRiskScore || 0;
  const status = contextData?.status || user?.currentStatus || 'Unknown';
  const isNightMode = riskData?.isNightMode || user?.isNightModeActive;

  return (
    <div className="min-h-screen p-4 lg:p-6">
      {/* Emergency Alert Modal */}
      {showEmergencyModal && emergencyAlert && (
        <EmergencyAlertModal 
          alert={emergencyAlert}
          onDismiss={() => setShowEmergencyModal(false)}
          onCall={handleEmergencyCall}
        />
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-night-400 mt-1">
              Your safety dashboard and real-time monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            {demoMode && (
              <span className="px-2 py-1 rounded-md text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Demo Mode
              </span>
            )}
            <NightModeIndicator isActive={isNightMode} />
            <button
              onClick={toggleTracking}
              className={`btn ${isTracking ? 'btn-danger' : 'btn-primary'}`}
            >
              {isTracking ? 'Stop Tracking' : 'Start Tracking'}
            </button>
          </div>
        </div>

        {familyAlerts.length > 0 && (
          <div className="space-y-2">
            {familyAlerts
              .filter((alert) => !dismissedAlerts.has(alert._id))
              .slice(0, 3)
              .map((alert) => (
                <AlertBanner
                  key={alert._id}
                  alert={alert}
                  onDismiss={() => handleDismissAlert(alert._id)}
                />
              ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Live Location</h2>
              <StatusBadge status={status} />
            </div>
            <div className="h-[400px] lg:h-[500px] rounded-xl overflow-hidden">
              <LiveMap
                currentLocation={currentLocation}
                familyMembers={familyMembers}
                taggedLocations={taggedLocations}
                riskScore={riskScore}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="card flex flex-col items-center">
              <h2 className="text-lg font-semibold text-white mb-4 self-start">
                Risk Score
              </h2>
              <RiskMeter score={riskScore} size="lg" smoothTransition={demoMode} />
              {riskData?.breakdown && (
                <div className="w-full mt-6">
                  <RiskBreakdown breakdown={riskData.breakdown} />
                </div>
              )}
            </div>

            <div className="card flex flex-col items-center">
              <h2 className="text-lg font-semibold text-white mb-4 self-start">
                Emergency SOS
              </h2>
              <SOSButton />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Family Members"
            value={familyMembers.length}
            subtitle={`${familyMembers.filter((m) => m.member.isOnline).length} online`}
            color="text-green-400"
          />
          <StatCard
            icon={MapPin}
            label="Tagged Locations"
            value={taggedLocations.length}
            subtitle="Safe zones"
            color="text-blue-400"
          />
          <StatCard
            icon={Activity}
            label="Current Status"
            value={riskScore < 60 ? 'Safe' : riskScore < 80 ? 'Elevated' : 'Alert'}
            subtitle={status}
            color={
              riskScore < 60
                ? 'text-green-400'
                : riskScore < 80
                ? 'text-amber-400'
                : 'text-red-400'
            }
          />
          <StatCard
            icon={Bell}
            label="Active Alerts"
            value={familyAlerts.filter((a) => a.status === 'active').length}
            subtitle="Family alerts"
            color="text-red-400"
          />
        </div>

        {familyMembers.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Family Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {familyMembers.map((member) => (
                <FamilyMemberCard key={member.connectionId} member={member} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, subtitle, color }) => (
  <div className="card">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-night-400 text-sm">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        <p className="text-night-500 text-xs mt-1 truncate">{subtitle}</p>
      </div>
      <div className={`p-2 rounded-lg bg-night-800 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

const FamilyMemberCard = ({ member }) => {
  const { member: m, relationship } = member;

  return (
    <div className="p-4 bg-night-800/50 rounded-lg border border-night-700">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-noctis-500 to-noctis-700 flex items-center justify-center text-white font-medium">
            {m.name?.charAt(0).toUpperCase()}
          </div>
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-night-800 ${
              m.isOnline ? 'bg-green-500' : 'bg-night-600'
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{m.name}</p>
          <p className="text-xs text-night-400">{relationship}</p>
        </div>
        <div className="text-right">
          <RiskMeter score={m.currentRiskScore || 0} size="sm" showLabel={false} />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-night-700">
        <StatusBadge status={m.currentStatus || 'Unknown'} className="text-xs" />
      </div>
    </div>
  );
};

export default Dashboard;
