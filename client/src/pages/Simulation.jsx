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
  MapPin,
  Dice6,
  Settings2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const Simulation = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [simulationData, setSimulationData] = useState(null);
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('homeToOffice');
  const [interval, setInterval] = useState(3000);
  const [locationHistory, setLocationHistory] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customRoute, setCustomRoute] = useState('');
  const [randomRouteConfig, setRandomRouteConfig] = useState({
    startLat: 13.0827,
    startLng: 80.2707,
    pointCount: 20,
    maxDeviation: 0.01,
  });
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
      toast.error('Failed to load available routes');
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
      setIsLoading(true);
      await api.post('/simulation/start', {
        routeType: selectedRoute,
        intervalMs: interval,
      });
      setIsRunning(true);
      setLocationHistory([]);
      startPolling();
      toast.success('✓ Simulation started');
    } catch (error) {
      toast.error('✗ Failed to start simulation');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const stopSimulation = async () => {
    try {
      setIsLoading(true);
      await api.post('/simulation/stop');
      setIsRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
      toast.success('✓ Simulation stopped');
    } catch (error) {
      toast.error('✗ Failed to stop simulation');
    } finally {
      setIsLoading(false);
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
          toast.success('✓ Simulation completed');
        }
      } catch (error) {
        console.error('Simulation tick error:', error);
        if (error.response?.status === 400) {
          setIsRunning(false);
          clearInterval(timerRef.current);
        }
      }
    }, interval);
  };

  const injectAnomaly = async (type) => {
    try {
      await api.post('/simulation/inject-anomaly', { anomalyType: type });
      toast.success(`✓ Injected: ${type}`);
    } catch (error) {
      toast.error('✗ Failed to inject anomaly');
    }
  };

  const clearAnomalies = async () => {
    try {
      await api.post('/simulation/clear-anomaly', { anomalyType: 'all' });
      toast.success('✓ Cleared all anomalies');
    } catch (error) {
      toast.error('✗ Failed to clear anomalies');
    }
  };

  const setCustomRouteHandler = async () => {
    try {
      const route = JSON.parse(customRoute);
      if (!Array.isArray(route) || route.length < 2) {
        toast.error('Route must be an array with at least 2 points');
        return;
      }
      setIsLoading(true);
      const response = await api.post('/simulation/custom-route', { route });
      toast.success(`✓ Custom route set (${response.data.data.routeLength} points)`);
      setCustomRoute('');
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('Invalid JSON format');
      } else {
        toast.error('Failed to set custom route');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const generateRandomRoute = async () => {
    try {
      setIsLoading(true);
      const response = await api.post('/simulation/random-route', {
        startLat: randomRouteConfig.startLat,
        startLng: randomRouteConfig.startLng,
        pointCount: randomRouteConfig.pointCount,
        maxDeviation: randomRouteConfig.maxDeviation,
      });
      toast.success(`✓ Random route generated (${response.data.data.route.length} points)`);
    } catch (error) {
      toast.error('Failed to generate random route');
    } finally {
      setIsLoading(false);
    }
  };

  const currentLocation = locationHistory[locationHistory.length - 1];
  const riskScore = currentLocation?.riskScore || 0;

  return (
    <div className="min-h-screen p-4 lg:p-6 bg-night-900">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-2">
              <MapPin className="w-8 h-8 text-blue-400" />
              GPS Simulation Engine
            </h1>
            <p className="text-night-400 mt-1">
              Test and validate the NOCTIS risk detection system with simulated movement patterns
            </p>
          </div>
          {simulationData?.active && (
            <div className="flex items-center gap-2 animate-pulse">
              <div className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm font-medium border border-green-500/50">
                🟢 Running: {simulationData.progress}%
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card border border-night-700">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                Live Map Simulation
              </h2>
              <div className="h-[400px] rounded-xl overflow-hidden bg-night-800">
                <LiveMap
                  currentLocation={currentLocation}
                  riskScore={riskScore}
                  zoom={14}
                />
              </div>
              <div className="mt-3 text-xs text-night-400">
                {currentLocation ? (
                  <>
                    Last update: {new Date(currentLocation.timestamp).toLocaleTimeString()} | 
                    Route progress: {simulationData?.progress || 0}%
                  </>
                ) : (
                  'Start simulation to see location data'
                )}
              </div>
            </div>

            {currentLocation && (
              <div className="card border border-night-700">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Current Status
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-night-800 rounded-lg p-3">
                    <p className="text-night-400 text-xs uppercase tracking-wide">Latitude</p>
                    <p className="text-white font-mono text-sm mt-1">
                      {currentLocation.latitude?.toFixed(6)}
                    </p>
                  </div>
                  <div className="bg-night-800 rounded-lg p-3">
                    <p className="text-night-400 text-xs uppercase tracking-wide">Longitude</p>
                    <p className="text-white font-mono text-sm mt-1">
                      {currentLocation.longitude?.toFixed(6)}
                    </p>
                  </div>
                  <div className="bg-night-800 rounded-lg p-3">
                    <p className="text-night-400 text-xs uppercase tracking-wide">Speed</p>
                    <p className="text-white font-mono text-sm mt-1">
                      {currentLocation.speed?.toFixed(1)} m/s
                    </p>
                  </div>
                  <div className="bg-night-800 rounded-lg p-3">
                    <p className="text-night-400 text-xs uppercase tracking-wide">Status</p>
                    <StatusBadge
                      status={currentLocation.status}
                      className="text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Main Controls */}
            <div className="card border border-night-700">
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
                    disabled={isRunning}
                    className="w-full px-3 py-2 bg-night-800 border border-night-600 rounded-lg text-white hover:border-night-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    disabled={isRunning}
                    className="w-full px-3 py-2 bg-night-800 border border-night-600 rounded-lg text-white hover:border-night-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <option value={1000}>1 second (Fast)</option>
                    <option value={2000}>2 seconds (Normal)</option>
                    <option value={3000}>3 seconds</option>
                    <option value={5000}>5 seconds (Slow)</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  {!isRunning ? (
                    <button
                      onClick={startSimulation}
                      disabled={isLoading}
                      className="btn btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Start
                    </button>
                  ) : (
                    <button
                      onClick={stopSimulation}
                      disabled={isLoading}
                      className="btn bg-red-600/20 hover:bg-red-600/30 text-red-400 flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Pause className="w-4 h-4" />
                      )}
                      Stop
                    </button>
                  )}
                  <button
                    onClick={clearAnomalies}
                    className="btn bg-night-800 hover:bg-night-700 flex items-center gap-2 disabled:opacity-50"
                    disabled={!isRunning}
                    title="Reset all injected anomalies"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Risk Score */}
            <div className="card border border-night-700">
              <h2 className="text-lg font-semibold text-white mb-4">
                Live Risk Score
              </h2>
              <div className="flex justify-center mb-4">
                <RiskMeter score={riskScore} size="md" />
              </div>
              {currentLocation?.riskBreakdown && (
                <RiskBreakdown breakdown={currentLocation.riskBreakdown} />
              )}
            </div>

            {/* Anomaly Injection */}
            <div className="card border border-night-700">
              <h2 className="text-lg font-semibold text-white mb-3">
                Test Anomalies
              </h2>
              <p className="text-night-400 text-xs mb-3">
                Inject anomalies to validate detection system
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => injectAnomaly('deviation')}
                  disabled={!isRunning}
                  className="btn bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 flex items-center justify-center gap-1.5 text-xs py-2"
                  title="Route deviation from planned path"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Route Dev
                </button>
                <button
                  onClick={() => injectAnomaly('stop')}
                  disabled={!isRunning}
                  className="btn bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 flex items-center justify-center gap-1.5 text-xs py-2"
                  title="Unexpected stop/idle"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Stop
                </button>
                <button
                  onClick={() => injectAnomaly('entropy')}
                  disabled={!isRunning}
                  className="btn bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 flex items-center justify-center gap-1.5 text-xs py-2"
                  title="Speed anomaly"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  Entropy
                </button>
                <button
                  onClick={() => injectAnomaly('all')}
                  disabled={!isRunning}
                  className="btn bg-red-600/20 hover:bg-red-600/30 text-red-400 flex items-center justify-center gap-1.5 text-xs py-2"
                  title="All anomalies"
                >
                  <Zap className="w-3.5 h-3.5" />
                  All
                </button>
              </div>
            </div>

            {/* Advanced Options */}
            <div className="card border border-night-700">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-lg font-semibold text-white hover:text-blue-400 transition-colors py-2"
              >
                <span className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  Advanced
                </span>
                <span className="text-sm text-night-400">
                  {showAdvanced ? '▼' : '▶'}
                </span>
              </button>
              
              {showAdvanced && (
                <div className="mt-4 pt-4 border-t border-night-700 space-y-4">
                  {/* Custom Route */}
                  <div>
                    <label className="block text-xs font-medium text-night-300 mb-2 uppercase tracking-wide">
                      Custom Route (JSON)
                    </label>
                    <textarea
                      value={customRoute}
                      onChange={(e) => setCustomRoute(e.target.value)}
                      placeholder='[{"latitude": 13.0827, "longitude": 80.2707, "timestamp": "2026-03-03T12:00:00Z"}]'
                      className="w-full h-20 p-2 bg-night-800 border border-night-600 rounded text-xs font-mono text-white placeholder-night-500"
                    />
                    <button
                      onClick={setCustomRouteHandler}
                      disabled={isLoading || !customRoute}
                      className="w-full mt-2 btn btn-primary text-sm disabled:opacity-50"
                    >
                      Set Custom Route
                    </button>
                  </div>

                  {/* Random Route */}
                  <div className="border-t border-night-700 pt-4">
                    <h3 className="text-xs font-medium text-night-300 mb-3 uppercase tracking-wide">
                      Generate Random Route
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-night-400">Start Latitude</label>
                        <input
                          type="number"
                          value={randomRouteConfig.startLat}
                          onChange={(e) =>
                            setRandomRouteConfig({
                              ...randomRouteConfig,
                              startLat: parseFloat(e.target.value),
                            })
                          }
                          step="0.0001"
                          className="w-full px-2 py-1 bg-night-800 border border-night-600 rounded text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-night-400">Start Longitude</label>
                        <input
                          type="number"
                          value={randomRouteConfig.startLng}
                          onChange={(e) =>
                            setRandomRouteConfig({
                              ...randomRouteConfig,
                              startLng: parseFloat(e.target.value),
                            })
                          }
                          step="0.0001"
                          className="w-full px-2 py-1 bg-night-800 border border-night-600 rounded text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-night-400">Point Count</label>
                        <input
                          type="number"
                          value={randomRouteConfig.pointCount}
                          onChange={(e) =>
                            setRandomRouteConfig({
                              ...randomRouteConfig,
                              pointCount: parseInt(e.target.value),
                            })
                          }
                          min="2"
                          className="w-full px-2 py-1 bg-night-800 border border-night-600 rounded text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-night-400">Max Deviation</label>
                        <input
                          type="number"
                          value={randomRouteConfig.maxDeviation}
                          onChange={(e) =>
                            setRandomRouteConfig({
                              ...randomRouteConfig,
                              maxDeviation: parseFloat(e.target.value),
                            })
                          }
                          step="0.001"
                          className="w-full px-2 py-1 bg-night-800 border border-night-600 rounded text-xs text-white"
                        />
                      </div>
                    </div>
                    <button
                      onClick={generateRandomRoute}
                      disabled={isLoading}
                      className="w-full mt-3 btn btn-secondary text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Dice6 className="w-4 h-4" />
                      Generate Route
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Location History Table */}
        {locationHistory.length > 0 && (
          <div className="card border border-night-700">
            <h2 className="text-lg font-semibold text-white mb-4">
              Location History ({locationHistory.length} points)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-night-700">
                    <th className="text-left py-3 px-2 text-night-400 text-xs uppercase">ID</th>
                    <th className="text-left py-3 px-2 text-night-400 text-xs uppercase">Time</th>
                    <th className="text-left py-3 px-2 text-night-400 text-xs uppercase">Position</th>
                    <th className="text-left py-3 px-2 text-night-400 text-xs uppercase">Speed</th>
                    <th className="text-left py-3 px-2 text-night-400 text-xs uppercase">Risk</th>
                    <th className="text-left py-3 px-2 text-night-400 text-xs uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {locationHistory.slice(-15).reverse().map((loc, idx) => (
                    <tr key={idx} className="border-b border-night-800 hover:bg-night-800/50">
                      <td className="py-2 px-2 text-night-500">
                        {locationHistory.length - idx}
                      </td>
                      <td className="py-2 px-2 font-mono text-night-300 text-xs">
                        {new Date(loc.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-2 font-mono text-night-300 text-xs">
                        {loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}
                      </td>
                      <td className="py-2 px-2 text-night-300">
                        {loc.speed?.toFixed(1)} m/s
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className="font-semibold text-xs px-2 py-1 rounded"
                          style={{
                            backgroundColor:
                              loc.riskScore >= 80
                                ? 'rgba(239, 68, 68, 0.2)'
                                : loc.riskScore >= 60
                                ? 'rgba(249, 115, 22, 0.2)'
                                : loc.riskScore >= 40
                                ? 'rgba(245, 158, 11, 0.2)'
                                : 'rgba(16, 185, 129, 0.2)',
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
                      <td className="py-2 px-2 text-night-300 truncate max-w-[150px] text-xs">
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
