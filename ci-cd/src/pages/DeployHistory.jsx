import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { History, CheckCircle, XCircle, Clock, Terminal } from 'lucide-react';
import { format } from 'date-fns';

const ENV_COLOR = {
  local: 'bg-blue-100 text-blue-700',
  staging: 'bg-purple-100 text-purple-700',
  production: 'bg-orange-100 text-orange-700',
};

const ACTION_COLOR = {
  test: 'bg-blue-50 text-blue-600',
  deploy: 'bg-green-50 text-green-600',
  approve: 'bg-emerald-50 text-emerald-600',
  reject: 'bg-red-50 text-red-600',
  rollback: 'bg-slate-50 text-slate-600',
};

export default function DeployHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEnv, setFilterEnv] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedLog, setExpandedLog] = useState(null);

  useEffect(() => {
    base44.entities.DeploymentLog.list('-created_date', 100).then(data => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  const filtered = logs.filter(l => {
    const matchEnv = filterEnv === 'all' || l.environment === filterEnv;
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchEnv && matchStatus;
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="w-6 h-6 text-primary" /> Deployment History
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Full audit log of all pipeline actions</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={filterEnv} onChange={e => setFilterEnv(e.target.value)}>
          <option value="all">All Environments</option>
          <option value="local">Local</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
        </select>
        <select className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
        <div className="ml-auto text-sm text-muted-foreground flex items-center">{filtered.length} records</div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">No deployment logs found</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Change Request</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Environment</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">By</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <>
                  <tr key={log.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground max-w-[200px]">
                      <span className="truncate block">{log.change_request_title || log.change_request_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${ACTION_COLOR[log.action] || 'bg-muted text-muted-foreground'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${ENV_COLOR[log.environment] || 'bg-muted text-muted-foreground'}`}>
                        {log.environment}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {log.status === 'success' ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : log.status === 'failed' ? <XCircle className="w-3.5 h-3.5 text-red-500" /> : <Clock className="w-3.5 h-3.5 text-yellow-500" />}
                        <span className={`text-xs font-medium capitalize ${log.status === 'success' ? 'text-green-600' : log.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}`}>{log.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{log.performed_by || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{log.created_date ? format(new Date(log.created_date), 'MMM d, HH:mm') : '—'}</td>
                    <td className="px-4 py-3">
                      {log.log_output && (
                        <button onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Terminal className="w-3 h-3" /> Logs
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedLog === log.id && log.log_output && (
                    <tr key={`${log.id}-log`} className="border-b border-border bg-slate-950">
                      <td colSpan={7} className="px-4 py-3">
                        <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">{log.log_output}</pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}