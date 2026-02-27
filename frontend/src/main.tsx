import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import enUS from 'antd/locale/en_US'
import daDK from 'antd/locale/da_DK'
import App from './App'
import './index.css'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import 'dayjs/locale/da'

dayjs.extend(localizedFormat)
const browserLocale = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en'
const isDanish = browserLocale.startsWith('da')
dayjs.locale(isDanish ? 'da' : 'en')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={isDanish ? daDK : enUS}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#7a4dd8',
          colorSuccess: '#1f9d7a',
          colorWarning: '#d6922f',
          colorError: '#d64545',
          colorInfo: '#4f83d1',
          borderRadius: 14,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          colorBgLayout: '#f8f6ff',
          colorBgContainer: '#ffffff',
        },
        components: {
          Card: {
            headerFontSize: 16,
          },
          Button: {
            controlHeight: 40,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)
