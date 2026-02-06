import { create } from 'zustand';

export type ThemeType = 'cyberpunk' | 'matrix' | 'sunset';

interface ThemeState {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: 'cyberpunk',
  setTheme: (theme) => {
    set({ theme });
    // 更新 document 的 class
    document.documentElement.classList.remove('theme-matrix', 'theme-sunset');
    if (theme === 'matrix') {
      document.documentElement.classList.add('theme-matrix');
    } else if (theme === 'sunset') {
      document.documentElement.classList.add('theme-sunset');
    }
  },
  toggleTheme: () => {
    const themes: ThemeType[] = ['cyberpunk', 'matrix', 'sunset'];
    const currentIndex = themes.indexOf(get().theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    get().setTheme(nextTheme);
  },
}));
