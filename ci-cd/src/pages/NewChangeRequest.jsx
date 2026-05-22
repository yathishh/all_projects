import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Lightbulb, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';

const SAMPLE_SCRIPTS = {
  mysql: `-- MySQL Migration Script
ALTER TABLE users ADD COLUMN last_login DATETIME NULL;
CREATE INDEX idx_users_last_login ON users(last_login);`,
  postgres: `-- PostgreSQL Migration Script
ALTER TABLE users ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
CREATE INDEX CONCURRENTLY idx_users_last_login ON users(last_login);`,
  mongodb: `// MongoDB Migration Script
db.users.updateMany(
  { last_login: { $exists: false } },
  { $set: { last_login: null } }
);
db.users.createIndex({ last_login: 1 });`,
};

const SAMPLE_ROLLBACKS = {
  mysql: `-- MySQL Rollback Script
DROP INDEX idx_users_last_login ON users;
ALTER TABLE users DROP COLUMN last_login;`,
  postgres: `-- PostgreSQL Rollback Script
DROP INDEX CONCURRENTLY IF EXISTS idx_users_last_login;
ALTER TABLE users DROP COLUMN IF EXISTS last_login;`,
  mongodb: `// MongoDB Rollback Script
db.users.dropIndex({ last_login: 1 });
db.users.updateMany({}, { $unset: { last_login: "" } });`,
};

export default function NewChangeRequest() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [jiraLoading, setJiraLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    jira_ticket: '',
    jira_summary: '',
    jira_status: '',
    jira_assignee: '',
    description: '',
    db_type: 'mysql',
    target_db: '',
    migration_script: SAMPLE_SCRIPTS.mysql,
    rollback_script: SAMPLE_ROLLBACKS.mysql,
    rollback_plan: '',
    rollback_risk: 'low',
    rollback_window_minutes: '',
    impact_assessment: '',
    priority: 'medium',
    git_branch: '',
    git_commit: '',
    status: 'draft',
  });

  const fetchJiraDetails = async () => {
    if (!form.jira_ticket) return;
    setJiraLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Simulate a Jira ticket lookup for ticket ID: "${form.jira_ticket}". 
Return realistic fake data as if this is a real Jira ticket for a database migration task. 
Return JSON with fields: summary (short title), status (one of: "Open", "In Progress", "In Review", "Done"), assignee (a realistic name like "John Smith").`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            status: { type: "string" },
            assignee: { type: "string" }
          }
        }
      });
      setForm(f => ({
        ...f,
        jira_summary: result.summary || '',
        jira_status: result.status || '',
        jira_assignee: result.assignee || '',
      }));
    } finally {
      setJiraLoading(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleDbTypeChange = (v) => {
    setForm(f => ({
      ...f,
      db_type: v,
      migration_script: SAMPLE_SCRIPTS[v],
      rollback_script: SAMPLE_ROLLBACKS[v],
    }));
  };

  const handleSave = async (status = 'draft') => {
    setSaving(true);
    const data = await base44.entities.ChangeRequest.create({ ...form, status });
    setSaving(false);
    navigate(`/changes/${data.id}`);
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/changes" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Change Request</h1>
          <p className="text-sm text-muted-foreground">Create a new DB migration change request</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Basic Info */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Title *</label>
              <input className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Add last_login column to users" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Jira Ticket *</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. DB-123"
                  value={form.jira_ticket}
                  onChange={e => set('jira_ticket', e.target.value)}
                />
                <button
                  type="button"
                  onClick={fetchJiraDetails}
                  disabled={!form.jira_ticket || jiraLoading}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                >
                  {jiraLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                  {jiraLoading ? 'Loading...' : 'Fetch Jira'}
                </button>
              </div>
              {form.jira_summary && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
                  <p className="text-xs font-semibold text-blue-800">{form.jira_ticket}: {form.jira_summary}</p>
                  <div className="flex items-center gap-3 text-xs text-blue-600">
                    <span>Status: <strong>{form.jira_status}</strong></span>
                    <span>Assignee: <strong>{form.jira_assignee}</strong></span>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-foreground">Description</label>
              <textarea className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={3} placeholder="What does this change do?" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>
        </div>

        {/* DB Config */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Database Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">DB Type *</label>
              <select className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.db_type} onChange={e => handleDbTypeChange(e.target.value)}>
                <option value="mysql">MySQL</option>
                <option value="postgres">PostgreSQL</option>
                <option value="mongodb">MongoDB</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Target Database</label>
              <input className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. production_db" value={form.target_db} onChange={e => set('target_db', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Priority</label>
              <select className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
        </div>

        {/* Git Info */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Git Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Branch</label>
              <input className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. feature/add-last-login" value={form.git_branch} onChange={e => set('git_branch', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Commit Hash</label>
              <input className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. a1b2c3d" value={form.git_commit} onChange={e => set('git_commit', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Scripts */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Migration Scripts</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              <Lightbulb className="w-3 h-3" /> Sample script loaded for {form.db_type}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Migration Script *</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={8}
              placeholder="Paste your migration script here..."
              value={form.migration_script}
              onChange={e => set('migration_script', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Rollback Script</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={5}
              placeholder="Paste your rollback script here..."
              value={form.rollback_script}
              onChange={e => set('rollback_script', e.target.value)}
            />
          </div>
        </div>

        {/* Rollback Plan */}
        <div className="bg-card rounded-xl border border-orange-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h2 className="font-semibold text-foreground">Rollback Plan</h2>
            <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Required for Production</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Rollback Risk Level</label>
              <select className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.rollback_risk} onChange={e => set('rollback_risk', e.target.value)}>
                <option value="low">Low — Simple script reversal, no data loss</option>
                <option value="medium">Medium — Some data transformation needed</option>
                <option value="high">High — Complex, manual steps required</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Estimated Rollback Time (minutes)</label>
              <input type="number" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. 15" value={form.rollback_window_minutes} onChange={e => set('rollback_window_minutes', e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-foreground">Impact Assessment</label>
              <textarea className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={2} placeholder="Which services/tables are impacted? What is the blast radius if this fails?" value={form.impact_assessment} onChange={e => set('impact_assessment', e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-foreground">Step-by-step Rollback Procedure</label>
              <textarea className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={4} placeholder="1. Stop affected services&#10;2. Execute rollback script&#10;3. Verify data integrity&#10;4. Restart services" value={form.rollback_plan} onChange={e => set('rollback_plan', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => handleSave('draft')} disabled={saving || !form.title || !form.jira_ticket || !form.migration_script} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" /> Save as Draft
          </button>
          <button onClick={() => handleSave('pending_local')} disabled={saving || !form.title || !form.jira_ticket || !form.migration_script} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : '🚀 Submit for Local Testing'}
          </button>
          {(!form.jira_ticket) && (
            <p className="text-xs text-orange-600 flex items-center gap-1 mt-1 self-center">
              <AlertTriangle className="w-3 h-3" /> Jira ticket is required
            </p>
          )}
        </div>
      </div>
    </div>
  );
}