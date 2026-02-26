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
} from 'antd'
import AnalysisOutlined from '@ant-design/icons'
import { MatchAnalysisRequest, MatchAnalysisResponse } from '../../types'
import dayjs from 'dayjs'

const { Option } = Select
const { Title, Text } = Typography

const sports = [
    { value: 'tennis', label: '🎾 Tennis' },
    { value: 'table_tennis', label: '🏓 Table Tennis' },
    { value: 'boxing', label: '🥊 Boxing' },
    { value: 'mma', label: '🥋 MMA' },
    { value: 'basketball', label: '🏀 Basketball' },
    { value: 'football', label: '⚽ Football' },
]

function DemoAnalyzer() {
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<MatchAnalysisResponse | null>(null)
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

            const response = await fetch('/api/v1/demo-analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            })

            if (!response.ok) {
                throw new Error('Analysis failed')
            }

            const data: MatchAnalysisResponse = await response.json()
            setResult(data)
        } catch (err: any) {
            setError(err.message || 'An error occurred during analysis')
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
        <Card title={<><AnalysisOutlined /> Try Demo Analysis</>}>
            <Form
                form={form}
                layout='vertical'
                onFinish={onFinish}
                initialValues={{
                    match_date: dayjs(),
                    sport: 'tennis',
                }}
            >
                <Space direction='vertical' style={{ width: '100%' }} size='large'>
                    <Space wrap style={{ width: '100%' }}>
                        <Form.Item
                            name='player1_name'
                            label='Player 1 Name'
                            rules={[{ required: true }]}
                            style={{ width: 250 }}
                        >
                            <Input placeholder='e.g., Novak Djokovic' />
                        </Form.Item>

                        <Form.Item
                            name='player1_birthdate'
                            label='Player 1 Birthdate'
                            rules={[{ required: true }]}
                        >
                            <DatePicker format='YYYY-MM-DD' />
                        </Form.Item>
                    </Space>

                    <Space wrap style={{ width: '100%' }}>
                        <Form.Item
                            name='player2_name'
                            label='Player 2 Name'
                            rules={[{ required: true }]}
                            style={{ width: 250 }}
                        >
                            <Input placeholder='e.g., Carlos Alcaraz' />
                        </Form.Item>

                        <Form.Item
                            name='player2_birthdate'
                            label='Player 2 Birthdate'
                            rules={[{ required: true }]}
                        >
                            <DatePicker format='YYYY-MM-DD' />
                        </Form.Item>
                    </Space>

                    <Space wrap style={{ width: '100%' }}>
                        <Form.Item
                            name='match_date'
                            label='Match Date'
                            rules={[{ required: true }]}
                        >
                            <DatePicker format='YYYY-MM-DD' />
                        </Form.Item>

                        <Form.Item
                            name='sport'
                            label='Sport'
                            rules={[{ required: true }]}
                            style={{ width: 200 }}
                        >
                            <Select>
                                {sports.map((sport) => (
                                    <Option key={sport.value} value={sport.value}>
                                        {sport.label}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Space>

                    <Form.Item>
                        <Button type='primary' htmlType='submit' loading={loading} size='large'>
                            Analyze Match
                        </Button>
                    </Form.Item>
                </Space>
            </Form>

            {error && (
                <Alert
                    message='Error'
                    description={error}
                    type='error'
                    showIcon
                    style={{ marginTop: 16 }}
                />
            )}

            {loading && (
                <Spin tip='Analyzing...' style={{ display: 'block', marginTop: 16 }} />
            )}

            {result && (
                <>
                    <Divider />
                    <Title level={4}>Analysis Result</Title>

                    <Alert
                        message={
                            <Space>
                                <span>Winner Prediction:</span>
                                <Text strong style={{ fontSize: 18 }}>
                                    {result.winner_prediction}
                                </Text>
                                <Tag color={getConfidenceColor(result.confidence)}>
                                    {result.confidence}
                                </Tag>
                            </Space>
                        }
                        description={result.analysis_summary}
                        type='info'
                        showIcon
                        style={{ marginBottom: 16 }}
                    />

                    <Descriptions title='Match Details' bordered column={1}>
                        <Descriptions.Item label='Sport'>{result.sport}</Descriptions.Item>
                        <Descriptions.Item label='Match Date'>{result.match_date}</Descriptions.Item>
                        <Descriptions.Item label='Recommendation'>
                            {result.recommendation}
                        </Descriptions.Item>
                        <Descriptions.Item label='Bet Size'>{result.bet_size}</Descriptions.Item>
                    </Descriptions>
                </>
            )}
        </Card>
    )
}

export default DemoAnalyzer
