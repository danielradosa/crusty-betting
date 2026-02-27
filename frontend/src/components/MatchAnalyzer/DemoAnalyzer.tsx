import { useState } from 'react'
import {
  Card,
  Form,
  Input,
  DatePicker,
  Select,
  Button,
  Alert,
  Spin,
  Descriptions,
  Tag,
  Space,
  Divider,
  Typography,
  Row,
  Col,
} from 'antd'
import { DotChartOutlined } from '@ant-design/icons'
import { MatchAnalysisRequest, DemoMatchAnalysisResponse } from '../../types'
import dayjs from 'dayjs'
import { demoAnalyze } from '../../services/analysisService'
import { ApiError } from '../../services/apiClient'

const { Option } = Select
const { Title, Text } = Typography

const sports = [
  { value: 'tennis', label: '🎾 Tennis' },
  { value: 'table-tennis', label: '🏓 Table Tennis' },
  { value: 'boxing', label: '🥊 Boxing' },
  { value: 'mma', label: '🥋 MMA' },
]

function DemoAnalyzer() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DemoMatchAnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onFinish = async (values: any) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const request: MatchAnalysisRequest = {
        player1_name: values.player1_name,
        player1_birthdate: values.player1_birthdate.format('YYYY-MM-DD'),
        player2_name: values.player2_name,
        player2_birthdate: values.player2_birthdate.format('YYYY-MM-DD'),
        match_date: values.match_date.format('YYYY-MM-DD'),
        sport: values.sport,
      }

      const data = await demoAnalyze(request)
      setResult(data)
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 429 && typeof err.details === 'object') {
        const detail = err.details as any
        const resetInfo = detail?.reset_time ? ` Resets at: ${new Date(detail.reset_time).toLocaleString()}.` : ''
        setError((err.message || 'Demo limit reached.') + resetInfo)
      } else {
        setError(err.message || 'An error occurred during analysis')
      }
    } finally {
      setLoading(false)
    }
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'VERY_HIGH':
        return 'success'
      case 'HIGH':
        return 'processing'
      case 'MODERATE':
        return 'warning'
      default:
        return 'default'
    }
  }

  return (
    <Card title={<><DotChartOutlined /> Try Demo Analysis</>}>
      <Form
        form={form}
        layout='vertical'
        onFinish={onFinish}
        initialValues={{
          match_date: dayjs(),
          sport: 'tennis',
        }}
      >
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name='player1_name' label='Player 1 Name' rules={[{ required: true }]}>
              <Input placeholder='e.g., Novak Djokovic' />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name='player1_birthdate' label='Player 1 Birthdate' rules={[{ required: true }]}>
              <DatePicker format='L' inputReadOnly style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name='player2_name' label='Player 2 Name' rules={[{ required: true }]}>
              <Input placeholder='e.g., Carlos Alcaraz' />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name='player2_birthdate' label='Player 2 Birthdate' rules={[{ required: true }]}>
              <DatePicker format='L' inputReadOnly style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name='match_date' label='Match Date' rules={[{ required: true }]}>
              <DatePicker format='L' inputReadOnly style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name='sport' label='Sport' rules={[{ required: true }]}>
              <Select>
                {sports.map((sport) => (
                  <Option key={sport.value} value={sport.value}>
                    {sport.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type='primary' htmlType='submit' loading={loading} size='large'>
            Analyze Match
          </Button>
        </Form.Item>
      </Form>

      {error && <Alert message='Error' description={error} type='error' showIcon style={{ marginTop: 16 }} />}

      {loading && <Spin tip='Analyzing...' style={{ display: 'block', marginTop: 16 }} />}

      {result && (
        <>
          <Divider />
          <Title level={4}>Analysis Result</Title>

          <Alert
            message={
              <Space wrap>
                <span>Winner Prediction:</span>
                <Text strong style={{ fontSize: 18 }}>
                  {result.winner_prediction}
                </Text>
                <Tag color={getConfidenceColor(result.confidence)}>{result.confidence}</Tag>
              </Space>
            }
            description={result.analysis_summary}
            type='info'
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Descriptions title='Match Details' bordered column={1} size='small'>
            <Descriptions.Item label='Sport'>{result.sport}</Descriptions.Item>
            <Descriptions.Item label='Match Date'>{result.match_date}</Descriptions.Item>
            <Descriptions.Item label='Recommendation'>{result.recommendation}</Descriptions.Item>
            <Descriptions.Item label='Bet Size'>{result.bet_size}</Descriptions.Item>
          </Descriptions>
        </>
      )}

      {result?.note && <Alert style={{ marginTop: 12 }} type='warning' showIcon message={result.note} />}
    </Card>
  )
}

export default DemoAnalyzer
