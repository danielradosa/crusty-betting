import { useState } from 'react'
import { Card, Form, Input, Button, Alert, Typography } from 'antd'
import {
  UserOutlined,
  LockOutlined,
  LoginOutlined,
} from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const { Title } = Typography

function Login() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      await login(values.email, values.password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '64px auto' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>
            <LoginOutlined /> Login
          </Title>
        </div>

        {error && (
          <Alert
            message={error}
            type='error'
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={form}
          name='login'
          onFinish={onFinish}
          autoComplete='off'
          layout='vertical'
        >
          <Form.Item
            name='email'
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder='Email'
              size='large'
            />
          </Form.Item>

          <Form.Item
            name='password'
            rules={[
              { required: true, message: 'Please input your password!' },
              { min: 8, message: 'Password must be at least 8 characters!' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder='Password'
              size='large'
            />
          </Form.Item>

          <Form.Item>
            <Button
              type='primary'
              htmlType='submit'
              loading={loading}
              size='large'
              block
            >
              Login
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            Don&apos;t have an account? <Link to='/signup'>Sign up</Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default Login
