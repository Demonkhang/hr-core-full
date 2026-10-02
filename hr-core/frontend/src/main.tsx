import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
import App from './App';
import { BORDER_RADIUS, COLORS as C } from '@/utils/constants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          theme={{
            algorithm: theme.defaultAlgorithm,
            token: {
              colorPrimary: '#a78bfa',
              colorInfo: '#a78bfa',
              colorSuccess: '#34d399',
              colorWarning: '#fbbf24',
              colorError: '#f87171',
              colorLink: '#818cf8',
              colorBgLayout: C.LAYOUT_BG,
              borderRadius: 8,
              borderRadiusLG: 12,
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)',
              boxShadowSecondary: '0 4px 16px rgba(0,0,0,0.06)',
            },
            components: {
              Menu: {
                itemBg: C.TRANSPARENT,
                subMenuItemBg: C.TRANSPARENT,
                itemBorderRadius: BORDER_RADIUS.MENU_ITEM,
                itemMarginInline: 6,
                itemColor: C.MENU_ITEM_COLOR,
                itemSelectedBg: C.MENU_ITEM_SELECTED_BG,
                itemSelectedColor: C.MENU_ITEM_SELECTED_COLOR,
                itemHoverBg: C.MENU_ITEM_HOVER_BG,
              },
              Layout: {
                bodyBg: C.LAYOUT_BG,
              },
              Card: {
                borderRadiusLG: BORDER_RADIUS.CARD,
                boxShadowTertiary: '0 1px 3px 0 rgba(0,0,0,0.04)',
              },
              Table: {
                borderRadiusLG: BORDER_RADIUS.CARD_SMALL,
                headerBg: C.LAYOUT_BG,
                headerBorderRadius: BORDER_RADIUS.CARD_SMALL,
              },
              Modal: {
                borderRadiusLG: BORDER_RADIUS.CARD_SMALL,
              },
              Button: {
                borderRadiusLG: 10,
                primaryShadow: '0 2px 8px rgba(167,139,250,0.35)',
              },
              Switch: {
                trackHeight: 24,
              },
            },
          }}
        >
          <App />
        </ConfigProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
