import { create } from 'zustand';

export const useUserStore = create((set) => ({
  // Hardcoded Admin user so the app never asks for a login
  user: { name: 'System Admin', role: 'Admin' }, 
  login: (userData) => set({ user: userData }),
  logout: () => set({ user: null }),
}));