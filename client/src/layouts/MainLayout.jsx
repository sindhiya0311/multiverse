import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { initializeSocket, disconnectSocket } from '../services/socket';
import { requestNotificationPermission } from '../utils/helpers';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Activity,
  Settings,
  LogOut,
  Moon,
  Shield,
  Play,
} from 'lucide-react';
import clsx from 'clsx';

const MainLayout = () => {
  const { user, token, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && token) {
      initializeSocket(token);
      requestNotificationPermission();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, token]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Family', href: '/family', icon: Users },
    { name: 'Locations', href: '/locations', icon: MapPin },
    { name: 'Timeline', href: '/timeline', icon: Activity },
    { name: 'Simulation', href: '/simulation', icon: Play },
  ];

  if (user?.role === 'admin') {
    navigation.push({ name: 'Admin', href: '/admin', icon: Shield });
  }

  return (
    <div className="min-h-screen bg-night-950 flex">
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col flex-grow bg-night-900/50 backdrop-blur-sm border-r border-night-800 pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-6">
              <div className="w-10 h-10 bg-gradient-to-br from-noctis-500 to-noctis-700 rounded-xl flex items-center justify-center">
                <Moon className="w-5 h-5 text-white" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-white">NOCTIS</h1>
                <p className="text-xs text-night-400">Night Safety OS</p>
              </div>
            </div>

            <nav className="mt-8 flex-1 px-3 space-y-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    clsx(
                      'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                      isActive
                        ? 'bg-noctis-600/20 text-noctis-400 border border-noctis-600/30'
                        : 'text-night-300 hover:bg-night-800 hover:text-white'
                    )
                  }
                >
                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {item.name}
                </NavLink>
              ))}
            </nav>

            <div className="flex-shrink-0 p-4 border-t border-night-800">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-noctis-500 to-noctis-700 flex items-center justify-center text-white font-medium">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-night-400 truncate">
                    {user?.email || ''}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-night-400 hover:text-white hover:bg-night-800 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-night-900/95 backdrop-blur-sm border-t border-night-800">
        <nav className="flex justify-around py-2">
          {navigation.slice(0, 5).map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors',
                  isActive
                    ? 'text-noctis-400'
                    : 'text-night-400 hover:text-white'
                )
              }
            >
              <item.icon className="h-5 w-5 mb-1" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
