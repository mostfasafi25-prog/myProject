<?php

namespace App\Services;

use App\Models\Pharmacy;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Throwable;

final class AdminWelcomeNotificationService
{
    /**
     * إشعار ترحيبي لمستخدم دوره admin مرتبط بصيدلية (إنشاء من لوحة الويب أو API).
     */
    public static function dispatchForUser(User $user): void
    {
        if (!Schema::hasTable('system_notifications')) {
            return;
        }

        if ((string) ($user->role ?? '') !== 'admin') {
            return;
        }

        $pid = $user->pharmacy_id;
        if ($pid === null || (int) $pid < 1) {
            return;
        }

        if (!(bool) $user->is_active) {
            return;
        }

        $username = trim((string) ($user->username ?? ''));
        if ($username === '') {
            return;
        }

        try {
            $planService = app(PharmacyPlanService::class);
            $trialDays = $planService->freeTrialDaysConfig();
            $pharmacy = Pharmacy::find((int) $pid);
            $pharmacyName = $pharmacy ? trim((string) $pharmacy->name) : '';
            if ($pharmacyName === '') {
                $pharmacyName = 'صيدليتك';
            }

            SystemNotification::withoutGlobalScopes()->create([
                'pharmacy_id' => (int) $pid,
                'type' => 'admin_welcome',
                'pref_category' => 'onboarding',
                'title' => 'مرحباً بك في النظام',
                'message' => "أهلاً {$username}، تم تفعيل حسابك في «{$pharmacyName}». باقتك الحالية: مجانية مع فترة تجريبية كاملة المزايا لمدة {$trialDays} يوماً.",
                'details' => null,
                'from_management' => true,
                'management_label' => 'النظام',
                'recipients_type' => 'users',
                'recipient_usernames' => [$username],
                'meta' => [
                    'welcome' => true,
                ],
                'created_by' => 'system',
                'read_by' => [],
                'deleted_by' => [],
            ]);
        } catch (Throwable) {
            // لا نعطل إنشاء الحساب إذا فشل الإشعار
        }
    }
}
