import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserPlus, Stethoscope, Bed, Receipt, ActivitySquare,
  UserCog, CalendarDays, Radio, BarChart3, ScrollText, ClipboardList, Moon,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/useAuthStore';

const ALL_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['Admin', 'Doctor', 'Nurse', 'Receptionist'] },
  { name: 'My Patients', path: '/my-patients', icon: ClipboardList, roles: ['Doctor'] },
  { name: 'Patients', path: '/patients', icon: Users, roles: ['Admin', 'Nurse', 'Receptionist'] },
  { name: 'Registration', path: '/registration', icon: UserPlus, roles: ['Admin', 'Receptionist'] },
  { name: 'Doctors & Queue', path: '/doctors', icon: Stethoscope, roles: ['Admin'] },
  { name: 'Ward Rounds', path: '/rounds', icon: Moon, roles: ['Admin', 'Doctor', 'Nurse'] },
  { name: 'Diagnostics', path: '/diagnostics', icon: ActivitySquare, roles: ['Admin', 'Doctor', 'Nurse'] },
  { name: 'Bed Management', path: '/beds', icon: Bed, roles: ['Admin', 'Nurse'] },
  { name: 'Billing', path: '/billing', icon: Receipt, roles: ['Admin', 'Doctor', 'Receptionist'] },
  { name: 'Appointments', path: '/appointments', icon: CalendarDays, roles: ['Admin', 'Doctor', 'Receptionist'] },
  { name: 'Coordinator AI', path: '/coordinator', icon: Radio, roles: ['Admin'] },
  { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['Admin'] },
  { name: 'Audit Log', path: '/audit', icon: ScrollText, roles: ['Admin'] },
  { name: 'Staff & Access', path: '/staff', icon: UserCog, roles: ['Admin'] },
];

const Sidebar = () => {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const items = ALL_ITEMS.filter((i) => !role || i.roles.includes(role));

  return (
    <aside className="w-64 glass-panel border-r shrink-0 flex flex-col hidden md:flex z-20 h-full">
      <div className="h-16 flex items-center px-6 border-b border-border-color">
        <ActivitySquare className="h-8 w-8 text-primary mr-3" />
        <span className="font-display font-bold text-xl text-primary tracking-tight">MediFlow AI</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) => clsx(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary border-l-4 border-primary'
                    : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                )}
              >
                <Icon className="mr-3 flex-shrink-0 h-5 w-5" aria-hidden="true" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
