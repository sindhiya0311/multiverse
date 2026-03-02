import { Outlet } from 'react-router-dom';
import { Moon } from 'lucide-react';

const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-night-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-noctis-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-noctis-800/20 rounded-full blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-gradient-to-br from-noctis-500 to-noctis-700 rounded-2xl flex items-center justify-center shadow-lg shadow-noctis-600/30">
            <Moon className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="mt-6 text-center text-3xl font-bold text-white tracking-tight">
          NOCTIS
        </h1>
        <p className="mt-2 text-center text-sm text-night-400">
          Predictive Night Safety OS
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="glass rounded-2xl px-8 py-10 shadow-xl">
          <Outlet />
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-night-500 relative z-10">
        Protected by intelligent behavioral analysis
      </p>
    </div>
  );
};

export default AuthLayout;
