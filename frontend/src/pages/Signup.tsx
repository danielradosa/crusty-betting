import { useState } from 'react'
import { Card, Form, Input, Button, Alert, Typography } from 'antd'
import {
  UserOutlined,
  LockOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const { Title } = Typography

function Signup() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const onFinish = async (values: {
    email: string
    password: string
    confirmPassword: string
  }) => {
    if (values.password !== values.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await signup(values.email, values.password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='auth-card-wrap'>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>
            <UserAddOutlined /> Sign Up
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
          name='signup'
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

          <Form.Item
            name='confirmPassword'
            rules={[{ required: true, message: 'Please confirm your password!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder='Confirm Password'
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
              Sign Up
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            Already have an account? <Link to='/login'>Login</Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default Signup
