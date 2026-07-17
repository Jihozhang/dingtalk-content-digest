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
} from '@ant-design/icons'
import dayjs from 'dayjs'
import '../styles/design-system.css'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

interface Group {
  _id: string
  conversation_id: string
  name: string
  project_name?: string
}

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

const AISummary: React.FC = () => {
  const [form] = Form.useForm()
  const [groups, setGroups] = useState<Group[]>([])
  const [tasks, setTasks] = useState<AISummaryTask[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pollingTaskId, setPollingTaskId] = useState<string | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedTask, setSelectedTask] = useState<AISummaryTask | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  const loadGroups = async () => {
    try {
      const res = await fetch(`${API_BASE}/groups`, { headers: getHeaders() })
      if (res.ok) {
        const data = await res.json()
        setGroups(data)
      }
    } catch (e) {
      console.error('加载群聊失败:', e)
    }
  }

  const loadTasks = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/ai-summaries?page=1&page_size=20`, {
        headers: getHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (e) {
      message.error('加载任务列表失败')
    } finally {
      setLoading(false)
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
            loadTasks()
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

  useEffect(() => {
    loadGroups()
    loadTasks()
  }, [])

  const handleCreateTask = async (values: any) => {
    const [startDate, endDate] = values.dateRange
    const taskData = {
      conversation_id: values.conversation_id,
      start_date: startDate.format('YYYY-MM-DD'),
      end_date: endDate.format('YYYY-MM-DD'),
      task_name: values.task_name || undefined,
    }

    setCreating(true)
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
        form.resetFields()
        loadTasks()
      } else {
        const err = await res.json()
        message.error(err.detail || '创建任务失败')
      }
    } catch (e) {
      message.error('创建任务失败')
    } finally {
      setCreating(false)
    }
  }

  const handleViewDetail = (task: AISummaryTask) => {
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
        loadTasks()
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

  const handleDelete = async (taskId: string) => {
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
            loadTasks()
          }
        } catch (e) {
          message.error('删除失败')
        }
      },
    })
  }

  const statusMap = {
    pending: { color: 'default' as const, text: '待处理', icon: <InboxOutlined /> },
    processing: { color: 'processing' as const, text: '处理中', icon: <ThunderboltOutlined /> },
    completed: { color: 'success' as const, text: '已完成', icon: <CheckCircleOutlined /> },
    failed: { color: 'error' as const, text: '失败', icon: <DeleteOutlined /> },
  }

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'task_name',
      key: 'task_name',
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
      key: 'status',
      width: 120,
      render: (status: string) => {
        const map = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status, icon: null }
        return (
          <div className={`status-tag ${map.color === 'success' ? 'success' : map.color === 'error' ? 'error' : map.color === 'processing' ? 'info' : 'default'}`}>
            {map.icon} {map.text}
          </div>
        )
      },
    },
    {
      title: '日期范围',
      key: 'date_range',
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
      key: 'raw_message_count',
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
      key: 'report_count',
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
      key: 'created_at',
      width: 140,
      render: (text: string) => (
        <span style={{ fontSize: 13, color: '#6b7280' }}>{dayjs(text).format('MM-DD HH:mm')}</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: AISummaryTask) => (
        <Space size={4}>
          <button
            className="btn-action"
            onClick={() => handleViewDetail(record)}
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
          <button className="btn-action danger" onClick={() => handleDelete(record._id)}>
            <DeleteOutlined /> 删除
          </button>
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
            AI 日报自动汇总
          </h2>
          <div className="subtitle">
            选择群聊和日期范围，使用 DeepSeek AI 自动解析聊天记录并生成结构化日报
          </div>
        </div>
      </div>

      {/* 创建任务卡片 */}
      <div className="content-card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3>
            <CloudOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            创建汇总任务
          </h3>
        </div>
        <div className="card-body">
          <Form form={form} layout="vertical" onFinish={handleCreateTask}>
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
                loading={creating}
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
            汇总任务列表
          </h3>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={loadTasks}
            loading={loading}
          >
            刷新
          </Button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <Table
            className="pro-table"
            columns={columns}
            dataSource={tasks}
            rowKey="_id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty description="暂无汇总任务" /> }}
          />
        </div>
      </div>

      {/* 详情弹窗 */}
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
                  {statusMap[selectedTask.status].icon}
                  {statusMap[selectedTask.status].text}
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
                    key: 'sender_name',
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
                  { title: '今日工作', dataIndex: 'today_work', key: 'today_work', ellipsis: true },
                  { title: '明日计划', dataIndex: 'tomorrow_plan', key: 'tomorrow_plan', ellipsis: true },
                  {
                    title: '工时',
                    dataIndex: 'work_hours',
                    key: 'work_hours',
                    width: 80,
                    align: 'center' as const,
                    render: (v: number | null) => v ? <Tag color="blue" style={{ fontWeight: 600 }}>{v}h</Tag> : '-',
                  },
                  {
                    title: '状态',
                    key: 'applied',
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
    </div>
  )
}

export default AISummary
