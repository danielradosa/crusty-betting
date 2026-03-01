import { useState } from 'react'
import { Button, Card, Input, Space, Table, message, Tag, Popconfirm, Modal, Select, Switch } from 'antd'
import type { ColumnsType } from 'antd/es/table'

type UnverifiedPlayer = {
  id: number
  name: string
  birthdate: string
  sport: string
  verified: boolean
}

const AdminPlayers = () => {
  const [adminKey, setAdminKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<UnverifiedPlayer[]>([])
  const [editing, setEditing] = useState<UnverifiedPlayer | null>(null)
  const [editName, setEditName] = useState('')
  const [editBirthdate, setEditBirthdate] = useState('')
  const [editSport, setEditSport] = useState('tennis')
  const [editVerified, setEditVerified] = useState(false)

  const [showVerified, setShowVerified] = useState(false)

  const load = async () => {
    if (!adminKey) {
      message.error('Enter admin key')
      return
    }
    setLoading(true)
    try {
      const url = showVerified ? '/admin/players' : '/admin/players?verified=false'
      const res = await fetch(url, {
        headers: { 'X-Admin-Key': adminKey },
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
    } catch {
      message.error('Failed to load players')
    } finally {
      setLoading(false)
    }
  }

  const verify = async (id: number) => {
    if (!adminKey) {
      message.error('Enter admin key')
      return
    }
    try {
      const res = await fetch(`/admin/unverified-players/${id}/verify`, {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
      })
      if (!res.ok) throw new Error('Failed')
      message.success('Player verified')
      load()
    } catch {
      message.error('Failed to verify')
    }
  }

  const remove = async (id: number) => {
    if (!adminKey) {
      message.error('Enter admin key')
      return
    }
    try {
      const res = await fetch(`/admin/players/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': adminKey },
      })
      if (!res.ok) throw new Error('Failed')
      message.success('Player deleted')
      load()
    } catch {
      message.error('Failed to delete')
    }
  }

  const openEdit = (p: UnverifiedPlayer) => {
    setEditing(p)
    setEditName(p.name)
    setEditBirthdate(p.birthdate)
    setEditSport(p.sport)
    setEditVerified(p.verified)
  }

  const saveEdit = async () => {
    if (!adminKey || !editing) {
      message.error('Enter admin key')
      return
    }
    try {
      const res = await fetch(`/admin/players/${editing.id}`, {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          birthdate: editBirthdate,
          sport: editSport,
          verified: editVerified,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      message.success('Player updated')
      setEditing(null)
      load()
    } catch {
      message.error('Failed to update')
    }
  }

  const columns: ColumnsType<UnverifiedPlayer> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'DOB', dataIndex: 'birthdate', key: 'birthdate' },
    { title: 'Sport', dataIndex: 'sport', key: 'sport', render: (v) => <Tag>{v}</Tag> },
    { title: 'Verified', dataIndex: 'verified', key: 'verified', render: (v) => (v ? <Tag color='green'>Yes</Tag> : <Tag color='red'>No</Tag>) },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          {!record.verified && (
            <Button type='primary' size='small' onClick={() => verify(record.id)}>
              Verify
            </Button>
          )}
          <Button size='small' onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Popconfirm title='Delete player?' onConfirm={() => remove(record.id)}>
            <Button size='small' danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card title='Unverified Players'>
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
          <Space>
            <span>Show verified</span>
            <Switch checked={showVerified} onChange={(v) => setShowVerified(v)} />
          </Space>
        </Space>
        <Table
          rowKey='id'
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 20 }}
          loading={loading}
        />
      </Space>

      <Modal
        open={!!editing}
        title='Edit player'
        onCancel={() => setEditing(null)}
        onOk={saveEdit}
      >
        <Space direction='vertical' style={{ width: '100%' }}>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder='Name' />
          <Input value={editBirthdate} onChange={(e) => setEditBirthdate(e.target.value)} placeholder='YYYY-MM-DD' />
          <Select value={editSport} onChange={(v) => setEditSport(v)}>
            <Select.Option value='tennis'>tennis</Select.Option>
            <Select.Option value='table-tennis'>table-tennis</Select.Option>
          </Select>
          <Space>
            <span>Verified</span>
            <Switch checked={editVerified} onChange={(v) => setEditVerified(v)} />
          </Space>
        </Space>
      </Modal>
    </Card>
  )
}

export default AdminPlayers
