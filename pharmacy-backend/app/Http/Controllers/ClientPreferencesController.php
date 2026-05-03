<?php

namespace App\Http\Controllers;

use App\Models\SystemSetting;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

/**
 * تفضيلات الواجهة وتصفية الإشعارات — مُخزَّنة في system_settings (مصدر الحقيقة السيرفر).
 */
class ClientPreferencesController extends Controller
{
    private const KEY = 'client_preferences';

    private function settingsPharmacyId(Request $request): int
    {
        $user = $request->user();
        if ($user && $user->pharmacy_id !== null) {
            return (int) $user->pharmacy_id;
        }
        $pid = (int) ($request->query('pharmacy_id') ?? $request->input('pharmacy_id', 0));
        if ($pid < 1) {
            throw new HttpResponseException(response()->json([
                'success' => false,
                'message' => 'لحساب سوبر أدمن أرسل pharmacy_id في الجسم أو ?pharmacy_id=',
            ], 422));
        }

        return $pid;
    }

    public function show(Request $request)
    {
        if (!Schema::hasTable('system_settings')) {
            return response()->json(['success' => true, 'data' => $this->defaults()]);
        }

        $pid = $this->settingsPharmacyId($request);
        $row = SystemSetting::query()->where('pharmacy_id', $pid)->where('key', self::KEY)->first();
        $stored = is_array($row?->value_json) ? $row->value_json : [];

        return response()->json([
            'success' => true,
            'data' => $this->mergeDefaults($stored),
        ]);
    }

    public function update(Request $request)
    {
        if (!Schema::hasTable('system_settings')) {
            return response()->json([
                'success' => false,
                'message' => 'جدول system_settings غير موجود',
            ], 500);
        }

        $user = $request->user();
        $role = (string) ($user?->role ?? '');
        $isAdmin = in_array($role, ['admin', 'super_admin'], true);

        $patch = $request->all();
        if (!is_array($patch)) {
            $patch = [];
        }

        if (array_key_exists('notificationPrefs', $patch) && !$isAdmin) {
            return response()->json([
                'success' => false,
                'message' => 'غير مصرح بتعديل تفضيلات الإشعارات',
            ], 403);
        }

        if (array_key_exists('approvalRequests', $patch) && !$isAdmin) {
            return response()->json([
                'success' => false,
                'message' => 'غير مصرح بتعديل طلبات الاعتماد',
            ], 403);
        }

        $pid = $this->settingsPharmacyId($request);
        $row = SystemSetting::query()->where('pharmacy_id', $pid)->where('key', self::KEY)->first();
        $current = is_array($row?->value_json) ? $row->value_json : [];
        $base = $this->mergeDefaults($current);

        if (array_key_exists('notificationPrefs', $patch) && is_array($patch['notificationPrefs'])) {
            $base['notificationPrefs'] = $this->deepMerge($base['notificationPrefs'], $patch['notificationPrefs']);
        }
        if (array_key_exists('ui', $patch) && is_array($patch['ui'])) {
            $base['ui'] = $this->deepMerge($base['ui'], $patch['ui']);
        }
        if (array_key_exists('approvalRequests', $patch) && is_array($patch['approvalRequests'])) {
            $base['approvalRequests'] = array_values($patch['approvalRequests']);
        }

        SystemSetting::query()->updateOrCreate(
            ['pharmacy_id' => $pid, 'key' => self::KEY],
            ['value_json' => $base]
        );

        return response()->json([
            'success' => true,
            'data' => $this->mergeDefaults($base),
        ]);
    }

    /**
     * إضافة طلب اعتماد جديد (كاشير / سوبر كاشير) دون السماح بتعديل القائمة كاملة عبر PUT.
     */
    public function appendApprovalRequest(Request $request)
    {
        if (!Schema::hasTable('system_settings')) {
            return response()->json([
                'success' => false,
                'message' => 'جدول system_settings غير موجود',
            ], 500);
        }

        $user = $request->user();
        $role = (string) ($user?->role ?? '');
        if (!in_array($role, ['cashier', 'admin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'غير مصرح بإنشاء طلب اعتماد',
            ], 403);
        }

        $validated = $request->validate([
            'requestType' => 'required|string|max:64',
            'invoiceId' => 'nullable',
            'requestData' => 'nullable|array',
            'reason' => 'nullable|string|max:2000',
        ]);

        $username = trim((string) ($user->username ?? ''));
        $nowMs = (int) round(microtime(true) * 1000);

        $req = [
            'id' => 'apr-' . $nowMs . '-' . random_int(0, 9999),
            'requestType' => $validated['requestType'],
            'requestedBy' => $username,
            'invoiceId' => $validated['invoiceId'] ?? null,
            'requestData' => is_array($validated['requestData'] ?? null) ? $validated['requestData'] : [],
            'reason' => (string) ($validated['reason'] ?? ''),
            'status' => 'pending',
            'assignedTo' => null,
            'approvedBy' => null,
            'approvedAt' => null,
            'rejectedReason' => '',
            'executionResult' => '',
            'expiresAt' => now()->addMinutes(5)->toIso8601String(),
            'createdAt' => now()->toIso8601String(),
        ];

        $pid = $this->settingsPharmacyId($request);
        $row = SystemSetting::query()->where('pharmacy_id', $pid)->where('key', self::KEY)->first();
        $current = is_array($row?->value_json) ? $row->value_json : [];
        $base = $this->mergeDefaults($current);
        $list = is_array($base['approvalRequests'] ?? null) ? $base['approvalRequests'] : [];
        array_unshift($list, $req);
        $base['approvalRequests'] = array_values($list);

        SystemSetting::query()->updateOrCreate(
            ['pharmacy_id' => $pid, 'key' => self::KEY],
            ['value_json' => $base]
        );

        return response()->json([
            'success' => true,
            'data' => $this->mergeDefaults($base),
        ]);
    }

    private function defaults(): array
    {
        return [
            'notificationPrefs' => [
                'admin' => [
                    'shiftEnd' => true,
                    'userLogin' => true,
                    'saleComplete' => false,
                    'purchases' => true,
                    'subscription' => true,
                ],
                'cashierUsers' => [],
            ],
            'ui' => [
                'themeMode' => 'light',
                'settings' => [
                    'primaryColor' => '#00464d',
                    'secondaryColor' => '#006a63',
                    'fontFamily' => 'playpen',
                    'borderRadius' => 10,
                    'density' => 'comfortable',
                ],
            ],
            'approvalRequests' => [],
        ];
    }

    private function mergeDefaults(array $stored): array
    {
        $defaults = $this->defaults();
        $merged = $this->deepMerge($defaults, $stored);

        if (!isset($merged['notificationPrefs']['cashierUsers']) || !is_array($merged['notificationPrefs']['cashierUsers'])) {
            $merged['notificationPrefs']['cashierUsers'] = [];
        }

        return $merged;
    }

    private function deepMerge(array $base, array $patch): array
    {
        foreach ($patch as $k => $v) {
            if ($k === 'approvalRequests' && is_array($v)) {
                $base[$k] = array_values($v);
                continue;
            }
            if ($k === 'cashierUsers' && is_array($v)) {
                if (!isset($base[$k]) || !is_array($base[$k])) {
                    $base[$k] = [];
                }
                foreach ($v as $username => $prefs) {
                    if (is_array($prefs) && isset($base[$k][$username]) && is_array($base[$k][$username])) {
                        $base[$k][$username] = $this->deepMerge($base[$k][$username], $prefs);
                    } else {
                        $base[$k][$username] = $prefs;
                    }
                }
                continue;
            }
            if (is_array($v) && isset($base[$k]) && is_array($base[$k])) {
                $base[$k] = $this->deepMerge($base[$k], $v);
            } else {
                $base[$k] = $v;
            }
        }

        return $base;
    }
}
