import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import MediBot from './MediBot';

const AppShell = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Navbar />
        <main className="w-full flex-grow p-6">
          <Outlet />
        </main>
      </div>
      <MediBot />
    </div>
  );
};

export default AppShell;
