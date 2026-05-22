import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { GitBranch, CheckCircle, XCircle, Clock, Database, ArrowRight, Activity, RefreshCw, ExternalLink } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import DbTypeBadge from '@/components/shared/DbTypeBadge';

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-card rounded-xl border border-border p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  </div>
);

export default function Dashboard() {
  const [changes, setChanges] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.ChangeRequest.list('-created_date', 50),
      base44.entities.DeploymentLog.list('-created_date', 10),
    ]).then(([c, l]) => {
      setChanges(c);
      setLogs(l);
      setLoading(false);
    });
  }, []);

  const stats = {
    total: changes.length,
    passed: changes.filter(c => c.status === 'prod_deployed').length,
    pending_approval: changes.filter(c => ['pending_staging_approval','pending_prod_approval'].includes(c.status)).length,
    failed: changes.filter(c => ['local_failed','staging_failed','prod_failed'].includes(c.status)).length,
    rolled_back: changes.filter(c => c.status === 'rolled_back').length,
  };

  // Group changes by Jira ticket
  const jiraGroups = changes.reduce((acc, c) => {
    if (!c.jira_ticket) return acc;
    if (!acc[c.jira_ticket]) acc[c.jira_ticket] = { ticket: c.jira_ticket, summary: c.jira_summary, status: c.jira_status, changes: [] };
    acc[c.jira_ticket].changes.push(c);
    return acc;
  }, {});
  const jiraList = Object.values(jiraGroups).slice(0, 5);

  const recent = changes.slice(0, 6);

  const pipelineStages = [
    { key: 'local', label: 'Local Test', count: changes.filter(c => ['pending_local','local_passed','local_failed'].includes(c.status)).length, color: 'text-blue-600 bg-blue-50' },
    { key: 'staging_approval', label: 'DBA Review (STG)', count: changes.filter(c => c.status === 'pending_staging_approval').length, color: 'text-yellow-600 bg-yellow-50' },
    { key: 'staging', label: 'Staging Deploy', count: changes.filter(c => ['staging_passed','staging_failed','pending_staging_deploy'].includes(c.status)).length, color: 'text-purple-600 bg-purple-50' },
    { key: 'prod_approval', label: 'DBA Review (PRD)', count: changes.filter(c => c.status === 'pending_prod_approval').length, color: 'text-orange-600 bg-orange-50' },
    { key: 'prod', label: 'Production', count: changes.filter(c => ['prod_deployed','prod_failed'].includes(c.status)).length, color: 'text-green-600 bg-green-50' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pipeline Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Monitor all DB change requests across environments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Changes" value={stats.total} icon={GitBranch} color="bg-blue-50 text-blue-600" />
        <StatCard label="Deployed to Prod" value={stats.passed} icon={CheckCircle} color="bg-green-50 text-green-600" />
        <StatCard label="Awaiting Approval" value={stats.pending_approval} icon={Clock} color="bg-yellow-50 text-yellow-600" />
        <StatCard label="Failed" value={stats.failed} icon={XCircle} color="bg-red-50 text-red-600" />
        <StatCard label="Rolled Back" value={stats.rolled_back} icon={RefreshCw} color="bg-purple-50 text-purple-600" />
      </div>

      {/* Pipeline Flow */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Pipeline Stages
        </h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {pipelineStages.map((stage, i) => (
            <div key={stage.key} className="flex items-center gap-2 flex-shrink-0">
              <div className={`rounded-xl px-4 py-3 text-center min-w-[130px] ${stage.color}`}>
                <p className="text-2xl font-bold">{stage.count}</p>
                <p className="text-xs font-medium mt-0.5">{stage.label}</p>
              </div>
              {i < pipelineStages.length - 1 && (
                <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Jira Integration Panel */}
      {jiraList.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-blue-500" /> Jira-Linked Change Requests
          </h2>
          <div className="space-y-2">
            {jiraList.map(group => (
              <div key={group.ticket} className="flex items-start gap-4 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                <div className="min-w-[70px]">
                  <span className="text-xs font-mono font-bold text-primary bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">{group.ticket}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {group.summary && <p className="text-sm font-medium text-foreground truncate">{group.summary}</p>}
                  <p className="text-xs text-muted-foreground">{group.changes.length} change{group.changes.length !== 1 ? 's' : ''} linked</p>
                </div>
                {group.status && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">{group.status}</span>
                )}
                <div className="flex gap-1 flex-wrap">
                  {group.changes.map(c => (
                    <Link key={c.id} to={`/changes/${c.id}`} className="text-xs text-muted-foreground hover:text-primary underline truncate max-w-[100px]">{c.title}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Changes */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent Changes</h2>
            <Link to="/changes" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No change requests yet
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(c => (
                <Link key={c.id} to={`/changes/${c.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {c.jira_ticket && <span className="text-xs text-primary font-mono">{c.jira_ticket}</span>}
                      <DbTypeBadge type={c.db_type} />
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Logs */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent Activity</h2>
            <Link to="/history" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No activity yet
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === 'success' ? 'bg-green-500' : log.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{log.change_request_title || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{log.action} on {log.environment}</p>
                  </div>
                  <span className={`text-xs font-medium ${log.status === 'success' ? 'text-green-600' : log.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}`}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}