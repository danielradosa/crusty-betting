import { useEffect, useMemo, useState } from "react"
import { Card, Form, Input, Button, DatePicker, Select, Space, Typography, message, Spin, Alert } from "antd"
import dayjs from "dayjs"
import { useAuthStore } from "../hooks/useAuth"
import type { ApiKey } from "../types"

const { Title, Text } = Typography

type AnalyzeFormValues = {
  apiKey: string
  sport: string
  player1_name: string
  player1_birthdate: any
  player2_name: string
  player2_birthdate: any
  match_date: any
}

export default function Analyzer() {
  const [form] = Form.useForm<AnalyzeFormValues>()
  const { accessToken } = useAuthStore()

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(true)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const activeKeys = useMemo(() => keys.filter((k) => k.active), [keys])

  useEffect(() => {
    const loadKeys = async () => {
      setKeysLoading(true)
      try {
        if (!accessToken) throw new Error("Not authenticated")

        const res = await fetch("/api-keys", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setKeys(data)

        // auto-pick first active key
        const firstActive = data.find((k: ApiKey) => k.active)
        if (firstActive) form.setFieldsValue({ apiKey: firstActive.api_key })
      } catch (e: any) {
        message.error("Failed to load API keys")
      } finally {
        setKeysLoading(false)
      }
    }

    loadKeys()
  }, [accessToken, form])

  const onFinish = async (values: AnalyzeFormValues) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const apiKey = values.apiKey
      if (!apiKey) throw new Error("Please select an API key")

      const payload = {
        player1_name: values.player1_name,
        player1_birthdate: values.player1_birthdate.format("YYYY-MM-DD"),
        player2_name: values.player2_name,
        player2_birthdate: values.player2_birthdate.format("YYYY-MM-DD"),
        match_date: values.match_date.format("YYYY-MM-DD"),
        sport: values.sport,
      }

      const res = await fetch("/api/v1/analyze-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || "Analysis failed")
      }

      const data = await res.json()
      setResult(data)
      message.success("Analysis complete")
    } catch (e: any) {
      setError(e?.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Title level={2}>Match Analyzer</Title>

      <Card>
        {keysLoading ? (
          <Spin tip="Loading API keys..." />
        ) : activeKeys.length === 0 ? (
          <Alert
            type="warning"
            showIcon
            message="No active API keys"
            description="Create an API key in the Dashboard first (or re-activate one)."
          />
        ) : (
          <Form
            form={form}
            layout="vertical"
            initialValues={{ sport: "tennis", match_date: dayjs() }}
            onFinish={onFinish}
          >
            <Form.Item
              label="API Key"
              name="apiKey"
              rules={[{ required: true, message: "Select an API key" }]}
            >
              <Select
                placeholder="Select API key"
                options={activeKeys.map((k) => ({
                  value: k.api_key,
                  label: `${k.name || "Key"} (${k.api_key.slice(0, 8)}...${k.api_key.slice(-4)})`,
                }))}
              />
            </Form.Item>

            <Form.Item label="Sport" name="sport" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: "tennis", label: "Tennis" },
                  { value: "table-tennis", label: "Table Tennis" },
                  { value: "boxing", label: "Boxing" },
                  { value: "mma", label: "MMA" },
                ]}
              />
            </Form.Item>

            <Space style={{ width: "100%" }} size="large" align="start">
              <Form.Item label="Player 1 Name" name="player1_name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Novak Djokovic" />
              </Form.Item>
              <Form.Item label="Player 1 Birthdate" name="player1_birthdate" rules={[{ required: true }]}>
                <DatePicker />
              </Form.Item>
            </Space>

            <Space style={{ width: "100%" }} size="large" align="start">
              <Form.Item label="Player 2 Name" name="player2_name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Rafael Nadal" />
              </Form.Item>
              <Form.Item label="Player 2 Birthdate" name="player2_birthdate" rules={[{ required: true }]}>
                <DatePicker />
              </Form.Item>
            </Space>

            <Form.Item label="Match Date" name="match_date" rules={[{ required: true }]}>
              <DatePicker />
            </Form.Item>

            {error && (
              <Alert style={{ marginBottom: 12 }} type="error" showIcon message="Error" description={error} />
            )}

            <Button type="primary" htmlType="submit" loading={loading} disabled={activeKeys.length === 0}>
              Analyze Match
            </Button>
          </Form>
        )}
      </Card>

      {result && (
        <Card style={{ marginTop: 16 }} title="Result">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>
          <Text type="secondary">Tip: we can render this nicely (winner/confidence/recommendation) next 😄</Text>
        </Card>
      )}
    </div>
  )
}