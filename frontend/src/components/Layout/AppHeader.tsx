import { Layout, Menu, Button, Space, Typography } from 'antd'
import {
  UserOutlined,
  DashboardOutlined,
  HomeOutlined,
  LoginOutlined,
  LogoutOutlined,
  DotChartOutlined,
  RobotOutlined
} from '@ant-design/icons'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const { Header } = Layout
const { Text } = Typography

function AppHeader() {
  const { isAuthenticated, user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to='/'>Home</Link>,
    },
    ...(isAuthenticated
      ? [
          {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: <Link to='/dashboard'>Dashboard</Link>,
          },
          {
            key: '/analyzer',
            icon: <DotChartOutlined />,
            label: <Link to='/analyzer'>Analyzer</Link>
          },
          {
            key: '/bot',
            icon: <RobotOutlined />,
            label: <Link to='/bot'></Link>
          }
        ]
      : []),
  ]

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Text
          style={{
            color: '#fff',
            fontSize: 20,
            fontWeight: 'bold',
            marginRight: 40,
          }}
        >
          🔮 SPORTOLOGY
        </Text>
        <Menu
          theme='dark'
          mode='horizontal'
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>

      <Space>
        {isAuthenticated ? (
          <>
            <Text style={{ color: '#fff' }}>
              <UserOutlined /> {user?.email}
            </Text>
            <Button
              type='primary'
              danger
              icon={<LogoutOutlined />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </>
        ) : (
          <>
            <Link to='/login'>
              <Button type='primary' icon={<LoginOutlined />}>
                Login
              </Button>
            </Link>
            <Link to='/signup'>
              <Button>Sign Up</Button>
            </Link>
          </>
        )}
      </Space>
    </Header>
  )
}

export default AppHeader
