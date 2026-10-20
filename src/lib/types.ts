export type MemberRole = 'mentor' | 'mentee';
export type ObjectiveStatus = 'proposed' | 'active' | 'achieved' | 'paused' | 'closed';
export type SessionStatus = 'planned' | 'completed' | 'cancelled';
export type ActionStatus = 'not_started' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type UpdateType = 'reflection' | 'evidence' | 'feedback' | 'achievement';

export interface Stamped {
  id: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  version: number;
  archived_at: string | null;
  archived_by: string | null;
}

export interface Profile {
  id: string;
  display_name: string;
  role: MemberRole;
}

export interface Objective extends Stamped {
  title: string;
  success_criteria: string;
  context: string | null;
  development_area: string | null;
  status: ObjectiveStatus;
  review_date: string | null;
  closing_summary: string | null;
}

export interface Session extends Stamped {
  scheduled_at: string;
  title: string | null;
  location: string | null;
  meeting_link: string | null;
  status: SessionStatus;
  is_review: boolean;
  discussion_notes: string | null;
  outcomes: string | null;
  review_changed: string | null;
  review_difficult: string | null;
  review_focus: string | null;
}

export interface SessionObjective {
  session_id: string;
  objective_id: string;
  created_at: string;
  created_by: string | null;
}

export interface Preparation extends Stamped {
  session_id: string;
  topics: string | null;
  recent_progress: string | null;
  difficulties: string | null;
  support_needed: string | null;
}

export interface Action extends Stamped {
  title: string;
  description: string | null;
  owner_role: MemberRole;
  due_date: string | null;
  status: ActionStatus;
  objective_id: string | null;
  session_id: string | null;
  completed_at: string | null;
  completion_note: string | null;
  blocked_note: string | null;
}

export interface ProgressUpdate extends Stamped {
  type: UpdateType;
  content: string;
  links: string[];
  occurred_on: string;
  objective_id: string | null;
  session_id: string | null;
}

export type TableName =
  | 'objectives'
  | 'sessions'
  | 'actions'
  | 'progress_updates'
  | 'session_preparation';
