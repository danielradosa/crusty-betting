import { useEffect, useMemo, useRef, useState } from "react"
import {
    Card,
    Form,
    Input,
    Button,
    DatePicker,
    Select,
    Space,
    Typography,
    message,
    Spin,
    Alert,
    Col,
    Row,
    Divider,
    Statistic,
    AutoComplete,
} from "antd"
import { InfoCircleOutlined } from "@ant-design/icons"
import dayjs from "dayjs"
import { useAuthStore } from "../hooks/useAuth"
import type { ApiKey } from "../types"

const { Title, Text } = Typography

type PlayerSuggestion = {
    id: number
    name: string
    birthdate: string // YYYY-MM-DD
    sport: string
    country?: string | null
}

type AnalyzeFormValues = {
    apiKey: string
    sport: string
    player1_name: string
    player1_birthdate: any
    player2_name: string
    player2_birthdate: any
    match_date: any
}

const sportOptions = [
    { value: "tennis", label: "Tennis" },
    { value: "table-tennis", label: "Table Tennis" },
    { value: "boxing", label: "Boxing" },
    { value: "mma", label: "MMA" },
]

export default function Analyzer() {
    const [form] = Form.useForm<AnalyzeFormValues>()
    const { accessToken } = useAuthStore()

    const [keys, setKeys] = useState<ApiKey[]>([])
    const [keysLoading, setKeysLoading] = useState(true)

    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    const activeKeys = useMemo(() => keys.filter((k) => k.active), [keys])

    // --- Player search/autocomplete ---
    const [p1Options, setP1Options] = useState<any[]>([])
    const [p2Options, setP2Options] = useState<any[]>([])
    const p1Timer = useRef<number | null>(null)
    const p2Timer = useRef<number | null>(null)

    // --- Birthdate lock state ---
    const [p1BirthLocked, setP1BirthLocked] = useState(false)
    const [p2BirthLocked, setP2BirthLocked] = useState(false)

    // Track "selected" name so we can unlock if user edits it
    const p1SelectedNameRef = useRef<string>("")
    const p2SelectedNameRef = useRef<string>("")

    // Load API keys (JWT protected)
    useEffect(() => {
        const loadKeys = async () => {
            setKeysLoading(true)
            try {
                if (!accessToken) throw new Error("Not authenticated")

                const res = await fetch("/api-keys", {
                    headers: { Authorization: `Bearer ${accessToken}` },
                })

                if (!res.ok) {
                    const text = await res.text().catch(() => "")
                    throw new Error(text || "Failed to load API keys")
                }

                const data: ApiKey[] = await res.json()
                setKeys(data)

                const firstActive = data.find((k) => k.active)
                if (firstActive) form.setFieldsValue({ apiKey: firstActive.api_key })
            } catch {
                message.error("Failed to load API keys")
            } finally {
                setKeysLoading(false)
            }
        }

        loadKeys()
    }, [accessToken, form])

    const searchPlayers = async (q: string, sport: string): Promise<PlayerSuggestion[]> => {
        if (!q?.trim()) return []
        const url = `/api/v1/players?q=${encodeURIComponent(q)}&sport=${encodeURIComponent(sport || "")}`
        const res = await fetch(url)
        if (!res.ok) return []
        return res.json()
    }

    const makeAutocompleteOptions = (players: PlayerSuggestion[]) =>
        players.map((p) => ({
            value: p.name,
            label: (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{p.name}</span>
                    <span style={{ opacity: 0.65, fontSize: 12 }}>
                        {p.birthdate}
                        {p.country ? ` • ${p.country}` : ""}
                    </span>
                </div>
            ),
            player: p,
        }))

    const onSearchP1 = (text: string) => {
        const sport = form.getFieldValue("sport") || "tennis"
        if (p1Timer.current) window.clearTimeout(p1Timer.current)
        p1Timer.current = window.setTimeout(async () => {
            const players = await searchPlayers(text, sport)
            setP1Options(makeAutocompleteOptions(players))
        }, 250)
    }

    const onSearchP2 = (text: string) => {
        const sport = form.getFieldValue("sport") || "tennis"
        if (p2Timer.current) window.clearTimeout(p2Timer.current)
        p2Timer.current = window.setTimeout(async () => {
            const players = await searchPlayers(text, sport)
            setP2Options(makeAutocompleteOptions(players))
        }, 250)
    }

    const onSelectP1 = (_value: string, option: any) => {
        const p: PlayerSuggestion | undefined = option?.player
        if (p?.birthdate) {
            form.setFieldsValue({ player1_birthdate: dayjs(p.birthdate, "YYYY-MM-DD") })
            setP1BirthLocked(true)
            p1SelectedNameRef.current = p.name
        }
    }

    const onSelectP2 = (_value: string, option: any) => {
        const p: PlayerSuggestion | undefined = option?.player
        if (p?.birthdate) {
            form.setFieldsValue({ player2_birthdate: dayjs(p.birthdate, "YYYY-MM-DD") })
            setP2BirthLocked(true)
            p2SelectedNameRef.current = p.name
        }
    }

    // If user edits name away from selected -> unlock + clear birthdate (avoid wrong birthdate)
    const handlePlayer1NameChange = (val: string) => {
        if (p1BirthLocked && val !== p1SelectedNameRef.current) {
            setP1BirthLocked(false)
            p1SelectedNameRef.current = ""
            form.setFieldsValue({ player1_birthdate: null })
        }
    }

    const handlePlayer2NameChange = (val: string) => {
        if (p2BirthLocked && val !== p2SelectedNameRef.current) {
            setP2BirthLocked(false)
            p2SelectedNameRef.current = ""
            form.setFieldsValue({ player2_birthdate: null })
        }
    }

    const onSportChange = () => {
        setP1Options([])
        setP2Options([])

        // sport change invalidates player selection (since DB is sport scoped)
        setP1BirthLocked(false)
        setP2BirthLocked(false)
        p1SelectedNameRef.current = ""
        p2SelectedNameRef.current = ""

        // optional: clear player fields too for safety
        form.setFieldsValue({
            player1_name: "",
            player1_birthdate: null,
            player2_name: "",
            player2_birthdate: null,
        })
    }

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
            message.success("Analysis complete ✅")
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
                            <Select options={sportOptions} onChange={onSportChange} />
                        </Form.Item>

                        <Row gutter={16}>
                            <Col xs={24} md={12}>
                                <Form.Item label="Player 1 Name" name="player1_name" rules={[{ required: true }]}>
                                    <AutoComplete
                                        options={p1Options}
                                        onSearch={onSearchP1}
                                        onSelect={onSelectP1}
                                        onChange={handlePlayer1NameChange}
                                        placeholder="Type to search (e.g. Novak Djokovic)"
                                        filterOption={false}
                                    >
                                        <Input />
                                    </AutoComplete>
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    label={
                                        <Space>
                                            Player 1 Birthdate
                                            {p1BirthLocked && <Text type="secondary">(auto-filled)</Text>}
                                        </Space>
                                    }
                                    name="player1_birthdate"
                                    rules={[{ required: true }]}
                                >
                                    <DatePicker style={{ width: "100%" }} disabled={p1BirthLocked} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col xs={24} md={12}>
                                <Form.Item label="Player 2 Name" name="player2_name" rules={[{ required: true }]}>
                                    <AutoComplete
                                        options={p2Options}
                                        onSearch={onSearchP2}
                                        onSelect={onSelectP2}
                                        onChange={handlePlayer2NameChange}
                                        placeholder="Type to search (e.g. Rafael Nadal)"
                                        filterOption={false}
                                    >
                                        <Input />
                                    </AutoComplete>
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    label={
                                        <Space>
                                            Player 2 Birthdate
                                            {p2BirthLocked && <Text type="secondary">(auto-filled)</Text>}
                                        </Space>
                                    }
                                    name="player2_birthdate"
                                    rules={[{ required: true }]}
                                >
                                    <DatePicker style={{ width: "100%" }} disabled={p2BirthLocked} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item label="Match Date" name="match_date" rules={[{ required: true }]}>
                            <DatePicker style={{ width: "100%" }} />
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
                <Card style={{ marginTop: 24 }}>
                    <Title level={3} style={{ marginBottom: 16 }}>
                        🏆 Prediction Result
                    </Title>

                    <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col xs={24} md={8}>
                            <Card bordered>
                                <Statistic title="Predicted Winner" value={result.winner_prediction} />
                            </Card>
                        </Col>

                        <Col xs={24} md={8}>
                            <Card bordered>
                                <Statistic title="Confidence" value={String(result.confidence || "").replace("_", " ")} />
                            </Card>
                        </Col>

                        <Col xs={24} md={8}>
                            <Card bordered>
                                <Statistic title="Score Difference" value={result.score_difference} prefix="Δ" />
                            </Card>
                        </Col>
                    </Row>

                    <Card style={{ marginBottom: 16 }} type="inner">
                        <Space align="start">
                            <InfoCircleOutlined style={{ marginTop: 4 }} />
                            <Text>
                                <strong>How scoring works:</strong> Higher total score = more likely to win
                                (according to numerological alignment for the selected match date).
                            </Text>
                        </Space>
                    </Card>

                    <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col xs={24} md={12}>
                            <Card title={`👤 ${result.player1?.name || "Player 1"}`} bordered>
                                <p><strong>Life Path:</strong> {result.player1?.life_path}</p>
                                <p><strong>Expression:</strong> {result.player1?.expression}</p>
                                <p><strong>Personal Year:</strong> {result.player1?.personal_year}</p>
                                <p><strong>Total Score:</strong> {result.player1?.score}</p>

                                {result.player1?.reasons?.length > 0 && (
                                    <>
                                        <Divider />
                                        <ul style={{ paddingLeft: 16 }}>
                                            {result.player1.reasons.map((r: string, i: number) => (
                                                <li key={i}>{r}</li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </Card>
                        </Col>

                        <Col xs={24} md={12}>
                            <Card title={`👤 ${result.player2?.name || "Player 2"}`} bordered>
                                <p><strong>Life Path:</strong> {result.player2?.life_path}</p>
                                <p><strong>Expression:</strong> {result.player2?.expression}</p>
                                <p><strong>Personal Year:</strong> {result.player2?.personal_year}</p>
                                <p><strong>Total Score:</strong> {result.player2?.score}</p>

                                {result.player2?.reasons?.length > 0 && (
                                    <>
                                        <Divider />
                                        <ul style={{ paddingLeft: 16 }}>
                                            {result.player2.reasons.map((r: string, i: number) => (
                                                <li key={i}>{r}</li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </Card>
                        </Col>
                    </Row>

                    <Card style={{ marginBottom: 16 }} bordered type="inner" title="💰 Betting Recommendation">
                        <p><strong>Suggested Bet Size:</strong> {result.bet_size}</p>
                        <p><strong>Recommendation:</strong> {result.recommendation}</p>
                    </Card>

                    <Card type="inner" title="📝 Analysis Summary">
                        <Text style={{ whiteSpace: "pre-line" }}>{result.analysis_summary}</Text>
                    </Card>
                </Card>
            )}
        </div>
    )
}