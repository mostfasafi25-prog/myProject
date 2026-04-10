<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * 1) OPTIONS (preflight) لـ api/* → 204 وهيدرز CORS فوراً.
 * 2) أي استجابة api/* بلا Access-Control-Allow-Origin → يُضاف * (احتياط إن تعطّل HandleCors).
 */
class PreflightCors
{
    private function isApiPath(Request $request): bool
    {
        $path = $request->path();

        return $path === 'api' || str_starts_with($path, 'api/');
    }

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethod('OPTIONS') && $this->isApiPath($request)) {
            return response('', 204)
                ->header('Access-Control-Allow-Origin', '*')
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, X-CSRF-TOKEN')
                ->header('Access-Control-Max-Age', '86400');
        }

        /** @var Response $response */
        $response = $next($request);

        if ($this->isApiPath($request) && ! $response->headers->get('Access-Control-Allow-Origin')) {
            $response->headers->set('Access-Control-Allow-Origin', '*');
        }

        return $response;
    }
}
