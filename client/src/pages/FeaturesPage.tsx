import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getErrorMessage } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArchiveBoxIcon,
  ArchiveBoxXMarkIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FeatureFormData {
  key: string;
  name: string;
  description: string;
  category: string;
}

const categoryColors: Record<string, string> = {
  core: 'bg-blue-100 text-blue-800',
  sales: 'bg-green-100 text-green-800',
  inventory: 'bg-yellow-100 text-yellow-800',
  reports: 'bg-purple-100 text-purple-800',
  customers: 'bg-pink-100 text-pink-800',
  suppliers: 'bg-orange-100 text-orange-800',
  general: 'bg-gray-100 text-gray-800',
};

const defaultCategories = ['core', 'sales', 'inventory', 'reports', 'customers', 'suppliers', 'general'];

export default function FeaturesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<FeatureFormData>({
    key: '',
    name: '',
    description: '',
    category: 'general',
  });

  // Fetch features
  const { data: features, isLoading } = useQuery<Feature[]>({
    queryKey: ['features', showArchived, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (showArchived) params.append('includeArchived', 'true');
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      const response = await api.get(`/features?${params.toString()}`);
      return response.data.data;
    },
  });

  // Fetch categories
  const { data: categories } = useQuery<string[]>({
    queryKey: ['feature-categories'],
    queryFn: async () => {
      const response = await api.get('/features/categories');
      return response.data.data;
    },
  });

  // Create feature mutation
  const createMutation = useMutation({
    mutationFn: async (data: FeatureFormData) => {
      const response = await api.post('/features', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Feature created successfully!');
      queryClient.invalidateQueries({ queryKey: ['features'] });
      closeModal();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  // Update feature mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FeatureFormData> }) => {
      const response = await api.put(`/features/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Feature updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['features'] });
      closeModal();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  // Archive feature mutation
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/features/${id}/archive`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Feature archived successfully!');
      queryClient.invalidateQueries({ queryKey: ['features'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  // Restore feature mutation
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/features/${id}/restore`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Feature restored successfully!');
      queryClient.invalidateQueries({ queryKey: ['features'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  // Delete feature mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/features/${id}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Feature deleted permanently!');
      queryClient.invalidateQueries({ queryKey: ['features'] });
      setDeleteConfirm(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const openCreateModal = () => {
    setEditingFeature(null);
    setFormData({
      key: '',
      name: '',
      description: '',
      category: 'general',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (feature: Feature) => {
    setEditingFeature(feature);
    setFormData({
      key: feature.key,
      name: feature.name,
      description: feature.description || '',
      category: feature.category,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingFeature(null);
    setFormData({
      key: '',
      name: '',
      description: '',
      category: 'general',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFeature) {
      updateMutation.mutate({ id: editingFeature.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Filter features by search
  const filteredFeatures = features?.filter((feature) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      feature.name.toLowerCase().includes(searchLower) ||
      feature.key.toLowerCase().includes(searchLower) ||
      feature.description?.toLowerCase().includes(searchLower) ||
      feature.category.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Features</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage features that can be assigned to license tiers
          </p>
        </div>
        {isSuperAdmin && (
          <button onClick={openCreateModal} className="btn btn-primary">
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Feature
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search features..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Categories</option>
              {(categories || defaultCategories).map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Show Archived Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-600">Show Archived</span>
          </label>
        </div>
      </div>

      {/* Features Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Feature
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Key
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredFeatures?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No features found
                  </td>
                </tr>
              ) : (
                filteredFeatures?.map((feature) => (
                  <tr
                    key={feature.id}
                    className={clsx(
                      'hover:bg-gray-50',
                      feature.archivedAt && 'opacity-60 bg-gray-50'
                    )}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{feature.name}</div>
                        {feature.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {feature.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {feature.key}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          'badge',
                          categoryColors[feature.category] || categoryColors.general
                        )}
                      >
                        {feature.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {feature.archivedAt ? (
                        <span className="badge bg-red-100 text-red-800">Archived</span>
                      ) : feature.isActive ? (
                        <span className="badge bg-green-100 text-green-800">Active</span>
                      ) : (
                        <span className="badge bg-gray-100 text-gray-800">Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isSuperAdmin && (
                        <div className="flex items-center justify-end gap-2">
                          {!feature.archivedAt && (
                            <>
                              <button
                                onClick={() => openEditModal(feature)}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                title="Edit"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => archiveMutation.mutate(feature.id)}
                                disabled={archiveMutation.isPending}
                                className="p-1 text-gray-400 hover:text-yellow-600 rounded"
                                title="Archive"
                              >
                                <ArchiveBoxIcon className="h-5 w-5" />
                              </button>
                            </>
                          )}
                          {feature.archivedAt && (
                            <>
                              <button
                                onClick={() => restoreMutation.mutate(feature.id)}
                                disabled={restoreMutation.isPending}
                                className="p-1 text-gray-400 hover:text-green-600 rounded"
                                title="Restore"
                              >
                                <ArchiveBoxXMarkIcon className="h-5 w-5" />
                              </button>
                              {deleteConfirm === feature.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => deleteMutation.mutate(feature.id)}
                                    disabled={deleteMutation.isPending}
                                    className="p-1 text-red-600 hover:text-red-700 rounded"
                                    title="Confirm Delete"
                                  >
                                    <CheckIcon className="h-5 w-5" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                    title="Cancel"
                                  >
                                    <XMarkIcon className="h-5 w-5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirm(feature.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                                  title="Delete Permanently"
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Count */}
      <div className="text-sm text-gray-500">
        Showing {filteredFeatures?.length || 0} of {features?.length || 0} features
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-30"
              onClick={closeModal}
            />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingFeature ? 'Edit Feature' : 'Create Feature'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Feature Key
                  </label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) =>
                      setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })
                    }
                    className="input w-full"
                    placeholder="e.g., customers, prescriptions"
                    required
                    disabled={!!editingFeature}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unique identifier used in the system (cannot be changed after creation)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input w-full"
                    placeholder="e.g., Customer Management"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input w-full"
                    rows={2}
                    placeholder="Brief description of the feature"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input w-full"
                  >
                    {defaultCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="btn btn-primary flex-1"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <LoadingSpinner size="sm" />
                    ) : editingFeature ? (
                      'Update'
                    ) : (
                      'Create'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
