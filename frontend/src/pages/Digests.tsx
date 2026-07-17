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
  Empty,
  Badge,
  Divider,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  SendOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
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
const { Paragraph, Text } = Typography

const statusMap: Record<string, { color: string; text: string; badge: string }> = {
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
        const s = statusMap[v] || { color: 'default', text: v, badge: 'default' }
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
          <button className="btn-action" onClick={() => openDetail(r._id)}>
            <FileTextOutlined /> 详情
          </button>
          <button
            className="btn-action"
            onClick={() => handlePush(r._id)}
            disabled={r.status !== 'completed'}
          >
            <SendOutlined /> 回推
          </button>
          <Popconfirm title="确认删除该汇总？" onConfirm={() => handleDelete(r._id)}>
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
            <BulbOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            智能汇总
          </h2>
          <div className="subtitle">定时生成日报/周报摘要，支持手动触发和自动回推</div>
        </div>
        <Space wrap>
          <Button icon={<CalendarOutlined />} onClick={handleRunDaily}>
            立即生成每日
          </Button>
          <Button icon={<CalendarOutlined />} onClick={handleRunWeekly}>
            立即生成每周
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchDigests} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            手动汇总
          </Button>
        </Space>
      </div>

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
            columns={columns}
            dataSource={digests}
            rowKey="_id"
            loading={loading}
            pagination={{ pageSize: 15 }}
            size="small"
            locale={{ emptyText: <Empty description="暂无汇总任务" /> }}
          />
        </div>
      </div>

      {/* 创建弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PlusOutlined style={{ color: '#1677ff' }} />
            <span>手动创建汇总</span>
          </div>
        }
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
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

      {/* 详情弹窗 */}
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
                <Paragraph style={{ margin: 0, lineHeight: 1.8 }}>{detail.overview}</Paragraph>
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

export default DigestsPage
