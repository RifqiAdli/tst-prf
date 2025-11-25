export type UserRole = "user" | "admin"

export type QuestionType = "multiple_choice" | "multiple_select" | "matching"

export type ParticipantStatus = "assigned" | "in_progress" | "completed" | "suspended" | "force_submitted"

export type SessionStatus = "active" | "completed" | "force_submitted" | "timeout" | "reset"

export type ActivityType =
  | "tab_switch"
  | "screen_blur"
  | "fullscreen_exit"
  | "print_screen"
  | "devtools"
  | "copy_paste"
  | "mouse_leave"
  | "window_resize"
  | "right_click"

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface QuestionCategory {
  id: string
  name: string
  description: string | null
  color: string
  created_at: string
}

export interface Question {
  id: string
  category_id: string | null
  type: QuestionType
  question: string
  options: string[] | null
  correct_answer: number | null
  correct_answers: number[] | null
  left_items: string[] | null
  right_items: string[] | null
  correct_pairs: Record<string, number> | null
  image_url: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  category?: QuestionCategory
}

export interface TestSchedule {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  duration_minutes: number
  question_count: number
  token: string
  is_published: boolean
  shuffle_questions: boolean
  shuffle_options: boolean
  max_strikes: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleParticipant {
  id: string
  schedule_id: string
  user_id: string
  status: ParticipantStatus
  profile?: Profile
  schedule?: TestSchedule
}

export interface TestSession {
  id: string
  schedule_id: string
  user_id: string
  started_at: string
  ended_at: string | null
  time_remaining_seconds: number | null
  current_question_index: number
  strike_count: number
  status: SessionStatus
  question_order: number[] | null
  options_order: Record<string, number[]> | null
  random_seed: number | null
}

export interface UserAnswer {
  id: string
  session_id: string
  question_id: string
  answer: unknown
  is_marked: boolean
  answered_at: string
}

export interface ActivityLog {
  id: string
  session_id: string | null
  user_id: string
  schedule_id: string | null
  activity_type: ActivityType
  details: Record<string, unknown> | null
  action_taken: "warning" | "strike" | "reset" | "terminated" | null
  created_at: string
  profile?: Profile
  schedule?: TestSchedule
}

export interface TestResult {
  id: string
  session_id: string
  user_id: string
  schedule_id: string
  total_questions: number
  answered_questions: number
  correct_answers: number | null
  score: number | null
  time_spent_seconds: number | null
  category_scores: Record<string, number> | null
  ai_analysis: string | null
  ai_recommendations: string | null
  status: "pending" | "analyzed" | "reviewed"
  submitted_at: string
  profile?: Profile
  schedule?: TestSchedule
}
