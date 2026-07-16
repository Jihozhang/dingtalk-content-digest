import React, { useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  DatePicker,
  message,
  Descriptions,
  List,
  Typography,
  Popconfirm,
  Alert,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  SendOutlined,
  ClockCircleOutlined,
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

const { RangePicker } = DatePicker
const { Paragraph, Text } = Typography

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '等待中' },
  processing: { color: 'processing', text: '生成中' },
  completed: { color: 'success', text: '已完成' },
  failed: { color: 'error', text: '失败' },
}

const periodMap: Record<string, string> = {
  daily: '每日',
  weekly: '每周',
  custom: '自定义',
}

const DigestsPage: React.FC = () => {
  const [digests, setDigests] = useState<Digest[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<Digest | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchGroups()
    fetchScheduler()
    fetchDigests()
  }, [])

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
    setLoading(true)
    try {
      const res = await getDigests({ page_size: 100 })
      setDigests(res.data)
    } catch (error) {
      message.error('获取汇总列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      const [start, end] = values.range as [dayjs.Dayjs, dayjs.Dayjs]
      await createDigest({
        conversation_id: values.conversation_id,
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD'),
        period_type: values.period_type || 'custom',
      })
      message.success('汇总任务已创建，正在后台生成')
      setCreateOpen(false)
      form.resetFields()
      setTimeout(fetchDigests, 800)
    } catch (error) {
      if ((error as any)?.errorFields) return
      message.error('创建失败')
    }
  }

  const openDetail = async (id: string) => {
    try {
      const res = await getDigest(id)
      setDetail(res.data)
      setDetailOpen(true)
    } catch (error) {
      message.error('获取详情失败')
    }
  }

  const handleDelete = async (id: string) => {
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

  const columns = [
    { title: '群聊', dataIndex: 'group_name', render: (v: string) => v || '-' },
    {
      title: '周期',
      dataIndex: 'period_type',
      width: 90,
      render: (v: string) => periodMap[v] || v,
    },
    {
      title: '时间范围',
      width: 200,
      render: (_: any, r: Digest) => `${r.start_date} ~ ${r.end_date}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const s = statusMap[v] || { color: 'default', text: v }
        return <Tag color={s.color}>{s.text}</Tag>
      },
    },
    { title: '消息数', dataIndex: 'raw_message_count', width: 90, align: 'center' as const },
    {
      title: '已回推',
      dataIndex: 'pushed',
      width: 80,
      align: 'center' as const,
      render: (v: boolean) => (v ? <Tag color="green">是</Tag> : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      width: 220,
      render: (_: any, r: Digest) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openDetail(r._id)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SendOutlined />}
            disabled={r.status !== 'completed'}
            onClick={() => handlePush(r._id)}
          >
            回推
          </Button>
          <Popconfirm title="确认删除该汇总？" onConfirm={() => handleDelete(r._id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>智能汇总</h2>
        <Space wrap>
          <Button icon={<ClockCircleOutlined />} onClick={handleRunDaily}>
            立即生成每日
          </Button>
          <Button icon={<ClockCircleOutlined />} onClick={handleRunWeekly}>
            立即生成每周
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchDigests}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            手动汇总
          </Button>
        </Space>
      </div>

      {scheduler && (
        <Alert
          type={scheduler.running ? 'info' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
          message={
            scheduler.running
              ? `调度器运行中 · ${scheduler.jobs
                  .map(
                    (j) =>
                      `${j.id}${
                        j.next_run_time
                          ? ` (下次: ${dayjs(j.next_run_time).format('MM-DD HH:mm')})`
                          : ''
                      }`
                  )
                  .join(' | ')}`
              : '调度器未运行（ENABLE_SCHEDULER=false 或未启动）'
          }
        />
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={digests}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 15 }}
          size="small"
        />
      </Card>

      <Modal
        title="手动创建汇总"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="conversation_id"
            label="群聊"
            rules={[{ required: true, message: '请选择群聊' }]}
          >
            <Select
              placeholder="选择群聊"
              options={groups.map((g) => ({ label: g.name, value: g.conversation_id }))}
            />
          </Form.Item>
          <Form.Item
            name="range"
            label="时间范围"
            rules={[{ required: true, message: '请选择时间范围' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="period_type" label="周期类型" initialValue="custom">
            <Select
              options={[
                { label: '自定义', value: 'custom' },
                { label: '每日', value: 'daily' },
                { label: '每周', value: 'weekly' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="汇总详情"
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
                {periodMap[detail.period_type] || detail.period_type}
              </Descriptions.Item>
              <Descriptions.Item label="时间范围">
                {detail.start_date} ~ {detail.end_date}
              </Descriptions.Item>
              <Descriptions.Item label="消息数">{detail.raw_message_count}</Descriptions.Item>
            </Descriptions>

            {detail.status === 'failed' && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
                message="生成失败"
                description={detail.error_message || '未知错误'}
              />
            )}

            {detail.overview && (
              <Card size="small" title="📊 整体概览" style={{ marginBottom: 12 }}>
                <Paragraph style={{ margin: 0 }}>{detail.overview}</Paragraph>
              </Card>
            )}

            {detail.hot_topics?.length > 0 && (
              <Card size="small" title="🔥 热点话题" style={{ marginBottom: 12 }}>
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
              <Card size="small" title="✅ 待办事项" style={{ marginBottom: 12 }}>
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
              <Card size="small" title="⚠️ 风险 / 问题" style={{ marginBottom: 12 }}>
                <List
                  dataSource={detail.risks}
                  renderItem={(r) => <List.Item>{r}</List.Item>}
                />
              </Card>
            )}

            {detail.key_conclusions?.length > 0 && (
              <Card size="small" title="📌 关键结论">
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

export default DigestsPage
