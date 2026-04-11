<?php

use App\Http\Middleware\ActAsAdminForOpenApi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CashierShiftCloseController;

/*
|--------------------------------------------------------------------------
| Pharmacy API Starter
|--------------------------------------------------------------------------
| Keep this file minimal until the pharmacy modules are defined.
| Suggested first modules: auth, medicines, inventory, sales, suppliers.
*/

Route::get('/health', function () {
    $payload = [
        'app' => 'pharmacy-backend',
        'status' => 'ok',
        'time' => now()->toIso8601String(),
        'database' => 'unknown',
    ];
    try {
        DB::connection()->getPdo();
        $payload['database'] = 'connected';
    } catch (\Throwable $e) {
        $payload['database'] = 'error';
        $payload['status'] = 'degraded';
        $payload['database_message'] = config('app.debug') ? $e->getMessage() : 'فشل الاتصال بقاعدة البيانات';
    }

    return response()->json($payload);
});

// فتح الرابط في المتصفح يرسل GET؛ نرجع JSON واضح بدل صفحة 405 الافتراضية
Route::get('/login', function () {
    return response()->json([
        'app' => 'pharmacy-backend',
        'message' => 'تسجيل الدخول يتم عبر طلب POST فقط (ليس من شريط العنوان).',
        'use_method' => 'POST',
        'content_type' => 'application/json',
        'body' => [
            'username' => 'string',
            'password' => 'string',
        ],
        'hint' => 'استخدم واجهة الموقع أو: curl -X POST .../api/login -d {"username":"admin","password":"..."}',
    ]);
});

$apiAuthMiddleware = config('app.skip_api_auth')
    ? [ActAsAdminForOpenApi::class, 'active']
    : ['auth:sanctum', 'active'];

Route::middleware($apiAuthMiddleware)->get('/user', function (Request $request) {
    return $request->user();
});

Route::post('/register', [AuthController::class, 'register']);
Route::post('/register/verify-otp', [AuthController::class, 'verifyRegisterOtp']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/login/verify-otp', [AuthController::class, 'verifyLoginOtp']);

Route::middleware($apiAuthMiddleware)->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/chatbase/identity-token', [AuthController::class, 'chatbaseIdentityToken']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::get('/users/pending-approvals', [AuthController::class, 'pendingApprovals']);
    Route::post('/users/{id}/approve', [AuthController::class, 'approveUser']);
    Route::get('/users', [UserController::class, 'index']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::post('/users', [UserController::class, 'store']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    Route::apiResource('products', ProductController::class);
    /** أقسام المبيعات/المشتريات للكاشير والواجهات — بيانات حقيقية من الجدول */
    Route::get('/categories/main', [CategoryController::class, 'getMainCategoriesSimple']);
    Route::get('/orders/stats/summary', [OrderController::class, 'stats']);
    Route::get('/dashboard/summary', [AdminDashboardController::class, 'summary']);
    Route::apiResource('orders', OrderController::class)->only(['index', 'store', 'show']);

    /** إنهاء دوام الكاشير — يُحفظ في السيرفر ولا يضيع عند تحديث الصفحة */
    Route::get('/cashier-shifts', [CashierShiftCloseController::class, 'index']);
    Route::post('/cashier-shifts', [CashierShiftCloseController::class, 'store']);
});
