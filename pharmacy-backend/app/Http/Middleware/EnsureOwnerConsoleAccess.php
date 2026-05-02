<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOwnerConsoleAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user || $user->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'هذه اللوحة مخصصة لحساب سوبر أدمن فقط.',
            ], 403);
        }

        $secret = (string) config('pharmacy.owner_console_secret', '');
        if ($secret !== '') {
            $given = (string) $request->header('X-Owner-Console-Secret', '');
            if (!hash_equals($secret, $given)) {
                return response()->json([
                    'success' => false,
                    'message' => 'مفتاح لوحة المالك غير صحيح أو مفقود.',
                    'code' => 'owner_console_secret_required',
                ], 403);
            }
        }

        return $next($request);
    }
}
