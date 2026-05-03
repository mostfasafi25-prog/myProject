<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureBackendWebAuth
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->session()->get('backend_web_ok') === true) {
            return $next($request);
        }

        return redirect()
            ->route('backend.login')
            ->with('error', 'سجّل الدخول للوصول إلى لوحة الإدارة.');
    }
}
