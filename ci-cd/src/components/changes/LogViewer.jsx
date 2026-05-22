import { cn } from '@/lib/utils';
import { Terminal } from 'lucide-react';

export default function LogViewer({ title, log, status, className }) {
  return (
    <div className={cn('bg-card border rounded-xl overflow-hidden', status === 'failed' ? 'border-red-200' : 'border-green-200', className)}>
      <div className={cn('flex items-center gap-2 px-4 py-3 border-b', status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200')}>
        <Terminal className={cn('w-4 h-4', status === 'failed' ? 'text-red-600' : 'text-green-600')} />
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className={cn('ml-auto text-xs font-semibold px-2 py-0.5 rounded-full', status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}>
          {status === 'failed' ? 'FAILED' : 'SUCCESS'}
        </span>
      </div>
      <pre className="p-4 text-xs font-mono bg-slate-950 text-slate-300 overflow-auto max-h-40 leading-relaxed">
        {log}
      </pre>
    </div>
  );
}