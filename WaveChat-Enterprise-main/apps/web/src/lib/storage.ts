const ACCESS = 'wavechat.access';
const REFRESH = 'wavechat.refresh';
const USER = 'wavechat.user';
export const storage = {
  getAccess: () => localStorage.getItem(ACCESS),
  getRefresh: () => localStorage.getItem(REFRESH),
  getUser: <T>() => { const value = localStorage.getItem(USER); return value ? JSON.parse(value) as T : null; },
  setSession: (access: string, refresh: string, user: unknown) => {
    localStorage.setItem(ACCESS, access); localStorage.setItem(REFRESH, refresh); localStorage.setItem(USER, JSON.stringify(user));
  },
  setAccess: (access: string) => localStorage.setItem(ACCESS, access),
  setUser: (user: unknown) => localStorage.setItem(USER, JSON.stringify(user)),
  clear: () => { localStorage.removeItem(ACCESS); localStorage.removeItem(REFRESH); localStorage.removeItem(USER); }
};
