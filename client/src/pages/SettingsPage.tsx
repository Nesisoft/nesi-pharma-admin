import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api, { getErrorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const profileMutation = useMutation({
    mutationFn: async (data: typeof profile) => api.put('/auth/profile', data),
    onSuccess: () => { toast.success('Profile updated'); refreshUser(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => api.post('/auth/change-password', data),
    onSuccess: () => { toast.success('Password changed'); setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    profileMutation.mutate(profile);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwords.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    passwordMutation.mutate({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-medium text-gray-900">Profile Information</h2>
          </div>
          <form onSubmit={handleProfileSubmit} className="card-body space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" value={user?.email || ''} disabled className="input bg-gray-50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name</label>
                <input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} className="input" required />
              </div>
            </div>
            <div>
              <label className="label">Role</label>
              <input value={user?.role?.replace('_', ' ') || ''} disabled className="input bg-gray-50" />
            </div>
            <button type="submit" disabled={profileMutation.isPending} className="btn btn-primary">
              {profileMutation.isPending ? <><LoadingSpinner size="sm" className="mr-2" />Saving...</> : 'Save Changes'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-medium text-gray-900">Change Password</h2>
          </div>
          <form onSubmit={handlePasswordSubmit} className="card-body space-y-4">
            <div>
              <label className="label">Current Password</label>
              <input type="password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} className="input" required minLength={8} />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} className="input" required minLength={8} />
            </div>
            <button type="submit" disabled={passwordMutation.isPending} className="btn btn-primary">
              {passwordMutation.isPending ? <><LoadingSpinner size="sm" className="mr-2" />Changing...</> : 'Change Password'}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">API Documentation</h2>
        </div>
        <div className="card-body">
          <p className="text-gray-600 mb-4">Use the following endpoints to integrate license verification into your pharmacy application:</p>
          <div className="space-y-4 font-mono text-sm">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-green-600 font-medium">POST /api/public/license/verify</p>
              <p className="text-gray-500 mt-1">Verify a license key</p>
              <pre className="mt-2 text-gray-700">{`{ "licenseKey": "XXXX-XXXX-XXXX-XXXX-XXXX" }`}</pre>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-green-600 font-medium">POST /api/public/license/activate</p>
              <p className="text-gray-500 mt-1">Activate a license on a device</p>
              <pre className="mt-2 text-gray-700">{`{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX-XXXX",
  "deviceId": "unique-device-id",
  "deviceName": "Device Name"
}`}</pre>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-green-600 font-medium">GET /api/public/license/tiers</p>
              <p className="text-gray-500 mt-1">Get available license tiers and features</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
