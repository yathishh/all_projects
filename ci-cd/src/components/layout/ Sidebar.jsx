import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, GitBranch, History,
  Database, Bell, ChevronRight, Shield, FlaskConical
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: GitBranch, label: 'Change Requests', path: '/changes' },
  { icon: FlaskConical, label: 'Local Testing', path: '/local-test' },
  { icon: Shield, label: 'DBA Approvals', path: '/approvals' },
  { icon: History, label: 'Deploy History', path: '/history' },
  { icon: Database, label: 'Environments', path: '/environments' },
  { icon: Bell, label: 'Webhook Settings', path: '/webhooks' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Database className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-none">DB Pipeline</p>
            <p className="text-sidebar-foreground/50 text-xs mt-0.5">CI/CD Control</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group',
                active
                  ? 'bg-sidebar-accent text-white'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-primary' : 'text-sidebar-foreground/60 group-hover:text-white')} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 text-primary" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse-slow" />
          <span className="text-xs text-sidebar-foreground/50">Pipeline Active</span>
        </div>
      </div>
    </div>
  );
}