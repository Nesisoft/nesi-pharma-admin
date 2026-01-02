# NesiPharma Admin Dashboard

A comprehensive admin dashboard for managing the NesiPharma Pharmacy Management System. This platform handles license key generation, verification, and activation for pharmacies using the NesiPharma PMS.

## Features

- **License Management**
  - Generate license keys for Standard, Professional, and Enterprise tiers
  - Bulk license generation (up to 100 at once)
  - License verification and activation endpoints
  - Track license usage and activations
  - Revoke or suspend licenses

- **Pharmacy Management**
  - Register and manage pharmacies
  - View pharmacy details and assigned licenses
  - Suspend or activate pharmacy accounts

- **Admin User Management**
  - Role-based access control (Super Admin, Admin, Support, Viewer)
  - User creation and management

- **Dashboard & Analytics**
  - Real-time statistics
  - License generation trends
  - Activation metrics

- **Audit Logging**
  - Track all system activities
  - Filter by action type, entity, and date

## Tech Stack

### Backend
- Node.js with Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT Authentication

### Frontend
- React 18 with TypeScript
- Vite
- Tailwind CSS
- React Query (TanStack Query)
- React Router v6
- Recharts

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Nesisoft/nesi-pharma-admin.git
cd nesi-pharma-admin
```

2. Install dependencies:
```bash
npm run install:all
```

3. Set up environment variables:
```bash
# Server environment
cp server/.env.example server/.env
# Edit server/.env with your database credentials and secrets
```

4. Set up the database:
```bash
npm run db:push
npm run db:seed
```

5. Start development servers:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000` and the API on `http://localhost:5000`.

### Default Admin Credentials

After seeding the database, you can log in with:
- **Email:** admin@nesipharma.com
- **Password:** Admin@123456

**Important:** Change the default password after first login!

## API Documentation

All API responses follow a standard format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

---

### Authentication

#### Login
```
POST /api/auth/login
```

**Request:**
```json
{
  "email": "admin@nesipharma.com",
  "password": "Admin@123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@nesipharma.com",
      "firstName": "System",
      "lastName": "Administrator",
      "role": "SUPER_ADMIN"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Refresh Token
```
POST /api/auth/refresh-token
```

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Get Profile
```
GET /api/auth/profile
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "admin@nesipharma.com",
    "firstName": "System",
    "lastName": "Administrator",
    "role": "SUPER_ADMIN",
    "isActive": true,
    "lastLogin": "2025-01-02T10:30:00.000Z"
  }
}
```

---

### License Management (Admin - Requires Authentication)

#### List Licenses
```
GET /api/licenses?page=1&limit=10&tier=STANDARD&status=ACTIVE&search=pharmacy
Authorization: Bearer <accessToken>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10) |
| tier | string | Filter by tier: STANDARD, PROFESSIONAL, ENTERPRISE |
| status | string | Filter by status: ACTIVE, INACTIVE, EXPIRED, REVOKED, SUSPENDED |
| search | string | Search in license key, pharmacy name, or email |
| pharmacyId | string | Filter by pharmacy ID |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "licenseKey": "SXXX-XXXX-XXXX-XXXX-XXXX",
      "tier": "STANDARD",
      "status": "ACTIVE",
      "durationDays": 365,
      "maxActivations": 3,
      "currentActivations": 1,
      "validFrom": "2025-01-01T00:00:00.000Z",
      "expiresAt": "2026-01-01T00:00:00.000Z",
      "pharmacy": {
        "id": "uuid",
        "name": "HealthFirst Pharmacy",
        "email": "info@healthfirst.com"
      },
      "generatedBy": {
        "id": "uuid",
        "firstName": "System",
        "lastName": "Administrator"
      },
      "_count": {
        "activations": 1
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

#### Get License Details
```
GET /api/licenses/:id
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "licenseKey": "SXXX-XXXX-XXXX-XXXX-XXXX",
    "tier": "STANDARD",
    "status": "ACTIVE",
    "durationDays": 365,
    "maxActivations": 3,
    "currentActivations": 1,
    "features": {
      "maxUsers": 3,
      "maxProducts": 500,
      "salesTracking": true,
      "inventoryManagement": true,
      "advancedAnalytics": true
    },
    "validFrom": "2025-01-01T00:00:00.000Z",
    "expiresAt": "2026-01-01T00:00:00.000Z",
    "notes": "License for HealthFirst Pharmacy",
    "pharmacy": {
      "id": "uuid",
      "name": "HealthFirst Pharmacy",
      "email": "info@healthfirst.com",
      "phone": "0201234567",
      "status": "ACTIVE"
    },
    "activations": [
      {
        "id": "uuid",
        "deviceId": "device-123",
        "deviceName": "POS Terminal 1",
        "isActive": true,
        "activatedAt": "2025-01-01T10:00:00.000Z"
      }
    ],
    "verifications": [
      {
        "id": "uuid",
        "isValid": true,
        "message": "License valid",
        "verifiedAt": "2025-01-02T08:00:00.000Z"
      }
    ]
  }
}
```

#### Generate License
```
POST /api/licenses/generate
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "tier": "STANDARD",
  "pharmacyId": "uuid (optional)",
  "durationDays": 365,
  "maxActivations": 3,
  "notes": "License for HealthFirst Pharmacy"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "License generated successfully",
  "data": {
    "id": "uuid",
    "licenseKey": "SXXX-XXXX-XXXX-XXXX-XXXX",
    "tier": "STANDARD",
    "status": "INACTIVE",
    "durationDays": 365,
    "maxActivations": 3,
    "pharmacy": null
  }
}
```

#### Generate Bulk Licenses
```
POST /api/licenses/generate-bulk
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "tier": "PROFESSIONAL",
  "count": 10,
  "durationDays": 365,
  "maxActivations": 9,
  "notes": "Bulk generation for distribution"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Generated 10 licenses",
  "data": {
    "count": 10,
    "licenses": [
      { "id": "uuid1", "licenseKey": "PXXX-XXXX-XXXX-XXXX-XXX1", "tier": "PROFESSIONAL" },
      { "id": "uuid2", "licenseKey": "PXXX-XXXX-XXXX-XXXX-XXX2", "tier": "PROFESSIONAL" }
    ]
  }
}
```

#### Update License
```
PUT /api/licenses/:id
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "status": "SUSPENDED",
  "pharmacyId": "uuid",
  "maxActivations": 5,
  "notes": "Updated notes"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "License updated successfully",
  "data": {
    "id": "uuid",
    "licenseKey": "SXXX-XXXX-XXXX-XXXX-XXXX",
    "status": "SUSPENDED",
    "maxActivations": 5
  }
}
```

#### Revoke License
```
POST /api/licenses/:id/revoke
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "reason": "Violation of terms of service"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "License revoked successfully",
  "data": {
    "id": "uuid",
    "status": "REVOKED"
  }
}
```

---

### Public License API (For NesiPharma App - No Authentication Required)

#### Verify License
```
POST /api/public/license/verify
```

**Request:**
```json
{
  "licenseKey": "SXXX-XXXX-XXXX-XXXX-XXXX",
  "deviceId": "unique-device-identifier"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "License is valid",
  "data": {
    "valid": true,
    "license": {
      "tier": "STANDARD",
      "status": "ACTIVE",
      "features": {
        "maxUsers": 3,
        "maxProducts": 500,
        "salesTracking": true,
        "inventoryManagement": true,
        "advancedAnalytics": true,
        "multiLocation": false
      },
      "validFrom": "2025-01-01T00:00:00.000Z",
      "validUntil": "2026-01-01T00:00:00.000Z",
      "expiresAt": "2026-01-01T00:00:00.000Z"
    },
    "pharmacy": {
      "id": "uuid",
      "name": "HealthFirst Pharmacy"
    }
  }
}
```

**Error Responses:**

License not found (404):
```json
{
  "success": false,
  "message": "License key not found"
}
```

License expired (403):
```json
{
  "success": false,
  "message": "License has expired"
}
```

License revoked (403):
```json
{
  "success": false,
  "message": "License has been revoked"
}
```

Pharmacy not active (403):
```json
{
  "success": false,
  "message": "Pharmacy account is not active"
}
```

#### Activate License
```
POST /api/public/license/activate
```

**Request:**
```json
{
  "licenseKey": "SXXX-XXXX-XXXX-XXXX-XXXX",
  "deviceId": "unique-device-identifier",
  "deviceName": "POS Terminal 1",
  "deviceFingerprint": "browser-fingerprint-hash",
  "pharmacy": {
    "name": "HealthFirst Pharmacy",
    "email": "info@healthfirst.com",
    "phone": "0201234567",
    "address": "123 Main Street",
    "city": "Accra",
    "region": "Greater Accra",
    "country": "Ghana",
    "registrationNumber": "PH12345"
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "License activated successfully",
  "data": {
    "activated": true,
    "license": {
      "tier": "STANDARD",
      "features": {
        "maxUsers": 3,
        "maxProducts": 500,
        "salesTracking": true,
        "inventoryManagement": true
      },
      "validFrom": "2025-01-02T10:00:00.000Z",
      "expiresAt": "2026-01-02T10:00:00.000Z"
    },
    "activation": {
      "id": "uuid",
      "deviceName": "POS Terminal 1",
      "activatedAt": "2025-01-02T10:00:00.000Z"
    }
  }
}
```

**Already Activated Response (200):**
```json
{
  "success": true,
  "message": "Device already activated",
  "data": {
    "activated": true,
    "alreadyActivated": true,
    "license": {
      "tier": "STANDARD",
      "features": { ... },
      "expiresAt": "2026-01-02T10:00:00.000Z"
    },
    "activation": {
      "id": "uuid",
      "deviceName": "POS Terminal 1",
      "activatedAt": "2025-01-01T10:00:00.000Z"
    }
  }
}
```

**Error Responses:**

Max activations reached (403):
```json
{
  "success": false,
  "message": "Maximum activations reached for this license"
}
```

Pharmacy suspended (403):
```json
{
  "success": false,
  "message": "Pharmacy account is suspended. Contact support to reactivate."
}
```

#### Deactivate License
```
POST /api/public/license/deactivate
```

**Request:**
```json
{
  "licenseKey": "SXXX-XXXX-XXXX-XXXX-XXXX",
  "deviceId": "unique-device-identifier"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "License deactivated successfully"
}
```

#### Get Tier Information
```
GET /api/public/license/tiers
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tier": "BASIC",
      "name": "Basic",
      "description": "Free tier with essential features for small pharmacies",
      "price": 0,
      "currency": "GHS",
      "durationDays": 0,
      "maxUsers": 1,
      "maxProducts": 100,
      "maxBranches": 1,
      "maxActivations": 1,
      "features": {
        "salesTracking": true,
        "inventoryManagement": true,
        "basicReports": true,
        "advancedAnalytics": false,
        "multiLocation": false
      }
    },
    {
      "id": "uuid",
      "tier": "STANDARD",
      "name": "Standard",
      "description": "Enhanced features for growing pharmacies - 1 branch, up to 3 users",
      "price": 500,
      "currency": "GHS",
      "durationDays": 365,
      "maxUsers": 3,
      "maxProducts": 500,
      "maxBranches": 1,
      "maxActivations": 3,
      "features": { ... }
    },
    {
      "id": "uuid",
      "tier": "PROFESSIONAL",
      "name": "Professional",
      "description": "Advanced features for established pharmacies - 3 branches, up to 10 users",
      "price": 1200,
      "currency": "GHS",
      "durationDays": 365,
      "maxUsers": 10,
      "maxProducts": 2000,
      "maxBranches": 3,
      "maxActivations": 9,
      "features": { ... }
    },
    {
      "id": "uuid",
      "tier": "ENTERPRISE",
      "name": "Enterprise",
      "description": "Full-featured solution for pharmacy chains - unlimited branches and users",
      "price": 3000,
      "currency": "GHS",
      "durationDays": 365,
      "maxUsers": null,
      "maxProducts": null,
      "maxBranches": null,
      "maxActivations": null,
      "features": { ... }
    }
  ]
}
```

---

### Pharmacy Management (Admin)

#### List Pharmacies
```
GET /api/pharmacies?page=1&limit=10&status=ACTIVE&search=health
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "HealthFirst Pharmacy",
      "email": "info@healthfirst.com",
      "phone": "0201234567",
      "address": "123 Main Street",
      "city": "Accra",
      "region": "Greater Accra",
      "country": "Ghana",
      "registrationNumber": "PH12345",
      "status": "ACTIVE",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "licenses": [
        {
          "id": "uuid",
          "tier": "STANDARD",
          "status": "ACTIVE",
          "expiresAt": "2026-01-01T00:00:00.000Z"
        }
      ],
      "_count": {
        "licenses": 1,
        "activations": 2
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

#### Create Pharmacy
```
POST /api/pharmacies
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "name": "HealthFirst Pharmacy",
  "email": "info@healthfirst.com",
  "phone": "0201234567",
  "address": "123 Main Street",
  "city": "Accra",
  "region": "Greater Accra",
  "country": "Ghana",
  "registrationNumber": "PH12345",
  "status": "ACTIVE"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Pharmacy created successfully",
  "data": {
    "id": "uuid",
    "name": "HealthFirst Pharmacy",
    "email": "info@healthfirst.com",
    "status": "ACTIVE",
    "createdAt": "2025-01-02T10:00:00.000Z"
  }
}
```

#### Update Pharmacy
```
PUT /api/pharmacies/:id
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "name": "HealthFirst Pharmacy Ltd",
  "phone": "0209876543",
  "status": "ACTIVE"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Pharmacy updated successfully",
  "data": {
    "id": "uuid",
    "name": "HealthFirst Pharmacy Ltd",
    "phone": "0209876543",
    "status": "ACTIVE"
  }
}
```

#### Suspend Pharmacy
```
POST /api/pharmacies/:id/suspend
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "reason": "Payment overdue"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Pharmacy suspended successfully",
  "data": {
    "id": "uuid",
    "status": "SUSPENDED"
  }
}
```

**Effect:** All licenses assigned to this pharmacy will stop working until reactivated.

#### Activate Pharmacy
```
POST /api/pharmacies/:id/activate
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Pharmacy activated successfully",
  "data": {
    "id": "uuid",
    "status": "ACTIVE"
  }
}
```

#### Delete Pharmacy
```
DELETE /api/pharmacies/:id
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Pharmacy deleted successfully"
}
```

**Note:** Pharmacies with assigned licenses cannot be deleted. Remove or reassign licenses first.

---

### Tier Configuration (Admin)

#### List Tier Configurations
```
GET /api/tier-configs
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tier": "STANDARD",
      "name": "Standard",
      "description": "Enhanced features for growing pharmacies - 1 branch, up to 3 users",
      "price": 500,
      "currency": "GHS",
      "durationDays": 365,
      "maxUsers": 3,
      "maxProducts": 500,
      "maxBranches": 1,
      "maxActivations": 3,
      "features": { ... },
      "isActive": true
    }
  ]
}
```

#### Update Tier Configuration
```
PUT /api/tier-configs/:tier
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "price": 600,
  "description": "Updated description",
  "maxUsers": 5,
  "maxBranches": 2,
  "maxActivations": 5
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Tier configuration updated successfully",
  "data": {
    "tier": "STANDARD",
    "price": 600,
    "maxUsers": 5,
    "maxBranches": 2,
    "maxActivations": 5
  }
}
```

---

### Dashboard (Admin)

#### Get Dashboard Statistics
```
GET /api/dashboard/stats
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "licenses": {
      "total": 150,
      "active": 120,
      "inactive": 20,
      "expired": 8,
      "revoked": 2
    },
    "pharmacies": {
      "total": 80,
      "active": 75,
      "pending": 3,
      "suspended": 2
    },
    "activations": {
      "total": 200,
      "last30Days": 45
    },
    "revenue": {
      "total": 125000,
      "byTier": {
        "STANDARD": 50000,
        "PROFESSIONAL": 60000,
        "ENTERPRISE": 15000
      }
    }
  }
}
```

---

### Audit Logs (Admin)

#### List Audit Logs
```
GET /api/audit-logs?page=1&limit=20&action=CREATE&entityType=License
Authorization: Bearer <accessToken>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| action | string | CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE, REVOKE, LOGIN, VERIFY, GENERATE |
| entityType | string | License, Pharmacy, AdminUser, LicenseTierConfig |
| adminUserId | string | Filter by admin user |
| startDate | string | ISO date string |
| endDate | string | ISO date string |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "action": "GENERATE",
      "entityType": "License",
      "entityId": "license-uuid",
      "description": "Generated STANDARD license: SXXX-****-****-****-XXX1",
      "adminUser": {
        "id": "uuid",
        "firstName": "System",
        "lastName": "Administrator"
      },
      "previousValue": null,
      "newValue": {
        "tier": "STANDARD",
        "licenseKey": "SXXX-****-****-****-XXX1"
      },
      "ipAddress": "192.168.1.1",
      "createdAt": "2025-01-02T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "totalPages": 25
  }
}
```

---

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Action not allowed |
| 404 | Not Found |
| 500 | Internal Server Error |

## License Key Format

License keys follow the format: `XXXX-XXXX-XXXX-XXXX-XXXX`

- First character indicates tier:
  - `S` - Standard
  - `P` - Professional
  - `E` - Enterprise
- Last group is a checksum for validation

## License Tiers

| Feature | Basic | Standard | Professional | Enterprise |
|---------|-------|----------|--------------|------------|
| Price | Free | GHS 500/yr | GHS 1,200/yr | GHS 3,000/yr |
| Max Users | 1 | 3 | 10 | Unlimited |
| Max Products | 100 | 500 | 2,000 | Unlimited |
| Analytics | Basic | Advanced | Advanced | Advanced |
| Multi-location | No | No | Yes (3) | Unlimited |
| API Access | No | No | Yes | Yes |
| Priority Support | No | No | Yes | Yes |

## Integration with NesiPharma PMS

To integrate license verification in your pharmacy app:

```javascript
// Verify license
const response = await fetch('https://your-admin-api.com/api/public/license/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    licenseKey: 'SXXX-XXXX-XXXX-XXXX-XXXX',
    deviceId: 'unique-device-identifier'
  })
});

const { data } = await response.json();
if (data.valid) {
  // License is valid, enable features based on data.license.tier
}

// Activate license
const activateResponse = await fetch('https://your-admin-api.com/api/public/license/activate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    licenseKey: 'SXXX-XXXX-XXXX-XXXX-XXXX',
    deviceId: 'unique-device-identifier',
    deviceName: 'Pharmacy POS Terminal 1',
    pharmacy: {
      name: 'My Pharmacy',
      email: 'pharmacy@example.com',
      phone: '0201234567'
    }
  })
});
```

## Development

### Available Scripts

```bash
# Install all dependencies
npm run install:all

# Start development (both frontend and backend)
npm run dev

# Start backend only
npm run dev:server

# Start frontend only
npm run dev:client

# Build for production
npm run build

# Database commands
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run migrations
npm run db:push      # Push schema to database
npm run db:seed      # Seed initial data
```

## Deployment

1. Build the application:
```bash
npm run build
```

2. Set production environment variables

3. Run database migrations:
```bash
npm run db:push
npm run db:seed
```

4. Start the server:
```bash
npm start
```

## License

This project is proprietary software owned by Nesisoft.

## Support

For support, contact support@nesipharma.com or visit https://nesipharma.com
