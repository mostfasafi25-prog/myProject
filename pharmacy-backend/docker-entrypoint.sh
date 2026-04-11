#!/bin/sh
set -e
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "On Render: open your Web Service → Environment → add DATABASE_URL from Postgres (Internal Database URL), or Link database."
  exit 1
fi
php artisan migrate --force
php artisan db:seed --class=AdminCashierSeeder --force

PORT="${PORT:-8000}"
export PORT
envsubst '$PORT' < /var/www/html/docker/nginx/default.conf.template > /etc/nginx/sites-enabled/laravel.conf

if [ "$#" -eq 0 ]; then
  set -- /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
fi
exec "$@"
