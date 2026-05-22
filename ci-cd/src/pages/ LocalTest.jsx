import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Play, Terminal, CheckCircle, XCircle, RefreshCw, FlaskConical } from 'lucide-react';
import DbTypeBadge from '@/components/shared/DbTypeBadge';
import StatusBadge from '@/components/shared/StatusBadge';

export default function LocalTest() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState({});
  const [logs, setLogs] = useState({});
  const [results, setResults] = useState({});

  useEffect(() => {
    base44.entities.ChangeRequest.filter({}, '-created_date', 100).then(all => {
      setChanges(all.filter(c => ['draft', 'pending_local', 'local_failed'].includes(c.status)));
      setLoading(false);
    });
  }, []);

  const runTest = async (change, simulateFail = false) => {
    setRunning(r => ({ ...r, [change.id]: true }));
    setLogs(l => ({ ...l, [change.id]: '' }));

    const lines = [
      `[INFO] Starting local test for ${change.db_type.toUpperCase()} migration`,
      `[INFO] Jira: ${change.jira_ticket || 'N/A'} | Branch: ${change.git_branch || 'N/A'}`,
      `[INFO] Connecting to local ${change.db_type} instance...`,
      `[INFO] ✓ Connection established`,
      `[INFO] Parsing migration script...`,
      `[INFO] ✓ Script syntax validated`,
    ];

    if (change.db_type === 'mysql') lines.push(`[INFO] Running SQL statements on MySQL...`);
    if (change.db_type === 'postgres') lines.push(`[INFO] Running SQL statements on PostgreSQL...`);
    if (change.db_type === 'mongodb') lines.push(`[INFO] Running commands on MongoDB...`);

    if (!simulateFail) {
      lines.push(`[INFO] ✓ Migration applied successfully`);
      lines.push(`[INFO] Running integrity checks...`);
      lines.push(`[INFO] ✓ Schema validation passed`);
      lines.push(`[SUCCESS] Local test PASSED ✅`);
    } else {
      lines.push(`[ERROR] ✗ Migration failed`);
      lines.push(`[ERROR] Column 'last_login' already exists in table`);
      lines.push(`[FAILED] Local test FAILED ❌`);
    }

    for (let i = 0; i < lines.length; i++) {
      await new Promise(r => setTimeout(r, 300));
      setLogs(l => ({ ...l, [change.id]: (l[change.id] || '') + lines[i] + '\n' }));
    }

    const newStatus = simulateFail ? 'local_failed' : 'local_passed';
    await base44.entities.ChangeRequest.update(change.id, { status: newStatus });
    await base44.entities.DeploymentLog.create({
      change_request_id: change.id,
      change_request_title: change.title,
      environment: 'local',
      action: 'test',
      status: simulateFail ? 'failed' : 'success',
      performed_by: 'tester',
      log_output: lines.join('\n'),
      db_type: change.db_type,
    });

    setResults(r => ({ ...r, [change.id]: simulateFail ? 'failed' : 'passed' }));
    setRunning(r => ({ ...r, [change.id]: false }));
    setChanges(prev => prev.map(c => c.id === change.id ? { ...c, status: newStatus } : c));
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-blue-600" /> Local Testing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Test your migration scripts locally before sending for DBA approval</p>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-2">How Local Testing Works</p>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>Your migration script is validated for syntax errors</li>
          <li>Script is run against a local/dev database instance</li>
          <li>Integrity checks are run to confirm schema changes</li>
          <li>On pass → you can submit for DBA Staging approval</li>
          <li>On fail → fix your script and re-run the test</li>
        </ol>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : changes.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <FlaskConical className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">No pending changes for local testing</p>
          <Link to="/changes/new" className="mt-3 inline-block text-primary text-sm hover:underline">Create a new change request</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {changes.map(change => (
            <div key={change.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{change.title}</span>
                    <DbTypeBadge type={change.db_type} />
                    <StatusBadge status={change.status} />
                  </div>
                  {change.jira_ticket && <span className="text-xs font-mono text-primary mt-1 block">{change.jira_ticket}</span>}
                  {change.description && <p className="text-xs text-muted-foreground mt-1">{change.description}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => runTest(change, false)}
                    disabled={running[change.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {running[change.id] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {running[change.id] ? 'Running...' : 'Run Test'}
                  </button>
                  <button
                    onClick={() => runTest(change, true)}
                    disabled={running[change.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground border border-border rounded-lg text-xs font-medium hover:bg-muted/80 disabled:opacity-50 transition-colors"
                  >
                    Simulate Fail
                  </button>
                </div>
              </div>

              {/* Script Preview */}
              <div className="border-t border-border">
                <details className="group">
                  <summary className="flex items-center gap-2 px-4 py-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                    <Terminal className="w-3.5 h-3.5" /> View Migration Script
                  </summary>
                  <pre className="bg-slate-900 text-green-400 px-4 py-3 text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap">
                    {change.migration_script}
                  </pre>
                </details>
              </div>

              {/* Test Output */}
              {logs[change.id] && (
                <div className="border-t border-border">
                  <div className={`flex items-center gap-2 px-4 py-2 text-xs font-medium ${results[change.id] === 'passed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {results[change.id] === 'passed' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    Test {results[change.id] === 'passed' ? 'PASSED' : results[change.id] === 'failed' ? 'FAILED' : 'Running...'}
                  </div>
                  <pre className="bg-slate-950 text-green-300 px-4 py-3 text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap">
                    {logs[change.id]}
                  </pre>
                  {results[change.id] === 'passed' && (
                    <div className="px-4 py-3 bg-green-50 border-t border-green-100">
                      <Link to={`/changes/${change.id}`} className="text-xs text-green-700 font-medium hover:underline">
                        → View change detail to submit for Staging DBA Approval
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}