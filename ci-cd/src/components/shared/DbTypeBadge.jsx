import { cn } from '@/lib/utils';

const dbConfig = {
  mysql:    { label: 'MySQL',    color: 'bg-orange-100 text-orange-700 border-orange-200' },
  postgres: { label: 'Postgres', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  mongodb:  { label: 'MongoDB',  color: 'bg-green-100 text-green-700 border-green-200' },
};

export default function DbTypeBadge({ type, className }) {
  const config = dbConfig[type] || { label: type, color: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border', config.color, className)}>
      {config.label}
    </span>
  );
}