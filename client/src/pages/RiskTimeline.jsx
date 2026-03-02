import { useEffect, useState } from 'react';
import { useLocationStore } from '../store/locationStore';
import { RiskMeter, RiskBreakdown, LiveMap } from '../components';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import { format } from 'date-fns';
import { Activity, Clock, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import { getRiskColor } from '../utils/helpers';

const RiskTimeline = () => {
  const { fetchRiskHistory } = useLocationStore();
  const [timelineData, setTimelineData] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [timeRange, setTimeRange] = useState(24);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchRiskHistory(timeRange);
    if (data) {
      setTimelineData(data.timeline);
      setStats(data.stats);
    }
    setIsLoading(false);
  };

  const chartData = timelineData.map((point) => ({
    ...point,
    time: format(new Date(point.timestamp), 'HH:mm'),
    fullTime: format(new Date(point.timestamp), 'MMM d, HH:mm'),
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-night-900 border border-night-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium">{data.fullTime}</p>
          <p className="text-sm" style={{ color: getRiskColor(data.score) }}>
            Risk Score: {data.score}
          </p>
          {data.anomalies?.length > 0 && (
            <p className="text-xs text-amber-400 mt-1">
              {data.anomalies.length} anomaly(ies)
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const handlePointClick = (data) => {
    if (data?.activePayload?.[0]?.payload) {
      setSelectedPoint(data.activePayload[0].payload);
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">
              Risk Timeline
            </h1>
            <p className="text-night-400 mt-1">
              Track your safety history and patterns
            </p>
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="input w-auto"
          >
            <option value={6}>Last 6 hours</option>
            <option value={12}>Last 12 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={48}>Last 48 hours</option>
            <option value={168}>Last 7 days</option>
          </select>
        </div>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Activity}
              label="Average Risk"
              value={stats.averageScore?.toFixed(1) || 0}
              color="text-noctis-400"
            />
            <StatCard
              icon={TrendingUp}
              label="Peak Risk"
              value={stats.maxScore || 0}
              color={`text-[${getRiskColor(stats.maxScore)}]`}
            />
            <StatCard
              icon={AlertTriangle}
              label="Anomalies"
              value={stats.anomalyCount || 0}
              color="text-amber-400"
            />
            <StatCard
              icon={Clock}
              label="Data Points"
              value={stats.dataPoints || 0}
              color="text-green-400"
            />
          </div>
        )}

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">
            Risk Score Over Time
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="w-8 h-8 animate-spin text-noctis-400" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px]">
              <Activity className="w-12 h-12 text-night-600 mb-4" />
              <p className="text-night-400">No data available</p>
              <p className="text-night-500 text-sm mt-1">
                Start tracking to see your risk timeline
              </p>
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  onClick={handlePointClick}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={60}
                    stroke="#f97316"
                    strokeDasharray="3 3"
                    label={{ value: 'Warning', fill: '#f97316', fontSize: 10 }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{ value: 'Critical', fill: '#ef4444', fontSize: 10 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#riskGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {selectedPoint && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">
                Selected Point Details
              </h2>
              <div className="flex items-center gap-6 mb-6">
                <RiskMeter score={selectedPoint.score} size="md" />
                <div>
                  <p className="text-night-400 text-sm">
                    {format(new Date(selectedPoint.timestamp), 'PPpp')}
                  </p>
                  <p className="text-white font-medium mt-1">
                    {selectedPoint.status}
                  </p>
                  {selectedPoint.anomalies?.length > 0 && (
                    <div className="mt-2">
                      {selectedPoint.anomalies.map((anomaly, idx) => (
                        <span
                          key={idx}
                          className="inline-block px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded mr-2 mb-1"
                        >
                          {anomaly.type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {selectedPoint.breakdown && (
                <RiskBreakdown breakdown={selectedPoint.breakdown} />
              )}
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">
                Location at Selected Time
              </h2>
              <div className="h-[300px] rounded-xl overflow-hidden">
                <LiveMap
                  center={[
                    selectedPoint.location.latitude,
                    selectedPoint.location.longitude,
                  ]}
                  currentLocation={selectedPoint.location}
                  riskScore={selectedPoint.score}
                  zoom={16}
                />
              </div>
            </div>
          </div>
        )}

        {chartData.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Anomaly Events
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {chartData
                .filter((point) => point.anomalies?.length > 0)
                .map((point, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-night-800/50 rounded-lg border border-night-700 cursor-pointer hover:border-amber-500/50 transition-colors"
                    onClick={() => setSelectedPoint(point)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{point.fullTime}</p>
                        <p className="text-sm text-night-400">{point.status}</p>
                      </div>
                      <div className="text-right">
                        <p
                          className="font-bold"
                          style={{ color: getRiskColor(point.score) }}
                        >
                          {point.score}
                        </p>
                        <div className="flex flex-wrap justify-end gap-1 mt-1">
                          {point.anomalies.map((anomaly, aIdx) => (
                            <span
                              key={aIdx}
                              className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded"
                            >
                              {anomaly.type}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              {chartData.filter((p) => p.anomalies?.length > 0).length === 0 && (
                <div className="text-center py-8">
                  <AlertTriangle className="w-12 h-12 text-night-600 mx-auto mb-4" />
                  <p className="text-night-400">No anomalies detected</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="card">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-night-800 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-night-400 text-sm">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  </div>
);

export default RiskTimeline;
