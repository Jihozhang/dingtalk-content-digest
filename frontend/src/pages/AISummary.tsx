import React, { useState, useEffect } from 'react'
import {
  Card,
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
  Badge,
  Typography,
  Divider,
} from 'antd'
import {
  RobotOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  CloudOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

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

  // 加载群聊列表
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

  // 加载任务列表
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

  // 轮询任务状态
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

  // 创建汇总任务
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

  // 查看任务详情
  const handleViewDetail = (task: AISummaryTask) => {
    setSelectedTask(task)
    setDetailModalVisible(true)
  }

  // 入库
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

  // 删除任务
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
    pending: { color: 'default', text: '待处理' },
    processing: { color: 'processing', text: '处理中' },
    completed: { color: 'success', text: '已完成' },
    failed: { color: 'error', text: '失败' },
  }

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'task_name',
      key: 'task_name',
      render: (text: string, record: AISummaryTask) =>
        text || `汇总任务 ${dayjs(record.created_at).format('MM-DD HH:mm')}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const map = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status }
        return <Badge status={map.color as any} text={map.text} />
      },
    },
    {
      title: '日期范围',
      key: 'date_range',
      render: (_: any, record: AISummaryTask) =>
        `${record.start_date} ~ ${record.end_date}`,
    },
    {
      title: '消息数',
      dataIndex: 'raw_message_count',
      key: 'raw_message_count',
      render: (count: number, record: AISummaryTask) =>
        record.status === 'completed' ? count : '-',
    },
    {
      title: '生成日报',
      key: 'report_count',
      render: (_: any, record: AISummaryTask) =>
        record.status === 'completed' ? record.generated_reports.length : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => dayjs(text).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AISummaryTask) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            disabled={record.status !== 'completed'}
          >
            查看
          </Button>
          {record.status === 'completed' && (
            <Button
              type="text"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApply(record._id)}
              loading={applying === record._id}
            >
              入库
            </Button>
          )}
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record._id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Title level={4}>
        <RobotOutlined /> AI 日报自动汇总
      </Title>
      <Text type="secondary">
        选择群聊和日期范围，使用 DeepSeek AI 自动解析聊天记录并生成结构化日报
      </Text>

      <Divider />

      <Card title="创建汇总任务" style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateTask}
        >
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
            />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="日期范围"
            rules={[{ required: true, message: '请选择日期范围' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="task_name" label="任务名称（可选）">
            <Select
              placeholder="给任务起个名字（可选）"
              allowClear
              showSearch
              mode="tags"
              maxCount={1}
              tokenSeparators={[',']}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              icon={<CloudOutlined />}
              htmlType="submit"
              loading={creating}
              disabled={!!pollingTaskId}
            >
              {pollingTaskId ? '处理中...' : '开始 AI 汇总'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title={
          <Space>
            <span>汇总任务列表</span>
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={loadTasks}
              loading={loading}
            />
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无汇总任务" /> }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="AI 汇总结果"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={900}
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
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="状态">
                <Badge
                  status={statusMap[selectedTask.status].color as any}
                  text={statusMap[selectedTask.status].text}
                />
              </Descriptions.Item>
              <Descriptions.Item label="原始消息数">
                {selectedTask.raw_message_count}
              </Descriptions.Item>
              <Descriptions.Item label="日期范围">
                {selectedTask.start_date} ~ {selectedTask.end_date}
              </Descriptions.Item>
              <Descriptions.Item label="生成日报数">
                {selectedTask.generated_reports.length}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Title level={5}>AI 生成的日报</Title>
            {selectedTask.generated_reports.length === 0 ? (
              <Empty description="未生成日报" />
            ) : (
              <Table
                dataSource={selectedTask.generated_reports.map((r, i) => ({ ...r, key: i }))}
                pagination={false}
                size="small"
                columns={[
                  { title: '员工', dataIndex: 'sender_name', key: 'sender_name' },
                  { title: '今日工作', dataIndex: 'today_work', key: 'today_work', ellipsis: true },
                  { title: '明日计划', dataIndex: 'tomorrow_plan', key: 'tomorrow_plan', ellipsis: true },
                  {
                    title: '工时',
                    dataIndex: 'work_hours',
                    key: 'work_hours',
                    render: (v: number | null) => v ? `${v}h` : '-',
                  },
                  {
                    title: '状态',
                    key: 'applied',
                    render: (_: any, record: AIReportItem) =>
                      record.applied ? (
                        <Tag color="success">已入库</Tag>
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
