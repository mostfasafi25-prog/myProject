#!/bin/sh
set -e
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "On Render: open your Web Service → Environment → add DATABASE_URL from Postgres (Internal Database URL), or Link database."
  exit 1
fi
php artisan migrate --force
php artisan db:seed --class=AdminCashierSeeder --force
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
