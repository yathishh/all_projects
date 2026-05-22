import { Database, Server, CheckCircle, Settings } from 'lucide-react';

const environments = [
  {
    name: 'Local',
    key: 'local',
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'bg-blue-600',
    desc: 'Developer local machine. Test migrations before any approval.',
    purpose: 'Initial testing & validation',
    approval: 'None required',
    dbs: [
      { type: 'MySQL', host: 'localhost:3306', note: 'Local Docker / XAMPP' },
      { type: 'PostgreSQL', host: 'localhost:5432', note: 'Local Docker / Homebrew' },
      { type: 'MongoDB', host: 'localhost:27017', note: 'Local Docker / Compass' },
    ],
    steps: ['Write migration script', 'Submit change request', 'Run local test', 'Fix errors if any', 'Submit for staging approval on pass'],
  },
  {
    name: 'Staging',
    key: 'staging',
    color: 'bg-purple-50 border-purple-200',
    headerColor: 'bg-purple-600',
    desc: 'Staging environment mirrors production. DBA must approve before deploy.',
    purpose: 'Pre-production validation',
    approval: 'DBA Team approval required',
    dbs: [
      { type: 'MySQL', host: 'staging-mysql.internal:3306', note: 'Managed RDS' },
      { type: 'PostgreSQL', host: 'staging-pg.internal:5432', note: 'Managed RDS' },
      { type: 'MongoDB', host: 'staging-mongo.internal:27017', note: 'Atlas Cluster' },
    ],
    steps: ['Local test must pass', 'DBA reviews migration + rollback script', 'DBA approves/rejects', 'Deploy to staging on approval', 'Validate staging results', 'Submit for prod approval on pass'],
  },
  {
    name: 'Production',
    key: 'production',
    color: 'bg-orange-50 border-orange-200',
    headerColor: 'bg-orange-600',
    desc: 'Live production database. Requires mandatory DBA approval + rollback plan.',
    purpose: 'Live production system',
    approval: 'Mandatory DBA approval + rollback script',
    dbs: [
      { type: 'MySQL', host: 'prod-mysql.internal:3306', note: 'Primary RDS Multi-AZ' },
      { type: 'PostgreSQL', host: 'prod-pg.internal:5432', note: 'Primary RDS Multi-AZ' },
      { type: 'MongoDB', host: 'prod-mongo.internal:27017', note: 'Atlas M30+ Cluster' },
    ],
    steps: ['Staging must pass', 'DBA carefully reviews', 'DBA approves production deploy', 'Deploy to production', 'Rollback available if needed'],
  },
];

export default function Environments() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Database className="w-6 h-6 text-primary" /> Environments
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Pipeline environment configuration and database connections</p>
      </div>

      {/* Pipeline flow */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-foreground mb-4">Full CI/CD Pipeline Flow</h2>
        <div className="relative">
          <div className="flex items-start gap-4 overflow-x-auto pb-2">
            {[
              { step: '1', label: 'Create Change Request', sub: 'Add Jira ticket + scripts', color: 'bg-slate-600' },
              { step: '2', label: 'Local Test', sub: 'Run on local DB', color: 'bg-blue-600' },
              { step: '3', label: 'DBA Review (STG)', sub: 'Approve/Reject', color: 'bg-yellow-600' },
              { step: '4', label: 'Deploy Staging', sub: 'Auto after approval', color: 'bg-purple-600' },
              { step: '5', label: 'DBA Review (PRD)', sub: 'Mandatory approval', color: 'bg-orange-600' },
              { step: '6', label: 'Deploy Production', sub: 'Live deployment', color: 'bg-green-600' },
            ].map((item, i, arr) => (
              <div key={i} className="flex items-center gap-3 flex-shrink-0">
                <div className="flex flex-col items-center gap-1.5 text-center w-28">
                  <div className={`w-8 h-8 rounded-full ${item.color} text-white text-sm font-bold flex items-center justify-center`}>{item.step}</div>
                  <p className="text-xs font-semibold text-foreground leading-tight">{item.label}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{item.sub}</p>
                </div>
                {i < arr.length - 1 && <div className="w-8 h-0.5 bg-border flex-shrink-0 mt-[-12px]" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Environment Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {environments.map(env => (
          <div key={env.key} className={`rounded-xl border ${env.color} overflow-hidden`}>
            <div className={`${env.headerColor} px-4 py-3 flex items-center gap-2`}>
              <Server className="w-4 h-4 text-white" />
              <span className="text-white font-semibold">{env.name} Environment</span>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">{env.desc}</p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Purpose</p>
                  <p className="font-medium">{env.purpose}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Approval</p>
                  <p className="font-medium">{env.approval}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Database Connections</p>
                <div className="space-y-1.5">
                  {env.dbs.map(db => (
                    <div key={db.type} className="bg-white/60 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{db.type}</span>
                        <span className="text-xs text-muted-foreground">{db.note}</span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{db.host}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Steps in this Environment</p>
                <ul className="space-y-1">
                  {env.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tools Section */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Settings className="w-4 h-4" /> Recommended Migration Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Flyway', dbs: 'MySQL, PostgreSQL', desc: 'Version-based SQL migrations. Simple, reliable, widely used.', cmd: 'flyway migrate -url=jdbc:mysql://...' },
            { name: 'Liquibase', dbs: 'MySQL, PostgreSQL', desc: 'XML/SQL/YAML changelogs. Enterprise-grade with rollback support.', cmd: 'liquibase update' },
            { name: 'mongomigrate', dbs: 'MongoDB', desc: 'Node.js migration tool for MongoDB with up/down support.', cmd: 'mongomigrate up' },
          ].map(tool => (
            <div key={tool.name} className="p-4 bg-muted/50 rounded-lg">
              <p className="font-semibold text-foreground text-sm">{tool.name}</p>
              <p className="text-xs text-primary mt-0.5">{tool.dbs}</p>
              <p className="text-xs text-muted-foreground mt-1.5">{tool.desc}</p>
              <pre className="mt-2 text-xs font-mono bg-slate-900 text-green-400 rounded px-2 py-1.5 overflow-auto">{tool.cmd}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}