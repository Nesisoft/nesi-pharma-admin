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

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/refresh-token` - Refresh access token
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/change-password` - Change password

### License Management (Admin)
- `GET /api/licenses` - List licenses with filters
- `GET /api/licenses/:id` - Get license details
- `POST /api/licenses/generate` - Generate single license
- `POST /api/licenses/generate-bulk` - Generate multiple licenses
- `PUT /api/licenses/:id` - Update license
- `POST /api/licenses/:id/revoke` - Revoke license
- `GET /api/licenses/stats` - License statistics

### Public License API (For Pharmacy App)
- `POST /api/public/license/verify` - Verify a license key
- `POST /api/public/license/activate` - Activate a license
- `POST /api/public/license/deactivate` - Deactivate a license
- `GET /api/public/license/tiers` - Get tier information

### Pharmacies
- `GET /api/pharmacies` - List pharmacies
- `GET /api/pharmacies/:id` - Get pharmacy details
- `POST /api/pharmacies` - Create pharmacy
- `PUT /api/pharmacies/:id` - Update pharmacy
- `POST /api/pharmacies/:id/suspend` - Suspend pharmacy
- `POST /api/pharmacies/:id/activate` - Activate pharmacy

### Admin Users
- `GET /api/admin-users` - List admin users
- `POST /api/admin-users` - Create admin user
- `PUT /api/admin-users/:id` - Update admin user
- `DELETE /api/admin-users/:id` - Delete admin user

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/recent-activity` - Recent activity
- `GET /api/dashboard/license-trends` - License generation trends

### Audit Logs
- `GET /api/audit-logs` - List audit logs with filters

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
