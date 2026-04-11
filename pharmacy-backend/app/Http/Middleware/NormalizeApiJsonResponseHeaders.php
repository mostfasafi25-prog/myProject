<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * على بعض البيئات (مثل php artisan serve خلف بروكسي) قد يُعلَن Content-Type كـ text/html
 * رغم أن الجسم JSON — يكسر اعتماد العميل على الهيدر ويُربك أدوات التطوير.
 */
class NormalizeApiJsonResponseHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $path = $request->path();
        if ($path !== 'api' && ! str_starts_with($path, 'api/')) {
            return $response;
        }

        $content = $response->getContent();
        if (! is_string($content) || $content === '') {
            return $response;
        }

        $first = $content[0];
        if ($first !== '{' && $first !== '[') {
            return $response;
        }

        $ct = strtolower((string) $response->headers->get('Content-Type', ''));
        if ($ct === '' || ! str_contains($ct, 'application/json')) {
            $response->headers->remove('Content-Type');
            $response->headers->set('Content-Type', 'application/json; charset=UTF-8');
        }

        return $response;
    }
}
