import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useLocationStore } from '../store/locationStore';
import { LiveMap, RiskMeter, RiskBreakdown, StatusBadge } from '../components';
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  AlertTriangle,
  Clock,
  Gauge,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const Simulation = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [simulationData, setSimulationData] = useState(null);
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('homeToOffice');
  const [interval, setInterval] = useState(3000);
  const [locationHistory, setLocationHistory] = useState([]);
  const timerRef = useRef(null);

  const { setCurrentLocation, setRiskData, setContextData } = useLocationStore();

  useEffect(() => {
    fetchAvailableRoutes();
    checkSimulationStatus();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fetchAvailableRoutes = async () => {
    try {
      const response = await api.get('/simulation/routes');
      setAvailableRoutes(response.data.data.routes);
    } catch (error) {
      console.error('Failed to fetch routes:', error);
    }
  };

  const checkSimulationStatus = async () => {
    try {
      const response = await api.get('/simulation/status');
      setSimulationData(response.data.data.status);
      if (response.data.data.status?.active) {
        setIsRunning(true);
        startPolling();
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  const startSimulation = async () => {
    try {
      await api.post('/simulation/start', {
        routeType: selectedRoute,
        intervalMs: interval,
      });
      setIsRunning(true);
      setLocationHistory([]);
      startPolling();
      toast.success('Simulation started');
    } catch (error) {
      toast.error('Failed to start simulation');
    }
  };

  const stopSimulation = async () => {
    try {
      await api.post('/simulation/stop');
      setIsRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
      toast.success('Simulation stopped');
    } catch (error) {
      toast.error('Failed to stop simulation');
    }
  };

  const startPolling = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(async () => {
      try {
        const response = await api.post('/simulation/next');
        const { location, risk, context, simulation } = response.data.data;
        
        setCurrentLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          speed: location.speed,
          accuracy: location.accuracy,
        });
        
        setRiskData(risk);
        setContextData(context);
        setSimulationData(simulation);
        
        setLocationHistory((prev) => [...prev.slice(-50), location]);

        if (!simulation.active) {
          setIsRunning(false);
          clearInterval(timerRef.current);
          toast.success('Simulation completed');
        }
      } catch (error) {
        console.error('Simulation tick error:', error);
      }
    }, interval);
  };

  const injectAnomaly = async (type) => {
    try {
      await api.post('/simulation/inject-anomaly', { anomalyType: type });
      toast.success(`Injected: ${type}`);
    } catch (error) {
      toast.error('Failed to inject anomaly');
    }
  };

  const clearAnomalies = async () => {
    try {
      await api.post('/simulation/clear-anomaly', { anomalyType: 'all' });
      toast.success('Cleared all anomalies');
    } catch (error) {
      toast.error('Failed to clear anomalies');
    }
  };

  const currentLocation = locationHistory[locationHistory.length - 1];
  const riskScore = currentLocation?.riskScore || 0;

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">
              GPS Simulation
            </h1>
            <p className="text-night-400 mt-1">
              Test the risk engine with simulated movement
            </p>
          </div>
          {simulationData?.active && (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                Running: {simulationData.progress}%
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">
                Simulation Map
              </h2>
              <div className="h-[400px] rounded-xl overflow-hidden">
                <LiveMap
                  currentLocation={currentLocation}
                  riskScore={riskScore}
                  zoom={14}
                />
              </div>
            </div>

            {currentLocation && (
              <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Current Status
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-night-400 text-sm">Latitude</p>
                    <p className="text-white font-mono">
                      {currentLocation.latitude?.toFixed(6)}
                    </p>
                  </div>
                  <div>
                    <p className="text-night-400 text-sm">Longitude</p>
                    <p className="text-white font-mono">
                      {currentLocation.longitude?.toFixed(6)}
                    </p>
                  </div>
                  <div>
                    <p className="text-night-400 text-sm">Speed</p>
                    <p className="text-white font-mono">
                      {currentLocation.speed?.toFixed(1)} m/s
                    </p>
                  </div>
                  <div>
                    <p className="text-night-400 text-sm">Status</p>
                    <StatusBadge
                      status={currentLocation.status}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">
                Simulation Controls
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-night-300 mb-2">
                    Route Type
                  </label>
                  <select
                    value={selectedRoute}
                    onChange={(e) => setSelectedRoute(e.target.value)}
                    className="input"
                    disabled={isRunning}
                  >
                    {availableRoutes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name} ({route.pointCount} points)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-night-300 mb-2">
                    Update Interval
                  </label>
                  <select
                    value={interval}
                    onChange={(e) => setInterval(parseInt(e.target.value))}
                    className="input"
                    disabled={isRunning}
                  >
                    <option value={1000}>1 second</option>
                    <option value={2000}>2 seconds</option>
                    <option value={3000}>3 seconds</option>
                    <option value={5000}>5 seconds</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  {!isRunning ? (
                    <button
                      onClick={startSimulation}
                      className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Start
                    </button>
                  ) : (
                    <button
                      onClick={stopSimulation}
                      className="btn btn-danger flex-1 flex items-center justify-center gap-2"
                    >
                      <Pause className="w-4 h-4" />
                      Stop
                    </button>
                  )}
                  <button
                    onClick={clearAnomalies}
                    className="btn btn-secondary flex items-center gap-2"
                    disabled={!isRunning}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">
                Risk Score
              </h2>
              <div className="flex justify-center">
                <RiskMeter score={riskScore} size="md" />
              </div>
              {currentLocation?.riskBreakdown && (
                <div className="mt-4">
                  <RiskBreakdown breakdown={currentLocation.riskBreakdown} />
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">
                Inject Anomalies
              </h2>
              <p className="text-night-400 text-sm mb-4">
                Manually inject anomalies to test the risk engine
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => injectAnomaly('deviation')}
                  disabled={!isRunning}
                  className="btn btn-secondary flex items-center justify-center gap-2 text-sm"
                >
                  <AlertTriangle className="w-4 h-4 text-purple-400" />
                  Route Dev
                </button>
                <button
                  onClick={() => injectAnomaly('stop')}
                  disabled={!isRunning}
                  className="btn btn-secondary flex items-center justify-center gap-2 text-sm"
                >
                  <Clock className="w-4 h-4 text-amber-400" />
                  Stop
                </button>
                <button
                  onClick={() => injectAnomaly('entropy')}
                  disabled={!isRunning}
                  className="btn btn-secondary flex items-center justify-center gap-2 text-sm"
                >
                  <Gauge className="w-4 h-4 text-blue-400" />
                  Entropy
                </button>
                <button
                  onClick={() => injectAnomaly('all')}
                  disabled={!isRunning}
                  className="btn bg-red-600/20 hover:bg-red-600/30 text-red-400 flex items-center justify-center gap-2 text-sm"
                >
                  <Zap className="w-4 h-4" />
                  All
                </button>
              </div>
            </div>
          </div>
        </div>

        {locationHistory.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Location History ({locationHistory.length} points)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-night-700">
                    <th className="text-left py-2 text-night-400">#</th>
                    <th className="text-left py-2 text-night-400">Time</th>
                    <th className="text-left py-2 text-night-400">Position</th>
                    <th className="text-left py-2 text-night-400">Speed</th>
                    <th className="text-left py-2 text-night-400">Risk</th>
                    <th className="text-left py-2 text-night-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {locationHistory.slice(-10).reverse().map((loc, idx) => (
                    <tr key={idx} className="border-b border-night-800">
                      <td className="py-2 text-night-500">
                        {locationHistory.length - idx}
                      </td>
                      <td className="py-2 font-mono text-night-300">
                        {new Date(loc.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 font-mono text-night-300">
                        {loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}
                      </td>
                      <td className="py-2 text-night-300">
                        {loc.speed?.toFixed(1)} m/s
                      </td>
                      <td className="py-2">
                        <span
                          className="font-medium"
                          style={{
                            color:
                              loc.riskScore >= 80
                                ? '#ef4444'
                                : loc.riskScore >= 60
                                ? '#f97316'
                                : loc.riskScore >= 40
                                ? '#f59e0b'
                                : '#10b981',
                          }}
                        >
                          {loc.riskScore}
                        </span>
                      </td>
                      <td className="py-2 text-night-300 truncate max-w-[200px]">
                        {loc.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Simulation;
