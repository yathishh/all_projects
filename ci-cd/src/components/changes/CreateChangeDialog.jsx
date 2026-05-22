import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const defaultScripts = {
  mysql: '-- MySQL Migration Script\nALTER TABLE users ADD COLUMN last_login DATETIME;\nCREATE INDEX idx_users_last_login ON users(last_login);',
  postgres: '-- PostgreSQL Migration Script\nALTER TABLE users ADD COLUMN last_login TIMESTAMP;\nCREATE INDEX idx_users_last_login ON users(last_login);',
  mongodb: '// MongoDB Migration Script\ndb.users.updateMany(\n  {},\n  { $set: { last_login: null } }\n);',
};

export default function CreateChangeDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    jira_ticket: '',
    description: '',
    db_type: 'postgres',
    target_db: '',
    priority: 'medium',
    git_branch: '',
    git_commit: '',
    migration_script: defaultScripts.postgres,
    rollback_script: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({
    ...p,
    [k]: v,
    ...(k === 'db_type' ? { migration_script: defaultScripts[v] } : {})
  }));

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.ChangeRequest.create({ ...form, status: 'draft' });
    setSaving(false);
    onCreated();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Change Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Title *</Label>
              <Input placeholder="e.g. Add indexes to users table" value={form.title} onChange={e => set('title', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Jira Ticket</Label>
              <Input placeholder="e.g. DB-123" value={form.jira_ticket} onChange={e => set('jira_ticket', e.target.value)} className="mt-1 font-mono" />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Database Type *</Label>
              <Select value={form.db_type} onValueChange={v => set('db_type', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="postgres">PostgreSQL</SelectItem>
                  <SelectItem value="mongodb">MongoDB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target Database</Label>
              <Input placeholder="e.g. prod_db / localhost:5432/mydb" value={form.target_db} onChange={e => set('target_db', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Git Branch</Label>
              <Input placeholder="e.g. feature/add-indexes" value={form.git_branch} onChange={e => set('git_branch', e.target.value)} className="mt-1 font-mono" />
            </div>
            <div>
              <Label>Git Commit Hash</Label>
              <Input placeholder="e.g. abc1234" value={form.git_commit} onChange={e => set('git_commit', e.target.value)} className="mt-1 font-mono" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea placeholder="Describe the purpose of this change..." value={form.description} onChange={e => set('description', e.target.value)} className="mt-1 h-20 resize-none" />
            </div>
            <div className="col-span-2">
              <Label>Migration Script *</Label>
              <Textarea value={form.migration_script} onChange={e => set('migration_script', e.target.value)} className="mt-1 h-36 resize-none font-mono text-xs" />
            </div>
            <div className="col-span-2">
              <Label>Rollback Script</Label>
              <Textarea placeholder="Script to undo this migration if needed..." value={form.rollback_script} onChange={e => set('rollback_script', e.target.value)} className="mt-1 h-24 resize-none font-mono text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.migration_script}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Change Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}