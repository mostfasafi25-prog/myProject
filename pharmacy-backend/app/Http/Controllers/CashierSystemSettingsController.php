<?php

namespace App\Http\Controllers;

use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class CashierSystemSettingsController extends Controller
{
    private const SETTINGS_KEY = 'cashier_system';

    public function show()
    {
        if (!Schema::hasTable('system_settings')) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $row = SystemSetting::query()->where('key', self::SETTINGS_KEY)->first();

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

        $row = SystemSetting::query()->updateOrCreate(
            ['key' => self::SETTINGS_KEY],
            ['value_json' => $payload]
        );

        return response()->json([
            'success' => true,
            'data' => is_array($row->value_json) ? $row->value_json : [],
        ]);
    }
}

