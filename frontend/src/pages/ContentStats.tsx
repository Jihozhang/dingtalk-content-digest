import React, { useEffect, useState } from 'react'
import { Card, Table, Row, Col, DatePicker, Select, Statistic, message, Spin } from 'antd'
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

  const participantColumns = [
    { title: '成员', dataIndex: 'sender_name' },
    {
      title: 'Staff ID',
      dataIndex: 'sender_staff_id',
      ellipsis: true,
      responsive: ['lg'] as any,
    },
    { title: '消息数', dataIndex: 'message_count', width: 90, align: 'center' as const },
    { title: '活跃天数', dataIndex: 'active_days', width: 90, align: 'center' as const },
    {
      title: '最近发言',
      dataIndex: 'last_message_time',
      width: 160,
      render: (ts: number | null) => formatTs(ts),
    },
  ]

  const groupColumns = [
    { title: '群聊', dataIndex: 'group_name' },
    { title: '消息数', dataIndex: 'message_count', width: 90, align: 'center' as const },
    { title: '活跃人数', dataIndex: 'active_users', width: 90, align: 'center' as const },
    {
      title: '最近活跃',
      dataIndex: 'last_message_time',
      width: 160,
      render: (ts: number | null) => formatTs(ts),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>内容分析</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
        </div>
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="消息总数" value={overview?.total_messages || 0} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="活跃用户" value={overview?.active_users || 0} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="今日消息" value={overview?.today_messages || 0} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="日均消息" value={overview?.avg_messages_per_day || 0} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <Card title="消息量趋势">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="消息量" stroke="#1677ff" fill="#1677ff" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="活跃人数" stroke="#52c41a" fill="#52c41a" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="24 小时活跃时段">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hoursData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" interval={2} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="消息量" fill="#722ed1" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title="高频关键词 (Top 20)">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={keywordData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="word" width={70} />
                  <Tooltip />
                  <Bar dataKey="次数" fill="#fa8c16" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="成员参与度排行">
              <Table
                columns={participantColumns}
                dataSource={participants}
                rowKey="sender_staff_id"
                pagination={{ pageSize: 8 }}
                size="small"
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Card title="各群活跃度对比">
              <Table
                columns={groupColumns}
                dataSource={groupActivity}
                rowKey="conversation_id"
                pagination={{ pageSize: 10 }}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}

export default ContentStatsPage
