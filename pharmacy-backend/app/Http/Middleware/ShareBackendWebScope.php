<?php

namespace App\Http\Middleware;

use App\Models\Pharmacy;
use App\Support\BackendWebScope;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use Symfony\Component\HttpFoundation\Response;

class ShareBackendWebScope
{
    public function handle(Request $request, Closure $next): Response
    {
        $sid = BackendWebScope::id();
        if ($sid !== null && $sid > 0 && !Pharmacy::query()->whereKey($sid)->exists()) {
            BackendWebScope::clear();
        }

        View::share([
            'backendScopeId' => BackendWebScope::id(),
            'backendScopePharmacy' => BackendWebScope::pharmacy(),
            'backendScoped' => BackendWebScope::active(),
        ]);

        return $next($request);
    }
}
