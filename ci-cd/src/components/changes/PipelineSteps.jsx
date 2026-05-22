import { cn } from '@/lib/utils';
import { Check, X, Clock, Circle } from 'lucide-react';

const steps = [
  { label: 'Draft', statuses: ['draft'] },
  { label: 'Local Test', statuses: ['pending_local', 'local_passed', 'local_failed'] },
  { label: 'DBA Staging', statuses: ['pending_staging_approval', 'staging_approved', 'staging_rejected'] },
  { label: 'Staging Deploy', statuses: ['pending_staging_deploy', 'staging_passed', 'staging_failed'] },
  { label: 'DBA Production', statuses: ['pending_prod_approval', 'prod_approved', 'prod_rejected'] },
  { label: 'Production', statuses: ['prod_deployed', 'prod_failed'] },
];

const stepOrder = [
  'draft',
  'pending_local', 'local_passed', 'local_failed',
  'pending_staging_approval', 'staging_approved', 'staging_rejected',
  'pending_staging_deploy', 'staging_passed', 'staging_failed',
  'pending_prod_approval', 'prod_approved', 'prod_rejected',
  'prod_deployed', 'prod_failed',
  'rolled_back',
];

export default function PipelineSteps({ status, className }) {
  const currentIdx = stepOrder.indexOf(status);

  const getStepState = (step) => {
    const stepStatuses = step.statuses;
    if (stepStatuses.includes(status)) return 'active';
    const firstStepIdx = stepOrder.indexOf(stepStatuses[0]);
    if (currentIdx > firstStepIdx + stepStatuses.length - 1) return 'done';
    return 'pending';
  };

  const isFailedStatus = (step) => {
    return step.statuses.some(s => s.includes('failed') || s.includes('rejected')) && step.statuses.includes(status);
  };

  return (
    <div className={cn('bg-card border border-border rounded-xl p-5', className)}>
      <div className="flex items-center gap-0">
        {steps.map((step, i) => {
          const state = getStepState(step);
          const failed = isFailedStatus(step);
          return (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                  state === 'done' ? 'bg-green-500 border-green-500' :
                  state === 'active' && failed ? 'bg-red-500 border-red-500' :
                  state === 'active' ? 'bg-primary border-primary' :
                  'bg-background border-border'
                )}>
                  {state === 'done' ? <Check className="w-4 h-4 text-white" /> :
                   state === 'active' && failed ? <X className="w-4 h-4 text-white" /> :
                   state === 'active' ? <Clock className="w-4 h-4 text-white" /> :
                   <Circle className="w-3 h-3 text-muted-foreground/40" />}
                </div>
                <p className={cn('text-xs mt-1.5 text-center font-medium',
                  state === 'active' ? 'text-foreground' : 'text-muted-foreground'
                )}>{step.label}</p>
              </div>
              {i < steps.length - 1 && (
                <div className={cn('h-0.5 flex-1 -mt-5 transition-all', state === 'done' ? 'bg-green-400' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}