import React, { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Space,
  Select,
  DatePicker,
  Tag,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Empty,
  Badge,
  Drawer,
  Descriptions,
  Tabs,
  Card,
} from 'antd'
import {
  ExportOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  FilterOutlined,
  ClearOutlined,
  DatabaseOutlined,
  RobotOutlined,
  MessageOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import '../styles/design-system.css'

const API_BASE = '/api'

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  'Content-Type': 'application/json',
})

interface DataRecord {
  _id: string
  template_id: string
  template_name: string
  conversation_id: string
  sender_staff_id: string
  sender_name: string
  raw_content: string
  parsed_data: Record<string, any>
  parse_status: string
  record_date: string
  created_at: string
}

interface Template {
  _id: string
  name: string
  fields: { name: string; label: string; field_type: string }[]
}

const parseStatusMap: Record<string, { color: string; text: string; badge: string }> = {
  pending: { color: 'default', text: '待解析', badge: 'default' },
  success: { color: 'success', text: '解析成功', badge: 'success' },
  failed: { color: 'error', text: '解析失败', badge: 'error' },
  unmatched: { color: 'warning', text: '未匹配', badge: 'warning' },
}

const DataRecordsPage: React.FC = () => {
  const [records, setRecords] = useState<DataRecord[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null)
  const [editForm] = Form.useForm()
  const [showFilters, setShowFilters] = useState(true)
  const [activeTab, setActiveTab] = useState('raw')

  const [aiParsingId, setAiParsingId] = useState<string | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchParsing, setBatchParsing] = useState(false)

  const [filters, setFilters] = useState({
    template_id: undefined as string | undefined,
    conversation_id: undefined as string | undefined,
    start_date: undefined as string | undefined,
    end_date: undefined as string | undefined,
    parse_status: undefined as string | undefined,
  })

  useEffect(() => {
    fetchRecords()
    fetchTemplates()
  }, [filters])

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.template_id) params.append('template_id', filters.template_id)
      if (filters.conversation_id) params.append('conversation_id', filters.conversation_id)
      if (filters.start_date) params.append('start_date', filters.start_date)
      if (filters.end_date) params.append('end_date', filters.end_date)
      if (filters.parse_status) params.append('parse_status', filters.parse_status)
      params.append('page_size', '100')

      const res = await fetch(`${API_BASE}/data-records?${params.toString()}`, {
        headers: getHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setRecords(data)
      }
    } catch (e) {
      message.error('获取数据记录失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/templates?page_size=100`, {
        headers: getHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch (e) {
      console.error('获取模板失败:', e)
    }
  }

  const handleExport = async (endpoint: string) => {
    const params = new URLSearchParams()
    if (filters.template_id) params.append('template_id', filters.template_id)
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)

    try {
      const res = await fetch(`${API_BASE}/data-records/${endpoint}?${params.toString()}`, {
        headers: getHeaders(),
      })
      if (!res.ok) {
        const err = await res.json()
        message.error(err.detail || '导出失败')
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('content-disposition')
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      a.download = filenameMatch ? filenameMatch[1] : `export_${endpoint}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      message.error('导出请求失败')
    }
  }

  const handleExportRaw = () => handleExport('export/raw')
  const handleExportParsed = () => handleExport('export')

  const openDetail = (record: DataRecord) => {
    setSelectedRecord(record)
    setDetailVisible(true)
  }

  const openEdit = (record: DataRecord) => {
    setSelectedRecord(record)
    editForm.setFieldsValue(record.parsed_data || {})
    setEditVisible(true)
  }

  const handleUpdate = async () => {
    if (!selectedRecord) return
    try {
      const values = await editForm.validateFields()
      const res = await fetch(`${API_BASE}/data-records/${selectedRecord._id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          parsed_data: values,
          parse_status: 'success',
        }),
      })
      if (res.ok) {
        message.success('更新成功')
        setEditVisible(false)
        fetchRecords()
      }
    } catch (e) {
      message.error('更新失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/data-records/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })
      if (res.ok) {
        message.success('删除成功')
        fetchRecords()
      }
    } catch (e) {
      message.error('删除失败')
    }
  }

  const handleAiParse = async (record: DataRecord) => {
    setAiParsingId(record._id)
    try {
      const res = await fetch(`${API_BASE}/data-records/${record._id}/ai-parse`, {
        method: 'POST',
        headers: getHeaders(),
      })
      if (res.ok) {
        await res.json()
        message.success('AI 解析成功')
        fetchRecords()
      } else {
        const err = await res.json()
        message.error(err.detail || 'AI 解析失败')
      }
    } catch (e) {
      message.error('AI 解析请求失败')
    } finally {
      setAiParsingId(null)
    }
  }

  const handleBatchAiParse = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要解析的记录')
      return
    }
    setBatchParsing(true)
    let successCount = 0
    let failCount = 0
    for (const key of selectedRowKeys) {
      try {
        const res = await fetch(`${API_BASE}/data-records/${key}/ai-parse`, {
          method: 'POST',
          headers: getHeaders(),
        })
        if (res.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch (e) {
        failCount++
      }
    }
    setBatchParsing(false)
    setSelectedRowKeys([])
    message.success(`批量解析完成：成功 ${successCount} 条，失败 ${failCount} 条`)
    fetchRecords()
  }

  const clearFilters = () => {
    setFilters({
      template_id: undefined,
      conversation_id: undefined,
      start_date: undefined,
      end_date: undefined,
      parse_status: undefined,
    })
  }

  // 原始消息 Tab 表格列
  const getRawColumns = (): any[] => [
    {
      title: '日期',
      dataIndex: 'record_date',
      width: 110,
      render: (date: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#4b5563' }}>{date}</span>
      ),
    },
    {
      title: '模板',
      dataIndex: 'template_name',
      width: 140,
      render: (name: string) => (
        <Tag color={name === '未匹配模板' ? 'default' : 'blue'} style={{ fontWeight: 500 }}>
          {name}
        </Tag>
      ),
    },
    {
      title: '发送人',
      dataIndex: 'sender_name',
      width: 120,
      render: (name: string, record: DataRecord) => (
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
      title: '原始内容',
      dataIndex: 'raw_content',
      ellipsis: true,
      render: (text: string) => (
        <span style={{ fontSize: 13, color: '#4b5563' }}>{text}</span>
      ),
    },
    {
      title: '解析状态',
      dataIndex: 'parse_status',
      width: 110,
      render: (status: string) => {
        const map = parseStatusMap[status] || { color: 'default', text: status, badge: 'default' }
        return <Badge status={map.badge as any} text={map.text} />
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, record: DataRecord) => (
        <Space size={4}>
          <button className="btn-action" onClick={() => openDetail(record)}>
            <EyeOutlined /> 查看
          </button>
          {(record.parse_status === 'unmatched' || record.parse_status === 'failed') && (
            <button
              className="btn-action"
              onClick={() => handleAiParse(record)}
              disabled={aiParsingId === record._id}
            >
              <RobotOutlined /> {aiParsingId === record._id ? '解析中' : 'AI 解析'}
            </button>
          )}
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

  // 解析数据 Tab 表格列
  const getParsedColumns = (): any[] => {
    const baseColumns: any[] = [
      {
        title: '日期',
        dataIndex: 'record_date',
        width: 110,
        render: (date: string) => (
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#4b5563' }}>{date}</span>
        ),
      },
      {
        title: '模板',
        dataIndex: 'template_name',
        width: 140,
        render: (name: string) => (
          <Tag color={name === '未匹配模板' ? 'default' : 'blue'} style={{ fontWeight: 500 }}>
            {name}
          </Tag>
        ),
      },
      {
        title: '发送人',
        dataIndex: 'sender_name',
        width: 120,
        render: (name: string, record: DataRecord) => (
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
    ]

    // 如果有筛选模板，显示该模板的字段列
    if (filters.template_id) {
      const template = templates.find((t) => t._id === filters.template_id)
      if (template && template.fields) {
        template.fields.forEach((field) => {
          baseColumns.push({
            title: field.label,
            dataIndex: field.name,
            key: field.name,
            ellipsis: true,
            render: (_: any, record: DataRecord) => {
              const value = record.parsed_data?.[field.name]
              return (
                <span style={{ fontSize: 13, color: value ? '#1f2937' : '#9ca3af' }}>
                  {value || '-'}
                </span>
              )
            },
          } as any)
        })
      }
    }

    baseColumns.push(
      {
        title: '解析状态',
        dataIndex: 'parse_status',
        width: 110,
        render: (status: string) => {
          const map = parseStatusMap[status] || { color: 'default', text: status, badge: 'default' }
          return <Badge status={map.badge as any} text={map.text} />
        },
      },
      {
        title: '操作',
        key: 'action',
        width: 180,
        render: (_: any, record: DataRecord) => (
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
      }
    )

    return baseColumns
  }

  // 表格操作栏
  const TableActionBar = ({ isRaw }: { isRaw: boolean }) => (
    <div className="card-header">
      <h3>
        <FileTextOutlined style={{ marginRight: 8, color: '#1677ff' }} />
        {isRaw ? '原始消息列表' : '解析数据列表'}
      </h3>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {isRaw && selectedRowKeys.length > 0 && (
          <Button
            type="primary"
            icon={<RobotOutlined />}
            loading={batchParsing}
            onClick={handleBatchAiParse}
          >
            批量 AI 解析 ({selectedRowKeys.length})
          </Button>
        )}
        <span style={{ fontSize: 13, color: '#9ca3af' }}>
          共 {records.length} 条记录
        </span>
      </div>
    </div>
  )

  return (
    <div className="animate-fade-in">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h2>
            <DatabaseOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            数据中心
          </h2>
          <div className="subtitle">查看、筛选、编辑和导出群聊收集的数据</div>
        </div>
        <Space>
          <Button icon={<FilterOutlined />} onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? '收起筛选' : '展开筛选'}
          </Button>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={activeTab === 'raw' ? handleExportRaw : handleExportParsed}
          >
            {activeTab === 'raw' ? '导出原始消息' : '导出解析数据'}
          </Button>
        </Space>
      </div>

      {/* 筛选栏 */}
      {showFilters && (
        <div className="filter-bar">
          <Select
            placeholder="选择模板"
            allowClear
            style={{ width: 200 }}
            value={filters.template_id}
            onChange={(value) => setFilters({ ...filters, template_id: value })}
            options={templates.map((t) => ({ label: t.name, value: t._id }))}
          />
          <DatePicker.RangePicker
            style={{ width: 260 }}
            onChange={(dates: any) => {
              if (dates && dates.length === 2) {
                setFilters({
                  ...filters,
                  start_date: dates[0].format('YYYY-MM-DD'),
                  end_date: dates[1].format('YYYY-MM-DD'),
                })
              } else {
                setFilters({ ...filters, start_date: undefined, end_date: undefined })
              }
            }}
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
              { label: '未匹配', value: 'unmatched' },
            ]}
          />
          <Button icon={<ClearOutlined />} onClick={clearFilters}>
            清除筛选
          </Button>
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchRecords} loading={loading}>
            刷新
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Card style={{ marginTop: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'raw',
              label: (
                <span>
                  <MessageOutlined style={{ marginRight: 6 }} />
                  原始消息
                </span>
              ),
              children: (
                <div>
                  <TableActionBar isRaw={true} />
                  <div style={{ padding: 0 }}>
                    <Table
                      className="pro-table"
                      columns={getRawColumns()}
                      dataSource={records}
                      rowKey="_id"
                      loading={loading}
                      scroll={{ x: 1000 }}
                      rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                      }}
                      pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                      }}
                      locale={{
                        emptyText: <Empty description="暂无原始消息记录" />,
                      }}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'parsed',
              label: (
                <span>
                  <CheckCircleOutlined style={{ marginRight: 6 }} />
                  解析数据
                </span>
              ),
              children: (
                <div>
                  <TableActionBar isRaw={false} />
                  <div style={{ padding: 0 }}>
                    <Table
                      className="pro-table"
                      columns={getParsedColumns()}
                      dataSource={records}
                      rowKey="_id"
                      loading={loading}
                      scroll={{ x: 1000 }}
                      pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                      }}
                      locale={{
                        emptyText: <Empty description="暂无解析数据记录" />,
                      }}
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileTextOutlined style={{ color: '#1677ff' }} />
            <span>数据详情</span>
          </div>
        }
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        bodyStyle={{ padding: 24 }}
      >
        {selectedRecord && (
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
                  background: `hsl(${(selectedRecord.sender_staff_id.charCodeAt(0) * 30) % 360}, 70%, 85%)`,
                  color: `hsl(${(selectedRecord.sender_staff_id.charCodeAt(0) * 30) % 360}, 70%, 35%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {(selectedRecord.sender_name || selectedRecord.sender_staff_id).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
                  {selectedRecord.sender_name || selectedRecord.sender_staff_id}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {selectedRecord.record_date} · {selectedRecord.template_name}
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Badge
                  status={parseStatusMap[selectedRecord.parse_status]?.badge as any}
                  text={parseStatusMap[selectedRecord.parse_status]?.text}
                />
              </div>
            </div>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="记录ID">
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>
                  {selectedRecord._id}
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
                  {selectedRecord.raw_content}
                </pre>
              </Descriptions.Item>
              {Object.entries(selectedRecord.parsed_data || {}).map(([key, value]) => {
                const fieldLabel = templates
                  .find((t) => t._id === selectedRecord.template_id)
                  ?.fields.find((f) => f.name === key)?.label || key
                return (
                  <Descriptions.Item key={key} label={fieldLabel}>
                    <span style={{ color: value ? '#1f2937' : '#9ca3af' }}>
                      {String(value) || '未解析'}
                    </span>
                  </Descriptions.Item>
                )
              })}
            </Descriptions>
          </div>
        )}
      </Drawer>

      {/* 编辑弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <EditOutlined style={{ color: '#1677ff' }} />
            <span>编辑数据</span>
          </div>
        }
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleUpdate}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          {selectedRecord &&
            Object.entries(selectedRecord.parsed_data || {}).map(([key, value]) => {
              const fieldLabel = templates
                .find((t) => t._id === selectedRecord.template_id)
                ?.fields.find((f) => f.name === key)?.label || key
              return (
                <Form.Item key={key} name={key} label={fieldLabel}>
                  <Input.TextArea rows={2} defaultValue={String(value)} />
                </Form.Item>
              )
            })}
        </Form>
      </Modal>
    </div>
  )
}

export default DataRecordsPage
