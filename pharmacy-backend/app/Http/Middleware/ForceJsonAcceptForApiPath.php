<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * يطبّق قبل مطابقة المسارات: أي طلب لـ api/* يُعامل كـ JSON (expectsJson)
 * حتى أخطاء 404 وصيانة وغيرها لا تُرجع redirect/HTML.
 */
class ForceJsonAcceptForApiPath
{
    private function isApiPath(Request $request): bool
    {
        $p = $request->path();

        return $p === 'api' || str_starts_with($p, 'api/');
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->isApiPath($request)) {
            return $next($request);
        }

        $accept = (string) $request->header('Accept', '');
        if (! str_contains($accept, 'application/json')) {
            $request->headers->set('Accept', 'application/json, text/plain, */*');
        }
        if (! $request->header('X-Requested-With')) {
            $request->headers->set('X-Requested-With', 'XMLHttpRequest');
        }

        return $next($request);
    }
}
