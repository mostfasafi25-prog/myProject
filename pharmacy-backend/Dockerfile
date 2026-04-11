# Laravel API على Render — PHP-FPM + nginx (أفضل من php artisan serve للإنتاج)
FROM php:8.2-fpm-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    unzip \
    nginx \
    supervisor \
    gettext-base \
    libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql \
    && rm -f /etc/nginx/sites-enabled/default \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .
RUN chmod +x docker-entrypoint.sh \
    && mv docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN cp docker/supervisord-main.conf /etc/supervisor/supervisord.conf \
    && cp docker/supervisor-laravel.conf /etc/supervisor/conf.d/laravel.conf

ENV COMPOSER_ALLOW_SUPERUSER=1
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts \
    && composer dump-autoload --optimize --no-dev

RUN chmod -R 775 storage bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

ENV PORT=8000
EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
