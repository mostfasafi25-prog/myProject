<?php

namespace App\Http\Controllers;

use App\Models\CashierShiftClose;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CashierShiftCloseController extends Controller
{
    private function isPrivileged($user): bool
    {
        return $user && in_array($user->role, ['admin', 'super_admin'], true);
    }

    /**
     * قائمة إنهاءات الدوام (المدير يرى الكل، الموظف يرى سجلاته فقط).
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'غير مصرح'], 401);
        }

        $q = CashierShiftClose::query()->orderByDesc('shift_ended_at')->limit(500);
        if (!$this->isPrivileged($user)) {
            $q->whereRaw('LOWER(username) = ?', [strtolower((string) $user->username)]);
        }

        $rows = $q->get()->map(function (CashierShiftClose $r) {
            $inv = [];
            if (!empty($r->invoices_json)) {
                $decoded = json_decode($r->invoices_json, true);
                if (is_array($decoded)) {
                    $inv = $decoded;
                }
            }

            return [
                'id' => $r->client_row_id,
                'serverId' => $r->id,
                'username' => $r->username,
                'displayName' => $r->display_name,
                'shiftStartedAt' => $r->shift_started_at?->toIso8601String(),
                'shiftEndedAt' => $r->shift_ended_at?->toIso8601String(),
                'invoiceCount' => (int) $r->invoice_count,
                'total' => (float) $r->total,
                'cash' => (float) $r->cash,
                'app' => (float) $r->app,
                'credit' => (float) $r->credit,
                'invoices' => $inv,
                'createdAt' => $r->created_at?->toIso8601String(),
                'fromServer' => true,
            ];
        });

        return response()->json(['success' => true, 'data' => $rows]);
    }

    /**
     * حفظ ملخص إنهاء دوام من الكاشير (إيديمبوتنت بـ client_row_id).
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'غير مصرح'], 401);
        }

        $v = Validator::make($request->all(), [
            'client_row_id' => 'required|string|max:128',
            'username' => 'required|string|max:64',
            'display_name' => 'nullable|string|max:191',
            'shift_started_at' => 'nullable|date',
            'shift_ended_at' => 'required|date',
            'invoice_count' => 'required|integer|min:0',
            'total' => 'required|numeric|min:0',
            'cash' => 'required|numeric|min:0',
            'app' => 'required|numeric|min:0',
            'credit' => 'nullable|numeric|min:0',
            'invoices' => 'nullable|array',
        ]);

        if ($v->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'بيانات غير صالحة',
                'errors' => $v->errors(),
            ], 422);
        }

        if (!$this->isPrivileged($user) && strcasecmp((string) $user->username, (string) $request->username) !== 0) {
            return response()->json(['success' => false, 'message' => 'لا يمكنك تسجيل دوام لمستخدم آخر'], 403);
        }

        $invoicesJson = json_encode($request->input('invoices', []), JSON_UNESCAPED_UNICODE);

        $row = CashierShiftClose::updateOrCreate(
            ['client_row_id' => $request->client_row_id],
            [
                'user_id' => $user->id,
                'username' => $request->username,
                'display_name' => $request->display_name,
                'shift_started_at' => $request->shift_started_at,
                'shift_ended_at' => $request->shift_ended_at,
                'invoice_count' => (int) $request->invoice_count,
                'total' => $request->total,
                'cash' => $request->cash,
                'app' => $request->app,
                'credit' => (float) ($request->credit ?? 0),
                'invoices_json' => $invoicesJson,
            ],
        );

        return response()->json([
            'success' => true,
            'message' => 'تم حفظ ملخص الدوام',
            'data' => ['id' => $row->id, 'client_row_id' => $row->client_row_id],
        ], 201);
    }
}
