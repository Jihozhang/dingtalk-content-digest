import React, { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Space,
  Select,
  DatePicker,
  Input,
  Tag,
  Modal,
  Form,
  message,
  Popconfirm,
  Row,
  Col,
  Drawer,
  Descriptions,
  Badge,
  Empty,
  Tooltip,
} from 'antd'
import {
  ExportOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  FilterOutlined,
  SearchOutlined,
  ClearOutlined,
} from '@ant-design/icons'
import {
  getReports,
  getGroups,
  exportReportsCSV,
  updateReport,
  deleteReport,
  type Report,
  type Group,
} from '../api'
import '../styles/design-system.css'

const { RangePicker } = DatePicker
const { TextArea } = Input

const parseStatusMap: Record<string, { color: string; text: string; badge: string }> = {
  pending: { color: 'default', text: '待解析', badge: 'default' },
  success: { color: 'success', text: '解析成功', badge: 'success' },
  failed: { color: 'error', text: '解析失败', badge: 'error' },
}

const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [form] = Form.useForm()
  const [showFilters, setShowFilters] = useState(true)

  const [filters, setFilters] = useState({
    conversation_id: undefined as string | undefined,
    report_date: undefined as string | undefined,
    start_date: undefined as string | undefined,
    end_date: undefined as string | undefined,
    parse_status: undefined as string | undefined,
  })

  useEffect(() => {
    fetchReports()
    fetchGroups()
  }, [filters])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = {}
      if (filters.conversation_id) params.conversation_id = filters.conversation_id
      if (filters.report_date) params.report_date = filters.report_date
      if (filters.start_date) params.start_date = filters.start_date
      if (filters.end_date) params.end_date = filters.end_date
      if (filters.parse_status) params.parse_status = filters.parse_status

      const res = await getReports(params)
      setReports(res.data)
    } catch (error) {
      message.error('获取日报列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchGroups = async () => {
    try {
      const res = await getGroups()
      setGroups(res.data)
    } catch (error) {
      console.error('获取群聊列表失败:', error)
    }
  }

  const handleDateChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilters({
        ...filters,
        start_date: dates[0].format('YYYY-MM-DD'),
        end_date: dates[1].format('YYYY-MM-DD'),
      })
    } else {
      setFilters({ ...filters, start_date: undefined, end_date: undefined })
    }
  }

  const handleExport = () => {
    exportReportsCSV({
      conversation_id: filters.conversation_id,
      start_date: filters.start_date,
      end_date: filters.end_date,
    })
  }

  const openDetail = (report: Report) => {
    setSelectedReport(report)
    setDetailVisible(true)
  }

  const openEdit = (report: Report) => {
    setSelectedReport(report)
    form.setFieldsValue({
      today_work: report.parsed_content?.today_work || '',
      tomorrow_plan: report.parsed_content?.tomorrow_plan || '',
      problems: report.parsed_content?.problems || '',
      work_hours: report.parsed_content?.work_hours || '',
      remarks: report.parsed_content?.remarks || '',
    })
    setEditVisible(true)
  }

  const handleUpdate = async (values: any) => {
    if (!selectedReport) return
    try {
      await updateReport(selectedReport._id, {
        parsed_content: {
          today_work: values.today_work,
          tomorrow_plan: values.tomorrow_plan,
          problems: values.problems,
          work_hours: values.work_hours ? parseFloat(values.work_hours) : null,
          remarks: values.remarks,
        },
      })
      message.success('更新成功')
      setEditVisible(false)
      fetchReports()
    } catch (error) {
      message.error('更新失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteReport(id)
      message.success('删除成功')
      fetchReports()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const clearFilters = () => {
    setFilters({
      conversation_id: undefined,
      report_date: undefined,
      start_date: undefined,
      end_date: undefined,
      parse_status: undefined,
    })
  }

  const groupMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    groups.forEach((g) => {
      map[g.conversation_id] = g.name
    })
    return map
  }, [groups])

  const columns = [
    {
      title: '日期',
      dataIndex: 'report_date',
      width: 110,
      sorter: (a: Report, b: Report) => a.report_date.localeCompare(b.report_date),
      render: (date: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#4b5563' }}>{date}</span>
      ),
    },
    {
      title: '群聊',
      dataIndex: 'conversation_id',
      width: 150,
      render: (id: string) => (
        <Tooltip title={id}>
          <span style={{ fontSize: 13, color: '#4b5563' }}>
            {groupMap[id] || `群聊-${id.slice(-8)}`}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '发送人',
      dataIndex: 'sender_name',
      width: 120,
      render: (name: string, record: Report) => (
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
              flexShrink: 0,
            }}
          >
            {(name || record.sender_staff_id).slice(0, 1).toUpperCase()}
          </div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {name || record.sender_staff_id.slice(-6)}
          </span>
        </div>
      ),
    },
    {
      title: '今日工作',
      dataIndex: ['parsed_content', 'today_work'],
      ellipsis: true,
      render: (text: string) => (
        <span style={{ fontSize: 13, color: text ? '#1f2937' : '#9ca3af' }}>
          {text || '未解析'}
        </span>
      ),
    },
    {
      title: '工作时长',
      dataIndex: ['parsed_content', 'work_hours'],
      width: 90,
      align: 'center' as const,
      render: (hours: number | null) =>
        hours ? (
          <Tag color="blue" style={{ fontWeight: 600, fontSize: 12 }}>
            {hours}h
          </Tag>
        ) : (
          <span style={{ color: '#9ca3af' }}>-</span>
        ),
    },
    {
      title: '解析状态',
      dataIndex: 'parse_status',
      width: 110,
      align: 'center' as const,
      render: (status: string) => {
        const map = parseStatusMap[status] || { color: 'default', text: status, badge: 'default' }
        return <Badge status={map.badge as any} text={map.text} />
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: Report) => (
        <Space size={4}>
          <button className="btn-action" onClick={() => openDetail(record)}>
            <EyeOutlined /> 查看
          </button>
          <button className="btn-action" onClick={() => openEdit(record)}>
            <EditOutlined /> 编辑
          </button>
          <Popconfirm
            title="确认删除"
            description="删除后不可恢复，是否继续？"
            onConfirm={() => handleDelete(record._id)}
          >
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
          <h2>日报管理</h2>
          <div className="subtitle">查看、筛选、编辑和导出日报数据</div>
        </div>
        <Space>
          <Button icon={<FilterOutlined />} onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? '收起筛选' : '展开筛选'}
          </Button>
          <Button type="primary" icon={<ExportOutlined />} onClick={handleExport}>
            导出CSV
          </Button>
        </Space>
      </div>

      {/* 筛选栏 */}
      {showFilters && (
        <div className="filter-bar">
          <Select
            placeholder="选择群聊"
            allowClear
            style={{ width: 200 }}
            value={filters.conversation_id}
            onChange={(value) => setFilters({ ...filters, conversation_id: value })}
            options={groups.map((g) => ({ label: g.name, value: g.conversation_id }))}
            prefix={<SearchOutlined />}
          />
          <RangePicker
            style={{ width: 260 }}
            onChange={handleDateChange}
            placeholder={['开始日期', '结束日期']}
          />
          <Select
            placeholder="解析状态"
            allowClear
            style={{ width: 140 }}
            value={filters.parse_status}
            onChange={(value) => setFilters({ ...filters, parse_status: value })}
            options={[
              { label: '解析成功', value: 'success' },
              { label: '解析失败', value: 'failed' },
              { label: '待解析', value: 'pending' },
            ]}
          />
          <Button icon={<ClearOutlined />} onClick={clearFilters}>
            清除筛选
          </Button>
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchReports} loading={loading}>
            刷新
          </Button>
        </div>
      )}

      {/* 数据表格 */}
      <div className="content-card">
        <div className="card-header">
          <h3>
            <FileTextOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            日报列表
          </h3>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>
            共 {reports.length} 条记录
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <Table
            className="pro-table"
            columns={columns}
            dataSource={reports}
            rowKey="_id"
            loading={loading}
            scroll={{ x: 1000 }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              pageSizeOptions: [10, 20, 50, 100],
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无日报数据"
                />
              ),
            }}
          />
        </div>
      </div>

      {/* 详情抽屉 */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileTextOutlined style={{ color: '#1677ff' }} />
            <span>日报详情</span>
          </div>
        }
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        bodyStyle={{ padding: 24 }}
      >
        {selectedReport && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 20px',
                background: '#fafbfc',
                borderRadius: 12,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: `hsl(${(selectedReport.sender_staff_id.charCodeAt(0) * 30) % 360}, 70%, 85%)`,
                  color: `hsl(${(selectedReport.sender_staff_id.charCodeAt(0) * 30) % 360}, 70%, 35%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {(selectedReport.sender_name || selectedReport.sender_staff_id).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
                  {selectedReport.sender_name || selectedReport.sender_staff_id}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {selectedReport.report_date} · {groupMap[selectedReport.conversation_id] || selectedReport.conversation_id}
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Badge
                  status={parseStatusMap[selectedReport.parse_status]?.badge as any}
                  text={parseStatusMap[selectedReport.parse_status]?.text}
                />
              </div>
            </div>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="日报ID">
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>
                  {selectedReport._id}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="原始内容">
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: '#4b5563',
                    background: '#fafbfc',
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  {selectedReport.raw_content}
                </pre>
              </Descriptions.Item>
              <Descriptions.Item label="今日工作">
                <span style={{ color: selectedReport.parsed_content?.today_work ? '#1f2937' : '#9ca3af' }}>
                  {selectedReport.parsed_content?.today_work || '未解析'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="明日计划">
                <span style={{ color: selectedReport.parsed_content?.tomorrow_plan ? '#1f2937' : '#9ca3af' }}>
                  {selectedReport.parsed_content?.tomorrow_plan || '未解析'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="遇到的问题">
                <span style={{ color: selectedReport.parsed_content?.problems ? '#1f2937' : '#9ca3af' }}>
                  {selectedReport.parsed_content?.problems || '未解析'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="工作时长">
                {selectedReport.parsed_content?.work_hours ? (
                  <Tag color="blue" style={{ fontWeight: 600 }}>
                    {selectedReport.parsed_content.work_hours} 小时
                  </Tag>
                ) : (
                  <span style={{ color: '#9ca3af' }}>-</span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="备注">
                <span style={{ color: selectedReport.parsed_content?.remarks ? '#1f2937' : '#9ca3af' }}>
                  {selectedReport.parsed_content?.remarks || '无'}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>

      {/* 编辑弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <EditOutlined style={{ color: '#1677ff' }} />
            <span>编辑日报</span>
          </div>
        }
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={() => form.submit()}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleUpdate} style={{ marginTop: 16 }}>
          <Form.Item name="today_work" label="今日工作">
            <TextArea rows={3} placeholder="请输入今日工作内容" />
          </Form.Item>
          <Form.Item name="tomorrow_plan" label="明日计划">
            <TextArea rows={3} placeholder="请输入明日计划" />
          </Form.Item>
          <Form.Item name="problems" label="遇到的问题">
            <TextArea rows={2} placeholder="请输入遇到的问题（如有）" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="work_hours" label="工作时长">
                <Input placeholder="例如：8" suffix="小时" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remarks" label="备注">
                <Input placeholder="其他补充信息" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default ReportsPage
