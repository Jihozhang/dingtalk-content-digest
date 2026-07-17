import React, { useState, useEffect } from 'react'
import {
  Form,
  Select,
  DatePicker,
  Button,
  Table,
  Tag,
  Space,
  message,
  Spin,
  Empty,
  Modal,
  Descriptions,
  Typography,
  Divider,
  Row,
  Col,
  Card,
  List,
  Popconfirm,
  Alert,
  Badge,
  Tabs,
} from 'antd'
import {
  RobotOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  CloudOutlined,
  ThunderboltOutlined,
  BranchesOutlined,
  InboxOutlined,
  PlusOutlined,
  SendOutlined,
  BulbOutlined,
  CalendarOutlined,
  FileTextOutlined,
  WarningOutlined,
  BookOutlined,
  BarChartOutlined,
  FireOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getDigests,
  getDigest,
  createDigest,
  deleteDigest,
  pushDigest,
  getSchedulerStatus,
  runDailyDigest,
  runWeeklyDigest,
  getGroups,
  type Digest,
  type SchedulerStatus,
  type Group,
} from '../api'
import '../styles/design-system.css'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

// ==================== AI 日报汇总类型 ====================
interface AIReportItem {
  sender_name: string
  sender_staff_id: string
  today_work: string
  tomorrow_plan: string
  problems: string
  work_hours: number | null
  remarks: string
  applied: boolean
}

interface AISummaryTask {
  _id: string
  conversation_id: string
  start_date: string
  end_date: string
  task_name?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  completed_at?: string
  error_message?: string
  generated_reports: AIReportItem[]
  raw_message_count: number
  api_cost_tokens?: number
}

const API_BASE = '/api'

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  'Content-Type': 'application/json',
})

// ==================== 状态映射 ====================
const aiStatusMap = {
  pending: { color: 'default' as const, text: '待处理', icon: <InboxOutlined /> },
  processing: { color: 'processing' as const, text: '处理中', icon: <ThunderboltOutlined /> },
  completed: { color: 'success' as const, text: '已完成', icon: <CheckCircleOutlined /> },
  failed: { color: 'error' as const, text: '失败', icon: <DeleteOutlined /> },
}

const digestStatusMap: Record<string, { color: string; text: string; badge: string }> = {
  pending: { color: 'default', text: '等待中', badge: 'default' },
  processing: { color: 'processing', text: '生成中', badge: 'processing' },
  completed: { color: 'success', text: '已完成', badge: 'success' },
  failed: { color: 'error', text: '失败', badge: 'error' },
}

const periodMap: Record<string, string> = {
  daily: '每日',
  weekly: '每周',
  custom: '自定义',
}

const AIAnalysisPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ai-summary' | 'digests'>('ai-summary')

  // ==================== AI 日报汇总状态 ====================
  const [aiForm] = Form.useForm()
  const [groups, setGroups] = useState<Group[]>([])
  const [aiTasks, setAiTasks] = useState<AISummaryTask[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCreating, setAiCreating] = useState(false)
  const [pollingTaskId, setPollingTaskId] = useState<string | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedTask, setSelectedTask] = useState<AISummaryTask | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  // ==================== 智能汇总状态 ====================
  const [digests, setDigests] = useState<Digest[]>([])
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null)
  const [digestLoading, setDigestLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<Digest | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [digestForm] = Form.useForm()

  // ==================== 公共加载 ====================
  useEffect(() => {
    fetchGroups()
  }, [])

  useEffect(() => {
    if (activeTab === 'ai-summary') {
      loadAiTasks()
    } else {
      fetchScheduler()
      fetchDigests()
    }
  }, [activeTab])

  // ==================== AI 日报汇总逻辑 ====================
  const loadAiTasks = async () => {
    setAiLoading(true)
    try {
      const res = await fetch(`${API_BASE}/ai-summaries?page=1&page_size=20`, {
        headers: getHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setAiTasks(data)
      }
    } catch (e) {
      message.error('加载任务列表失败')
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    if (!pollingTaskId) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/ai-summaries/${pollingTaskId}`, {
          headers: getHeaders(),
        })
        if (res.ok) {
          const task = await res.json()
          if (task.status === 'completed' || task.status === 'failed') {
            setPollingTaskId(null)
            loadAiTasks()
            if (task.status === 'completed') {
              message.success('AI 汇总任务完成！')
            } else {
              message.error(`任务失败: ${task.error_message || '未知错误'}`)
            }
          }
        }
      } catch (e) {
        console.error('轮询任务状态失败:', e)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [pollingTaskId])

  const handleCreateAiTask = async (values: any) => {
    const [startDate, endDate] = values.dateRange
    const taskData = {
      conversation_id: values.conversation_id,
      start_date: startDate.format('YYYY-MM-DD'),
      end_date: endDate.format('YYYY-MM-DD'),
      task_name: values.task_name || undefined,
    }
    setAiCreating(true)
    try {
      const res = await fetch(`${API_BASE}/ai-summaries`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(taskData),
      })
      if (res.ok) {
        const task = await res.json()
        message.success('AI 汇总任务已创建，正在处理中...')
        setPollingTaskId(task._id)
        aiForm.resetFields()
        loadAiTasks()
      } else {
        const err = await res.json()
        message.error(err.detail || '创建任务失败')
      }
    } catch (e) {
      message.error('创建任务失败')
    } finally {
      setAiCreating(false)
    }
  }

  const handleViewAiDetail = (task: AISummaryTask) => {
    setSelectedTask(task)
    setDetailModalVisible(true)
  }

  const handleApply = async (taskId: string, indices?: number[]) => {
    setApplying(taskId)
    try {
      const res = await fetch(`${API_BASE}/ai-summaries/${taskId}/apply`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(indices || []),
      })
      if (res.ok) {
        const data = await res.json()
        message.success(data.message)
        loadAiTasks()
      } else {
        const err = await res.json()
        message.error(err.detail || '入库失败')
      }
    } catch (e) {
      message.error('入库失败')
    } finally {
      setApplying(null)
    }
  }

  const handleDeleteAiTask = async (taskId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，是否继续？',
      onOk: async () => {
        try {
          const res = await fetch(`${API_BASE}/ai-summaries/${taskId}`, {
            method: 'DELETE',
            headers: getHeaders(),
          })
          if (res.ok) {
            message.success('任务已删除')
            loadAiTasks()
          }
        } catch (e) {
          message.error('删除失败')
        }
      },
    })
  }

  // ==================== 智能汇总逻辑 ====================
  const fetchGroups = async () => {
    try {
      const res = await getGroups()
      setGroups(res.data)
    } catch (error) {
      console.error('获取群聊失败:', error)
    }
  }

  const fetchScheduler = async () => {
    try {
      const res = await getSchedulerStatus()
      setScheduler(res.data)
    } catch (error) {
      console.error('获取调度器状态失败:', error)
    }
  }

  const fetchDigests = async () => {
    setDigestLoading(true)
    try {
      const res = await getDigests({ page_size: 100 })
      setDigests(res.data)
    } catch (error) {
      message.error('获取汇总列表失败')
    } finally {
      setDigestLoading(false)
    }
  }

  const handleCreateDigest = async () => {
    try {
      const values = await digestForm.validateFields()
      const [start, end] = values.range as [dayjs.Dayjs, dayjs.Dayjs]
      await createDigest({
        conversation_id: values.conversation_id,
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD'),
        period_type: values.period_type || 'custom',
      })
      message.success('汇总任务已创建，正在后台生成')
      setCreateOpen(false)
      digestForm.resetFields()
      setTimeout(fetchDigests, 800)
    } catch (error) {
      if ((error as any)?.errorFields) return
      message.error('创建失败')
    }
  }

  const openDigestDetail = async (id: string) => {
    try {
      const res = await getDigest(id)
      setDetail(res.data)
      setDetailOpen(true)
    } catch (error) {
      message.error('获取详情失败')
    }
  }

  const handleDeleteDigest = async (id: string) => {
    try {
      await deleteDigest(id)
      message.success('已删除')
      fetchDigests()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handlePush = async (id: string) => {
    try {
      await pushDigest(id)
      message.success('已回推到群聊')
      fetchDigests()
    } catch (error) {
      message.error('回推失败，请检查机器人权限与 RobotCode 配置')
    }
  }

  const handleRunDaily = async () => {
    try {
      await runDailyDigest()
      message.success('每日汇总已触发，稍后刷新查看')
      setTimeout(fetchDigests, 1500)
    } catch (error) {
      message.error('触发失败')
    }
  }

  const handleRunWeekly = async () => {
    try {
      await runWeeklyDigest()
      message.success('每周汇总已触发，稍后刷新查看')
      setTimeout(fetchDigests, 1500)
    } catch (error) {
      message.error('触发失败')
    }
  }

  // ==================== AI 日报表格列 ====================
  const aiColumns = [
    {
      title: '任务名称',
      dataIndex: 'task_name',
      render: (text: string, record: AISummaryTask) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1f2937' }}>
            {text || `汇总任务 ${dayjs(record.created_at).format('MM-DD HH:mm')}`}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {record.conversation_id.slice(-8)}
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: string) => {
        const map = aiStatusMap[status as keyof typeof aiStatusMap] || { color: 'default', text: status, icon: null }
        return (
          <div className={`status-tag ${map.color === 'success' ? 'success' : map.color === 'error' ? 'error' : map.color === 'processing' ? 'info' : 'default'}`}>
            {map.icon} {map.text}
          </div>
        )
      },
    },
    {
      title: '日期范围',
      width: 180,
      render: (_: any, record: AISummaryTask) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#4b5563' }}>
          {record.start_date} ~ {record.end_date}
        </span>
      ),
    },
    {
      title: '消息数',
      dataIndex: 'raw_message_count',
      width: 90,
      align: 'center' as const,
      render: (count: number, record: AISummaryTask) =>
        record.status === 'completed' ? (
          <Tag color="blue" style={{ fontWeight: 600 }}>{count}</Tag>
        ) : (
          <span style={{ color: '#9ca3af' }}>-</span>
        ),
    },
    {
      title: '生成日报',
      width: 90,
      align: 'center' as const,
      render: (_: any, record: AISummaryTask) =>
        record.status === 'completed' ? (
          <Tag color="green" style={{ fontWeight: 600 }}>{record.generated_reports.length}</Tag>
        ) : (
          <span style={{ color: '#9ca3af' }}>-</span>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 140,
      render: (text: string) => (
        <span style={{ fontSize: 13, color: '#6b7280' }}>{dayjs(text).format('MM-DD HH:mm')}</span>
      ),
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, record: AISummaryTask) => (
        <Space size={4}>
          <button
            className="btn-action"
            onClick={() => handleViewAiDetail(record)}
            disabled={record.status !== 'completed'}
          >
            <EyeOutlined /> 查看
          </button>
          {record.status === 'completed' && (
            <button
              className="btn-action"
              onClick={() => handleApply(record._id)}
              disabled={applying === record._id}
            >
              <CheckCircleOutlined /> 入库
            </button>
          )}
          <button className="btn-action danger" onClick={() => handleDeleteAiTask(record._id)}>
            <DeleteOutlined /> 删除
          </button>
        </Space>
      ),
    },
  ]

  // ==================== 智能汇总表格列 ====================
  const digestColumns = [
    {
      title: '群聊',
      dataIndex: 'group_name',
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v || '-'}</span>,
    },
    {
      title: '周期',
      dataIndex: 'period_type',
      width: 90,
      render: (v: string) => (
        <Tag color={v === 'daily' ? 'blue' : v === 'weekly' ? 'purple' : 'default'} style={{ fontWeight: 500 }}>
          {periodMap[v] || v}
        </Tag>
      ),
    },
    {
      title: '时间范围',
      width: 200,
      render: (_: any, r: Digest) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#4b5563' }}>
          {r.start_date} ~ {r.end_date}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      align: 'center' as const,
      render: (v: string) => {
        const s = digestStatusMap[v] || { color: 'default', text: v, badge: 'default' }
        return <Badge status={s.badge as any} text={s.text} />
      },
    },
    { title: '消息数', dataIndex: 'raw_message_count', width: 90, align: 'center' as const },
    {
      title: '已回推',
      dataIndex: 'pushed',
      width: 80,
      align: 'center' as const,
      render: (v: boolean) =>
        v ? <Tag color="success" style={{ fontWeight: 600 }}>已推送</Tag> : <span style={{ color: '#9ca3af' }}>-</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (v: string) => (
        <span style={{ fontSize: 13, color: '#6b7280' }}>{v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'}</span>
      ),
    },
    {
      title: '操作',
      width: 220,
      align: 'center' as const,
      render: (_: any, r: Digest) => (
        <Space size={4}>
          <button className="btn-action" onClick={() => openDigestDetail(r._id)}>
            <FileTextOutlined /> 详情
          </button>
          <button
            className="btn-action"
            onClick={() => handlePush(r._id)}
            disabled={r.status !== 'completed'}
          >
            <SendOutlined /> 回推
          </button>
          <Popconfirm title="确认删除该汇总？" onConfirm={() => handleDeleteDigest(r._id)}>
            <button className="btn-action danger">
              <DeleteOutlined /> 删除
            </button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h2>
            <RobotOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            AI 分析
          </h2>
          <div className="subtitle">AI 日报自动汇总与智能汇总任务管理</div>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'ai-summary' | 'digests')}
        style={{ marginBottom: 24 }}
        items={[
          {
            key: 'ai-summary',
            label: (
              <span>
                <ThunderboltOutlined style={{ marginRight: 6 }} />
                AI 日报汇总
              </span>
            ),
          },
          {
            key: 'digests',
            label: (
              <span>
                <BulbOutlined style={{ marginRight: 6 }} />
                智能汇总
              </span>
            ),
          },
        ]}
      />

      {/* ==================== AI 日报汇总面板 ==================== */}
      {activeTab === 'ai-summary' && (
        <>
          {/* 创建任务卡片 */}
          <div className="content-card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <h3>
                <CloudOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                创建 AI 汇总任务
              </h3>
            </div>
            <div className="card-body">
              <Form form={aiForm} layout="vertical" onFinish={handleCreateAiTask}>
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="conversation_id"
                      label="选择群聊"
                      rules={[{ required: true, message: '请选择群聊' }]}
                    >
                      <Select
                        placeholder="请选择要汇总的群聊"
                        options={groups.map((g) => ({
                          value: g.conversation_id,
                          label: g.project_name ? `${g.name} (${g.project_name})` : g.name,
                        }))}
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="dateRange"
                      label="日期范围"
                      rules={[{ required: true, message: '请选择日期范围' }]}
                    >
                      <RangePicker style={{ width: '100%' }} size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="task_name" label="任务名称（可选）">
                      <Select
                        placeholder="给任务起个名字（可选）"
                        allowClear
                        showSearch
                        mode="tags"
                        maxCount={1}
                        tokenSeparators={[',']}
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    htmlType="submit"
                    loading={aiCreating}
                    disabled={!!pollingTaskId}
                    size="large"
                    style={{ minWidth: 160 }}
                  >
                    {pollingTaskId ? '处理中...' : '开始 AI 汇总'}
                  </Button>
                  {pollingTaskId && (
                    <Text type="secondary" style={{ marginLeft: 16 }}>
                      <Spin size="small" style={{ marginRight: 8 }} />
                      正在解析聊天记录，请稍候...
                    </Text>
                  )}
                </Form.Item>
              </Form>
            </div>
          </div>

          {/* 任务列表 */}
          <div className="content-card">
            <div className="card-header">
              <h3>
                <BranchesOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                AI 汇总任务列表
              </h3>
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={loadAiTasks}
                loading={aiLoading}
              >
                刷新
              </Button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <Table
                className="pro-table"
                columns={aiColumns}
                dataSource={aiTasks}
                rowKey="_id"
                loading={aiLoading}
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: <Empty description="暂无汇总任务" /> }}
              />
            </div>
          </div>
        </>
      )}

      {/* ==================== 智能汇总面板 ==================== */}
      {activeTab === 'digests' && (
        <>
          {/* 调度器状态 */}
          {scheduler && (
            <Alert
              type={scheduler.running ? 'info' : 'warning'}
              showIcon
              style={{ marginBottom: 24, borderRadius: 12 }}
              icon={scheduler.running ? <ThunderboltOutlined /> : <WarningOutlined />}
              message={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>
                    {scheduler.running ? '调度器运行中' : '调度器未运行'}
                  </span>
                  <Divider type="vertical" />
                  <span style={{ fontSize: 13, color: '#6b7280' }}>
                    {scheduler.running
                      ? scheduler.jobs
                          .map(
                            (j) =>
                              `${j.id}${
                                j.next_run_time
                                  ? ` (下次: ${dayjs(j.next_run_time).format('MM-DD HH:mm')})`
                                  : ''
                              }`
                          )
                          .join(' | ')
                      : 'ENABLE_SCHEDULER=false 或未启动'}
                  </span>
                </div>
              }
            />
          )}

          {/* 操作栏 */}
          <div className="content-card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <h3>
                <BulbOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                智能汇总任务
              </h3>
              <Space wrap>
                <Button icon={<CalendarOutlined />} onClick={handleRunDaily}>
                  立即生成每日
                </Button>
                <Button icon={<CalendarOutlined />} onClick={handleRunWeekly}>
                  立即生成每周
                </Button>
                <Button icon={<ReloadOutlined />} onClick={fetchDigests} loading={digestLoading}>
                  刷新
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                  手动汇总
                </Button>
              </Space>
            </div>
          </div>

          {/* 汇总列表 */}
          <div className="content-card">
            <div className="card-header">
              <h3>
                <BookOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                汇总任务列表
              </h3>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>
                共 {digests.length} 条记录
              </span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <Table
                className="pro-table"
                columns={digestColumns}
                dataSource={digests}
                rowKey="_id"
                loading={digestLoading}
                pagination={{ pageSize: 15 }}
                size="small"
                locale={{ emptyText: <Empty description="暂无汇总任务" /> }}
              />
            </div>
          </div>
        </>
      )}

      {/* ==================== AI 汇总详情弹窗 ==================== */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RobotOutlined style={{ color: '#1677ff' }} />
            <span>AI 汇总结果</span>
          </div>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={960}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          selectedTask && (
            <Button
              key="apply"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                handleApply(selectedTask._id)
                setDetailModalVisible(false)
              }}
              loading={applying === selectedTask._id}
            >
              全部入库
            </Button>
          ),
        ]}
      >
        {selectedTask && (
          <div>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="状态">
                <div className={`status-tag ${selectedTask.status === 'completed' ? 'success' : selectedTask.status === 'failed' ? 'error' : 'info'}`}>
                  {aiStatusMap[selectedTask.status].icon}
                  {aiStatusMap[selectedTask.status].text}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="原始消息数">
                <Tag color="blue" style={{ fontWeight: 600 }}>{selectedTask.raw_message_count}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="日期范围">
                <span style={{ fontFamily: 'monospace' }}>{selectedTask.start_date} ~ {selectedTask.end_date}</span>
              </Descriptions.Item>
              <Descriptions.Item label="生成日报数">
                <Tag color="green" style={{ fontWeight: 600 }}>{selectedTask.generated_reports.length}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Title level={5} style={{ marginBottom: 16 }}>
              <CheckCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} />
              AI 生成的日报
            </Title>
            {selectedTask.generated_reports.length === 0 ? (
              <Empty description="未生成日报" />
            ) : (
              <Table
                dataSource={selectedTask.generated_reports.map((r, i) => ({ ...r, key: i }))}
                pagination={false}
                size="small"
                className="pro-table"
                columns={[
                  {
                    title: '员工',
                    dataIndex: 'sender_name',
                    render: (name: string) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: `hsl(${(name.charCodeAt(0) * 30) % 360}, 70%, 85%)`,
                            color: `hsl(${(name.charCodeAt(0) * 30) % 360}, 70%, 35%)`,
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
                  { title: '今日工作', dataIndex: 'today_work', ellipsis: true },
                  { title: '明日计划', dataIndex: 'tomorrow_plan', ellipsis: true },
                  {
                    title: '工时',
                    dataIndex: 'work_hours',
                    width: 80,
                    align: 'center' as const,
                    render: (v: number | null) => v ? <Tag color="blue" style={{ fontWeight: 600 }}>{v}h</Tag> : '-',
                  },
                  {
                    title: '状态',
                    width: 90,
                    align: 'center' as const,
                    render: (_: any, record: AIReportItem) =>
                      record.applied ? (
                        <Tag color="success" style={{ fontWeight: 600 }}>已入库</Tag>
                      ) : (
                        <Tag>未入库</Tag>
                      ),
                  },
                ]}
              />
            )}
          </div>
        )}
      </Modal>

      {/* ==================== 智能汇总创建弹窗 ==================== */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PlusOutlined style={{ color: '#1677ff' }} />
            <span>手动创建汇总</span>
          </div>
        }
        open={createOpen}
        onOk={handleCreateDigest}
        onCancel={() => setCreateOpen(false)}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form form={digestForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="conversation_id"
            label="群聊"
            rules={[{ required: true, message: '请选择群聊' }]}
          >
            <Select
              placeholder="选择群聊"
              size="large"
              options={groups.map((g) => ({ label: g.name, value: g.conversation_id }))}
            />
          </Form.Item>
          <Form.Item
            name="range"
            label="时间范围"
            rules={[{ required: true, message: '请选择时间范围' }]}
          >
            <RangePicker style={{ width: '100%' }} size="large" />
          </Form.Item>
          <Form.Item name="period_type" label="周期类型" initialValue="custom">
            <Select
              size="large"
              options={[
                { label: '自定义', value: 'custom' },
                { label: '每日', value: 'daily' },
                { label: '每周', value: 'weekly' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== 智能汇总详情弹窗 ==================== */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileTextOutlined style={{ color: '#1677ff' }} />
            <span>汇总详情</span>
          </div>
        }
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={720}
      >
        {detail && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="群聊">{detail.group_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="周期">
                <Tag color={detail.period_type === 'daily' ? 'blue' : detail.period_type === 'weekly' ? 'purple' : 'default'}>
                  {periodMap[detail.period_type] || detail.period_type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="时间范围">
                <span style={{ fontFamily: 'monospace' }}>{detail.start_date} ~ {detail.end_date}</span>
              </Descriptions.Item>
              <Descriptions.Item label="消息数">{detail.raw_message_count}</Descriptions.Item>
            </Descriptions>

            {detail.status === 'failed' && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 16, borderRadius: 8 }}
                message="生成失败"
                description={detail.error_message || '未知错误'}
              />
            )}

            {detail.overview && (
              <Card size="small" title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChartOutlined style={{ color: '#1677ff' }} />
                  <span>整体概览</span>
                </div>
              } style={{ marginBottom: 12, borderRadius: 12 }}>
                <Typography.Paragraph style={{ margin: 0, lineHeight: 1.8 }}>{detail.overview}</Typography.Paragraph>
              </Card>
            )}

            {detail.hot_topics?.length > 0 && (
              <Card size="small" title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FireOutlined style={{ color: '#fa8c16' }} />
                  <span>热点话题</span>
                </div>
              } style={{ marginBottom: 12, borderRadius: 12 }}>
                <List
                  dataSource={detail.hot_topics}
                  renderItem={(t) => (
                    <List.Item>
                      <List.Item.Meta title={t.title} description={t.summary} />
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {detail.todos?.length > 0 && (
              <Card size="small" title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <span>待办事项</span>
                </div>
              } style={{ marginBottom: 12, borderRadius: 12 }}>
                <List
                  dataSource={detail.todos}
                  renderItem={(t) => (
                    <List.Item>
                      <Text>{t.content}</Text>
                      {t.owner && <Tag style={{ marginLeft: 8 }}>{t.owner}</Tag>}
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {detail.risks?.length > 0 && (
              <Card size="small" title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <WarningOutlined style={{ color: '#ff4d4f' }} />
                  <span>风险 / 问题</span>
                </div>
              } style={{ marginBottom: 12, borderRadius: 12 }}>
                <List
                  dataSource={detail.risks}
                  renderItem={(r) => <List.Item>{r}</List.Item>}
                />
              </Card>
            )}

            {detail.key_conclusions?.length > 0 && (
              <Card size="small" title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOutlined style={{ color: '#722ed1' }} />
                  <span>关键结论</span>
                </div>
              } style={{ borderRadius: 12 }}>
                <List
                  dataSource={detail.key_conclusions}
                  renderItem={(k) => <List.Item>{k}</List.Item>}
                />
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default AIAnalysisPage
