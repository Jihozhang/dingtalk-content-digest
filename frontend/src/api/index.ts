import axios, { AxiosError } from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：添加 Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器：处理 401 错误
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ==================== 认证 API ====================

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  access_token: string
  token_type: string
}

export const login = (params: LoginParams) =>
  api.post<LoginResult>('/auth/login', new URLSearchParams({
    username: params.username,
    password: params.password,
  }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

export const getMe = () => api.get('/auth/me')

// ==================== 日报 API ====================

export interface Report {
  _id: string
  raw_content: string
  parsed_content: {
    today_work: string
    tomorrow_plan: string
    problems: string
    work_hours: number | null
    remarks: string
  }
  parse_status: string
  conversation_id: string
  sender_staff_id: string
  sender_name: string
  message_id: string | null
  created_at: string
  report_date: string
  assessment_status: string
  assessment_note: string | null
}

export interface ReportListParams {
  conversation_id?: string
  sender_staff_id?: string
  report_date?: string
  start_date?: string
  end_date?: string
  parse_status?: string
  assessment_status?: string
  page?: number
  page_size?: number
}

export const getReports = (params?: ReportListParams) =>
  api.get<Report[]>('/reports', { params })

export const getReportCount = (params?: { conversation_id?: string; report_date?: string }) =>
  api.get('/reports/count', { params })

export const getReport = (id: string) =>
  api.get<Report>(`/reports/${id}`)

export interface ReportUpdateData {
  parsed_content?: {
    today_work?: string
    tomorrow_plan?: string
    problems?: string
    work_hours?: number | null
    remarks?: string
  }
  parse_status?: string
  assessment_status?: string
  assessment_note?: string
}

export const updateReport = (id: string, data: ReportUpdateData) =>
  api.put<Report>(`/reports/${id}`, data)

export const deleteReport = (id: string) =>
  api.delete(`/reports/${id}`)

export const exportReportsCSV = (params?: { conversation_id?: string; start_date?: string; end_date?: string }) => {
  const query = new URLSearchParams()
  if (params?.conversation_id) query.append('conversation_id', params.conversation_id)
  if (params?.start_date) query.append('start_date', params.start_date)
  if (params?.end_date) query.append('end_date', params.end_date)
  window.open(`/api/reports/export/csv?${query.toString()}`, '_blank')
}

// ==================== 群聊 API ====================

export interface Group {
  _id: string
  conversation_id: string
  name: string
  project_name: string | null
  project_id: string | null
  created_at: string
  member_count: number
  is_active: boolean
}

export interface GroupCreateData {
  conversation_id: string
  name: string
  project_name?: string
  project_id?: string
}

export interface GroupUpdateData {
  name?: string
  project_name?: string
  project_id?: string
}

export const getGroups = () => api.get<Group[]>('/groups')
export const getGroup = (id: string) => api.get<Group>(`/groups/${id}`)
export const createGroup = (data: GroupCreateData) => api.post<Group>('/groups', data)
export const updateGroup = (id: string, data: GroupUpdateData) => api.put<Group>(`/groups/${id}`, data)
export const deleteGroup = (id: string) => api.delete(`/groups/${id}`)

// ==================== 统计 API ====================

export interface DailyStats {
  date: string
  total_reports: number
  success_parse_count: number
  failed_parse_count: number
}

export interface GroupStats {
  group_id: string
  group_name: string
  total_reports: number
  member_count: number
  submission_rate: number
}

export interface UserStats {
  staff_id: string
  name: string
  total_reports: number
  success_parse_count: number
  message_count: number
  active_days: number
  last_report_date: string | null
}

export interface OverviewStats {
  total_reports: number
  today_reports: number
  week_reports: number
  pending_parses: number
  success_parses: number
  failed_parses: number
  total_groups: number
  total_users: number
}

export const getDailyStats = (params?: { start_date?: string; end_date?: string; template_id?: string }) =>
  api.get<DailyStats[]>('/stats/daily', { params })

export const getGroupStats = (params?: { template_id?: string }) =>
  api.get<GroupStats[]>('/stats/groups', { params })

export const getUserStats = (params?: { conversation_id?: string; template_id?: string }) =>
  api.get<UserStats[]>('/stats/users', { params })

export const getOverviewStats = () =>
  api.get<OverviewStats>('/stats/overview')

// ==================== 群内容统计 API ====================

export interface ContentStatsParams {
  conversation_id?: string
  start_date?: string
  end_date?: string
}

export interface ContentOverview {
  total_messages: number
  active_users: number
  today_messages: number
  active_days: number
  avg_messages_per_day: number
}

export interface VolumePoint {
  date: string
  message_count: number
  active_users: number
}

export interface ActiveHourPoint {
  hour: number
  message_count: number
}

export interface ParticipantStat {
  sender_staff_id: string
  sender_name: string
  message_count: number
  active_days: number
  last_message_time: number | null
}

export interface KeywordStat {
  word: string
  count: number
}

export interface GroupActivityStat {
  conversation_id: string
  group_name: string
  message_count: number
  active_users: number
  last_message_time: number | null
}

export const getContentOverview = (params?: ContentStatsParams) =>
  api.get<ContentOverview>('/content/overview', { params })

export const getMessageVolume = (params?: ContentStatsParams) =>
  api.get<VolumePoint[]>('/content/volume', { params })

export const getActiveHours = (params?: ContentStatsParams) =>
  api.get<ActiveHourPoint[]>('/content/active-hours', { params })

export const getParticipants = (params?: ContentStatsParams & { limit?: number }) =>
  api.get<ParticipantStat[]>('/content/participants', { params })

export const getKeywords = (params?: ContentStatsParams & { limit?: number; sample_size?: number }) =>
  api.get<KeywordStat[]>('/content/keywords', { params })

export const getGroupActivity = (params?: { start_date?: string; end_date?: string }) =>
  api.get<GroupActivityStat[]>('/content/group-activity', { params })

// ==================== 定时智能汇总 API ====================

export interface HotTopic {
  title: string
  summary: string
}

export interface TodoItem {
  content: string
  owner?: string
}

export interface Digest {
  _id: string
  conversation_id: string
  group_name?: string
  period_type: string
  start_date: string
  end_date: string
  status: string
  overview?: string
  hot_topics: HotTopic[]
  todos: TodoItem[]
  risks: string[]
  key_conclusions: string[]
  raw_message_count: number
  pushed: boolean
  error_message?: string | null
  created_at: string
  completed_at?: string | null
}

export interface DigestListParams {
  conversation_id?: string
  period_type?: string
  status?: string
  page?: number
  page_size?: number
}

export interface DigestCreateData {
  conversation_id: string
  start_date: string
  end_date: string
  period_type?: string
}

export interface SchedulerJob {
  id: string
  next_run_time: string | null
}

export interface SchedulerStatus {
  running: boolean
  jobs: SchedulerJob[]
}

export const getDigests = (params?: DigestListParams) =>
  api.get<Digest[]>('/digests', { params })

export const getDigest = (id: string) =>
  api.get<Digest>(`/digests/${id}`)

export const createDigest = (data: DigestCreateData) =>
  api.post<Digest>('/digests', data)

export const deleteDigest = (id: string) =>
  api.delete(`/digests/${id}`)

export const pushDigest = (id: string) =>
  api.post(`/digests/${id}/push`)

export const getSchedulerStatus = () =>
  api.get<SchedulerStatus>('/digests/scheduler/status')

export const runDailyDigest = () =>
  api.post('/digests/scheduler/run-daily')

export const runWeeklyDigest = () =>
  api.post('/digests/scheduler/run-weekly')

export default api
