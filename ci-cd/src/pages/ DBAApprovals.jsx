import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Shield, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import DbTypeBadge from '@/components/shared/DbTypeBadge';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';

export default function DBAApprovals() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [rejectInputs, setRejectInputs] = useState({});
  const [showReject, setShowReject] = useState({});
  const [activeTab, setActiveTab] = useState('staging');

  const reload = () => {
    base44.entities.ChangeRequest.list('-created_date', 100).then(all => {
      setChanges(all.filter(c => ['pending_staging_approval', 'pending_prod_approval'].includes(c.status)));
      setLoading(false);
    });
  };

  useEffect(() => { reload(); }, []);

  const stagingPending = changes.filter(c => c.status === 'pending_staging_approval');
  const prodPending = changes.filter(c => c.status === 'pending_prod_approval');

  const approve = async (change) => {
    const isStaging = change.status === 'pending_staging_approval';
    setProcessing(p => ({ ...p, [change.id]: 'approving' }));
    await base44.entities.ChangeRequest.update(change.id, {
      status: isStaging ? 'staging_approved' : 'prod_approved',
      [isStaging ? 'staging_approved_by' : 'prod_approved_by']: 'dba_admin',
      [isStaging ? 'staging_approved_at' : 'prod_approved_at']: new Date().toISOString(),
    });
    await base44.entities.DeploymentLog.create({
      change_request_id: change.id,
      change_request_title: change.title,
      environment: isStaging ? 'staging' : 'production',
      action: 'approve',
      status: 'success',
      performed_by: 'dba_admin',
      log_output: `Approved by DBA team at ${new Date().toISOString()}`,
      db_type: change.db_type,
    });
    setProcessing(p => ({ ...p, [change.id]: '' }));
    reload();
  };

  const reject = async (change) => {
    const isStaging = change.status === 'pending_staging_approval';
    const reason = rejectInputs[change.id] || '';
    setProcessing(p => ({ ...p, [change.id]: 'rejecting' }));
    await base44.entities.ChangeRequest.update(change.id, {
      status: isStaging ? 'staging_rejected' : 'prod_rejected',
      [isStaging ? 'staging_rejection_reason' : 'prod_rejection_reason']: reason,
    });
    await base44.entities.DeploymentLog.create({
      change_request_id: change.id,
      change_request_title: change.title,
      environment: isStaging ? 'staging' : 'production',
      action: 'reject',
      status: 'failed',
      performed_by: 'dba_admin',
      log_output: `Rejected by DBA. Reason: ${reason}`,
      db_type: change.db_type,
    });
    setProcessing(p => ({ ...p, [change.id]: '' }));
    setShowReject(s => ({ ...s, [change.id]: false }));
    reload();
  };

  const ApprovalCard = ({ change }) => {
    const isStaging = change.status === 'pending_staging_approval';
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className={`px-4 py-2 text-xs font-semibold ${isStaging ? 'bg-yellow-50 text-yellow-800 border-b border-yellow-100' : 'bg-orange-50 text-orange-800 border-b border-orange-100'}`}>
          {isStaging ? '⚡ Staging Environment Approval Required' : '🔴 Production Environment Approval Required'}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground">{change.title}</h3>
                <DbTypeBadge type={change.db_type} />
                <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${change.priority === 'critical' ? 'bg-red-100 text-red-700' : change.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                  {change.priority}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                {change.jira_ticket && <span className="font-mono text-primary font-semibold">{change.jira_ticket}</span>}
                {change.git_branch && <span className="font-mono">{change.git_branch}</span>}
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{change.created_date ? format(new Date(change.created_date), 'MMM d, HH:mm') : '—'}</span>
              </div>
              {change.description && <p className="text-sm text-muted-foreground mt-2">{change.description}</p>}
            </div>
            <Link to={`/changes/${change.id}`} className="text-xs text-primary hover:underline flex-shrink-0">View Details →</Link>
          </div>

          {/* Script preview */}
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Migration Script</p>
            <pre className="bg-slate-900 text-green-400 rounded-lg p-3 text-xs font-mono overflow-auto max-h-32 whitespace-pre-wrap">
              {change.migration_script}
            </pre>
          </div>

          {/* Rollback */}
          {change.rollback_script && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View Rollback Script</summary>
              <pre className="bg-slate-900 text-orange-300 rounded-lg p-3 text-xs font-mono overflow-auto max-h-24 mt-1.5 whitespace-pre-wrap">
                {change.rollback_script}
              </pre>
            </details>
          )}

          {/* Reject input */}
          {showReject[change.id] && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
              <p className="text-xs font-medium text-red-800">Rejection Reason (required)</p>
              <textarea
                className="w-full px-3 py-2 rounded-lg border border-red-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                rows={2}
                placeholder="e.g. Missing index, performance risk, incorrect column type..."
                value={rejectInputs[change.id] || ''}
                onChange={e => setRejectInputs(r => ({ ...r, [change.id]: e.target.value }))}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            {!showReject[change.id] ? (
              <>
                <button onClick={() => approve(change)} disabled={!!processing[change.id]} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                  <CheckCircle className="w-4 h-4" />
                  {processing[change.id] === 'approving' ? 'Approving...' : `Approve for ${isStaging ? 'Staging' : 'Production'}`}
                </button>
                <button onClick={() => setShowReject(s => ({ ...s, [change.id]: true }))} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </>
            ) : (
              <>
                <button onClick={() => reject(change)} disabled={!rejectInputs[change.id] || !!processing[change.id]} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  <XCircle className="w-4 h-4" /> Confirm Rejection
                </button>
                <button onClick={() => setShowReject(s => ({ ...s, [change.id]: false }))} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6 text-green-600" /> DBA Approvals
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Review and approve database change requests for Staging and Production</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab('staging')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'staging' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${stagingPending.length > 0 ? 'bg-yellow-500 text-white' : 'bg-muted-foreground/30 text-muted-foreground'}`}>{stagingPending.length}</span>
          Staging Approvals
        </button>
        <button onClick={() => setActiveTab('prod')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'prod' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${prodPending.length > 0 ? 'bg-orange-500 text-white' : 'bg-muted-foreground/30 text-muted-foreground'}`}>{prodPending.length}</span>
          Production Approvals
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'staging' && (
            stagingPending.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center">
                <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground">No staging approvals pending</p>
              </div>
            ) : stagingPending.map(c => <ApprovalCard key={c.id} change={c} />)
          )}
          {activeTab === 'prod' && (
            prodPending.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center">
                <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground">No production approvals pending</p>
              </div>
            ) : prodPending.map(c => (
              <div key={c.id}>
                <div className="flex items-center gap-2 mb-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <p className="text-xs text-orange-700 font-medium">⚠️ This will deploy to PRODUCTION. Carefully review the migration and rollback scripts before approving.</p>
                </div>
                <ApprovalCard change={c} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}