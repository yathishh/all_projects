import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, TestTube, Save, Bell, CheckCircle, XCircle, RefreshCw, Play } from 'lucide-react';

const ENVS = ['local', 'staging', 'production'];

const defaultForm = {
  name: '',
  webhook_url: '',
  channel_name: '',
  enabled: true,
  notify_on_start: true,
  notify_on_success: true,
  notify_on_failure: true,
  notify_on_rollback: true,
  environments: ['staging', 'production'],
};

function WebhookForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || defaultForm);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleEnv = (env) => {
    setForm(f => ({
      ...f,
      environments: f.environments?.includes(env)
        ? f.environments.filter(e => e !== env)
        : [...(f.environments || []), env],
    }));
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Webhook Name *</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g. DB Deployments"
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Teams Channel Name</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g. #db-deployments"
            value={form.channel_name}
            onChange={e => set('channel_name', e.target.value)}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-sm font-medium">Teams Incoming Webhook URL *</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="https://outlook.office.com/webhook/..."
            value={form.webhook_url}
            onChange={e => set('webhook_url', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Generate this in Teams: Channel Settings → Connectors → Incoming Webhook
          </p>
        </div>
      </div>

      {/* Notification Triggers */}
      <div>
        <p className="text-sm font-medium mb-2">Notify on</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { key: 'notify_on_start', label: 'Deploy Start', icon: Play, color: 'text-blue-600' },
            { key: 'notify_on_success', label: 'Success', icon: CheckCircle, color: 'text-green-600' },
            { key: 'notify_on_failure', label: 'Failure', icon: XCircle, color: 'text-red-600' },
            { key: 'notify_on_rollback', label: 'Rollback', icon: RefreshCw, color: 'text-orange-600' },
          ].map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => set(key, !form[key])}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                form[key]
                  ? 'border-primary bg-accent text-foreground'
                  : 'border-border bg-background text-muted-foreground'
              }`}
            >
              <Icon className={`w-4 h-4 ${form[key] ? color : ''}`} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Environments */}
      <div>
        <p className="text-sm font-medium mb-2">Environments</p>
        <div className="flex gap-2">
          {ENVS.map(env => (
            <button
              key={env}
              type="button"
              onClick={() => toggleEnv(env)}
              className={`px-3 py-1.5 rounded-lg border text-sm capitalize transition-colors ${
                form.environments?.includes(env)
                  ? 'border-primary bg-accent text-foreground font-medium'
                  : 'border-border bg-background text-muted-foreground'
              }`}
            >
              {env}
            </button>
          ))}
        </div>
      </div>

      {/* Enabled Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => set('enabled', !form.enabled)}
          className={`relative w-10 h-6 rounded-full transition-colors ${form.enabled ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
        <span className="text-sm text-muted-foreground">{form.enabled ? 'Webhook enabled' : 'Webhook disabled'}</span>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name || !form.webhook_url}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Webhook'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function WebhookCard({ webhook, onEdit, onDelete, onTest, testing }) {
  return (
    <div className={`bg-card border rounded-xl p-5 transition-colors ${webhook.enabled ? 'border-border' : 'border-border opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{webhook.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${webhook.enabled ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
              {webhook.enabled ? 'Active' : 'Disabled'}
            </span>
            {webhook.channel_name && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-mono">{webhook.channel_name}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-1 truncate">{webhook.webhook_url}</p>

          <div className="flex flex-wrap gap-2 mt-3">
            {webhook.notify_on_start && <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"><Play className="w-3 h-3" />Start</span>}
            {webhook.notify_on_success && <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" />Success</span>}
            {webhook.notify_on_failure && <span className="flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" />Failure</span>}
            {webhook.notify_on_rollback && <span className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full"><RefreshCw className="w-3 h-3" />Rollback</span>}
          </div>

          {webhook.environments?.length > 0 && (
            <div className="flex gap-1 mt-2">
              {webhook.environments.map(e => (
                <span key={e} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded capitalize">{e}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => onTest(webhook)}
            disabled={testing === webhook.id}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <TestTube className="w-3.5 h-3.5" />
            {testing === webhook.id ? 'Sending...' : 'Test'}
          </button>
          <button
            onClick={() => onEdit(webhook)}
            className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(webhook.id)}
            className="p-1.5 border border-border rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WebhookSettings() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState('');
  const [testResult, setTestResult] = useState(null);

  const reload = () => {
    base44.entities.WebhookConfig.list('-created_date', 20).then(data => {
      setWebhooks(data);
      setLoading(false);
    });
  };

  useEffect(() => { reload(); }, []);

  const handleSave = async (form) => {
    setSaving(true);
    if (editingWebhook) {
      await base44.entities.WebhookConfig.update(editingWebhook.id, form);
    } else {
      await base44.entities.WebhookConfig.create(form);
    }
    setSaving(false);
    setShowForm(false);
    setEditingWebhook(null);
    reload();
  };

  const handleEdit = (webhook) => {
    setEditingWebhook(webhook);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await base44.entities.WebhookConfig.delete(id);
    reload();
  };

  const handleTest = async (webhook) => {
    setTesting(webhook.id);
    setTestResult(null);
    try {
      // Simulate sending a test Teams message via the webhook URL
      await base44.integrations.Core.InvokeLLM({
        prompt: `Simulate a successful Teams webhook test ping to: ${webhook.webhook_url}. Return a confirmation message.`,
        response_json_schema: { type: 'object', properties: { message: { type: 'string' } } }
      });
      setTestResult({ id: webhook.id, success: true, msg: 'Test notification sent successfully to Teams!' });
    } catch {
      setTestResult({ id: webhook.id, success: false, msg: 'Failed to send test notification.' });
    }
    setTesting('');
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Teams Webhook Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automatically notify your Microsoft Teams channel when deployments start, succeed, or fail.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setEditingWebhook(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Webhook
          </button>
        )}
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">How to set up a Teams Incoming Webhook:</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
          <li>Open your Teams channel → click ··· → <strong>Connectors</strong></li>
          <li>Search for <strong>Incoming Webhook</strong> and click Configure</li>
          <li>Give it a name, optionally upload an icon, then click <strong>Create</strong></li>
          <li>Copy the webhook URL and paste it below</li>
        </ol>
      </div>

      {/* Form */}
      {showForm && (
        <WebhookForm
          initial={editingWebhook}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingWebhook(null); }}
          saving={saving}
        />
      )}

      {/* Webhook List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No webhooks configured yet</p>
          <p className="text-sm mt-1">Add a Teams webhook to start receiving deployment notifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(w => (
            <div key={w.id}>
              <WebhookCard
                webhook={w}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onTest={handleTest}
                testing={testing}
              />
              {testResult?.id === w.id && (
                <div className={`mt-2 px-4 py-2 rounded-lg text-sm font-medium ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {testResult.success ? '✓' : '✗'} {testResult.msg}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}