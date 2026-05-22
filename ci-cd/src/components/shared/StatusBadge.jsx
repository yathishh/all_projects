import { cn } from '@/lib/utils';

const statusConfig = {
  draft:                    { label: 'Draft',              color: 'bg-muted text-muted-foreground' },
  pending_local:            { label: 'Testing Locally',    color: 'bg-blue-100 text-blue-700' },
  local_passed:             { label: 'Local Passed',       color: 'bg-green-100 text-green-700' },
  local_failed:             { label: 'Local Failed',       color: 'bg-red-100 text-red-700' },
  pending_staging_approval: { label: 'Awaiting DBA (STG)', color: 'bg-yellow-100 text-yellow-700' },
  staging_approved:         { label: 'Staging Approved',   color: 'bg-green-100 text-green-700' },
  staging_rejected:         { label: 'Staging Rejected',   color: 'bg-red-100 text-red-700' },
  pending_staging_deploy:   { label: 'Deploying (STG)',    color: 'bg-blue-100 text-blue-700' },
  staging_passed:           { label: 'Staging Passed',     color: 'bg-green-100 text-green-700' },
  staging_failed:           { label: 'Staging Failed',     color: 'bg-red-100 text-red-700' },
  pending_prod_approval:    { label: 'Awaiting DBA (PRD)', color: 'bg-orange-100 text-orange-700' },
  prod_approved:            { label: 'Prod Approved',      color: 'bg-green-100 text-green-700' },
  prod_rejected:            { label: 'Prod Rejected',      color: 'bg-red-100 text-red-700' },
  prod_deployed:            { label: 'Deployed (PRD)',      color: 'bg-emerald-100 text-emerald-700' },
  prod_failed:              { label: 'Prod Failed',        color: 'bg-red-100 text-red-700' },
  rolled_back:              { label: 'Rolled Back',        color: 'bg-purple-100 text-purple-700' },
};

export default function StatusBadge({ status, className }) {
  const config = statusConfig[status] || { label: status, color: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.color, className)}>
      {config.label}
    </span>
  );
}