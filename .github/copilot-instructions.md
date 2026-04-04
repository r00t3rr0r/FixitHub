# FixitHub Project Guidelines

FixitHub is a full-stack device repair platform. Monorepo with `client/` (React/TypeScript/Vite) and `server/` (Node.js/Express/MongoDB).

## Build & Run

```bash
# From root — runs both client and server concurrently
npm run start

# Individual
npm run client   # Vite dev server → http://localhost:5173
npm run server   # nodemon with port cleanup → http://localhost:3000

# Server utilities
npm --prefix server run seed          # Seed the database
npm --prefix server run reset-db      # Reset and reseed
```

Client lint: `cd client && npm run lint`

See [README.md](../README.md) for first-time setup (`.env` config, MongoDB startup, troubleshooting).

## Architecture

```
client/src/
  api/          # One file per feature domain; all import from api.ts (Axios base instance)
  pages/        # Role-grouped: public, customer portal, staff, admin (24+ admin pages)
  components/   # Shadcn/ui in ui/, feature components in named subfolders
  contexts/     # AuthContext only — holds user state + token refresh logic
  hooks/        # useMobile, useToast
server/
  routes/       # One file per feature; thin — delegate to services/
  services/     # Business logic, one file per feature domain
  models/       # 44 Mongoose models
  middleware/   # auth.js — JWT Bearer verification, sets req.user
  config/       # database.js — MongoDB connection
```

## Key Conventions

### Server
- **Routes are thin**: Move logic to `services/`. Route files only parse input, call service, return response.
- **Auth middleware**: `requireUser` from `routes/middleware/auth.js` — import via destructuring. Verifies JWT, sets `req.user`.
- **Role hierarchy**: customer < staff < admin. Check `req.user.role` in routes/services.
- **Input normalization**: Trim and lowercase emails before use. Strip untrusted input at the route layer.
- **Debug info in responses**: Only include debug details when `process.env.NODE_ENV === 'development'`.
- **Email**: Via `services/emailService.js` (nodemailer + SMTP config). See [SMTP_EMAIL_INTEGRATION.md](../SMTP_EMAIL_INTEGRATION.md).
- **Shipping**: DHL integration in `services/dhlService.js`. See [server/DHL_API_INTEGRATION_DOCUMENTATION.md](../server/DHL_API_INTEGRATION_DOCUMENTATION.md).
- **Customer groups**: Rule-based system in `services/customerGroupService.js`. See [CUSTOMER_GROUP_MANAGEMENT_CONCEPT.md](../CUSTOMER_GROUP_MANAGEMENT_CONCEPT.md).

### Client
- **API modules**: Each feature in `src/api/<feature>.ts`. All share the Axios instance from `api.ts`.
- **Axios instance quirk**: `validateStatus: () => true` — all HTTP status codes resolve (no auto-throw). Check `response.status` manually in API functions.
- **Large numbers**: Axios instance uses `JSONbig.parse` for `transformResponse`. Don't bypass this when adding new transforms.
- **Auth tokens**: Access + refresh tokens in `localStorage`, managed by `AuthContext`. A 401 response triggers silent refresh via the response interceptor in `api.ts`.
- **Routing tiers**: `BrowserRouter > AuthProvider > ThemeProvider`. Layout wrapping: none (public), `CustomerLayout`, `Layout` (admin/staff). Use `ProtectedRoute` for role-restricted pages.
- **Forms**: `react-hook-form` + `zod` for validation. Follow existing form patterns in corresponding admin pages.
- **UI components**: Use `components/ui/` (shadcn/ui) — don't introduce new component libraries.
- **Styling**: Tailwind CSS. No inline styles. Dark mode handled by `ThemeProvider`.
- **i18n**: `i18next`. Add new user-facing strings to locale files in `public/locales/`.

## Environment Variables

Required: `PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `SESSION_SECRET`, `CLIENT_URL`, `SERVER_URL`

Optional: `SMTP_*` (email), `STRIPE_SECRET_KEY` (payments), `TWILIO_*` (SMS), `MAX_FILE_SIZE`, `UPLOAD_PATH`

See [README.md](../README.md) for full setup. Run `node server/scripts/setup-env.js` to auto-generate secrets.

## Domain Docs

| Topic | Doc |
|---|---|
| Email admin | [EMAIL_ADMINISTRATION_GUIDE.md](../EMAIL_ADMINISTRATION_GUIDE.md) |
| SMTP setup | [SMTP_EMAIL_INTEGRATION.md](../SMTP_EMAIL_INTEGRATION.md) |
| Customer groups | [CUSTOMER_GROUP_MANAGEMENT_CONCEPT.md](../CUSTOMER_GROUP_MANAGEMENT_CONCEPT.md) |
| DHL shipping | [server/DHL_API_INTEGRATION_DOCUMENTATION.md](../server/DHL_API_INTEGRATION_DOCUMENTATION.md) |
| DB scripts | [server/scripts/README.md](../server/scripts/README.md) |
| Homepage blocks | [client/src/pages/admin/HOMEPAGE_BLOCK_TYPES.md](../client/src/pages/admin/HOMEPAGE_BLOCK_TYPES.md) |
| SMS/push notifications | [SMS_PUSH_NOTIFICATION_SUMMARY.md](../SMS_PUSH_NOTIFICATION_SUMMARY.md) |
