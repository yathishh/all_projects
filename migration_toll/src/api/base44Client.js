import { api } from './apiClient';

// Maps entity name → REST table path
const TABLE = {
  MigrationProject:  'migration_projects',
  MigrationTask:     'migration_tasks',
  ConnectionProfile: 'connection_profiles',
  BackupJob:         'backup_jobs',
  RestoreJob:        'restore_jobs',
  StorageEngine:     'storage_engines',
  SchemaMapping:     'schema_mappings',
  AlertRule:         'alert_rules',
  AuditLog:          'audit_logs',
};

/** @param {string} table */
const makeEntity = (table) => ({
  /** @param {string} sort @param {number} limit */
  list: (sort = '-created_date', limit = 100) =>
    api.get(`/${table}?sort=${sort}&limit=${limit}`),

  /** @param {Record<string, string>} filters */
  filter: (filters) => {
    const qs = new URLSearchParams(filters).toString();
    return api.get(`/${table}/filter?${qs}`);
  },

  /** @param {Record<string, unknown>} data */
  create: (data) => api.post(`/${table}`, data),

  /** @param {string} id @param {Record<string, unknown>} data */
  update: (id, data) => api.put(`/${table}/${id}`, data),

  /** @param {string} id */
  delete: (id) => api.delete(`/${table}/${id}`),
});

export const base44 = {
  auth: {
    me: async () => {
      const data = await api.get('/auth/me');
      return data.user;
    },
    logout: () => {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    },
    /** @param {string} [returnUrl] */
    redirectToLogin: (returnUrl) => {
      const next = returnUrl ? `?next=${encodeURIComponent(returnUrl)}` : '';
      window.location.href = `/login${next}`;
    },
  },
  entities: Object.fromEntries(
    Object.entries(TABLE).map(([name, table]) => [name, makeEntity(table)])
  ),
};
