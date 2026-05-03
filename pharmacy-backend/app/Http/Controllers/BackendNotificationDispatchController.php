<?php

namespace App\Http\Controllers;

use App\Models\Pharmacy;
use App\Models\SystemNotification;
use App\Models\User;
use App\Support\BackendWebScope;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class BackendNotificationDispatchController extends Controller
{
    private const PHARMACY_ALL = 'all';

    public function create(Request $request)
    {
        if (! Schema::hasTable('system_notifications')) {
            return redirect()->route('backend.dashboard')
                ->with('error', 'جدول الإشعارات غير موجود في قاعدة البيانات.');
        }

        $scoped = BackendWebScope::active();
        $scopeId = BackendWebScope::id();

        if ($scoped) {
            $selectedPharmacyKey = (string) (int) $scopeId;
        } else {
            $raw = old('pharmacy_id', $request->query('pharmacy_id'));
            if ($raw === null || $raw === '') {
                $selectedPharmacyKey = null;
            } elseif ($raw === self::PHARMACY_ALL || $raw === 'all') {
                $selectedPharmacyKey = self::PHARMACY_ALL;
            } else {
                $id = (int) $raw;
                $selectedPharmacyKey = ($id >= 1 && Pharmacy::whereKey($id)->exists()) ? (string) $id : null;
            }
        }

        $pharmacies = $scoped
            ? Pharmacy::where('id', $scopeId)->orderBy('name')->get(['id', 'name'])
            : Pharmacy::orderBy('name')->get(['id', 'name']);

        $broadcastStats = null;
        $broadcastPreviewAdmins = collect();

        if ($selectedPharmacyKey === self::PHARMACY_ALL && ! $scoped) {
            $broadcastStats = [
                'pharmacies' => Pharmacy::query()->count(),
                'admins' => User::withoutGlobalScopes()
                    ->whereNotNull('pharmacy_id')
                    ->whereIn('role', ['admin', 'super_admin'])
                    ->count(),
            ];
            $broadcastPreviewAdmins = User::withoutGlobalScopes()
                ->whereNotNull('pharmacy_id')
                ->whereIn('role', ['admin', 'super_admin'])
                ->with(['pharmacy' => fn ($q) => $q->select('id', 'name')])
                ->orderBy('pharmacy_id')
                ->orderBy('username')
                ->limit(120)
                ->get(['id', 'username', 'role', 'pharmacy_id', 'is_active']);
        }

        $admins = collect();
        if ($selectedPharmacyKey !== null
            && $selectedPharmacyKey !== self::PHARMACY_ALL
            && (int) $selectedPharmacyKey > 0) {
            $pid = (int) $selectedPharmacyKey;
            $admins = User::withoutGlobalScopes()
                ->where('pharmacy_id', $pid)
                ->whereIn('role', ['admin', 'super_admin'])
                ->orderByDesc('is_active')
                ->orderBy('username')
                ->get(['id', 'username', 'role', 'is_active']);
        }

        return view('backend.notifications-send', [
            'pharmacies' => $pharmacies,
            'admins' => $admins,
            'selectedPharmacyKey' => $selectedPharmacyKey,
            'scoped' => $scoped,
            'broadcastStats' => $broadcastStats,
            'broadcastPreviewAdmins' => $broadcastPreviewAdmins,
            'pharmacyAllToken' => self::PHARMACY_ALL,
        ]);
    }

    public function store(Request $request)
    {
        if (! Schema::hasTable('system_notifications')) {
            return redirect()->route('backend.dashboard')
                ->with('error', 'جدول الإشعارات غير موجود في قاعدة البيانات.');
        }

        $scoped = BackendWebScope::active();
        $scopeId = BackendWebScope::id();

        if ($scoped) {
            $broadcastAll = false;
            $pharmacyId = (int) $scopeId;
        } else {
            $pidRaw = (string) $request->input('pharmacy_id', '');
            if ($pidRaw === self::PHARMACY_ALL || $pidRaw === 'all') {
                $broadcastAll = true;
                $pharmacyId = null;
            } else {
                $broadcastAll = false;
                $pharmacyId = (int) $request->validate([
                    'pharmacy_id' => 'required|integer|exists:pharmacies,id',
                ])['pharmacy_id'];
            }
        }

        $rules = [
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'details' => 'nullable|string',
            'management_label' => 'nullable|string|max:120',
            'recipients_mode' => 'required|in:all_admins,all_staff,one_admin',
            'target_user_id' => 'nullable|integer|exists:users,id',
        ];

        $data = $request->validate($rules);

        if ($broadcastAll && $data['recipients_mode'] === 'one_admin') {
            return back()->withErrors([
                'recipients_mode' => 'إرسال «مدير محدد» غير متاح عند اختيار جميع الصيدليات.',
            ])->withInput();
        }

        if ($data['recipients_mode'] === 'one_admin') {
            $targetId = (int) ($data['target_user_id'] ?? 0);
            if ($targetId < 1) {
                return back()->withErrors(['target_user_id' => 'اختر المدير المستهدف.'])->withInput();
            }

            $target = User::withoutGlobalScopes()->find($targetId);
            if (! $target
                || (int) $target->pharmacy_id !== $pharmacyId
                || ! in_array((string) $target->role, ['admin', 'super_admin'], true)) {
                return back()->withErrors(['target_user_id' => 'المستخدم المختار ليس أدمناً في هذه الصيدلية.'])->withInput();
            }

            $recipientsType = 'users';
            $recipientUsernames = [trim((string) $target->username)];
        } elseif ($data['recipients_mode'] === 'all_admins') {
            $recipientsType = 'admin_only';
            $recipientUsernames = [];
        } else {
            $recipientsType = 'all';
            $recipientUsernames = [];
        }

        $label = trim((string) ($data['management_label'] ?? ''));
        if ($label === '') {
            $label = 'لوحة إدارة النظام (ويب)';
        }

        $payloadBase = [
            'type' => 'manual',
            'pref_category' => 'management_manual',
            'title' => $data['title'],
            'message' => $data['message'],
            'details' => $data['details'] ?? null,
            'from_management' => true,
            'management_label' => $label,
            'recipients_type' => $recipientsType,
            'recipient_usernames' => $recipientUsernames,
            'meta' => [
                'from_backend_web' => true,
            ],
            'created_by' => 'backend_web',
            'read_by' => [],
            'deleted_by' => [],
        ];

        $createdCount = 0;

        DB::transaction(function () use ($broadcastAll, $pharmacyId, $payloadBase, &$createdCount): void {
            if ($broadcastAll) {
                Pharmacy::query()->orderBy('id')->select('id')->cursor()->each(function (Pharmacy $p) use ($payloadBase, &$createdCount): void {
                    SystemNotification::withoutGlobalScopes()->create(array_merge($payloadBase, [
                        'pharmacy_id' => $p->id,
                    ]));
                    $createdCount++;
                });
            } else {
                SystemNotification::withoutGlobalScopes()->create(array_merge($payloadBase, [
                    'pharmacy_id' => $pharmacyId,
                ]));
                $createdCount = 1;
            }
        });

        $okMsg = $broadcastAll
            ? 'تم إنشاء الإشعار في '.$createdCount.' صيدلية (حسب نوع المستلمين الذي اخترته). سيظهر في التطبيق لمن يصلهم.'
            : 'تم إنشاء الإشعار لصيدلية «'.(optional(Pharmacy::find($pharmacyId))->name ?? '#'.$pharmacyId).'». سيظهر في التطبيق حسب صلاحيات كل مستخدم.';

        return $scoped
            ? redirect()->route('backend.notifications.send')->with('ok', $okMsg)
            : redirect()->route('backend.notifications.send', ['pharmacy_id' => $broadcastAll ? self::PHARMACY_ALL : $pharmacyId])->with('ok', $okMsg);
    }
}
