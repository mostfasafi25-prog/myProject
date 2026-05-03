<?php

namespace App\Http\Controllers;

use App\Models\SystemSetting;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class CashierSystemSettingsController extends Controller
{
    private const SETTINGS_KEY = 'cashier_system';

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
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $pid = $this->settingsPharmacyId($request);
        $row = SystemSetting::query()->where('pharmacy_id', $pid)->where('key', self::SETTINGS_KEY)->first();

        return response()->json([
            'success' => true,
            'data' => is_array($row?->value_json) ? $row->value_json : [],
        ]);
    }

    public function update(Request $request)
    {
        $role = (string) ($request->user()?->role ?? '');
        if (!in_array($role, ['admin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'غير مصرح بتعديل إعدادات الكاشير',
            ], 403);
        }

        if (!Schema::hasTable('system_settings')) {
            return response()->json([
                'success' => false,
                'message' => 'جدول system_settings غير موجود',
            ], 500);
        }

        $payload = $request->all();
        if (!is_array($payload)) {
            $payload = [];
        }

        $pid = $this->settingsPharmacyId($request);
        $row = SystemSetting::query()->updateOrCreate(
            ['pharmacy_id' => $pid, 'key' => self::SETTINGS_KEY],
            ['value_json' => $payload]
        );

        return response()->json([
            'success' => true,
            'data' => is_array($row->value_json) ? $row->value_json : [],
        ]);
    }
}

