import { useState } from 'react'
import { Button, Card, Input, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'

type UserRow = {
  id: number
  email: string
  created_at: string
  plan_tier: string
}

const tiers = ['free', 'starter', 'pro']

const AdminUsers = () => {
  const [adminKey, setAdminKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<UserRow[]>([])

  const load = async () => {
    if (!adminKey) {
      message.error('Enter admin key')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/admin/users', {
        headers: { 'X-Admin-Key': adminKey },
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
    } catch {
      message.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const updateTier = async (id: number, tier: string) => {
    if (!adminKey) {
      message.error('Enter admin key')
      return
    }
    try {
      const res = await fetch(`/admin/users/${id}/tier?tier=${tier}`, {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
      })
      if (!res.ok) throw new Error('Failed')
      setData((prev) => prev.map((u) => (u.id === id ? { ...u, plan_tier: tier } : u)))
      message.success('Tier updated')
    } catch {
      message.error('Failed to update tier')
    }
  }

  const columns: ColumnsType<UserRow> = [
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at' },
    {
      title: 'Tier',
      dataIndex: 'plan_tier',
      key: 'plan_tier',
      render: (value: string, record) => (
        <Select value={value} onChange={(val) => updateTier(record.id, val)} style={{ width: 120 }}>
          {tiers.map((t) => (
            <Select.Option key={t} value={t}>
              {t}
            </Select.Option>
          ))}
        </Select>
      ),
    },
  ]

  return (
    <Card title='Users'>
      <Space direction='vertical' style={{ width: '100%' }} size='middle'>
        <Space>
          <Input.Password
            placeholder='Admin key'
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            style={{ minWidth: 280 }}
          />
          <Button onClick={load} loading={loading}>
            Load
          </Button>
        </Space>
        <Table
          rowKey='id'
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 20 }}
          loading={loading}
        />
      </Space>
    </Card>
  )
}

export default AdminUsers
