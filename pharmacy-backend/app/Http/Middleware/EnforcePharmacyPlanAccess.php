<?php

namespace App\Http\Middleware;

use App\Models\Pharmacy;
use App\Services\PharmacyPlanService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * باقة مجانية: بدون كاشير، وبعد انتهاء التجربة (١٤ يوماً) يُمنع أي تعديل عبر API حتى الاشتراك.
 */
class EnforcePharmacyPlanAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        if (config('app.skip_api_auth')) {
            return $next($request);
        }

        $user = $request->user();
        if (!$user || $user->pharmacy_id === null || $user->role === 'super_admin') {
            return $next($request);
        }

        $pharmacy = Pharmacy::find($user->pharmacy_id);
        if (!$pharmacy) {
            return $next($request);
        }

        /** @var PharmacyPlanService $plans */
        $plans = app(PharmacyPlanService::class);
        $plans->syncMonthlySubscriptionLifecycle($pharmacy);
        $pharmacy->refresh();

        $path = strtolower($request->path());
        $method = $request->method();

        if ($plans->effectivePlanKey($pharmacy) === PharmacyPlanService::EFFECTIVE_TRIAL_EXPIRED) {
            if ($this->writeBlockExemptRoute($method, $path)) {
                return $next($request);
            }
            if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'انتهت فترة التجربة المجانية (١٤ يوماً). لا يمكن تنفيذ أي تعديل حتى يتم الاشتراك في باقة مدفوعة. تواصل مع مدير النظام أو حدّث الباقة من لوحة الويب.',
                    'code' => 'trial_expired',
                ], 403);
            }

            return $next($request);
        }

        if ($plans->monthlyStoredButInactive($pharmacy)) {
            if ($this->writeBlockExemptRoute($method, $path)) {
                return $next($request);
            }
            if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'اشتراكك الشهري غير فعّال (ملغى أو انتهت مهلة السداد). لا يمكن إضافة أو تعديل أو حذف بيانات في النظام حتى يُجدَّد الاشتراك من لوحة التحكم وتأكيد استلام الدفعة. يمكنك الاطلاع على الباقات من صفحة الاشتراكات.',
                    'code' => 'monthly_subscription_inactive',
                ], 403);
            }

            return $next($request);
        }

        $limits = $plans->limits($pharmacy);
        $maxCashiers = $limits['cashiers'];
        if ($maxCashiers === 0 && $user->role === 'cashier') {
            if ($this->freeTierCashierAllows($method, $path)) {
                return $next($request);
            }

            return response()->json([
                'success' => false,
                'message' => 'هذا الحساب بدور كاشير غير مفعّل في باقتك (لا مقاعد كاشير منفصلة). سجّل دخولاً كأدمن لاستخدام النظام وشاشة البيع، أو ترقّ الباقة لإضافة كاشيرين.',
                'code' => 'free_plan_no_cashier',
            ], 403);
        }

        return $next($request);
    }

    private function writeBlockExemptRoute(string $method, string $path): bool
    {
        if ($method !== 'POST') {
            return false;
        }

        return $path === 'api/logout' || $path === 'api/change-password';
    }

    private function freeTierCashierAllows(string $method, string $path): bool
    {
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return true;
        }
        if ($method === 'POST' && $path === 'api/logout') {
            return true;
        }

        return false;
    }
}
