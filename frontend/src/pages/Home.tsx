import { Typography, Row, Col, Card, List, Space } from 'antd'
import {
    ThunderboltOutlined,
    LockOutlined,
    BarChartOutlined,
    ApiOutlined,
} from '@ant-design/icons'
import DemoAnalyzer from '../components/MatchAnalyzer/DemoAnalyzer'

const { Title, Paragraph } = Typography

const features = [
    {
        icon: <ThunderboltOutlined />,
        title: 'Numerology Analysis',
        description: 'Life Path, Personal Year, Universal Cycles, Name Expression',
    },
    {
        icon: <BarChartOutlined />,
        title: 'Match Prediction',
        description: 'Predict winners with confidence scores for 1:1 sports',
    },
    {
        icon: <LockOutlined />,
        title: 'Secure Authentication',
        description: 'JWT sessions and API key-based access',
    },
    {
        icon: <ApiOutlined />,
        title: 'REST API',
        description: 'Simple JSON API for your own apps and tools',
    },
]

function Home() {
    return (
        <div>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <Title>🔮 SPORTOLOGY + API</Title>
                <Paragraph style={{ fontSize: 18, maxWidth: 640, margin: '0 auto' }}>
                    Analyze sports matches using numerology and get betting-oriented insights
                    with confidence scores and recommendations.
                </Paragraph>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} lg={16}>
                    <DemoAnalyzer />
                </Col>
                <Col xs={24} lg={8}>
                    <Card title='Features'>
                        <List
                            itemLayout='horizontal'
                            dataSource={features}
                            renderItem={(item) => (
                                <List.Item>
                                    <List.Item.Meta
                                        avatar={<Space style={{ fontSize: 24 }}>{item.icon}</Space>}
                                        title={item.title}
                                        description={item.description}
                                    />
                                </List.Item>
                            )}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    )
}

export default Home
