<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckRole
{
    public function handle(Request $request, Closure $next, ...$roles)
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'message' => 'غير مصرح بالدخول'
            ], 401);
        }
        
        if (!in_array($user->role, $roles)) {
            return response()->json([
                'message' => 'لا تملك الصلاحية للوصول إلى هذه الصفحة'
            ], 403);
        }
        
        return $next($request);
    }
}