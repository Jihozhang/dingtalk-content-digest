import React, { useEffect, useState } from 'react'
import {
  Table,
  Row,
  Col,
  DatePicker,
  Select,
  message,
  Spin,
  Badge,
  Empty,
  Button,
  Tag,
  Space,
  Tabs,
} from 'antd'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts'
import {
  BarChartOutlined,
  TeamOutlined,
  UserOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  FireOutlined,
  GlobalOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getDailyStats,
  getGroupStats,
  getUserStats,
  getGroups,
  getContentOverview,
  getMessageVolume,
  getActiveHours,
  getParticipants,
  getKeywords,
  getGroupActivity,
  type DailyStats,
  type GroupStats,
  type UserStats,
  type Group,
  type ContentOverview,
  type VolumePoint,
  type ActiveHourPoint,
  type ParticipantStat,
  type KeywordStat,
  type GroupActivityStat,
} from '../api'
import '../styles/design-system.css'

const { RangePicker } = DatePicker

const COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1', '#13c2c2']

const formatTs = (ts: number | null) =>
  ts ? dayjs(ts).format('YYYY-MM-DD HH:mm') : '-'

const StatsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'submit' | 'content'>('submit')

  // ==================== 数据提交统计状态 ====================
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [groupStats, setGroupStats] = useState<GroupStats[]>([])
  const [userStats, setUserStats] = useState<UserStats[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined)
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(undefined)

  // ==================== 内容分析状态 ====================
  const [overview, setOverview] = useState<ContentOverview | null>(null)
  const [volume, setVolume] = useState<VolumePoint[]>([])
  const [hours, setHours] = useState<ActiveHourPoint[]>([])
  const [participants, setParticipants] = useState<ParticipantStat[]>([])
  const [keywords, setKeywords] = useState<KeywordStat[]>([])
  const [groupActivity, setGroupActivity] = useState<GroupActivityStat[]>([])
  const [contentLoading, setContentLoading] = useState(true)
  const [contentDateRange, setContentDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [contentSelectedGroup, setContentSelectedGroup] = useState<string | undefined>(undefined)

  useEffect(() => {
    fetchGroups()
    fetchTemplates()
    fetchAllStats()
  }, [])

  useEffect(() => {
    fetchDailyStats()
  }, [dateRange, selectedTemplate])

  useEffect(() => {
    fetchUserStats()
  }, [selectedGroup, selectedTemplate])

  useEffect(() => {
    fetchGroupStats()
  }, [selectedTemplate])

  // ==================== 内容分析数据获取 ====================
  useEffect(() => {
    if (activeTab === 'content') {
      fetchContentStats()
    }
  }, [activeTab, contentDateRange, contentSelectedGroup])

  const buildContentParams = () => {
    const params: { conversation_id?: string; start_date?: string; end_date?: string } = {}
    if (contentSelectedGroup) params.conversation_id = contentSelectedGroup
    if (contentDateRange && contentDateRange[0] && contentDateRange[1]) {
      params.start_date = contentDateRange[0].format('YYYY-MM-DD')
      params.end_date = contentDateRange[1].format('YYYY-MM-DD')
    }
    return params
  }

  const fetchContentStats = async () => {
    setContentLoading(true)
    const params = buildContentParams()
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
      setContentLoading(false)
    }
  }

  const fetchGroups = async () => {
    try {
      const res = await getGroups()
      setGroups(res.data)
    } catch (error) {
      console.error('获取群聊失败:', error)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates?page_size=100', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      })
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch (error) {
      console.error('获取模板失败:', error)
    }
  }

  const fetchAllStats = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchDailyStats(), fetchGroupStats(), fetchUserStats()])
    } finally {
      setLoading(false)
    }
  }

  const fetchDailyStats = async () => {
    try {
      const params: { start_date?: string; end_date?: string; template_id?: string } = {}
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD')
        params.end_date = dateRange[1].format('YYYY-MM-DD')
      }
      if (selectedTemplate) params.template_id = selectedTemplate
      const res = await getDailyStats(params)
      setDailyStats(res.data)
    } catch (error) {
      message.error('获取每日统计失败')
    }
  }

  const fetchGroupStats = async () => {
    try {
      const params: { template_id?: string } = {}
      if (selectedTemplate) params.template_id = selectedTemplate
      const res = await getGroupStats(params)
      setGroupStats(res.data)
    } catch (error) {
      message.error('获取群聊统计失败')
    }
  }

  const fetchUserStats = async () => {
    try {
      const params: { conversation_id?: string; template_id?: string } = {}
      if (selectedGroup) params.conversation_id = selectedGroup
      if (selectedTemplate) params.template_id = selectedTemplate
      const res = await getUserStats(params)
      setUserStats(res.data)
    } catch (error) {
      message.error('获取用户统计失败')
    }
  }

  const dailyChartData = dailyStats.map((s) => ({
    date: s.date.slice(5),
    数据总数: s.total_reports,
    解析成功: s.success_parse_count,
    解析失败: s.failed_parse_count,
  }))

  const pieData = [
    { name: '解析成功', value: dailyStats.reduce((sum, s) => sum + s.success_parse_count, 0) },
    { name: '解析失败', value: dailyStats.reduce((sum, s) => sum + s.failed_parse_count, 0) },
  ]

  const totalRecords = dailyStats.reduce((sum, s) => sum + s.total_reports, 0)
  const successRate = totalRecords > 0
    ? Math.round((dailyStats.reduce((sum, s) => sum + s.success_parse_count, 0) / totalRecords) * 100)
    : 0

  const groupColumns = [
    { title: '群聊名称', dataIndex: 'group_name', render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: '数据总数', dataIndex: 'total_reports', width: 100, render: (v: number) => <Tag color="blue">{v}</Tag> },
    { title: '成员数', dataIndex: 'member_count', width: 100, render: (v: number) => <Tag>{v}</Tag> },
    {
      title: '近7日提交率',
      dataIndex: 'submission_rate',
      width: 120,
      render: (rate: number) => (
        <Badge color={rate >= 80 ? 'green' : rate >= 50 ? 'orange' : 'red'} text={`${rate}%`} />
      ),
    },
    {
      title: '绑定模板',
      dataIndex: 'template_names',
      render: (names: string[]) => (
        <Space size={4} wrap>
          {names?.map((n: string, i: number) => <Tag key={i} color="cyan">{n}</Tag>) || '-'}
        </Space>
      ),
    },
  ]

  const userColumns = [
    {
      title: '员工姓名',
      dataIndex: 'name',
      render: (name: string, record: UserStats) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: `hsl(${(record.staff_id.charCodeAt(0) * 30) % 360}, 70%, 85%)`,
              color: `hsl(${(record.staff_id.charCodeAt(0) * 30) % 360}, 70%, 35%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}
          >
            {name.slice(0, 1).toUpperCase()}
          </div>
          <span style={{ fontWeight: 500 }}>{name}</span>
        </div>
      ),
    },
    { title: 'Staff ID', dataIndex: 'staff_id', ellipsis: true },
    { title: '数据总数', dataIndex: 'total_reports', width: 100, render: (v: number) => <Tag color="blue">{v}</Tag> },
    { title: '解析成功', dataIndex: 'success_parse_count', width: 100, render: (v: number) => <Tag color="green">{v}</Tag> },
    { title: '消息数', dataIndex: 'message_count', width: 100, render: (v: number) => <Tag>{v}</Tag> },
    { title: '活跃天数', dataIndex: 'active_days', width: 100, render: (v: number) => <Tag color="orange">{v}</Tag> },
    {
      title: '最近提交',
      dataIndex: 'last_report_date',
      width: 120,
      render: (date: string | null) =>
        date ? (
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#4b5563' }}>{date}</span>
        ) : (
          <span style={{ color: '#9ca3af' }}>-</span>
        ),
    },
  ]

  // ==================== 内容分析数据转换 ====================
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

  const contentStatCards = [
    { title: '消息总数', value: overview?.total_messages || 0, icon: <MessageOutlined />, color: 'blue' },
    { title: '活跃用户', value: overview?.active_users || 0, icon: <TeamOutlined />, color: 'green' },
    { title: '今日消息', value: overview?.today_messages || 0, icon: <ClockCircleOutlined />, color: 'orange' },
    { title: '日均消息', value: overview?.avg_messages_per_day || 0, icon: <RiseOutlined />, color: 'purple' },
  ]

  const participantColumns = [
    {
      title: '成员',
      dataIndex: 'sender_name',
      render: (name: string, record: ParticipantStat) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: `hsl(${(record.sender_staff_id.charCodeAt(0) * 30) % 360}, 70%, 85%)`,
              color: `hsl(${(record.sender_staff_id.charCodeAt(0) * 30) % 360}, 70%, 35%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
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

  const groupActivityColumns = [
    { title: '群聊', dataIndex: 'group_name', render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
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

  if (loading && activeTab === 'submit') {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h2>
            <BarChartOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            统计报表
          </h2>
          <div className="subtitle">数据提交趋势、群聊活跃度与内容分析</div>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'submit' | 'content')}
        style={{ marginBottom: 24 }}
        items={[
          {
            key: 'submit',
            label: (
              <span>
                <DatabaseOutlined style={{ marginRight: 6 }} />
                数据提交统计
              </span>
            ),
          },
          {
            key: 'content',
            label: (
              <span>
                <MessageOutlined style={{ marginRight: 6 }} />
                群聊内容分析
              </span>
            ),
          },
        ]}
      />

      {/* ==================== 数据提交统计面板 ==================== */}
      {activeTab === 'submit' && (
        <>
          <div className="page-header" style={{ marginTop: -8 }}>
            <div />
            <div style={{ display: 'flex', gap: 12 }}>
              <Select
                placeholder="按模板筛选"
                allowClear
                style={{ width: 180 }}
                value={selectedTemplate}
                onChange={setSelectedTemplate}
                options={templates.map((t) => ({ label: t.name, value: t._id }))}
              />
              <Button icon={<ReloadOutlined />} onClick={fetchAllStats}>
                刷新数据
              </Button>
            </div>
          </div>

          {/* 概览卡片 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} md={6}>
              <div className="stat-card">
                <div className="stat-header">
                  <div className="stat-label">总数据数</div>
                  <div className="stat-icon blue"><DatabaseOutlined /></div>
                </div>
                <div className="stat-body">
                  <div className="stat-value">{totalRecords}</div>
                </div>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div className="stat-card">
                <div className="stat-header">
                  <div className="stat-label">解析成功率</div>
                  <div className="stat-icon green"><CheckCircleOutlined /></div>
                </div>
                <div className="stat-body">
                  <div className="stat-value">
                    {successRate}
                    <span style={{ fontSize: 14, fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>%</span>
                  </div>
                </div>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div className="stat-card">
                <div className="stat-header">
                  <div className="stat-label">活跃群聊</div>
                  <div className="stat-icon orange"><TeamOutlined /></div>
                </div>
                <div className="stat-body">
                  <div className="stat-value">{groupStats.length}</div>
                </div>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div className="stat-card">
                <div className="stat-header">
                  <div className="stat-label">活跃员工</div>
                  <div className="stat-icon purple"><UserOutlined /></div>
                </div>
                <div className="stat-body">
                  <div className="stat-value">{userStats.length}</div>
                </div>
              </div>
            </Col>
          </Row>

          {/* 图表区域 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <div className="content-card">
                <div className="card-header">
                  <h3>
                    <BarChartOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                    每日数据趋势
                  </h3>
                  <RangePicker
                    size="small"
                    onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                    placeholder={['开始日期', '结束日期']}
                  />
                </div>
                <div className="card-body">
                  {dailyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={dailyChartData}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1677ff" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#52c41a" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                        <Legend />
                        <Area type="monotone" dataKey="数据总数" stroke="#1677ff" fill="url(#colorTotal)" strokeWidth={2} />
                        <Area type="monotone" dataKey="解析成功" stroke="#52c41a" fill="url(#colorSuccess)" strokeWidth={2} />
                        <Area type="monotone" dataKey="解析失败" stroke="#f5222d" fill="#fff2f0" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="暂无数据" />
                  )}
                </div>
              </div>
            </Col>
            <Col xs={24} lg={8}>
              <div className="content-card">
                <div className="card-header">
                  <h3>
                    <BarChartOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                    解析状态分布
                  </h3>
                </div>
                <div className="card-body">
                  {pieData.some((d) => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%" cy="50%"
                          innerRadius={70} outerRadius={110}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="暂无数据" />
                  )}
                </div>
              </div>
            </Col>
          </Row>

          {/* 表格区域 */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <div className="content-card">
                <div className="card-header">
                  <h3>
                    <TeamOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                    群聊提交统计
                  </h3>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <Table
                    className="pro-table"
                    columns={groupColumns}
                    dataSource={groupStats}
                    rowKey="group_id"
                    pagination={{ pageSize: 10 }}
                    size="small"
                    locale={{ emptyText: <Empty description="暂无数据" /> }}
                  />
                </div>
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className="content-card">
                <div className="card-header">
                  <h3>
                    <UserOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                    员工活跃度统计
                  </h3>
                  <Select
                    placeholder="按群聊筛选"
                    allowClear
                    size="small"
                    style={{ width: 180 }}
                    value={selectedGroup}
                    onChange={setSelectedGroup}
                    options={groups.map((g) => ({ label: g.name, value: g.conversation_id }))}
                  />
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <Table
                    className="pro-table"
                    columns={userColumns}
                    dataSource={userStats}
                    rowKey="staff_id"
                    pagination={{ pageSize: 10 }}
                    size="small"
                    locale={{ emptyText: <Empty description="暂无数据" /> }}
                  />
                </div>
              </div>
            </Col>
          </Row>
        </>
      )}

      {/* ==================== 群聊内容分析面板 ==================== */}
      {activeTab === 'content' && (
        <Spin spinning={contentLoading}>
          <div className="page-header" style={{ marginTop: -8 }}>
            <div />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Select
                placeholder="全部群聊"
                allowClear
                style={{ width: 200 }}
                value={contentSelectedGroup}
                onChange={setContentSelectedGroup}
                options={groups.map((g) => ({ label: g.name, value: g.conversation_id }))}
              />
              <RangePicker
                onChange={(dates) => setContentDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                placeholder={['开始日期', '结束日期']}
              />
              <Button icon={<ReloadOutlined />} onClick={fetchContentStats} loading={contentLoading}>
                刷新
              </Button>
            </div>
          </div>

          {/* 概览统计 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {contentStatCards.map((card, index) => (
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
                    columns={groupActivityColumns}
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
      )}
    </div>
  )
}

export default StatsPage
