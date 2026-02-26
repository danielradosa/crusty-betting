import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
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
            </Routes>
          </Content>
          <Footer style={{ textAlign: 'center' }}>
            Crusty Betting ©{new Date().getFullYear()} - Sports Numerology API
          </Footer>
        </Layout>
      </Router>
    </AuthProvider>
  )
}

export default App
