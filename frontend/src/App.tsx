import { FC } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Templates from './pages/Templates'
import DataRecords from './pages/DataRecords'
import Groups from './pages/Groups'
import Stats from './pages/Stats'
import AIAnalysis from './pages/AIAnalysis'

const App: FC = () => {
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
                <Route path="/templates" element={<Templates />} />
                <Route path="/data-records" element={<DataRecords />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/ai-analysis" element={<AIAnalysis />} />
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
