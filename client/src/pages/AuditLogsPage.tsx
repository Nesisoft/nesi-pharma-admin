import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import clsx from 'clsx';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  ipAddress: string;
  createdAt: string;
  adminUser: { firstName: string; lastName: string; email: string } | null;
}

const actionColors: Record<string, string> = {
  CREATE: 'badge-success',
  UPDATE: 'badge-info',
  DELETE: 'badge-danger',
  ACTIVATE: 'badge-success',
  DEACTIVATE: 'badge-warning',
  REVOKE: 'badge-danger',
  LOGIN: 'badge-info',
  LOGOUT: 'badge-gray',
  VERIFY: 'badge-info',
  GENERATE: 'badge-success',
};

export default function AuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const action = searchParams.get('action') || '';
  const entityType = searchParams.get('entityType') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, action, entityType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (action) params.set('action', action);
      if (entityType) params.set('entityType', entityType);
      const response = await api.get(`/audit-logs?${params}`);
      return { data: response.data.data as AuditLog[], meta: response.data.meta };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-500">Track all system activities</p>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex gap-4">
            <select value={action} onChange={(e) => setSearchParams((prev) => {
              if (e.target.value) prev.set('action', e.target.value); else prev.delete('action');
              prev.set('page', '1'); return prev;
            })} className="input w-auto">
              <option value="">All Actions</option>
              {['CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'REVOKE', 'LOGIN', 'LOGOUT', 'VERIFY', 'GENERATE'].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select value={entityType} onChange={(e) => setSearchParams((prev) => {
              if (e.target.value) prev.set('entityType', e.target.value); else prev.delete('entityType');
              prev.set('page', '1'); return prev;
            })} className="input w-auto">
              <option value="">All Types</option>
              {['License', 'Pharmacy', 'AdminUser'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
        ) : (
          <>
            <table className="table">
              <thead><tr><th>Time</th><th>Action</th><th>Type</th><th>Description</th><th>User</th><th>IP</th></tr></thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data?.data.map((log) => (
                  <tr key={log.id}>
                    <td className="text-gray-500 text-sm">{format(new Date(log.createdAt), 'MMM d, HH:mm')}</td>
                    <td><span className={clsx('badge', actionColors[log.action] || 'badge-gray')}>{log.action}</span></td>
                    <td className="text-gray-600">{log.entityType}</td>
                    <td className="text-gray-900 max-w-xs truncate">{log.description}</td>
                    <td className="text-gray-600">{log.adminUser ? `${log.adminUser.firstName} ${log.adminUser.lastName}` : 'System'}</td>
                    <td className="text-gray-500 text-sm font-mono">{log.ipAddress || '-'}</td>
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">No logs found</td></tr>
                )}
              </tbody>
            </table>
            {data?.meta && data.meta.totalPages > 1 && (
              <div className="px-6 py-4 border-t flex justify-between items-center">
                <p className="text-sm text-gray-500">Page {data.meta.page} of {data.meta.totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setSearchParams((prev) => { prev.set('page', (page - 1).toString()); return prev; })} disabled={page <= 1} className="btn btn-secondary">Previous</button>
                  <button onClick={() => setSearchParams((prev) => { prev.set('page', (page + 1).toString()); return prev; })} disabled={page >= data.meta.totalPages} className="btn btn-secondary">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
