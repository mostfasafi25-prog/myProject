<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to the "home" route for your application.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     *
     * @return void
     */
    public function boot()
    {
        $this->configureRateLimiting();

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }

    /**
     * Configure the rate limiters for the application.
     *
     * @return void
     */
    protected function configureRateLimiting()
    {
        RateLimiter::for('api', function (Request $request) {
            $authPerMinute = (int) env('API_RATE_LIMIT_AUTH_PER_MINUTE', 240);
            $guestPerMinute = (int) env('API_RATE_LIMIT_GUEST_PER_MINUTE', 120);

            if ($request->user()?->id) {
                return Limit::perMinute(max(60, $authPerMinute))
                    ->by('user:' . $request->user()->id);
            }

            return Limit::perMinute(max(30, $guestPerMinute))
                ->by('ip:' . $request->ip());
        });
    }
}
