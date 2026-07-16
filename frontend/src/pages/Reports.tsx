import React, { useEffect, useState } from 'react'
import {
  Table,
  Card,
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
} from 'antd'
import {
  ExportOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getReports,
  getGroups,
  exportReportsCSV,
  updateReport,
  deleteReport,
  type Report,
  type Group,
} from '../api'

const { RangePicker } = DatePicker
const { TextArea } = Input

const parseStatusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待解析' },
  success: { color: 'success', text: '解析成功' },
  failed: { color: 'error', text: '解析失败' },
}

const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [form] = Form.useForm()

  // 筛选条件
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
    },
    {
      title: '群聊',
      dataIndex: 'conversation_id',
      width: 150,
      render: (id: string) => groupMap[id] || `群聊-${id.slice(-8)}`,
    },
    {
      title: '发送人',
      dataIndex: 'sender_name',
      width: 120,
      render: (name: string, record: Report) => name || record.sender_staff_id.slice(-6),
    },
    {
      title: '今日工作',
      dataIndex: ['parsed_content', 'today_work'],
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '工作时长',
      dataIndex: ['parsed_content', 'work_hours'],
      width: 90,
      align: 'center' as const,
      render: (hours: number | null) => (hours ? `${hours}h` : '-'),
    },
    {
      title: '解析状态',
      dataIndex: 'parse_status',
      width: 100,
      align: 'center' as const,
      render: (status: string) => {
        const map = parseStatusMap[status] || { color: 'default', text: status }
        return <Tag color={map.color}>{map.text}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: Report) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            查看
          </Button>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="删除后不可恢复，是否继续？"
            onConfirm={() => handleDelete(record._id)}
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>日报管理</h2>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="选择群聊"
              allowClear
              style={{ width: '100%' }}
              value={filters.conversation_id}
              onChange={(value) => setFilters({ ...filters, conversation_id: value })}
              options={groups.map((g) => ({ label: g.name, value: g.conversation_id }))}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={7}>
            <RangePicker
              style={{ width: '100%' }}
              onChange={handleDateChange}
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={5}>
            <Select
              placeholder="解析状态"
              allowClear
              style={{ width: '100%' }}
              value={filters.parse_status}
              onChange={(value) => setFilters({ ...filters, parse_status: value })}
              options={[
                { label: '解析成功', value: 'success' },
                { label: '解析失败', value: 'failed' },
                { label: '待解析', value: 'pending' },
              ]}
            />
          </Col>
          <Col xs={24} sm={24} md={24} lg={6}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchReports}>
                刷新
              </Button>
              <Button type="primary" icon={<ExportOutlined />} onClick={handleExport}>
                导出CSV
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={reports}
        rowKey="_id"
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
      />

      {/* 详情抽屉 */}
      <Drawer
        title="日报详情"
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {selectedReport && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="日报ID">{selectedReport._id}</Descriptions.Item>
            <Descriptions.Item label="日期">{selectedReport.report_date}</Descriptions.Item>
            <Descriptions.Item label="群聊">
              {groupMap[selectedReport.conversation_id] || selectedReport.conversation_id}
            </Descriptions.Item>
            <Descriptions.Item label="发送人">
              {selectedReport.sender_name || selectedReport.sender_staff_id}
            </Descriptions.Item>
            <Descriptions.Item label="原始内容">
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selectedReport.raw_content}</pre>
            </Descriptions.Item>
            <Descriptions.Item label="今日工作">
              {selectedReport.parsed_content?.today_work || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="明日计划">
              {selectedReport.parsed_content?.tomorrow_plan || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="遇到的问题">
              {selectedReport.parsed_content?.problems || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="工作时长">
              {selectedReport.parsed_content?.work_hours ? `${selectedReport.parsed_content.work_hours} 小时` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="备注">
              {selectedReport.parsed_content?.remarks || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="解析状态">
              <Tag color={parseStatusMap[selectedReport.parse_status]?.color}>
                {parseStatusMap[selectedReport.parse_status]?.text}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑日报"
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdate}>
          <Form.Item name="today_work" label="今日工作">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="tomorrow_plan" label="明日计划">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="problems" label="遇到的问题">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="work_hours" label="工作时长">
            <Input placeholder="例如：8" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ReportsPage
