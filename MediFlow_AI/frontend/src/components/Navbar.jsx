import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sun, Moon, User, LogOut } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';

const Navbar = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const doLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 glass-panel border-b border-l-0 flex items-center justify-between px-6 z-10 sticky top-0">
      <h2 className="font-display font-semibold text-text-primary md:hidden">MediFlow AI</h2>
      <div className="flex-1" />

      <div className="flex items-center space-x-4">
        {user && (
          <div className="text-xs font-medium px-3 py-1 bg-primary/20 text-primary rounded-full">
            {user.role}
          </div>
        )}
        <button onClick={toggleTheme} className="text-text-secondary hover:text-primary transition-colors">
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <Link to="/account" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-full bg-surface-secondary flex items-center justify-center border border-border-color">
            <User className="h-5 w-5 text-text-secondary" />
          </div>
          <span className="text-sm font-medium text-text-primary group-hover:text-primary hidden md:block">
            {user?.full_name || 'Account'}
          </span>
        </Link>
        <button onClick={doLogout} title="Logout"
          className="text-text-secondary hover:text-emergency transition-colors flex items-center gap-1">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};

export default Navbar;
