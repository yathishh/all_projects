import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, GitBranch, ExternalLink } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import DbTypeBadge from '@/components/shared/DbTypeBadge';
import { format } from 'date-fns';

const PRIORITY_COLOR = {
  low: 'text-slate-500', medium: 'text-blue-600', high: 'text-orange-600', critical: 'text-red-600'
};

export default function ChangeRequests() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDb, setFilterDb] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    base44.entities.ChangeRequest.list('-created_date', 100).then(data => {
      setChanges(data);
      setLoading(false);
    });
  }, []);

  const filtered = changes.filter(c => {
    const matchSearch = !search || c.title?.toLowerCase().includes(search.toLowerCase()) || c.jira_ticket?.toLowerCase().includes(search.toLowerCase());
    const matchDb = filterDb === 'all' || c.db_type === filterDb;
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchDb && matchStatus;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Change Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">All DB migration change requests</p>
        </div>
        <Link to="/changes/new" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New Change
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search by title or Jira ticket..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={filterDb}
          onChange={e => setFilterDb(e.target.value)}
        >
          <option value="all">All DB Types</option>
          <option value="mysql">MySQL</option>
          <option value="postgres">Postgres</option>
          <option value="mongodb">MongoDB</option>
        </select>
        <select
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="local_passed">Local Passed</option>
          <option value="pending_staging_approval">Awaiting DBA (STG)</option>
          <option value="staging_passed">Staging Passed</option>
          <option value="pending_prod_approval">Awaiting DBA (PRD)</option>
          <option value="prod_deployed">Deployed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jira</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">DB Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array(7).fill(0).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No change requests found
              </td></tr>
            ) : (
              filtered.map(c => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground max-w-[220px]">
                    <span className="truncate block">{c.title}</span>
                    {c.git_branch && <span className="text-xs text-muted-foreground font-mono">{c.git_branch}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.jira_ticket ? (
                      <span className="text-primary font-mono text-xs font-semibold">{c.jira_ticket}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3"><DbTypeBadge type={c.db_type} /></td>
                  <td className="px-4 py-3">
                    <span className={`font-medium capitalize ${PRIORITY_COLOR[c.priority]}`}>{c.priority}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {c.created_date ? format(new Date(c.created_date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/changes/${c.id}`} className="text-primary hover:underline flex items-center gap-1 text-xs">
                      View <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}ss