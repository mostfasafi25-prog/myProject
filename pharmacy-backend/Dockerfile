# Laravel API على Render (Docker + PHP 8.2 + PostgreSQL)
FROM php:8.2-cli-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    unzip \
    libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .
RUN chmod +x docker-entrypoint.sh \
    && mv docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

ENV COMPOSER_ALLOW_SUPERUSER=1
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts \
    && composer dump-autoload --optimize --no-dev

RUN chmod -R 775 storage bootstrap/cache

ENV PORT=8000
EXPOSE 8000

# يتطلب DATABASE_URL على Render (ربط Postgres من Environment).
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
