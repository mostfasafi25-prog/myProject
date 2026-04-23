<?php

namespace App\Http\Controllers;

use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

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

    /**
     * التسجيل الذاتي معطّل — يُنشئ المدير المستخدمين من لوحة الموظفين (POST /api/users مع توكن).
     */
    public function register(Request $request)
    {
        return response()->json([
            'error' => 'التسجيل العام معطّل. أنشئ الحسابات من لوحة الإدارة → الموظفين.',
        ], 403);
    }

    public function verifyRegisterOtp(Request $request)
    {
        return response()->json(['error' => 'معطّل'], 403);
    }

    public function login(Request $request)
    {
        $username = trim((string) $request->username);
        $password = (string) $request->password;
        if ($username === '' || $password === '') {
            return response()->json(['error' => 'يجب إدخال اسم المستخدم وكلمة المرور'], 422);
        }

        $user = User::where('username', $username)->first();
        if (!$user) {
            return response()->json(['error' => 'اسم المستخدم غير صحيح'], 401);
        }
        if (!Hash::check($password, $user->password)) {
            return response()->json(['error' => 'كلمة المرور غير صحيحة'], 401);
        }

        if (($user->approval_status ?? 'approved') !== 'approved') {
            return response()->json(['error' => 'الحساب بانتظار موافقة الأدمن'], 403);
        }

        if (!($user->is_active ?? true)) {
            return response()->json(['error' => 'أنت غير مفعّل. تواصل مع مدير النظام لتفعيل حسابك.'], 403);
        }

        $token = $user->createToken('api_token')->plainTextToken;
        return response()->json([
            'message' => 'تم الدخول بنجاح',
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'role' => $user->role,
                'avatar_url' => $user->avatar_url,
                'approval_status' => $user->approval_status,
                'is_active' => (bool) ($user->is_active ?? true),
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

        if (($user->approval_status ?? 'approved') !== 'approved') {
            return response()->json(['error' => 'الحساب بانتظار موافقة الأدمن'], 403);
        }

        if (!($user->is_active ?? true)) {
            return response()->json(['error' => 'أنت غير مفعّل. تواصل مع مدير النظام لتفعيل حسابك.'], 403);
        }

        Cache::forget("login_otp:{$request->challenge_id}");
        $token = $user->createToken('api_token')->plainTextToken;

        return response()->json([
            'message' => 'تم الدخول بنجاح',
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'role' => $user->role,
                'avatar_url' => $user->avatar_url,
                'approval_status' => $user->approval_status,
                'is_active' => (bool) ($user->is_active ?? true),
            ],
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
                'avatar_url' => $user->avatar_url,
                'approval_status' => $user->approval_status,
                'is_active' => (bool) ($user->is_active ?? true),
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
        $user->is_active = true;
        $user->save();

        return response()->json([
            'message' => 'تمت الموافقة على المستخدم',
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'role' => $user->role,
                'avatar_url' => $user->avatar_url,
                'approval_status' => $user->approval_status,
                'is_active' => (bool) $user->is_active,
            ],
        ]);
    }
}
