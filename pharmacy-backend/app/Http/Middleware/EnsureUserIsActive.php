<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    /**
     * يمنع استخدام الـ API إذا عطّل المدير الحساب (مع بقاء التوكن سابقاً).
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        if (!($user->is_active ?? true)) {
            return response()->json([
                'error' => 'أنت غير مفعّل. تواصل مع مدير النظام لتفعيل حسابك.',
            ], 403);
        }

        return $next($request);
    }
}
