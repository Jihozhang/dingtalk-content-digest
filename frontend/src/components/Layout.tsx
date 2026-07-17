import React, { useState } from 'react'
import { Layout as AntLayout, Menu, Button, theme, Avatar, Dropdown, Badge } from 'antd'
import {
  DashboardOutlined,
  TeamOutlined,
  BarChartOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  AppstoreOutlined,
  FormOutlined,
  DatabaseOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import '../styles/design-system.css'

const { Header, Sider, Content } = AntLayout

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const {
    token: { borderRadiusLG },
  } = theme.useToken()

  const handleLogout = () => {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '数据概览',
    },
    {
      key: '/templates',
      icon: <FormOutlined />,
      label: '问卷模板',
    },
    {
      key: '/data-records',
      icon: <DatabaseOutlined />,
      label: '数据中心',
    },
    {
      key: '/groups',
      icon: <TeamOutlined />,
      label: '群聊管理',
    },
    {
      key: '/stats',
      icon: <BarChartOutlined />,
      label: '统计报表',
    },
    {
      key: '/ai-analysis',
      icon: <RobotOutlined />,
      label: 'AI 分析',
    },
  ]

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <AntLayout style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="dark"
        width={240}
        style={{
          background: '#1a1d2e',
          boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
          zIndex: 10,
        }}
      >
        {/* Logo 区域 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <AppstoreOutlined />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#fff',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                群聊数据收集
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.4)',
                  lineHeight: 1.2,
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                Data Collection Platform
              </div>
            </div>
          )}
        </div>

        {/* 导航菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            background: 'transparent',
            borderRight: 'none',
            padding: '12px 0',
          }}
          theme="dark"
        />

        {/* 底部信息 */}
        {!collapsed && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '16px 20px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
              textAlign: 'center',
            }}
          >
            v1.0.0
          </div>
        )}
      </Sider>

      <AntLayout>
        {/* 顶部 Header */}
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e5e7eb',
            height: 64,
            position: 'sticky',
            top: 0,
            zIndex: 5,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, color: '#6b7280' }}
            />
            <div
              style={{
                height: 20,
                width: 1,
                background: '#e5e7eb',
              }}
            />
            <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 500 }}>
              {menuItems.find((item) => item.key === location.pathname)?.label || '数据概览'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* 通知 */}
            <Badge dot offset={[-2, 2]}>
              <Button
                type="text"
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                }
                style={{ padding: 4 }}
              />
            </Badge>

            {/* 用户 */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '4px 12px',
                  borderRadius: 8,
                  transition: 'background 200ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar
                  size={32}
                  icon={<UserOutlined />}
                  style={{ background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>管理员</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>admin</span>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* 内容区域 */}
        <Content
          style={{
            margin: 24,
            padding: 0,
            background: 'transparent',
            borderRadius: borderRadiusLG,
            minHeight: 280,
            overflow: 'auto',
          }}
        >
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
