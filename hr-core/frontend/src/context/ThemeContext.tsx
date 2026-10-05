import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ConfigProvider, theme } from 'antd';
import { BORDER_RADIUS, COLORS as C } from '@/utils/constants';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'light',
  isDark: false,
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const THEME_STORAGE_KEY = 'hr_theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const isDark = themeMode === 'dark';

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  };

  const toggleTheme = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    if (isDark) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
  }, [themeMode, isDark]);

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, toggleTheme, setThemeMode }}>
      <ConfigProvider
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: isDark ? '#a78bfa' : '#7c3aed',
            colorInfo: isDark ? '#a78bfa' : '#7c3aed',
            colorSuccess: '#34d399',
            colorWarning: '#fbbf24',
            colorError: '#f87171',
            colorLink: isDark ? '#a78bfa' : '#6366f1',
            colorBgLayout: isDark ? '#0f172a' : C.LAYOUT_BG,
            colorBgContainer: isDark ? '#1e293b' : '#ffffff',
            colorText: isDark ? '#f8fafc' : '#1e293b',
            colorTextSecondary: isDark ? '#94a3b8' : '#64748b',
            colorBorder: isDark ? '#334155' : '#e2e8f0',
            colorBorderSecondary: isDark ? '#1e293b' : '#f1f5f9',
            borderRadius: 8,
            borderRadiusLG: 12,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            boxShadow: isDark
              ? '0 1px 3px 0 rgba(0,0,0,0.3)'
              : '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)',
            boxShadowSecondary: isDark
              ? '0 4px 16px rgba(0,0,0,0.4)'
              : '0 4px 16px rgba(0,0,0,0.06)',
          },
          components: {
            Menu: {
              itemBg: C.TRANSPARENT,
              subMenuItemBg: C.TRANSPARENT,
              itemBorderRadius: BORDER_RADIUS.MENU_ITEM,
              itemMarginInline: 6,
              itemColor: isDark ? '#cbd5e1' : C.MENU_ITEM_COLOR,
              itemSelectedBg: isDark ? '#334155' : C.MENU_ITEM_SELECTED_BG,
              itemSelectedColor: isDark ? '#a78bfa' : C.MENU_ITEM_SELECTED_COLOR,
              itemHoverBg: isDark ? 'rgba(255,255,255,0.06)' : C.MENU_ITEM_HOVER_BG,
            },
            Layout: {
              bodyBg: isDark ? '#0f172a' : C.LAYOUT_BG,
              headerBg: isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.72)',
              siderBg: isDark ? '#1e293b' : C.SIDEBAR_BG,
            },
            Card: {
              borderRadiusLG: BORDER_RADIUS.CARD,
              boxShadowTertiary: isDark ? '0 1px 3px 0 rgba(0,0,0,0.2)' : '0 1px 3px 0 rgba(0,0,0,0.04)',
            },
            Table: {
              borderRadiusLG: BORDER_RADIUS.CARD_SMALL,
              headerBg: isDark ? '#0f172a' : C.LAYOUT_BG,
              headerBorderRadius: BORDER_RADIUS.CARD_SMALL,
            },
            Modal: {
              borderRadiusLG: BORDER_RADIUS.CARD_SMALL,
            },
            Button: {
              borderRadiusLG: 10,
              primaryShadow: isDark
                ? '0 2px 8px rgba(167,139,250,0.25)'
                : '0 2px 8px rgba(124,58,237,0.3)',
            },
            Switch: {
              trackHeight: 24,
            },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
