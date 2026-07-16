import React, { useEffect, useState } from 'react'
import { Card, Statistic, Row, Col, Spin } from 'antd'
import {
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { getOverviewStats } from '../api'
import type { OverviewStats } from '../api'

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

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>数据概览</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="日报总数"
              value={stats?.total_reports || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="今日日报"
              value={stats?.today_reports || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="本周日报"
              value={stats?.week_reports || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="已接入群聊"
              value={stats?.total_groups || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="员工总数"
              value={stats?.total_users || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="解析成功"
              value={stats?.success_parses || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="解析失败"
              value={stats?.failed_parses || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="系统状态">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />
              <div>
                <div style={{ fontWeight: 500 }}>MongoDB 数据库</div>
                <div style={{ color: '#999', fontSize: 14 }}>连接正常</div>
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />
              <div>
                <div style={{ fontWeight: 500 }}>钉钉 Stream 连接</div>
                <div style={{ color: '#999', fontSize: 14 }}>等待配置</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="使用说明">
            <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
              <li>在钉钉开放平台创建企业内部应用并添加机器人能力</li>
              <li>将机器人添加到需要收集日报的群聊中</li>
              <li>员工在群里 @机器人 发送日报内容</li>
              <li>系统自动解析并存储到数据库</li>
              <li>在管理后台查看、筛选和考核日报</li>
            </ol>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
