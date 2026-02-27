import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Analyzer from './pages/Analyzer'
import Bot from './pages/Bot'
import AppHeader from './components/Layout/AppHeader'
import { AuthProvider } from './hooks/useAuth'

const { Content, Footer } = Layout

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout style={{ minHeight: '100vh' }}>
          <AppHeader />
          <Content style={{ padding: '24px 50px' }}>
            <Routes>
              <Route path='/' element={<Home />} />
              <Route path='/login' element={<Login />} />
              <Route path='/signup' element={<Signup />} />
              <Route path='/dashboard' element={<Dashboard />} />
              <Route path='/analyzer' element={<Analyzer />} />
              <Route path='/bot' element={<Bot />} />
            </Routes>
          </Content>
          <Footer style={{ textAlign: 'center' }}>
            2026 ©{new Date().getFullYear()} - SPORTOLOGY + API
          </Footer>
        </Layout>
      </Router>
    </AuthProvider>
  )
}

export default App
