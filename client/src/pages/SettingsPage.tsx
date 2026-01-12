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
          <div className="space-y-6 text-sm">
            {/* Verify License */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-green-600 font-medium font-mono">POST /api/public/license/verify</p>
              <p className="text-gray-500 mt-1">Verify a license key and get its current status and features</p>
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Request Body:</p>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{`{
  "licenseKey": "STD-XXXX-XXXX-XXXX-XXXX",
  "deviceId": "optional-device-id"
}`}</pre>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Success Response (200):</p>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "message": "License is valid",
  "data": {
    "valid": true,
    "license": {
      "tier": "STANDARD",
      "tierCode": "STANDARD",
      "status": "ACTIVE",
      "features": {
        "maxUsers": 3,
        "maxBranches": 1,
        "maxProducts": 5000,
        "barcodeScanning": true,
        "inventoryReports": false,
        ...
      },
      "validFrom": "2024-01-15T00:00:00.000Z",
      "validUntil": "2025-01-15T00:00:00.000Z",
      "expiresAt": "2025-01-15T00:00:00.000Z"
    },
    "pharmacy": {
      "id": "pharmacy-uuid",
      "name": "ABC Pharmacy"
    }
  }
}`}</pre>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Error Responses:</p>
                <pre className="bg-red-50 p-2 rounded text-xs overflow-x-auto text-red-700">{`400: "License key is required" | "Invalid license key format"
403: "License has been revoked" | "License has been suspended" | "License has expired"
404: "License key not found"
500: "License verification failed"`}</pre>
              </div>
            </div>

            {/* Activate License */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-green-600 font-medium font-mono">POST /api/public/license/activate</p>
              <p className="text-gray-500 mt-1">Activate a license on a device. Can also register pharmacy details during first activation.</p>
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Request Body:</p>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{`{
  "licenseKey": "PRO-XXXX-XXXX-XXXX-XXXX",
  "deviceId": "unique-device-identifier",
  "deviceName": "Main POS Terminal",
  "deviceFingerprint": "optional-hardware-fingerprint",
  "pharmacy": {                           // Optional - for first activation
    "name": "ABC Pharmacy",
    "email": "contact@abcpharmacy.com",
    "phone": "+233200000000",
    "address": "123 Main Street",
    "city": "Accra",
    "region": "Greater Accra",
    "country": "Ghana",
    "registrationNumber": "PH-12345"
  }
}`}</pre>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Success Response (200):</p>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "message": "License activated successfully",
  "data": {
    "activated": true,
    "alreadyActivated": false,    // true if device was already activated
    "license": {
      "tier": "PROFESSIONAL",
      "tierCode": "PROFESSIONAL",
      "features": {
        "maxUsers": 10,
        "maxBranches": 3,
        "maxProducts": -1,
        "suppliers": true,
        "purchaseOrders": true,
        "customers": true,
        ...
      },
      "validFrom": "2024-01-15T10:30:00.000Z",
      "expiresAt": "2025-01-15T10:30:00.000Z"
    },
    "activation": {
      "id": "activation-uuid",
      "deviceName": "Main POS Terminal",
      "activatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}`}</pre>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Error Responses:</p>
                <pre className="bg-red-50 p-2 rounded text-xs overflow-x-auto text-red-700">{`400: "License key is required" | "Invalid license key format"
403: "License has been revoked" | "License has expired" |
     "Pharmacy account is suspended. Contact support to reactivate." |
     "Maximum activations reached for this license"
404: "License key not found"
500: "License activation failed"`}</pre>
              </div>
            </div>

            {/* Deactivate License */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-orange-600 font-medium font-mono">POST /api/public/license/deactivate</p>
              <p className="text-gray-500 mt-1">Deactivate a license on a specific device to free up an activation slot</p>
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Request Body:</p>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{`{
  "licenseKey": "PRO-XXXX-XXXX-XXXX-XXXX",
  "deviceId": "unique-device-identifier",     // Either deviceId
  "activationId": "activation-uuid"           // OR activationId is required
}`}</pre>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Success Response (200):</p>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "message": "License deactivated successfully",
  "data": null
}`}</pre>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Error Responses:</p>
                <pre className="bg-red-50 p-2 rounded text-xs overflow-x-auto text-red-700">{`400: "License key is required" | "Device ID or activation ID is required"
404: "License key not found" | "Active activation not found"
500: "License deactivation failed"`}</pre>
              </div>
            </div>

            {/* Get Tiers */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-blue-600 font-medium font-mono">GET /api/public/license/tiers</p>
              <p className="text-gray-500 mt-1">Get all available license tiers with their configurations and pricing</p>
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Success Response (200):</p>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "data": [
    {
      "id": "tier-uuid",
      "code": "BASIC",
      "name": "Basic",
      "description": "Essential features for small pharmacies",
      "price": 0,
      "isActive": true,
      "isDefault": true,
      "displayOrder": 1,
      "maxUsers": 1,
      "maxBranches": 1,
      "maxProducts": 500,
      "durationDays": 365,
      "maxActivations": 1
    },
    {
      "id": "tier-uuid",
      "code": "STANDARD",
      "name": "Standard",
      "description": "For growing pharmacies",
      "price": 499,
      "isActive": true,
      "displayOrder": 2,
      "maxUsers": 3,
      "maxBranches": 1,
      "maxProducts": 5000,
      ...
    },
    ...
  ]
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
