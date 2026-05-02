<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

/**
 * لوحة مالك سرية — مسارات تحت /api/owner-console/* مع وسيط EnsureOwnerConsoleAccess.
 */
class OwnerConsoleController extends Controller
{
    public function ping()
    {
        return response()->json([
            'success' => true,
            'message' => 'ok',
        ]);
    }

    /**
     * إرسال إشعار/رسالة للمستخدمين (نفس منطق SystemNotificationController::store).
     * يُوسم كإشعار من المبرمج ليصل لمدير الصيدلية (admin) ضمن القائمة المسموحة.
     */
    public function sendNotification(Request $request)
    {
        $meta = $request->input('meta', []);
        if (!is_array($meta)) {
            $meta = [];
        }
        $meta['from_programmer'] = true;
        $request->merge(['meta' => $meta]);

        return app(SystemNotificationController::class)->store($request);
    }
}
