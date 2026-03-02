import { useEffect, useState } from 'react';
import api from '../services/api';
import { LiveMap, RiskMeter, AlertBanner } from '../components';
import {
  Users,
  Moon,
  AlertTriangle,
  Activity,
  Shield,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

const AdminPanel = () => {
  const [stats, setStats] = useState(null);
  const [nightUsers, setNightUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [heatmapData, setHeatmapData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, nightRes, alertsRes, analyticsRes, heatmapRes] =
        await Promise.all([
          api.get('/admin/dashboard'),
          api.get('/admin/night-users'),
          api.get('/admin/alerts', { params: { limit: 20 } }),
          api.get('/admin/alerts/analytics', { params: { timeRange } }),
          api.get('/admin/heatmap'),
        ]);

      setStats(statsRes.data.data);
      setNightUsers(nightRes.data.data.users);
      setAlerts(alertsRes.data.data.alerts);
      setAnalytics(analyticsRes.data.data);
      setHeatmapData(heatmapRes.data.data.heatmap);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
    setIsLoading(false);
  };

  const SEVERITY_COLORS = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#3b82f6',
  };

  const TYPE_COLORS = {
    shadow: '#6366f1',
    sos: '#ef4444',
    system: '#64748b',
  };

  if (isLoading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-noctis-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
              <Shield className="w-8 h-8 text-noctis-400" />
              Admin Dashboard
            </h1>
            <p className="text-night-400 mt-1">
              System overview and monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="input w-auto text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <button
              onClick={loadData}
              className="btn btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Total Users"
              value={stats.users.total}
              subtitle={`${stats.users.active} active now`}
              color="text-blue-400"
            />
            <StatCard
              icon={Moon}
              label="Night Mode Users"
              value={stats.users.nightMode}
              subtitle="Enhanced monitoring"
              color="text-noctis-400"
            />
            <StatCard
              icon={AlertTriangle}
              label="Active Alerts"
              value={stats.alerts.active}
              subtitle={`${stats.alerts.critical} critical`}
              color="text-red-400"
            />
            <StatCard
              icon={Activity}
              label="Avg Risk Score"
              value={stats.alerts.avgRiskScore?.toFixed(1) || 0}
              subtitle="System average"
              color="text-amber-400"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Live Risk Heatmap
            </h2>
            <div className="h-[300px] rounded-xl overflow-hidden">
              <LiveMap
                zoom={10}
                center={
                  heatmapData.length > 0
                    ? [heatmapData[0].latitude, heatmapData[0].longitude]
                    : undefined
                }
              />
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Alert Volume
            </h2>
            {analytics?.alertsByHour?.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.alertsByHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="_id" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-night-400">No data available</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Alerts by Severity
            </h2>
            {analytics?.alertsBySeverity ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(analytics.alertsBySeverity).map(
                        ([name, value]) => ({ name, value })
                      )}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {Object.entries(analytics.alertsBySeverity).map(
                        ([name], idx) => (
                          <Cell
                            key={idx}
                            fill={SEVERITY_COLORS[name] || '#64748b'}
                          />
                        )
                      )}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <p className="text-night-400">No data</p>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Alerts by Type
            </h2>
            {analytics?.alertsByType ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(analytics.alertsByType).map(
                      ([name, value]) => ({ name, value })
                    )}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#64748b" />
                    <YAxis dataKey="name" type="category" stroke="#64748b" width={60} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <p className="text-night-400">No data</p>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Response Metrics
            </h2>
            <div className="space-y-4">
              <div className="p-3 bg-night-800/50 rounded-lg">
                <p className="text-night-400 text-sm">Avg Response Time</p>
                <p className="text-2xl font-bold text-white">
                  {analytics?.avgResponseTimeMs
                    ? `${(analytics.avgResponseTimeMs / 60000).toFixed(1)} min`
                    : 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-night-800/50 rounded-lg">
                <p className="text-night-400 text-sm">Top Anomaly</p>
                <p className="text-lg font-bold text-amber-400">
                  {analytics?.topAnomalies?.[0]?._id || 'None'}
                </p>
              </div>
              <div className="p-3 bg-night-800/50 rounded-lg">
                <p className="text-night-400 text-sm">False Alarm Rate</p>
                <p className="text-lg font-bold text-green-400">
                  {stats?.alerts?.total
                    ? `${((stats.alerts.falseAlarms / stats.alerts.total) * 100).toFixed(1)}%`
                    : '0%'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Active Night Mode Users ({nightUsers.length})
            </h2>
            {nightUsers.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {nightUsers.map((user) => (
                  <div
                    key={user._id}
                    className="p-3 bg-night-800/50 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-noctis-500 to-noctis-700 flex items-center justify-center text-white font-medium">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.name}</p>
                        <p className="text-xs text-night-400">{user.currentStatus}</p>
                      </div>
                    </div>
                    <RiskMeter
                      score={user.currentRiskScore || 0}
                      size="sm"
                      showLabel={false}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Moon className="w-12 h-12 text-night-600 mx-auto mb-4" />
                <p className="text-night-400">No users in night mode</p>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Recent Alerts
            </h2>
            {alerts.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {alerts.slice(0, 10).map((alert) => (
                  <AlertBanner key={alert._id} alert={alert} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-night-600 mx-auto mb-4" />
                <p className="text-night-400">No recent alerts</p>
              </div>
            )}
          </div>
        </div>

        {stats?.highRiskUsers?.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              High Risk Users
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.highRiskUsers.map((user) => (
                <div
                  key={user._id}
                  className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-white">{user.name}</p>
                    <span className="text-red-400 font-bold text-lg">
                      {user.currentRiskScore}
                    </span>
                  </div>
                  <p className="text-sm text-night-400">{user.currentStatus}</p>
                  {user.isNightModeActive && (
                    <span className="inline-block mt-2 px-2 py-1 bg-noctis-500/20 text-noctis-400 text-xs rounded">
                      Night Mode
                    </span>
                  )}
                </div>
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
        <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
        <p className="text-night-500 text-xs mt-1">{subtitle}</p>
      </div>
      <div className={`p-3 rounded-xl bg-night-800 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

export default AdminPanel;
