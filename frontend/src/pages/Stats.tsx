import React, { useEffect, useState } from 'react'
import { Card, Table, Row, Col, DatePicker, Select, message, Spin } from 'antd'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import dayjs from 'dayjs'
import {
  getDailyStats,
  getGroupStats,
  getUserStats,
  getGroups,
  type DailyStats,
  type GroupStats,
  type UserStats,
  type Group,
} from '../api'

const { RangePicker } = DatePicker

const COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1', '#13c2c2']

const StatsPage: React.FC = () => {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [groupStats, setGroupStats] = useState<GroupStats[]>([])
  const [userStats, setUserStats] = useState<UserStats[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined)

  useEffect(() => {
    fetchGroups()
    fetchAllStats()
  }, [])

  useEffect(() => {
    fetchDailyStats()
  }, [dateRange])

  useEffect(() => {
    fetchUserStats()
  }, [selectedGroup])

  const fetchGroups = async () => {
    try {
      const res = await getGroups()
      setGroups(res.data)
    } catch (error) {
      console.error('获取群聊失败:', error)
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
      const params: { start_date?: string; end_date?: string } = {}
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD')
        params.end_date = dateRange[1].format('YYYY-MM-DD')
      }
      const res = await getDailyStats(params)
      setDailyStats(res.data)
    } catch (error) {
      message.error('获取每日统计失败')
    }
  }

  const fetchGroupStats = async () => {
    try {
      const res = await getGroupStats()
      setGroupStats(res.data)
    } catch (error) {
      message.error('获取群聊统计失败')
    }
  }

  const fetchUserStats = async () => {
    try {
      const params: { conversation_id?: string } = {}
      if (selectedGroup) params.conversation_id = selectedGroup
      const res = await getUserStats(params)
      setUserStats(res.data)
    } catch (error) {
      message.error('获取用户统计失败')
    }
  }

  const dailyChartData = dailyStats.map((s) => ({
    date: s.date.slice(5),
    日报总数: s.total_reports,
    解析成功: s.success_parse_count,
    解析失败: s.failed_parse_count,
  }))

  const pieData = [
    { name: '解析成功', value: dailyStats.reduce((sum, s) => sum + s.success_parse_count, 0) },
    { name: '解析失败', value: dailyStats.reduce((sum, s) => sum + s.failed_parse_count, 0) },
  ]

  const groupColumns = [
    { title: '群聊名称', dataIndex: 'group_name' },
    { title: '日报总数', dataIndex: 'total_reports', width: 100, align: 'center' as const },
    { title: '成员数', dataIndex: 'member_count', width: 100, align: 'center' as const },
    {
      title: '近7日提交率',
      dataIndex: 'submission_rate',
      width: 120,
      align: 'center' as const,
      render: (rate: number) => `${rate}%`,
    },
  ]

  const userColumns = [
    { title: '员工姓名', dataIndex: 'name' },
    { title: 'Staff ID', dataIndex: 'staff_id', ellipsis: true },
    { title: '日报总数', dataIndex: 'total_reports', width: 100, align: 'center' as const },
    { title: '解析成功', dataIndex: 'success_parse_count', width: 100, align: 'center' as const },
    { title: '消息数', dataIndex: 'message_count', width: 100, align: 'center' as const },
    { title: '活跃天数', dataIndex: 'active_days', width: 100, align: 'center' as const },
    {
      title: '最近提交',
      dataIndex: 'last_report_date',
      width: 120,
      render: (date: string | null) => date || '-',
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>统计报表</h2>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title="每日日报趋势"
            extra={
              <RangePicker
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                placeholder={['开始日期', '结束日期']}
              />
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="日报总数" fill="#1677ff" />
                <Bar dataKey="解析成功" fill="#52c41a" />
                <Bar dataKey="解析失败" fill="#f5222d" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="解析状态分布">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="群聊提交统计">
            <Table
              columns={groupColumns}
              dataSource={groupStats}
              rowKey="group_id"
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="员工活跃度统计"
            extra={
              <Select
                placeholder="按群聊筛选"
                allowClear
                style={{ width: 200 }}
                value={selectedGroup}
                onChange={setSelectedGroup}
                options={groups.map((g) => ({ label: g.name, value: g.conversation_id }))}
              />
            }
          >
            <Table
              columns={userColumns}
              dataSource={userStats}
              rowKey="staff_id"
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default StatsPage
