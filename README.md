# Pharmacy System Scaffold

This folder is a separate copy for the pharmacy project and does not modify the restaurant project.

## Structure

- `pharmacy-frontend`: React + Vite frontend starter (no business pages).
- `pharmacy-backend`: Laravel backend starter for pharmacy APIs.

## Frontend (pharmacy-frontend)

- Main app is reset to a clean placeholder in `src/App.jsx`.
- Ready for your new UI design.

Run:

```bash
cd "c:\Users\mostf\Desktop\برمجه\ECommerce\مطعم بلال\مجلد جديد\pharmacy-system\pharmacy-frontend"
npm install
npm run dev
```

## Backend (pharmacy-backend)

- API routes are reset to a minimal starter in `routes/api.php`.
- Health endpoint is available at: `GET /api/health`.

Run:

```bash
cd "c:\Users\mostf\Desktop\برمجه\ECommerce\مطعم بلال\مجلد جديد\pharmacy-system\pharmacy-backend"
composer install
php artisan key:generate
php artisan migrate
php artisan serve
```

## Notes

- Original restaurant folders are untouched:
  - `ftont end`
  - `myproject`
- Send the new pharmacy design, and I will build the pages on this scaffold.
