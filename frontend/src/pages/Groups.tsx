import React, { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Empty,
  Badge,
  Row,
  Col,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TeamOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { getGroups, createGroup, updateGroup, deleteGroup, type Group } from '../api'
import '../styles/design-system.css'

const GroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    setLoading(true)
    try {
      const res = await getGroups()
      setGroups(res.data)
    } catch (error) {
      message.error('获取群聊列表失败')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingGroup(null)
    form.resetFields()
    setModalVisible(true)
  }

  const openEdit = (group: Group) => {
    setEditingGroup(group)
    form.setFieldsValue({
      name: group.name,
      conversation_id: group.conversation_id,
      project_name: group.project_name || '',
      project_id: group.project_id || '',
    })
    setModalVisible(true)
  }

  const handleSubmit = async (values: any) => {
    try {
      if (editingGroup) {
        await updateGroup(editingGroup._id, {
          name: values.name,
          project_name: values.project_name || undefined,
          project_id: values.project_id || undefined,
        })
        message.success('更新成功')
      } else {
        await createGroup({
          conversation_id: values.conversation_id,
          name: values.name,
          project_name: values.project_name || undefined,
          project_id: values.project_id || undefined,
        })
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchGroups()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteGroup(id)
      message.success('删除成功')
      fetchGroups()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const columns = [
    {
      title: '群聊名称',
      dataIndex: 'name',
      render: (text: string, record: Group) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `hsl(${(record.conversation_id.charCodeAt(0) * 30) % 360}, 70%, 85%)`,
              color: `hsl(${(record.conversation_id.charCodeAt(0) * 30) % 360}, 70%, 35%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {text.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#1f2937' }}>{text}</div>
            {!record.is_active && <Tag color="red" style={{ marginTop: 2 }}>已停用</Tag>}
          </div>
        </div>
      ),
    },
    {
      title: 'Conversation ID',
      dataIndex: 'conversation_id',
      ellipsis: true,
      width: 220,
      render: (id: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{id}</span>
      ),
    },
    {
      title: '关联项目',
      dataIndex: 'project_name',
      render: (text: string | null) =>
        text ? (
          <Tag color="blue" style={{ fontWeight: 500 }}>{text}</Tag>
        ) : (
          <span style={{ color: '#9ca3af' }}>-</span>
        ),
    },
    {
      title: '成员数',
      dataIndex: 'member_count',
      width: 90,
      align: 'center' as const,
      render: (v: number) => <Tag color="green" style={{ fontWeight: 600 }}>{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 90,
      align: 'center' as const,
      render: (v: boolean) =>
        v ? (
          <Badge status="success" text="正常" />
        ) : (
          <Badge status="error" text="停用" />
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (text: string) => (
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {new Date(text).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: Group) => (
        <Space size={4}>
          <button className="btn-action" onClick={() => openEdit(record)}>
            <EditOutlined /> 编辑
          </button>
          <Popconfirm
            title="确认停用"
            description="停用后该群聊的日报将不再被收集，是否继续？"
            onConfirm={() => handleDelete(record._id)}
          >
            <button className="btn-action danger">
              <DeleteOutlined /> 停用
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
            <TeamOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            群聊管理
          </h2>
          <div className="subtitle">管理已接入的钉钉群聊，配置关联项目</div>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            添加群聊
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchGroups} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 数据表格 */}
      <div className="content-card">
        <div className="card-header">
          <h3>
            <GlobalOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            群聊列表
          </h3>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>
            共 {groups.length} 个群聊
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <Table
            className="pro-table"
            columns={columns}
            dataSource={groups}
            rowKey="_id"
            loading={loading}
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: <Empty description="暂无群聊数据" /> }}
          />
        </div>
      </div>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TeamOutlined style={{ color: '#1677ff' }} />
            <span>{editingGroup ? '编辑群聊' : '添加群聊'}</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={560}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="群聊名称"
            rules={[{ required: true, message: '请输入群聊名称' }]}
          >
            <Input placeholder="例如：项目A日报群" size="large" />
          </Form.Item>
          {!editingGroup && (
            <Form.Item
              name="conversation_id"
              label="Conversation ID"
              rules={[{ required: true, message: '请输入 Conversation ID' }]}
            >
              <Input placeholder="钉钉群聊的 conversation_id" size="large" />
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="project_name" label="关联项目名称">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="project_id" label="关联项目 ID">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default GroupsPage
