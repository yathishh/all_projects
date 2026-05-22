import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, XCircle, RefreshCw, Terminal, GitBranch, Clock, AlertTriangle, ExternalLink, ShieldAlert } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import DbTypeBadge from '@/components/shared/DbTypeBadge';
import { format } from 'date-fns';

const PIPELINE_STEPS = [
  { key: 'local', label: 'Local Test', env: 'local' },
  { key: 'staging_approval', label: 'DBA Approve (STG)', env: 'staging' },
  { key: 'staging_deploy', label: 'Staging Deploy', env: 'staging' },
  { key: 'prod_approval', label: 'DBA Approve (PRD)', env: 'production' },
  { key: 'prod_deploy', label: 'Production Deploy', env: 'production' },
];

function getStepStatus(change, stepKey) {
  const s = change.status;
  if (stepKey === 'local') {
    if (s === 'pending_local') return 'running';
    if (s === 'local_passed' || ['pending_staging_approval','staging_approved','staging_rejected','pending_staging_deploy','staging_passed','staging_failed','pending_prod_approval','prod_approved','prod_rejected','prod_deployed','prod_failed','rolled_back'].includes(s)) return 'done';
    if (s === 'local_failed') return 'failed';
    return 'pending';
  }
  if (stepKey === 'staging_approval') {
    if (s === 'pending_staging_approval') return 'running';
    if (['staging_approved','pending_staging_deploy','staging_passed','staging_failed','pending_prod_approval','prod_approved','prod_rejected','prod_deployed','prod_failed'].includes(s)) return 'done';
    if (s === 'staging_rejected') return 'failed';
    return 'pending';
  }
  if (stepKey === 'staging_deploy') {
    if (s === 'pending_staging_deploy') return 'running';
    if (['staging_passed','pending_prod_approval','prod_approved','prod_rejected','prod_deployed','prod_failed'].includes(s)) return 'done';
    if (s === 'staging_failed') return 'failed';
    return 'pending';
  }
  if (stepKey === 'prod_approval') {
    if (s === 'pending_prod_approval') return 'running';
    if (['prod_approved','prod_deployed','prod_failed'].includes(s)) return 'done';
    if (s === 'prod_rejected') return 'failed';
    return 'pending';
  }
  if (stepKey === 'prod_deploy') {
    if (s === 'prod_deployed') return 'done';
    if (s === 'prod_failed') return 'failed';
    return 'pending';
  }
  return 'pending';
}

function StepIcon({ status }) {
  if (status === 'done') return <CheckCircle className="w-5 h-5 text-green-500" />;
  if (status === 'failed') return <XCircle className="w-5 h-5 text-red-500" />;
  if (status === 'running') return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
  return <div className="w-5 h-5 rounded-full border-2 border-border" />;
}

export default function ChangeDetail() {
  const { id } = useParams();
  const [change, setChange] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const reload = () => {
    Promise.all([
      base44.entities.ChangeRequest.filter({ id }, '-created_date', 1),
      base44.entities.DeploymentLog.filter({ change_request_id: id }, '-created_date', 20),
    ]).then(([c, l]) => {
      setChange(c[0]);
      setLogs(l);
      setLoading(false);
    });
  };

  useEffect(() => { reload(); }, [id]);

  const doAction = async (newStatus, logAction, env, extraFields = {}) => {
    setActionLoading(logAction);
    const logOutput = simulateLog(logAction, change);
    await base44.entities.ChangeRequest.update(id, { status: newStatus, ...extraFields });
    await base44.entities.DeploymentLog.create({
      change_request_id: id,
      change_request_title: change.title,
      environment: env,
      action: logAction,
      status: newStatus.includes('failed') || newStatus.includes('rejected') ? 'failed' : 'success',
      performed_by: 'current_user',
      log_output: logOutput,
      db_type: change.db_type,
    });
    setActionLoading('');
    reload();
  };

  const simulateLog = (action, cr) => {
    const ts = new Date().toISOString();
    if (action === 'test') return `[${ts}] Starting local test for ${cr.db_type}...\n[${ts}] Connecting to local database...\n[${ts}] Running migration script...\n[${ts}] ✓ Migration completed successfully\n[${ts}] Running validation checks...\n[${ts}] ✓ All checks passed`;
    if (action === 'deploy') return `[${ts}] Initiating deployment...\n[${ts}] Checking environment health...\n[${ts}] Applying migration...\n[${ts}] ✓ Migration applied\n[${ts}] Running post-deploy checks...\n[${ts}] ✓ Deployment successful`;
    if (action === 'approve') return `[${ts}] Change request approved by DBA team\n[${ts}] Proceeding to next stage...`;
    if (action === 'reject') return `[${ts}] Change request rejected\n[${ts}] Reason: ${rejectReason}`;
    if (action === 'rollback') return `[${ts}] Initiating rollback...\n[${ts}] Applying rollback script...\n[${ts}] ✓ Rollback completed`;
    return `[${ts}] Action: ${action}`;
  };

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!change) return <div className="p-6 text-muted-foreground">Change request not found</div>;

  const canLocalTest = change.status === 'draft' || change.status === 'pending_local';
  const canSubmitStaging = change.status === 'local_passed';
  const canApprovStaging = change.status === 'pending_staging_approval';
  const canDeployStaging = change.status === 'staging_approved';
  const canSubmitProd = change.status === 'staging_passed';
  const canApproveProd = change.status === 'pending_prod_approval';
  const canDeployProd = change.status === 'prod_approved';
  const canRollback = ['prod_deployed', 'staging_passed'].includes(change.status);

  return (
    <div className="p-6 max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to="/changes" className="p-2 rounded-lg hover:bg-muted transition-colors mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{change.title}</h1>
            <StatusBadge status={change.status} />
            <DbTypeBadge type={change.db_type} />
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-muted-foreground">
            {change.jira_ticket && (
              <span className="flex items-center gap-1 font-mono text-primary font-semibold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                <ExternalLink className="w-3 h-3" />{change.jira_ticket}
                {change.jira_status && <span className="ml-1 text-blue-500 font-normal">· {change.jira_status}</span>}
                {change.jira_assignee && <span className="ml-1 text-muted-foreground font-normal">· {change.jira_assignee}</span>}
              </span>
            )}
            {change.git_branch && <span className="font-mono flex items-center gap-1"><GitBranch className="w-3 h-3" />{change.git_branch}</span>}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{change.created_date ? format(new Date(change.created_date), 'MMM d, yyyy HH:mm') : '—'}</span>
          </div>
        </div>
      </div>

      {/* Pipeline Progress */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-foreground mb-4">Pipeline Progress</h2>
        <div className="flex items-center gap-0">
          {PIPELINE_STEPS.map((step, i) => {
            const status = getStepStatus(change, step.key);
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-lg ${status === 'running' ? 'bg-blue-50 border border-blue-200' : status === 'done' ? 'bg-green-50' : status === 'failed' ? 'bg-red-50' : 'bg-muted/30'}`}>
                  <StepIcon status={status} />
                  <span className="text-xs font-medium text-center leading-tight">{step.label}</span>
                  <span className={`text-xs capitalize ${status === 'done' ? 'text-green-600' : status === 'failed' ? 'text-red-600' : status === 'running' ? 'text-blue-600' : 'text-muted-foreground'}`}>{status}</span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && <div className={`w-6 h-0.5 flex-shrink-0 ${status === 'done' ? 'bg-green-400' : 'bg-border'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-3">
        <h2 className="font-semibold text-foreground">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {canLocalTest && (
            <button onClick={() => doAction('local_passed', 'test', 'local')} disabled={!!actionLoading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <Play className="w-4 h-4" /> {actionLoading === 'test' ? 'Running...' : 'Run Local Test'}
            </button>
          )}
          {canSubmitStaging && (
            <button onClick={() => doAction('pending_staging_approval', 'approve', 'staging')} disabled={!!actionLoading} className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors">
              <Clock className="w-4 h-4" /> Submit for Staging Approval
            </button>
          )}
          {canApprovStaging && (
            <div className="flex gap-2">
              <button onClick={() => doAction('staging_approved', 'approve', 'staging')} disabled={!!actionLoading} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                <CheckCircle className="w-4 h-4" /> Approve Staging
              </button>
              <button onClick={() => setShowReject('staging')} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          )}
          {canDeployStaging && (
            <button onClick={() => doAction('staging_passed', 'deploy', 'staging')} disabled={!!actionLoading} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
              <Play className="w-4 h-4" /> {actionLoading === 'deploy' ? 'Deploying...' : 'Deploy to Staging'}
            </button>
          )}
          {canSubmitProd && (
            <button onClick={() => doAction('pending_prod_approval', 'approve', 'production')} disabled={!!actionLoading} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
              <Clock className="w-4 h-4" /> Submit for Production Approval
            </button>
          )}
          {canApproveProd && (
            <div className="flex gap-2">
              <button onClick={() => doAction('prod_approved', 'approve', 'production')} disabled={!!actionLoading} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                <CheckCircle className="w-4 h-4" /> Approve Production
              </button>
              <button onClick={() => setShowReject('prod')} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          )}
          {canDeployProd && (
            <button onClick={() => doAction('prod_deployed', 'deploy', 'production')} disabled={!!actionLoading} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
              <Play className="w-4 h-4" /> {actionLoading === 'deploy' ? 'Deploying...' : '🚀 Deploy to Production'}
            </button>
          )}
          {canRollback && (
            <button onClick={() => doAction('rolled_back', 'rollback', change.status === 'prod_deployed' ? 'production' : 'staging')} disabled={!!actionLoading} className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors">
              <RefreshCw className="w-4 h-4" /> Rollback
            </button>
          )}
        </div>

        {/* Reject Dialog */}
        {showReject && (
          <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
            <p className="text-sm font-medium text-red-800">Rejection Reason</p>
            <textarea className="w-full px-3 py-2 rounded-lg border border-red-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" rows={3} placeholder="Enter reason for rejection..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => {
                const newStatus = showReject === 'staging' ? 'staging_rejected' : 'prod_rejected';
                doAction(newStatus, 'reject', showReject === 'staging' ? 'staging' : 'production', showReject === 'staging' ? { staging_rejection_reason: rejectReason } : { prod_rejection_reason: rejectReason });
                setShowReject('');
              }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                Confirm Reject
              </button>
              <button onClick={() => setShowReject('')} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex border-b border-border">
          {['overview', 'scripts', 'rollback', 'logs'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'text-primary border-b-2 border-primary bg-accent/30' : 'text-muted-foreground hover:text-foreground'}`}>
              {tab === 'logs' ? `Logs (${logs.length})` : tab === 'rollback' ? '🔄 Rollback Plan' : tab}
            </button>
          ))}
        </div>
        <div className="p-5">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {[
                ['Description', change.description || '—'],
                ['Target DB', change.target_db || '—'],
                ['Priority', change.priority],
                ['Git Branch', change.git_branch || '—'],
                ['Git Commit', change.git_commit || '—'],
                ['Staging Approved By', change.staging_approved_by || '—'],
                ['Prod Approved By', change.prod_approved_by || '—'],
                ['Staging Rejection', change.staging_rejection_reason || '—'],
                ['Prod Rejection', change.prod_rejection_reason || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-muted-foreground mb-0.5">{k}</p>
                  <p className="font-medium font-mono">{v}</p>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'scripts' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2"><Terminal className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Migration Script</span></div>
                <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">{change.migration_script || '— No script provided'}</pre>
              </div>
              {change.rollback_script && (
                <div>
                  <div className="flex items-center gap-2 mb-2"><RefreshCw className="w-4 h-4 text-orange-500" /><span className="text-sm font-medium">Rollback Script</span></div>
                  <pre className="bg-slate-900 text-orange-300 rounded-lg p-4 text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">{change.rollback_script}</pre>
                </div>
              )}
            </div>
          )}
          {activeTab === 'rollback' && (
            <div className="space-y-5">
              {/* Risk Banner */}
              {change.rollback_risk && (
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${change.rollback_risk === 'high' ? 'bg-red-50 border-red-200 text-red-700' : change.rollback_risk === 'medium' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                  <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm capitalize">Rollback Risk: {change.rollback_risk}</p>
                    {change.rollback_window_minutes && <p className="text-xs mt-0.5">Estimated rollback time: <strong>{change.rollback_window_minutes} minutes</strong></p>}
                  </div>
                </div>
              )}

              {/* Impact Assessment */}
              {change.impact_assessment && (
                <div>
                  <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-orange-500" /><span className="text-sm font-medium">Impact Assessment</span></div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-900 whitespace-pre-wrap">{change.impact_assessment}</div>
                </div>
              )}

              {/* Step-by-step Rollback Plan */}
              {change.rollback_plan && (
                <div>
                  <div className="flex items-center gap-2 mb-2"><RefreshCw className="w-4 h-4 text-blue-500" /><span className="text-sm font-medium">Step-by-step Rollback Procedure</span></div>
                  <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap font-mono">{change.rollback_plan}</div>
                </div>
              )}

              {/* Rollback Script */}
              {change.rollback_script && (
                <div>
                  <div className="flex items-center gap-2 mb-2"><Terminal className="w-4 h-4 text-orange-500" /><span className="text-sm font-medium">Rollback Script</span></div>
                  <pre className="bg-slate-900 text-orange-300 rounded-lg p-4 text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">{change.rollback_script}</pre>
                </div>
              )}

              {!change.rollback_script && !change.rollback_plan && (
                <div className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No rollback plan defined for this change request.</p>
                  <p className="text-xs mt-1">Add a rollback script and plan when creating change requests.</p>
                </div>
              )}

              {/* Execute Rollback */}
              {canRollback && (
                <div className="border-t border-border pt-4 mt-4">
                  <p className="text-sm font-medium text-foreground mb-2">Execute Rollback</p>
                  <button onClick={() => doAction('rolled_back', 'rollback', change.status === 'prod_deployed' ? 'production' : 'staging')} disabled={!!actionLoading} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                    <RefreshCw className="w-4 h-4" /> {actionLoading === 'rollback' ? 'Rolling back...' : '⚠️ Execute Rollback Now'}
                  </button>
                  <p className="text-xs text-muted-foreground mt-2">This will revert the deployment and log a rollback action.</p>
                </div>
              )}
            </div>
          )}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No logs yet</p>
              ) : logs.map(log => (
                <div key={log.id} className="border border-border rounded-lg overflow-hidden">
                  <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${log.status === 'success' ? 'bg-green-50 border-b border-green-100' : 'bg-red-50 border-b border-red-100'}`}>
                    <span className={`font-semibold capitalize ${log.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>{log.action}</span>
                    <span className="text-muted-foreground">on</span>
                    <span className="font-medium capitalize">{log.environment}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{log.created_date ? format(new Date(log.created_date), 'MMM d, HH:mm') : ''}</span>
                  </div>
                  {log.log_output && (
                    <pre className="bg-slate-900 text-green-400 p-3 text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap">{log.log_output}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}