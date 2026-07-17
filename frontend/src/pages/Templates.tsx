import React, { useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Popconfirm,
  Empty,
  Row,
  Col,
  Divider,
  Badge,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  TagsOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import '../styles/design-system.css'

const API_BASE = '/api'

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  'Content-Type': 'application/json',
})

interface TemplateField {
  name: string
  label: string
  field_type: string
  required: boolean
  options: string[]
  description: string
  keywords: string[]
  default_value: string
}

interface Template {
  _id: string
  name: string
  description: string
  keywords: string[]
  fields: TemplateField[]
  conversation_ids: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

const FIELD_TYPES = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '下拉选择', value: 'select' },
  { label: '日期', value: 'date' },
  { label: '是/否', value: 'boolean' },
]

const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [form] = Form.useForm()
  const [fieldForms, setFieldForms] = useState<TemplateField[]>([])

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/templates?page=1&page_size=100`, {
        headers: getHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch (e) {
      message.error('获取模板列表失败')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingTemplate(null)
    form.resetFields()
    setFieldForms([])
    setModalVisible(true)
  }

  const openEdit = (template: Template) => {
    setEditingTemplate(template)
    form.setFieldsValue({
      name: template.name,
      description: template.description,
      keywords: template.keywords?.join(', ') || '',
      is_active: template.is_active,
    })
    setFieldForms(template.fields || [])
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        name: values.name,
        description: values.description || '',
        keywords: values.keywords
          ? values.keywords.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
          : [],
        fields: fieldForms.map((f) => ({
          ...f,
          keywords: f.keywords || [],
          options: f.options || [],
        })),
        conversation_ids: [],
        is_active: values.is_active !== false,
      }

      const url = editingTemplate
        ? `${API_BASE}/templates/${editingTemplate._id}`
        : `${API_BASE}/templates`
      const method = editingTemplate ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        message.success(editingTemplate ? '更新成功' : '创建成功')
        setModalVisible(false)
        fetchTemplates()
      } else {
        const err = await res.json()
        message.error(err.detail || '操作失败')
      }
    } catch (e) {
      // 表单验证失败
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/templates/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })
      if (res.ok) {
        message.success('删除成功')
        fetchTemplates()
      }
    } catch (e) {
      message.error('删除失败')
    }
  }

  const addField = () => {
    setFieldForms([
      ...fieldForms,
      {
        name: '',
        label: '',
        field_type: 'text',
        required: false,
        options: [],
        description: '',
        keywords: [],
        default_value: '',
      },
    ])
  }

  const removeField = (index: number) => {
    setFieldForms(fieldForms.filter((_, i) => i !== index))
  }

  const updateField = (index: number, key: keyof TemplateField, value: any) => {
    const newFields = [...fieldForms]
    newFields[index] = { ...newFields[index], [key]: value }
    setFieldForms(newFields)
  }

  const copyTemplate = (template: Template) => {
    setEditingTemplate(null)
    form.setFieldsValue({
      name: `${template.name} (复制)`,
      description: template.description,
      keywords: template.keywords?.join(', ') || '',
      is_active: true,
    })
    setFieldForms(
      template.fields.map((f) => ({
        ...f,
        keywords: [...f.keywords],
        options: [...f.options],
      }))
    )
    setModalVisible(true)
  }

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      render: (text: string, record: Template) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1f2937' }}>{text}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {record.description || '无描述'}
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 90,
      align: 'center' as const,
      render: (v: boolean) =>
        v ? (
          <Badge status="success" text="启用" />
        ) : (
          <Badge status="default" text="停用" />
        ),
    },
    {
      title: '字段数',
      dataIndex: 'fields',
      width: 80,
      align: 'center' as const,
      render: (fields: TemplateField[]) => (
        <Tag color="blue">{fields?.length || 0}</Tag>
      ),
    },
    {
      title: '触发关键词',
      dataIndex: 'keywords',
      render: (keywords: string[]) => (
        <Space size={4} wrap>
          {keywords?.map((k, i) => (
            <Tag key={i} color="cyan">
              {k}
            </Tag>
          )) || <span style={{ color: '#9ca3af' }}>无</span>}
        </Space>
      ),
    },
    {
      title: '绑定群聊',
      dataIndex: 'conversation_ids',
      width: 100,
      align: 'center' as const,
      render: (ids: string[]) => <Tag>{ids?.length || 0} 个</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      align: 'center' as const,
      render: (_: any, record: Template) => (
        <Space size={4}>
          <button className="btn-action" onClick={() => openEdit(record)}>
            <EditOutlined /> 编辑
          </button>
          <button className="btn-action" onClick={() => copyTemplate(record)}>
            <CopyOutlined /> 复制
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
          <h2>
            <AppstoreOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            问卷模板
          </h2>
          <div className="subtitle">配置群聊问卷模板，定义字段和触发关键词</div>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            创建模板
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchTemplates} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 模板列表 */}
      <div className="content-card">
        <div className="card-header">
          <h3>
            <FileTextOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            模板列表
          </h3>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>
            共 {templates.length} 个模板
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <Table
            className="pro-table"
            columns={columns}
            dataSource={templates}
            rowKey="_id"
            loading={loading}
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: <Empty description="暂无模板，请创建" /> }}
          />
        </div>
      </div>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AppstoreOutlined style={{ color: '#1677ff' }} />
            <span>{editingTemplate ? '编辑模板' : '创建模板'}</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={800}
        okText="保存"
        cancelText="取消"
        bodyStyle={{ maxHeight: '70vh', overflow: 'auto', padding: '24px' }}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="name"
                label="模板名称"
                rules={[{ required: true, message: '请输入模板名称' }]}
              >
                <Input placeholder="例如：IT报修登记" size="large" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_active" label="状态" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="停用" defaultChecked />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="模板描述">
            <Input.TextArea placeholder="描述这个模板的用途" rows={2} />
          </Form.Item>

          <Form.Item name="keywords" label="触发关键词">
            <Input placeholder="报修, 维修, 故障（用逗号分隔）" />
          </Form.Item>

          <Divider />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              <TagsOutlined style={{ marginRight: 8, color: '#1677ff' }} />
              字段配置
            </h3>
            <Button type="dashed" icon={<PlusOutlined />} onClick={addField}>
              添加字段
            </Button>
          </div>

          {fieldForms.length === 0 && (
            <Empty description="请添加字段" style={{ margin: '24px 0' }} />
          )}

          {fieldForms.map((field, index) => (
            <Card
              key={index}
              size="small"
              style={{ marginBottom: 12 }}
              title={`字段 ${index + 1}: ${field.label || '未命名'}`}
              extra={
                <Button type="text" danger size="small" onClick={() => removeField(index)}>
                  删除
                </Button>
              }
            >
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item label="字段标识" required>
                    <Input
                      placeholder="如 repair_content"
                      value={field.name}
                      onChange={(e) => updateField(index, 'name', e.target.value)}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="显示名称" required>
                    <Input
                      placeholder="如 报修内容"
                      value={field.label}
                      onChange={(e) => updateField(index, 'label', e.target.value)}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="字段类型">
                    <Select
                      value={field.field_type}
                      onChange={(v) => updateField(index, 'field_type', v)}
                      options={FIELD_TYPES}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item label="是否必填">
                    <Switch
                      checked={field.required}
                      onChange={(v) => updateField(index, 'required', v)}
                      checkedChildren="必填"
                      unCheckedChildren="选填"
                    />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item label="匹配关键词">
                    <Input
                      placeholder="报修, 坏了, 故障（用逗号分隔）"
                      value={field.keywords?.join(', ') || ''}
                      onChange={(e) =>
                        updateField(
                          index,
                          'keywords',
                          e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
                        )
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>

              {field.field_type === 'select' && (
                <Form.Item label="选项值">
                  <Input
                    placeholder="一般, 紧急, 特急（用逗号分隔）"
                    value={field.options?.join(', ') || ''}
                    onChange={(e) =>
                      updateField(
                        index,
                        'options',
                        e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
                      )
                    }
                  />
                </Form.Item>
              )}

              <Form.Item label="字段说明">
                <Input
                  placeholder="字段的详细说明"
                  value={field.description}
                  onChange={(e) => updateField(index, 'description', e.target.value)}
                />
              </Form.Item>
            </Card>
          ))}
        </Form>
      </Modal>
    </div>
  )
}

export default TemplatesPage
