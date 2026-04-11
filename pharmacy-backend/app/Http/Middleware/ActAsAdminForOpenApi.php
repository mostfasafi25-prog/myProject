<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * عند SKIP_API_AUTH=true: يعتبر الطلب قادماً من حساب مدير (أول admin في DB) دون Bearer token.
 * خطر أمني — عطّل المتغير في الإنتاج الحقيقي.
 */
class ActAsAdminForOpenApi
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('app.skip_api_auth')) {
            return $next($request);
        }

        $user = User::query()->where('role', User::ROLE_ADMIN)->first()
            ?? User::query()->orderBy('id')->first();

        if ($user) {
            Auth::login($user);
            $request->setUserResolver(static fn () => $user);
        }

        return $next($request);
    }
}
