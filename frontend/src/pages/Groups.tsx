import React, { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { getGroups, createGroup, updateGroup, deleteGroup, type Group } from '../api'

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
        <Space>
          <TeamOutlined />
          <span>{text}</span>
          {!record.is_active && <Tag color="red">已停用</Tag>}
        </Space>
      ),
    },
    {
      title: 'Conversation ID',
      dataIndex: 'conversation_id',
      ellipsis: true,
      width: 200,
    },
    {
      title: '关联项目',
      dataIndex: 'project_name',
      render: (text: string | null) => text || '-',
    },
    {
      title: '成员数',
      dataIndex: 'member_count',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Group) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认停用"
            description="停用后该群聊的日报将不再被收集，是否继续？"
            onConfirm={() => handleDelete(record._id)}
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />}>
              停用
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>群聊管理</h2>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            添加群聊
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchGroups}>
            刷新
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={groups}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingGroup ? '编辑群聊' : '添加群聊'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="群聊名称"
            rules={[{ required: true, message: '请输入群聊名称' }]}
          >
            <Input placeholder="例如：项目A日报群" />
          </Form.Item>
          {!editingGroup && (
            <Form.Item
              name="conversation_id"
              label="Conversation ID"
              rules={[{ required: true, message: '请输入 Conversation ID' }]}
            >
              <Input placeholder="钉钉群聊的 conversation_id" />
            </Form.Item>
          )}
          <Form.Item name="project_name" label="关联项目名称">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="project_id" label="关联项目 ID">
            <Input placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default GroupsPage
