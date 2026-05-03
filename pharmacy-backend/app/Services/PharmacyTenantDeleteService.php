<?php

namespace App\Services;

use App\Models\Pharmacy;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

/**
 * حذف صيدلية بالكامل: جميع المستخدمين (مع تنظيف المراجع) ثم حذف السجل؛
 * بقية الجداول المرتبطة بـ pharmacy_id تُحذف عبر قيود CASCADE في قاعدة البيانات.
 */
final class PharmacyTenantDeleteService
{
    public function __construct(private UserCascadeDeleteService $userCascade) {}

    /**
     * @throws RuntimeException|Throwable
     */
    public function deleteTenant(int $pharmacyId): string
    {
        $pharmacy = Pharmacy::query()->whereKey($pharmacyId)->first();
        if ($pharmacy === null) {
            throw new RuntimeException('الصيدلية غير موجودة.');
        }

        if (Pharmacy::query()->count() <= 1) {
            throw new RuntimeException('لا يمكن حذف آخر صيدلية في النظام.');
        }

        $name = (string) $pharmacy->name;

        DB::transaction(function () use ($pharmacy, $pharmacyId) {
            $users = User::withoutGlobalScopes()
                ->where('pharmacy_id', $pharmacyId)
                ->orderBy('id')
                ->get();

            foreach ($users as $user) {
                $this->userCascade->deleteWithRelatedCleanup($user);
            }

            $pharmacy->delete();
        });

        return $name;
    }
}
