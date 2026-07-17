import React, { useEffect, useState } from 'react'
import { Row, Col, Spin, Badge, Tag } from 'antd'
import {
  DatabaseOutlined,
  TeamOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  MessageOutlined,
  CloudServerOutlined,
  ApiOutlined,
  AppstoreOutlined,
  FormOutlined,
} from '@ant-design/icons'
import { getOverviewStats } from '../api'
import type { OverviewStats } from '../api'
import '../styles/design-system.css'

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await getOverviewStats()
      setStats(res.data)
    } catch (error) {
      console.error('获取统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  const statCards = [
    {
      title: '数据总数',
      value: stats?.total_reports || 0,
      icon: <DatabaseOutlined />,
      color: 'blue',
      suffix: '条',
    },
    {
      title: '今日数据',
      value: stats?.today_reports || 0,
      icon: <ClockCircleOutlined />,
      color: 'green',
      suffix: '条',
    },
    {
      title: '本周数据',
      value: stats?.week_reports || 0,
      icon: <DatabaseOutlined />,
      color: 'purple',
      suffix: '条',
    },
    {
      title: '问卷模板',
      value: 0,
      icon: <FormOutlined />,
      color: 'cyan',
      suffix: '个',
    },
    {
      title: '已接入群聊',
      value: stats?.total_groups || 0,
      icon: <TeamOutlined />,
      color: 'orange',
      suffix: '个',
    },
    {
      title: '员工总数',
      value: stats?.total_users || 0,
      icon: <UserOutlined />,
      color: 'cyan',
      suffix: '人',
    },
    {
      title: '解析成功',
      value: stats?.success_parses || 0,
      icon: <CheckCircleOutlined />,
      color: 'green',
      suffix: '条',
    },
    {
      title: '解析失败',
      value: stats?.failed_parses || 0,
      icon: <ExclamationCircleOutlined />,
      color: 'red',
      suffix: '条',
    },
  ]

  return (
    <div className="animate-fade-in">
      {/* 页面标题 */}
      <div className="page-header">
        <div>
          <h2>数据概览</h2>
          <div className="subtitle">实时监控群聊数据收集与解析状态</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Tag icon={<CheckCircleOutlined />} color="success">
            系统正常运行
          </Tag>
        </div>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        {statCards.map((card, index) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={index}>
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-label">{card.title}</div>
                <div className={`stat-icon ${card.color}`}>{card.icon}</div>
              </div>
              <div className="stat-body">
                <div className="stat-value">
                  {card.value}
                  <span style={{ fontSize: 14, fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>
                    {card.suffix}
                  </span>
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* 系统状态和使用说明 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <div className="content-card">
            <div className="card-header">
              <h3>
                <CloudServerOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                系统状态
              </h3>
              <Badge status="success" text="运行中" />
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <StatusItem
                  icon={<CloudServerOutlined />}
                  title="MongoDB 数据库"
                  desc="连接正常，数据同步中"
                  status="success"
                />
                <StatusItem
                  icon={<ApiOutlined />}
                  title="钉钉 Stream 连接"
                  desc="等待配置凭据"
                  status="warning"
                />
                <StatusItem
                  icon={<MessageOutlined />}
                  title="消息收集服务"
                  desc="已就绪"
                  status="success"
                />
                <StatusItem
                  icon={<CheckCircleOutlined />}
                  title="AI 解析服务"
                  desc="DeepSeek API 已配置"
                  status="success"
                />
              </div>
            </div>
          </div>
        </Col>

        <Col xs={24} lg={12}>
          <div className="content-card">
            <div className="card-header">
              <h3>
                <AppstoreOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                使用说明
              </h3>
            </div>
            <div className="card-body">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  fontSize: 14,
                  color: '#4b5563',
                }}
              >
                {[
                  '在"问卷模板"页面创建收集模板（如报修登记、客户签到）',
                  '配置模板的字段和触发关键词',
                  '将机器人添加到需要收集数据的群聊中',
                  '群成员 @机器人 发送消息，系统自动匹配模板并解析',
                  '在"数据管理"页面查看、筛选和导出收集的数据',
                ].map((text, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: '#e6f4ff',
                        color: '#1677ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {i + 1}
                    </div>
                    <span style={{ lineHeight: 1.6 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  )
}

// 状态项组件
function StatusItem({
  icon,
  title,
  desc,
  status,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  status: 'success' | 'warning' | 'error'
}) {
  const statusColors = {
    success: '#52c41a',
    warning: '#faad14',
    error: '#ff4d4f',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${statusColors[status]}15`,
          color: statusColors[status],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{desc}</div>
      </div>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: statusColors[status],
          boxShadow: `0 0 0 3px ${statusColors[status]}30`,
        }}
      />
    </div>
  )
}

export default Dashboard
