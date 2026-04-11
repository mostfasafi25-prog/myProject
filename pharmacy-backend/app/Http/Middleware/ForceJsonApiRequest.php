<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * يضمن أن Laravel يعامل طلبات مجموعة api كـ JSON (expectsJson / wantsJson)
 * حتى لا تُرجع استثناءات أو تحقق كصفحة HTML (مشكلة ظهرت من Vercel مع POST /api/login).
 */
class ForceJsonApiRequest
{
    public function handle(Request $request, Closure $next): Response
    {
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
