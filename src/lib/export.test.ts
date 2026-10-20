import { describe, expect, it } from 'vitest';
import { buildJson, buildMarkdown, type MentoringRecord } from './export';

const stamp = { created_at: '2026-03-01T10:00:00Z', created_by: 'u1', updated_at: '2026-03-01T10:00:00Z', updated_by: 'u1', version: 1, archived_at: null, archived_by: null };
const data: MentoringRecord = {
  profiles: [{ id: 'u1', display_name: 'Ada', role: 'mentee' }, { id: 'u2', display_name: 'Bo', role: 'mentor' }],
  objectives: [{ ...stamp, id: 'o1', title: 'Delegate', success_criteria: 'Hands over work', context: null, development_area: 'Skills', status: 'active', review_date: '2026-06-01', closing_summary: null, archived_at: '2026-04-01T10:00:00Z', archived_by: 'u2' }],
  sessions: [{ ...stamp, id: 's1', scheduled_at: '2026-03-05T14:00:00Z', title: 'First', location: null, meeting_link: null, status: 'completed', is_review: false, discussion_notes: 'Talked\nabout things', outcomes: 'Agreed X', review_changed: null, review_difficult: null, review_focus: null }],
  session_objectives: [{ session_id: 's1', objective_id: 'o1', created_at: stamp.created_at, created_by: 'u1' }],
  session_preparation: [],
  actions: [{ ...stamp, id: 'a1', title: 'Draft plan', description: null, owner_role: 'mentee', due_date: '2026-03-12', status: 'completed', objective_id: 'o1', session_id: 's1', completed_at: '2026-03-10T09:00:00Z', completion_note: 'Done', blocked_note: null }],
  progress_updates: [{ ...stamp, id: 'p1', type: 'achievement', content: 'Led the meeting', links: ['https://example.test/x'], occurred_on: '2026-03-20', objective_id: 'o1', session_id: null }],
};

describe('export', () => {
  it('JSON keeps ids, relationships, archived records and no credentials', () => {
    const json = JSON.parse(buildJson(data, new Date('2026-04-01T00:00:00Z')));
    expect(json.format_version).toBe(1);
    expect(json.objectives[0].archived_at).toBeTruthy();
    expect(json.actions[0].objective_id).toBe('o1');
    expect(json.session_objectives[0]).toMatchObject({ session_id: 's1', objective_id: 'o1' });
    expect(JSON.stringify(json)).not.toMatch(/password|token|secret|email/i);
  });
  it('Markdown is readable and attributed', () => {
    const md = buildMarkdown(data, new Date('2026-04-01T00:00:00Z'));
    expect(md).toContain('# Mentoring record');
    expect(md).toContain('### Delegate');
    expect(md).toContain('**archived** by Bo');
    expect(md).toContain('> Talked\n> about things');
    expect(md).toContain('`a1`');
    expect(md).toContain('Led the meeting');
  });
});
