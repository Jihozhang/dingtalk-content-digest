import React, { useEffect, useState } from 'react'
import { Table, Row, Col, DatePicker, Select, message, Spin, Empty, Tag, Button } from 'antd'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  MessageOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  FireOutlined,
  GlobalOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getContentOverview,
  getMessageVolume,
  getActiveHours,
  getParticipants,
  getKeywords,
  getGroupActivity,
  getGroups,
  type ContentOverview,
  type VolumePoint,
  type ActiveHourPoint,
  type ParticipantStat,
  type KeywordStat,
  type GroupActivityStat,
  type Group,
} from '../api'
import '../styles/design-system.css'

const { RangePicker } = DatePicker

const formatTs = (ts: number | null) =>
  ts ? dayjs(ts).format('YYYY-MM-DD HH:mm') : '-'

const ContentStatsPage: React.FC = () => {
  const [overview, setOverview] = useState<ContentOverview | null>(null)
  const [volume, setVolume] = useState<VolumePoint[]>([])
  const [hours, setHours] = useState<ActiveHourPoint[]>([])
  const [participants, setParticipants] = useState<ParticipantStat[]>([])
  const [keywords, setKeywords] = useState<KeywordStat[]>([])
  const [groupActivity, setGroupActivity] = useState<GroupActivityStat[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined)

  useEffect(() => {
    fetchGroups()
  }, [])

  useEffect(() => {
    fetchAll()
  }, [dateRange, selectedGroup])

  const buildParams = () => {
    const params: { conversation_id?: string; start_date?: string; end_date?: string } = {}
    if (selectedGroup) params.conversation_id = selectedGroup
    if (dateRange && dateRange[0] && dateRange[1]) {
      params.start_date = dateRange[0].format('YYYY-MM-DD')
      params.end_date = dateRange[1].format('YYYY-MM-DD')
    }
    return params
  }

  const fetchGroups = async () => {
    try {
      const res = await getGroups()
      setGroups(res.data)
    } catch (error) {
      console.error('获取群聊失败:', error)
    }
  }

  const fetchAll = async () => {
    setLoading(true)
    const params = buildParams()
    const rangeParams = { start_date: params.start_date, end_date: params.end_date }
    try {
      const [ov, vol, hrs, parts, kws, ga] = await Promise.all([
        getContentOverview(params),
        getMessageVolume(params),
        getActiveHours(params),
        getParticipants({ ...params, limit: 50 }),
        getKeywords({ ...params, limit: 50 }),
        getGroupActivity(rangeParams),
      ])
      setOverview(ov.data)
      setVolume(vol.data)
      setHours(hrs.data)
      setParticipants(parts.data)
      setKeywords(kws.data)
      setGroupActivity(ga.data)
    } catch (error) {
      message.error('获取内容统计失败')
    } finally {
      setLoading(false)
    }
  }

  const volumeData = volume.map((v) => ({
    date: v.date.slice(5),
    消息量: v.message_count,
    活跃人数: v.active_users,
  }))

  const hoursData = hours.map((h) => ({
    hour: `${h.hour}时`,
    消息量: h.message_count,
  }))

  const keywordData = keywords.slice(0, 20).map((k) => ({
    word: k.word,
    次数: k.count,
  }))

  const statCards = [
    {
      title: '消息总数',
      value: overview?.total_messages || 0,
      icon: <MessageOutlined />,
      color: 'blue',
    },
    {
      title: '活跃用户',
      value: overview?.active_users || 0,
      icon: <TeamOutlined />,
      color: 'green',
    },
    {
      title: '今日消息',
      value: overview?.today_messages || 0,
      icon: <ClockCircleOutlined />,
      color: 'orange',
    },
    {
      title: '日均消息',
      value: overview?.avg_messages_per_day || 0,
      icon: <RiseOutlined />,
      color: 'purple',
    },
  ]

  const participantColumns = [
    {
      title: '成员',
      dataIndex: 'sender_name',
      render: (name: string, record: ParticipantStat) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: `hsl(${(record.sender_staff_id.charCodeAt(0) * 30) % 360}, 70%, 85%)`,
              color: `hsl(${(record.sender_staff_id.charCodeAt(0) * 30) % 360}, 70%, 35%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {name.slice(0, 1).toUpperCase()}
          </div>
          <span style={{ fontWeight: 500 }}>{name}</span>
        </div>
      ),
    },
    {
      title: 'Staff ID',
      dataIndex: 'sender_staff_id',
      ellipsis: true,
      responsive: ['lg'] as any,
      render: (id: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{id}</span>
      ),
    },
    {
      title: '消息数',
      dataIndex: 'message_count',
      width: 90,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue" style={{ fontWeight: 600 }}>{v}</Tag>,
    },
    {
      title: '活跃天数',
      dataIndex: 'active_days',
      width: 90,
      align: 'center' as const,
      render: (v: number) => <Tag color="green" style={{ fontWeight: 600 }}>{v}</Tag>,
    },
    {
      title: '最近发言',
      dataIndex: 'last_message_time',
      width: 160,
      render: (ts: number | null) => formatTs(ts),
    },
  ]

  const groupColumns = [
    {
      title: '群聊',
      dataIndex: 'group_name',
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: '消息数',
      dataIndex: 'message_count',
      width: 90,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue" style={{ fontWeight: 600 }}>{v}</Tag>,
    },
    {
      title: '活跃人数',
      dataIndex: 'active_users',
      width: 90,
      align: 'center' as const,
      render: (v: number) => <Tag color="green" style={{ fontWeight: 600 }}>{v}</Tag>,
    },
    {
      title: '最近活跃',
      dataIndex: 'last_message_time',
      width: 160,
      render: (ts: number | null) => formatTs(ts),
    },
  ]

  return (
    <div className="animate-fade-in">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h2>
            <MessageOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            内容分析
          </h2>
          <div className="subtitle">群聊消息量、活跃时段、关键词与成员参与度分析</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Select
            placeholder="全部群聊"
            allowClear
            style={{ width: 200 }}
            value={selectedGroup}
            onChange={setSelectedGroup}
            options={groups.map((g) => ({ label: g.name, value: g.conversation_id }))}
          />
          <RangePicker
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            placeholder={['开始日期', '结束日期']}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>
            刷新
          </Button>
        </div>
      </div>

      <Spin spinning={loading}>
        {/* 概览统计 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {statCards.map((card, index) => (
            <Col xs={12} md={6} key={index}>
              <div className="stat-card">
                <div className="stat-header">
                  <div className="stat-label">{card.title}</div>
                  <div className={`stat-icon ${card.color}`}>{card.icon}</div>
                </div>
                <div className="stat-body">
                  <div className="stat-value">{card.value}</div>
                </div>
              </div>
            </Col>
          ))}
        </Row>

        {/* 图表区域 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <div className="content-card">
              <div className="card-header">
                <h3>
                  <RiseOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                  消息量趋势
                </h3>
              </div>
              <div className="card-body">
                {volumeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={volumeData}>
                      <defs>
                        <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1677ff" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#52c41a" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      <Legend />
                      <Area type="monotone" dataKey="消息量" stroke="#1677ff" fill="url(#colorVol)" strokeWidth={2} />
                      <Area type="monotone" dataKey="活跃人数" stroke="#52c41a" fill="url(#colorUsers)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="暂无数据" />
                )}
              </div>
            </div>
          </Col>
          <Col xs={24} lg={10}>
            <div className="content-card">
              <div className="card-header">
                <h3>
                  <ClockCircleOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                  24 小时活跃时段
                </h3>
              </div>
              <div className="card-body">
                {hoursData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={hoursData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="hour" interval={2} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      <Bar dataKey="消息量" fill="#722ed1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="暂无数据" />
                )}
              </div>
            </div>
          </Col>
        </Row>

        {/* 关键词和参与度 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <div className="content-card">
              <div className="card-header">
                <h3>
                  <FireOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                  高频关键词 (Top 20)
                </h3>
              </div>
              <div className="card-body">
                {keywordData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={keywordData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} />
                      <YAxis type="category" dataKey="word" width={70} tick={{ fontSize: 12, fill: '#4b5563' }} axisLine={{ stroke: '#e5e7eb' }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      <Bar dataKey="次数" fill="#fa8c16" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="暂无数据" />
                )}
              </div>
            </div>
          </Col>
          <Col xs={24} lg={12}>
            <div className="content-card">
              <div className="card-header">
                <h3>
                  <TeamOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                  成员参与度排行
                </h3>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <Table
                  className="pro-table"
                  columns={participantColumns}
                  dataSource={participants}
                  rowKey="sender_staff_id"
                  pagination={{ pageSize: 8 }}
                  size="small"
                  locale={{ emptyText: <Empty description="暂无数据" /> }}
                />
              </div>
            </div>
          </Col>
        </Row>

        {/* 群活跃度对比 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <div className="content-card">
              <div className="card-header">
                <h3>
                  <GlobalOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                  各群活跃度对比
                </h3>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <Table
                  className="pro-table"
                  columns={groupColumns}
                  dataSource={groupActivity}
                  rowKey="conversation_id"
                  pagination={{ pageSize: 10 }}
                  size="small"
                  locale={{ emptyText: <Empty description="暂无数据" /> }}
                />
              </div>
            </div>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}

export default ContentStatsPage
