<?php

namespace App\Http\Controllers;

use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function chatbaseIdentityToken(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'غير مصرح'], 401);
        }

        $secret = env('CHATBOT_IDENTITY_SECRET');
        if (!$secret) {
            return response()->json(['error' => 'CHATBOT_IDENTITY_SECRET غير مضبوط في .env'], 500);
        }

        $payload = [
            'user_id' => (string) $user->id,
            'email' => (string) ($user->email ?? ''),
            'username' => (string) $user->username,
            'role' => (string) $user->role,
            'exp' => now()->addHour()->timestamp,
        ];

        $token = JWT::encode($payload, $secret, 'HS256');

        return response()->json([
            'token' => $token,
            'expires_in' => 3600,
        ]);
    }

    public function register(Request $request)
    {
        $v = Validator::make($request->all(), [
            'username' => 'required|string|max:255|unique:users',
            'password' => 'required|string|min:6',
            'role' => ['required', Rule::in(['admin', 'cashier', 'super_cashier'])],
        ]);

        if ($v->fails()) {
            return response()->json(['errors' => $v->errors()], 422);
        }

        if (filter_var(env('REGISTER_SIMPLE_MODE', false), FILTER_VALIDATE_BOOLEAN)) {
            if ($request->role === 'admin' && ! filter_var(env('REGISTER_SIMPLE_ALLOW_ADMIN', false), FILTER_VALIDATE_BOOLEAN)) {
                return response()->json([
                    'error' => 'التسجيل السريع كمدير معطّل. فعّل REGISTER_SIMPLE_ALLOW_ADMIN=true على السيرفر (اختبار فقط)، أو أنشئ أدمن عبر db:seed.',
                ], 422);
            }

            User::create([
                'username' => $request->username,
                'password' => Hash::make($request->password),
                'role' => $request->role,
                'approval_status' => 'approved',
            ]);

            return response()->json([
                'message' => 'تم إنشاء الحساب (وضع اختبار: بدون بريد). يمكنك تسجيل الدخول فورًا.',
                'requires_verification' => false,
            ], 201);
        }

        $confirmEmail = env('HOTMAIL_CONFIRM_EMAIL');
        if (!$confirmEmail) {
            return response()->json(['error' => 'لم يتم إعداد بريد Hotmail لتأكيد التسجيل'], 500);
        }

        $challengeId = (string) Str::uuid();
        $code = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);

        Cache::put("register_otp:{$challengeId}", [
            'username' => $request->username,
            'password' => Hash::make($request->password),
            'role' => $request->role,
            'code' => $code,
        ], now()->addMinutes(10));

        Mail::raw("رمز تأكيد التسجيل (4 أرقام): {$code}\nينتهي خلال 10 دقائق.", function ($message) use ($confirmEmail) {
            $message->to($confirmEmail)->subject('رمز تأكيد التسجيل - نظام الصيدلية');
        });

        return response()->json([
            'message' => 'تم إرسال رمز التأكيد إلى البريد',
            'requires_verification' => true,
            'challenge_id' => $challengeId,
            'expires_in' => 600,
            'channel' => $confirmEmail,
        ]);
    }

    public function verifyRegisterOtp(Request $request)
    {
        $v = Validator::make($request->all(), [
            'challenge_id' => 'required|string',
            'code' => 'required|string|size:4',
        ]);

        if ($v->fails()) {
            return response()->json(['errors' => $v->errors()], 422);
        }

        $cached = Cache::get("register_otp:{$request->challenge_id}");
        if (!$cached) {
            return response()->json(['error' => 'رمز تأكيد التسجيل منتهي أو غير صالح'], 401);
        }

        if (($cached['code'] ?? null) !== $request->code) {
            return response()->json(['error' => 'رمز التأكيد غير صحيح'], 401);
        }

        if (User::where('username', $cached['username'])->exists()) {
            Cache::forget("register_otp:{$request->challenge_id}");
            return response()->json(['error' => 'اسم المستخدم مستخدم مسبقًا'], 409);
        }

        User::create([
            'username' => $cached['username'],
            'password' => $cached['password'],
            'role' => $cached['role'],
            'approval_status' => 'pending',
        ]);

        Cache::forget("register_otp:{$request->challenge_id}");

        return response()->json([
            'message' => 'تم التحقق من البريد. الحساب بانتظار موافقة الأدمن.',
            'status' => 'pending_admin_approval',
        ], 201);
    }

    public function login(Request $request)
    {
        if (!$request->username || !$request->password) {
            return response()->json(['error' => 'يجب إدخال اسم المستخدم وكلمة المرور'], 422);
        }

        $user = User::where('username', $request->username)->first();
        if (!$user) {
            return response()->json(['error' => 'اسم المستخدم غير صحيح'], 401);
        }
        if (!Hash::check($request->password, $user->password)) {
            return response()->json(['error' => 'كلمة المرور غير صحيحة'], 401);
        }

        if (($user->approval_status ?? 'approved') !== 'approved') {
            return response()->json(['error' => 'الحساب بانتظار موافقة الأدمن'], 403);
        }
        $token = $user->createToken('api_token')->plainTextToken;
        return response()->json([
            'message' => 'تم الدخول بنجاح',
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'role' => $user->role,
                'approval_status' => $user->approval_status,
            ],
            'token' => $token,
            'token_type' => 'Bearer',
        ]);
    }

    public function verifyLoginOtp(Request $request)
    {
        $v = Validator::make($request->all(), [
            'challenge_id' => 'required|string',
            'code' => 'required|string|size:6',
        ]);

        if ($v->fails()) {
            return response()->json(['errors' => $v->errors()], 422);
        }

        $cached = Cache::get("login_otp:{$request->challenge_id}");
        if (!$cached) {
            return response()->json(['error' => 'رمز التأكيد منتهي أو غير صالح'], 401);
        }

        if (($cached['code'] ?? null) !== $request->code) {
            return response()->json(['error' => 'رمز التأكيد غير صحيح'], 401);
        }

        $user = User::find($cached['user_id'] ?? 0);
        if (!$user) {
            return response()->json(['error' => 'المستخدم غير موجود'], 404);
        }

        Cache::forget("login_otp:{$request->challenge_id}");
        $token = $user->createToken('api_token')->plainTextToken;

        return response()->json([
            'message' => 'تم الدخول بنجاح',
            'user' => ['id' => $user->id, 'username' => $user->username, 'role' => $user->role],
            'token' => $token,
            'token_type' => 'Bearer',
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'تم تسجيل الخروج بنجاح']);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'قم بتسجيل الدخول أولاً'], 401);
        }
        return response()->json([
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'role' => $user->role,
                'approval_status' => $user->approval_status,
            ],
        ]);
    }

    public function changePassword(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'غير مصرح'], 401);
        }

        $v = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:6|different:current_password',
        ]);

        if ($v->fails()) {
            return response()->json(['errors' => $v->errors()], 422);
        }

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['error' => 'كلمة المرور الحالية غير صحيحة'], 401);
        }

        $user->password = Hash::make($request->new_password);
        $user->save();

        return response()->json(['message' => 'تم تحديث كلمة المرور بنجاح']);
    }

    public function pendingApprovals(Request $request)
    {
        if (!in_array($request->user()->role, ['admin', 'super_admin'], true)) {
            return response()->json(['error' => 'غير مصرح'], 403);
        }

        $users = User::where('approval_status', 'pending')
            ->select('id', 'username', 'role', 'approval_status', 'created_at')
            ->latest()
            ->get();

        return response()->json(['users' => $users]);
    }

    public function approveUser(Request $request, int $id)
    {
        if (!in_array($request->user()->role, ['admin', 'super_admin'], true)) {
            return response()->json(['error' => 'غير مصرح'], 403);
        }

        $user = User::find($id);
        if (!$user) {
            return response()->json(['error' => 'المستخدم غير موجود'], 404);
        }

        $user->approval_status = 'approved';
        $user->save();

        return response()->json([
            'message' => 'تمت الموافقة على المستخدم',
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'role' => $user->role,
                'approval_status' => $user->approval_status,
            ],
        ]);
    }
}
