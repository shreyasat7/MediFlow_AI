import { create } from 'zustand';

const stored = (() => {
  try {
    return JSON.parse(localStorage.getItem('mediflow_auth')) || {};
  } catch {
    return {};
  }
})();

export const useAuthStore = create((set) => ({
  token: stored.token || null,
  user: stored.user || null,
  setAuth: (token, user) => {
    localStorage.setItem('mediflow_auth', JSON.stringify({ token, user }));
    set({ token, user });
  },
  updateUser: (user) => {
    const token = useAuthStore.getState().token;
    localStorage.setItem('mediflow_auth', JSON.stringify({ token, user }));
    set({ user });
  },
  logout: () => {
    localStorage.removeItem('mediflow_auth');
    set({ token: null, user: null });
  },
}));
