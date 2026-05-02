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
use App\Http\Controllers\ImageUploadController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\StaffActivityController;
use App\Http\Controllers\SystemNotificationController;
use App\Http\Controllers\TreasuryController;
use App\Http\Controllers\CashierSystemSettingsController;
use App\Http\Controllers\ClientPreferencesController;
use App\Http\Controllers\OwnerConsoleController;

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
    Route::put('orders/credit-customers/{customerId}/credit-limit', [OrderController::class, 'updateCreditLimit']);
    Route::get('/chatbase/identity-token', [AuthController::class, 'chatbaseIdentityToken']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::get('/users/pending-approvals', [AuthController::class, 'pendingApprovals']);
    Route::post('/users/{id}/approve', [AuthController::class, 'approveUser']);
    Route::get('/users', [UserController::class, 'index']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::post('/users', [UserController::class, 'store']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    Route::get('products/{product}/inventory-cost-layers', [ProductController::class, 'inventoryCostLayers']);
    Route::patch('products/{product}/cashier-labels', [ProductController::class, 'patchCashierDisplayLabels']);
    Route::apiResource('products', ProductController::class);
    Route::post('/products/stocktake/apply', [ProductController::class, 'applyStocktake']);
    Route::get('/products/stats', [ProductController::class, 'stats']);
    Route::get('/categories/main', [CategoryController::class, 'getMainCategoriesSimple']);
    Route::get('/orders/stats/summary', [OrderController::class, 'stats']);
    Route::get('/orders/credit-customers', [OrderController::class, 'creditCustomersSummary']);
    Route::post('/orders/credit-customers', [OrderController::class, 'createCreditCustomer']);
    Route::put('/orders/credit-customers/{customerId}', [OrderController::class, 'updateCreditCustomer']);
    Route::get('/orders/today-transactions', [OrderController::class, 'getTodayTransactions']);
    Route::get('/orders/credit-customers/{customerId}/movements', [OrderController::class, 'getCreditCustomerMovements']);

    Route::post('/orders/credit-customers/{customerId}/pay', [OrderController::class, 'applyCreditPayment']);
    Route::get('/dashboard/summary', [AdminDashboardController::class, 'summary']);
    Route::apiResource('orders', OrderController::class)->only(['index', 'store', 'show']);
    Route::post('/orders/{id}/return', [OrderController::class, 'returnOrder']);
    Route::post('/orders/{id}/return-full', [OrderController::class, 'returnOrderFull']);

    /** إنهاء دوام الكاشير — يُحفظ في السيرفر ولا يضيع عند تحديث الصفحة */
    Route::get('/cashier-shifts', [CashierShiftCloseController::class, 'index']);
    Route::post('/cashier-shifts', [CashierShiftCloseController::class, 'store']);
    
    /** رفع الصور للمنتجات */
    Route::post('/upload/product-image', [ImageUploadController::class, 'uploadProductImage']);
    Route::post('/upload/multiple-images', [ImageUploadController::class, 'uploadMultipleImages']);
    Route::delete('/upload/delete-image', [ImageUploadController::class, 'deleteImage']);
    
    /** الموردين */
    Route::apiResource('suppliers', SupplierController::class);
    Route::post('suppliers/{supplier}/pay-debt', [SupplierController::class, 'payDebt']);
    
    /** المشتريات */
    Route::apiResource('purchases', PurchaseController::class);
    Route::post('purchases/{purchase}/return-items', [PurchaseController::class, 'returnItems']);
    Route::post('purchases/{purchase}/full-return', [PurchaseController::class, 'fullReturn']);
    Route::delete('/purchases-all', [PurchaseController::class, 'destroyAll']);
    
    /** الخزنة */
    Route::apiResource('treasury', TreasuryController::class);
    Route::get('/treasury-balance', [TreasuryController::class, 'getSimpleBalance']);
    Route::post('/treasury-init', [TreasuryController::class, 'initTreasury']);
    Route::post('/system/reset-all', [TreasuryController::class, 'resetEverything']);
    Route::post('/treasury/manual-deposit', [TreasuryController::class, 'manualDeposit']);
    Route::post('/treasury/manual-withdraw', [TreasuryController::class, 'manualWithdraw']);
    /** الأقسام */
    Route::apiResource('categories', CategoryController::class);

    /** الإشعارات النظامية */
    Route::post('/notifications', [SystemNotificationController::class, 'store']);

    Route::get('/notifications', [SystemNotificationController::class, 'index']);
    Route::post('/notifications/read-all', [SystemNotificationController::class, 'markReadAll']);
    Route::post('/notifications/delete-all', [SystemNotificationController::class, 'markDeletedAll']);
    Route::post('/notifications/{id}/read', [SystemNotificationController::class, 'markRead']);
    Route::post('/notifications/{id}/delete', [SystemNotificationController::class, 'markDeleted']);
    Route::get('/settings/cashier-system', [CashierSystemSettingsController::class, 'show']);
    Route::put('/settings/cashier-system', [CashierSystemSettingsController::class, 'update']);
    Route::get('/settings/client-preferences', [ClientPreferencesController::class, 'show']);
    Route::post('/settings/client-preferences/approval-request', [ClientPreferencesController::class, 'appendApprovalRequest']);
    Route::put('/settings/client-preferences', [ClientPreferencesController::class, 'update']);

    /** نشاط الموظفين */
    Route::post('/staff-activities', [StaffActivityController::class, 'store']);
    Route::get('/staff-activities', [StaffActivityController::class, 'index']);

    /** لوحة مالك سرية — سوبر أدمن + مفتاح OWNER_CONSOLE_SECRET (إن وُجد) */
    Route::middleware('owner.console')->prefix('owner-console')->group(function () {
        Route::get('/ping', [OwnerConsoleController::class, 'ping']);
        Route::post('/notifications', [OwnerConsoleController::class, 'sendNotification']);
    });
});
