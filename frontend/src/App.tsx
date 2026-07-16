import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import Groups from './pages/Groups'
import Stats from './pages/Stats'
import ContentStats from './pages/ContentStats'
import AISummary from './pages/AISummary'
import Digests from './pages/Digests'

function App() {
  const isAuthenticated = !!localStorage.getItem('token')

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/content" element={<ContentStats />} />
                <Route path="/ai-summary" element={<AISummary />} />
                <Route path="/digests" element={<Digests />} />
              </Routes>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  )
}

export default App
