export type MemberRole = 'mentor' | 'mentee';
export type PartnershipStatus = 'pending' | 'active' | 'paused' | 'completed';
export type ObjectiveStatus = 'proposed' | 'active' | 'achieved' | 'paused' | 'closed';
export type ObjectiveStage = 'starting' | 'building' | 'confident' | 'embedded';
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

export interface Partnership extends Stamped {
  mentor_id: string;
  mentee_id: string | null;
  mentee_name: string;
  title: string | null;
  status: PartnershipStatus;
  purpose: string | null;
  meeting_cadence: string | null;
  working_agreement: string | null;
  review_horizon: string | null;
}

export interface PartnershipInvite {
  partnership_id: string;
  code: string;
  mentor_id: string;
  mentee_email: string | null;
  created_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
}

export interface Milestone {
  id: string;
  text: string;
  done: boolean;
}

export interface Objective extends Stamped {
  partnership_id?: string;
  title: string;
  success_criteria: string;
  context: string | null;
  development_area: string | null;
  status: ObjectiveStatus;
  progress_stage?: ObjectiveStage;
  milestones?: Milestone[];
  review_date: string | null;
  closing_summary: string | null;
}

export interface Session extends Stamped {
  partnership_id?: string;
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
  partnership_id?: string;
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
  partnership_id?: string;
  type: UpdateType;
  content: string;
  links: string[];
  occurred_on: string;
  objective_id: string | null;
  session_id: string | null;
  action_id?: string | null;
  discuss_next?: boolean;
}

export interface ProgressUpdateComment extends Stamped {
  partnership_id?: string;
  update_id: string;
  content: string;
}

export type TableName =
  | 'partnerships'
  | 'objectives'
  | 'sessions'
  | 'actions'
  | 'progress_updates'
  | 'progress_update_comments'
  | 'session_preparation';
