import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getErrorMessage } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { format } from 'date-fns';

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800',
  ADMIN: 'badge-info',
  SUPPORT: 'badge-success',
  VIEWER: 'badge-gray',
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'VIEWER' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await api.get('/admin-users?limit=50');
      return response.data.data as AdminUser[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => api.post('/admin-users', data),
    onSuccess: () => { toast.success('User created'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); closeModal(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => api.put(`/admin-users/${id}`, data),
    onSuccess: () => { toast.success('User updated'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); closeModal(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin-users/${id}`),
    onSuccess: () => { toast.success('User deleted'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const closeModal = () => { setShowModal(false); setEditingUser(null); setFormData({ email: '', password: '', firstName: '', lastName: '', role: 'VIEWER' }); };

  const openCreateModal = () => { setEditingUser(null); setFormData({ email: '', password: '', firstName: '', lastName: '', role: 'VIEWER' }); setShowModal(true); };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setFormData({ email: user.email, password: '', firstName: user.firstName, lastName: user.lastName, role: user.role });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const { password, email, ...rest } = formData;
      updateMutation.mutate({ id: editingUser.id, data: rest });
    } else {
      createMutation.mutate(formData);
    }
  };

  const canManageUsers = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
          <p className="mt-1 text-sm text-gray-500">Manage system administrators</p>
        </div>
        {currentUser?.role === 'SUPER_ADMIN' && (
          <button onClick={openCreateModal} className="btn btn-primary">
            <PlusIcon className="h-5 w-5 mr-2" />Add User
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
        ) : (
          <table className="table">
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data?.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div>
                      <p className="font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </td>
                  <td><span className={clsx('badge', roleColors[user.role])}>{user.role.replace('_', ' ')}</span></td>
                  <td><span className={clsx('badge', user.isActive ? 'badge-success' : 'badge-gray')}>{user.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="text-gray-500">{user.lastLogin ? format(new Date(user.lastLogin), 'MMM d, HH:mm') : 'Never'}</td>
                  <td>
                    {canManageUsers && user.id !== currentUser?.id && (
                      <div className="flex gap-2">
                        <button onClick={() => openEditModal(user)} className="text-gray-400 hover:text-gray-600"><PencilIcon className="h-5 w-5" /></button>
                        {currentUser?.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN' && (
                          <button onClick={() => deleteMutation.mutate(user.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-5 w-5" /></button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={closeModal} />
            <div className="relative bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-medium mb-4">{editingUser ? 'Edit User' : 'Create User'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">First Name</label>
                    <input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="input" required />
                  </div>
                  <div>
                    <label className="label">Last Name</label>
                    <input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="input" required />
                  </div>
                </div>
                {!editingUser && (
                  <>
                    <div>
                      <label className="label">Email</label>
                      <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" required />
                    </div>
                    <div>
                      <label className="label">Password</label>
                      <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="input" required minLength={8} />
                    </div>
                  </>
                )}
                <div>
                  <label className="label">Role</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="input">
                    <option value="VIEWER">Viewer</option>
                    <option value="SUPPORT">Support</option>
                    <option value="ADMIN">Admin</option>
                    {currentUser?.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin</option>}
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn btn-primary flex-1">{editingUser ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
