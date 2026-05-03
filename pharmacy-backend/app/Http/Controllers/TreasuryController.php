<?php

namespace App\Http\Controllers;

use App\Models\Treasury;
use App\Models\TreasuryTransaction;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use App\Support\ActivityLogger;

class TreasuryController extends Controller
{
    /**
     * ملخص الخزنة والإحصائيات الأساسية (GET /api/treasury)
     */
    public function index(Request $request)
    {
        try {
            $treasury = Treasury::getActive();
            $employeesStats = $this->getEmployeesStats();

            $stats = [
                'today_income' => TreasuryTransaction::whereDate('created_at', today())
                    ->where('type', 'income')
                    ->sum('amount'),
                'today_expenses' => TreasuryTransaction::whereDate('created_at', today())
                    ->where('type', 'expense')
                    ->sum('amount'),
                'today_sales' => \App\Models\Order::whereDate('created_at', today())->sum('total'),
                'monthly_income' => TreasuryTransaction::whereMonth('created_at', now()->month)
                    ->where('type', 'income')
                    ->sum('amount'),
                'expenses_weekly' => TreasuryTransaction::whereBetween('created_at', [
                    now()->startOfWeek(),
                    now()->endOfWeek(),
                ])
                    ->where('type', 'expense')
                    ->sum('amount'),
                'monthly_expenses' => TreasuryTransaction::whereMonth('created_at', now()->month)
                    ->where('type', 'expense')
                    ->sum('amount'),
                'total_transactions' => TreasuryTransaction::count(),
                'total_orders' => \App\Models\Order::count(),
                'total_order_value' => \App\Models\Order::sum('total'),
                'pending_payments' => \App\Models\Order::where('due_amount', '>', 0)->sum('due_amount'),
                'employees_stats' => $employeesStats,
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'treasury' => $treasury,
                    'stats' => $stats,
                    'report_type' => 'summary',
                    'generated_at' => now()->format('Y-m-d H:i:s'),
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in TreasuryController@index', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request' => $request->all(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب بيانات الخزنة',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null,
            ], 500);
        }
    }
    
    /**
     * جلب الرصيد البسيط للخزنة (للفحص السريع)
     */
    public function getSimpleBalance()
    {
        try {
            $treasury = Treasury::getActive();
            
            if (!$treasury) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'balance' => 0,
                        'exists' => false,
                        'message' => 'لا توجد خزنة مسجلة - يجب إنشاء خزنة أولاً'
                    ]
                ]);
            }
            
            $cash = (float) ($treasury->balance_cash ?? $treasury->balance ?? 0);
            $app = (float) ($treasury->balance_app ?? 0);
            $computedBalance = round($cash + $app, 2);

            return response()->json([
                'success' => true,
                'data' => [
                    // Always return total as cash + app to avoid stale balance column mismatches.
                    'balance' => $computedBalance,
                    'balance_cash' => $cash,
                    'balance_app' => $app,
                    'total_income' => $treasury->total_income,
                    'total_expenses' => $treasury->total_expenses,
                    'exists' => true,
                    'treasury_id' => $treasury->id
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'فشل في جلب رصيد الخزنة',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    /**
     * إنشاء خزنة جديدة إذا لم تكن موجودة
     */
    public function initTreasury(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'initial_balance' => 'nullable|numeric|min:0',
                'name' => 'nullable|string|max:255'
            ]);
            
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }
            
            $treasury = Treasury::getActive();

            return response()->json([
                'success' => true,
                'message' => 'الخزنة جاهزة',
                'data' => [
                    'treasury' => $treasury,
                    'created' => $treasury->wasRecentlyCreated,
                ],
            ], $treasury->wasRecentlyCreated ? 201 : 200);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'فشل في إنشاء الخزنة',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    /**
     * جلب إحصائيات الموظفين
     */
    private function getEmployeesStats()
    {
        try {
            $employees = Customer::all();
            
            $totalMonthlySalaries = $employees->sum('salary');
            
            return [
                'total_employees' => $employees->count(),
                'total_monthly_salaries' => $totalMonthlySalaries,
                'average_salary' => $employees->count() > 0 ? $totalMonthlySalaries / $employees->count() : 0,
                'by_department' => $employees->groupBy('department')->map(function ($deptEmployees) {
                    return [
                        'count' => $deptEmployees->count(),
                        'total_salary' => $deptEmployees->sum('salary'),
                        'average_salary' => $deptEmployees->avg('salary')
                    ];
                }),
                'by_shift' => $employees->groupBy('shift')->map(function ($shiftEmployees) {
                    return [
                        'count' => $shiftEmployees->count(),
                        'total_salary' => $shiftEmployees->sum('salary')
                    ];
                })
            ];
        } catch (\Exception $e) {
            return [];
        }
    }
    




    /**
 * إضافة مبلغ للخزنة يدويًا (بدون إضافة لإجمالي الدخل)
 */
public function manualDeposit(Request $request)
{
    $validator = Validator::make($request->all(), [
        'amount' => 'required|numeric|min:0.01',
        'description' => 'required|string|max:500',
        'transaction_date' => 'nullable|date',
        'payment_method' => 'nullable|in:cash,app',
    ]);
    
    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'خطأ في التحقق من البيانات',
            'errors' => $validator->errors()
        ], 422);
    }

    try {
        DB::beginTransaction();
        
        // جلب الخزنة
        $treasury = Treasury::getActive();

        $oldBalance = $treasury->balance;
        $pm = strtolower((string) ($request->payment_method ?? 'cash'));
        $amt = (float) $request->amount;
        
        // تحديث رصيد الخزنة فقط بدون تعديل total_income
        if ($pm === 'app') {
            $treasury->applyLiquidityDelta(0, $amt);
        } else {
            $treasury->applyLiquidityDelta($amt, 0);
        }
        $treasury->save();
        
        // تسجيل المعاملة باستخدام القيم المسموحة في ENUM الحالي
        $transaction = TreasuryTransaction::create([
            'treasury_id' => $treasury->id,
            'type' => 'income', // استخدم 'income' المسموح به
            'amount' => $request->amount,
            'description' => '💰 إضافة يدوية: ' . $request->description,
            'category' => 'other_income', // استخدم 'other_income' المسموح به
            'transaction_date' => $request->transaction_date ?? now(),
            'transaction_number' => 'MANUAL-' . time(),
            'status' => 'completed',
            'payment_method' => $pm === 'app' ? 'app' : 'cash',
            'created_by' => auth()->id() ?? 1,
            'reference_type' => 'manual_deposit',
            'reference_id' => rand(1000, 9999),
            'metadata' => json_encode([
                'is_manual' => true,
                'operation' => 'manual_deposit',
                'note' => 'إضافة يدوية - لم تضف لإجمالي الدخل',
                'original_description' => $request->description
            ])
        ]);
        
        DB::commit();

        ActivityLogger::log($request, [
            'action_type' => 'treasury_manual_deposit',
            'entity_type' => 'treasury',
            'entity_id' => $treasury->id ?? null,
            'description' => 'إضافة يدوية للخزنة',
            'meta' => [
                'amount' => (float) $request->amount,
                'payment_method' => $pm,
                'description' => (string) $request->description,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => '✅ تم إضافة المبلغ للخزنة يدويًا',
            'data' => [
                'old_balance' => $oldBalance,
                'new_balance' => $treasury->balance,
                'amount' => $request->amount,
                'description' => $request->description,
                'transaction_date' => $transaction->transaction_date->format('Y-m-d H:i:s'),
                'transaction_id' => $transaction->id,
                'note' => '⚠️ المبلغ أضيف للرصيد فقط، ولم يضاف لإجمالي الدخل',
                'transaction_type' => 'manual_deposit (مسجل كـ other_income)'
            ]
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        \Log::error('Error in manualDeposit', [
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء الإضافة اليدوية',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null,
            'hint' => 'ENUM المسموح: type: [income, expense], category: [deposit, withdraw, sales_income, purchase_expense, purchases, salary_expense, other_income, other_expense]'
        ], 500);
    }
}

/**
 * سحب مبلغ من الخزنة يدويًا (متوافق مع ENUM الحالي)
 */
public function manualWithdraw(Request $request)
{
    $validator = Validator::make($request->all(), [
        'amount' => 'required|numeric|min:0.01',
        'description' => 'required|string|max:500',
        'transaction_date' => 'nullable|date',
        'payment_method' => 'nullable|in:cash,app',
    ]);
    
    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'خطأ في التحقق من البيانات',
            'errors' => $validator->errors()
        ], 422);
    }

    try {
        DB::beginTransaction();
        
        // جلب الخزنة
        $treasury = Treasury::getActive();
        if (!$treasury) {
            return response()->json([
                'success' => false,
                'message' => 'لا توجد خزنة'
            ], 404);
        }
        
        $oldBalance = $treasury->balance;
        $pm = strtolower((string) ($request->payment_method ?? 'cash'));
        $amt = (float) $request->amount;
        
        // تحديث رصيد الخزنة فقط بدون تعديل total_expenses (يُسمَح برصيد سالب)
        if ($pm === 'app') {
            $treasury->applyLiquidityDelta(0, -$amt);
        } else {
            $treasury->applyLiquidityDelta(-$amt, 0);
        }
        $treasury->save();
        
        // تسجيل المعاملة باستخدام القيم المسموحة في ENUM الحالي
        $transaction = TreasuryTransaction::create([
            'treasury_id' => $treasury->id,
            'type' => 'expense', // استخدم 'expense' المسموح به
            'amount' => $request->amount,
            'description' => '💸 سحب يدوي: ' . $request->description,
            'category' => 'other_expense', // استخدم 'other_expense' المسموح به
            'transaction_date' => $request->transaction_date ?? now(),
            'transaction_number' => 'MANUAL-W-' . time(),
            'status' => 'completed',
            'payment_method' => $pm === 'app' ? 'app' : 'cash',
            'created_by' => auth()->id() ?? 1,
            'reference_type' => 'manual_withdraw',
            'reference_id' => rand(1000, 9999),
            'metadata' => json_encode([
                'is_manual' => true,
                'operation' => 'manual_withdraw',
                'note' => 'سحب يدوي - لم يضاف لإجمالي المصروفات',
                'original_description' => $request->description
            ])
        ]);
        
        DB::commit();

        ActivityLogger::log($request, [
            'action_type' => 'treasury_manual_withdraw',
            'entity_type' => 'treasury',
            'entity_id' => $treasury->id ?? null,
            'description' => 'سحب يدوي من الخزنة',
            'meta' => [
                'amount' => (float) $request->amount,
                'payment_method' => $pm,
                'description' => (string) $request->description,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => '✅ تم سحب المبلغ من الخزنة يدويًا',
            'data' => [
                'old_balance' => $oldBalance,
                'new_balance' => $treasury->balance,
                'amount' => $request->amount,
                'description' => $request->description,
                'transaction_date' => $transaction->transaction_date->format('Y-m-d H:i:s'),
                'transaction_id' => $transaction->id,
                'note' => '⚠️ المبلغ خصم من الرصيد فقط، ولم يضاف لإجمالي المصروفات',
                'transaction_type' => 'manual_withdraw (مسجل كـ other_expense)'
            ]
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        \Log::error('Error in manualWithdraw', [
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء السحب اليدوي',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null,
            'hint' => 'استخدم القيم المسموحة في ENUM'
        ], 500);
    }
}



  /**
 * تصفير كامل للنظام (كل شيء)
 */

  /**
 * تصفير كامل للنظام (بترتيب الحذف الصحيح)
 */
/**
 * تصفير كامل للنظام
 */
public function resetEverything(Request $request)
{
    try {
        $actor = $request->user();
        if ($actor && $actor->pharmacy_id !== null) {
            return $this->resetTenantBulk($request, (int) $actor->pharmacy_id);
        }
        if (!$actor || $actor->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'تصفير كامل المنصة لسوبر أدمن فقط. كمدير صيدلية يُحذف نطاق صيدليتك فقط عند استدعاء التصفير.',
            ], 403);
        }

        // تسجيل الإحصائيات
        $stats = [
            'orders_count' => \App\Models\Order::withoutGlobalScopes()->count(),
            'transactions_count' => TreasuryTransaction::withoutGlobalScopes()->count(),
            'purchases_count' => \App\Models\Purchase::withoutGlobalScopes()->count(),
            'treasury_balance' => Treasury::withoutGlobalScopes()->sum('balance') ?? 0,
            'suppliers_count' => \App\Models\Supplier::withoutGlobalScopes()->count(),
            'customers_count' => \App\Models\Customer::withoutGlobalScopes()->count(),
            'users_count' => \App\Models\User::withoutGlobalScopes()->count(),
        ];

        DB::beginTransaction();

        // حفظ مستخدم الأدمن الذي سنُبقيه للدخول بعد التصفير
        $adminToKeep = null;
        if (\Schema::hasTable('users')) {
            $authUserId = (int) ($request->user()?->id ?? 0);
            if ($authUserId > 0) {
                $adminToKeep = DB::table('users')
                    ->where('id', $authUserId)
                    ->whereIn('role', ['admin', 'super_admin'])
                    ->first();
            }
            if (!$adminToKeep) {
                $adminToKeep = DB::table('users')
                    ->whereRaw('LOWER(COALESCE(username, "")) = ?', ['admin'])
                    ->first();
            }
            if (!$adminToKeep) {
                $adminToKeep = DB::table('users')
                    ->whereIn('role', ['admin', 'super_admin'])
                    ->orderBy('id')
                    ->first();
            }
        }

        // حذف الجداول التابعة أولاً لضمان عدم تعارض المفاتيح الأجنبية
        if (\Schema::hasTable('meal_order_item_options')) DB::table('meal_order_item_options')->delete();
        if (\Schema::hasTable('order_item_options')) DB::table('order_item_options')->delete();
        if (\Schema::hasTable('meal_order_items')) DB::table('meal_order_items')->delete();
        if (\Schema::hasTable('purchase_returns')) DB::table('purchase_returns')->delete();
        if (\Schema::hasTable('customer_credit_movements')) DB::table('customer_credit_movements')->delete();
        if (\Schema::hasTable('cashier_shift_closes')) DB::table('cashier_shift_closes')->delete();
        if (\Schema::hasTable('salary_payments')) DB::table('salary_payments')->delete();
        if (\Schema::hasTable('staff_activities')) DB::table('staff_activities')->delete();
        if (\Schema::hasTable('system_notifications')) DB::table('system_notifications')->delete();
        if (\Schema::hasTable('inventory_logs')) DB::table('inventory_logs')->delete();
        if (\Schema::hasTable('system_settings')) DB::table('system_settings')->delete();

        if (\Schema::hasTable('order_items')) DB::table('order_items')->delete();
        if (\Schema::hasTable('orders')) DB::table('orders')->delete();
        if (\Schema::hasTable('purchase_items')) DB::table('purchase_items')->delete();
        if (\Schema::hasTable('purchases')) DB::table('purchases')->delete();
        if (\Schema::hasTable('treasury_transactions')) DB::table('treasury_transactions')->delete();

        if (\Schema::hasTable('category_product')) DB::table('category_product')->delete();
        if (\Schema::hasTable('products')) DB::table('products')->delete();
        if (\Schema::hasTable('categories')) DB::table('categories')->delete();

        // المطلوب من المستخدم: تصفير الموردين والزبائن الآجل بالكامل
        if (\Schema::hasTable('suppliers')) DB::table('suppliers')->delete();
        if (\Schema::hasTable('customers')) DB::table('customers')->delete();

        // تصفير/إعادة إنشاء الخزنة
        if (\Schema::hasTable('treasury')) {
            DB::table('treasury')->delete();
            DB::table('treasury')->insert([
                'pharmacy_id' => 1,
                'balance' => 0,
                'balance_cash' => 0,
                'balance_app' => 0,
                'total_income' => 0,
                'total_expenses' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // الإبقاء فقط على حساب الأدمن (الاسم/كلمة السر كما هي) وحذف كل بقية المستخدمين
        if (\Schema::hasTable('users')) {
            if ($adminToKeep) {
                DB::table('users')->where('id', '!=', $adminToKeep->id)->delete();
            } else {
                // fallback آمن: لا نحذف المستخدمين إذا لم نحدد حساب أدمن للحفاظ على إمكانية الدخول
                Log::warning('resetEverything: skipped users cleanup because no admin user was resolved.');
            }
        }
        if (\Schema::hasTable('personal_access_tokens')) {
            DB::table('personal_access_tokens')->delete();
        }

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => '✅ تم تصفير النظام بالكامل مع الإبقاء على حساب الأدمن فقط',
            'stats_before_reset' => $stats,
            'current_status' => [
                'الطلبات' => 0,
                'المشتريات' => 0,
                'المعاملات' => 0,
                'رصيد_الخزنة' => 0,
                'الأصناف' => 0,
                'الأقسام' => 0,
                'الموردين' => 0,
                'الزبائن_الآجل' => 0,
            ]
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        return response()->json([
            'success' => false,
            'message' => '❌ فشل: ' . $e->getMessage(),
            'hint' => 'استخدم delete() بدلاً من truncate() للحذف'
        ], 500);
    }
}

    /**
     * تصفير بيانات صيدلية واحدة (أدمن/كاشير مرتبطون بنفس pharmacy_id).
     */
    private function resetTenantBulk(Request $request, int $pharmacyId): \Illuminate\Http\JsonResponse
    {
        try {
            $stats = [
                'orders_count' => \App\Models\Order::withoutGlobalScopes()->where('pharmacy_id', $pharmacyId)->count(),
                'transactions_count' => TreasuryTransaction::withoutGlobalScopes()->where('pharmacy_id', $pharmacyId)->count(),
                'purchases_count' => \App\Models\Purchase::withoutGlobalScopes()->where('pharmacy_id', $pharmacyId)->count(),
                'treasury_balance' => Treasury::withoutGlobalScopes()->where('pharmacy_id', $pharmacyId)->sum('balance') ?? 0,
                'suppliers_count' => \App\Models\Supplier::withoutGlobalScopes()->where('pharmacy_id', $pharmacyId)->count(),
                'customers_count' => \App\Models\Customer::withoutGlobalScopes()->where('pharmacy_id', $pharmacyId)->count(),
                'users_count' => \App\Models\User::withoutGlobalScopes()->where('pharmacy_id', $pharmacyId)->count(),
            ];

            DB::beginTransaction();

            $keepId = (int) ($request->user()?->id ?? 0);
            $adminToKeep = DB::table('users')
                ->where('pharmacy_id', $pharmacyId)
                ->where('id', $keepId)
                ->whereIn('role', ['admin', 'super_admin'])
                ->first();
            if (!$adminToKeep) {
                $adminToKeep = DB::table('users')
                    ->where('pharmacy_id', $pharmacyId)
                    ->whereIn('role', ['admin', 'super_admin'])
                    ->orderBy('id')
                    ->first();
            }

            $w = ['pharmacy_id' => $pharmacyId];
            if (\Schema::hasTable('purchase_returns')) {
                DB::table('purchase_returns')->where($w)->delete();
            }
            if (\Schema::hasTable('customer_credit_movements')) {
                DB::table('customer_credit_movements')->where($w)->delete();
            }
            if (\Schema::hasTable('cashier_shift_closes')) {
                DB::table('cashier_shift_closes')->where($w)->delete();
            }
            if (\Schema::hasTable('staff_activities')) {
                DB::table('staff_activities')->where($w)->delete();
            }
            if (\Schema::hasTable('system_notifications')) {
                DB::table('system_notifications')->where($w)->delete();
            }
            if (\Schema::hasTable('system_settings')) {
                DB::table('system_settings')->where($w)->delete();
            }
            if (\Schema::hasTable('order_items')) {
                DB::table('order_items')->where($w)->delete();
            }
            if (\Schema::hasTable('orders')) {
                DB::table('orders')->where($w)->delete();
            }
            if (\Schema::hasTable('purchase_items')) {
                DB::table('purchase_items')->where($w)->delete();
            }
            if (\Schema::hasTable('purchases')) {
                DB::table('purchases')->where($w)->delete();
            }
            if (\Schema::hasTable('treasury_transactions')) {
                DB::table('treasury_transactions')->where($w)->delete();
            }

            $productIds = DB::table('products')->where('pharmacy_id', $pharmacyId)->pluck('id');
            if ($productIds->isNotEmpty() && \Schema::hasTable('category_product')) {
                DB::table('category_product')->whereIn('product_id', $productIds)->delete();
            }
            if (\Schema::hasTable('products')) {
                DB::table('products')->where($w)->delete();
            }
            if (\Schema::hasTable('categories')) {
                DB::table('categories')->where($w)->delete();
            }
            if (\Schema::hasTable('suppliers')) {
                DB::table('suppliers')->where($w)->delete();
            }
            if (\Schema::hasTable('customers')) {
                DB::table('customers')->where($w)->delete();
            }

            if (\Schema::hasTable('treasury')) {
                DB::table('treasury')->where($w)->delete();
                DB::table('treasury')->insert([
                    'pharmacy_id' => $pharmacyId,
                    'balance' => 0,
                    'balance_cash' => 0,
                    'balance_app' => 0,
                    'total_income' => 0,
                    'total_expenses' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            if (\Schema::hasTable('users') && $adminToKeep) {
                $removeIds = DB::table('users')->where('pharmacy_id', $pharmacyId)->where('id', '!=', $adminToKeep->id)->pluck('id');
                if ($removeIds->isNotEmpty() && \Schema::hasTable('personal_access_tokens')) {
                    DB::table('personal_access_tokens')
                        ->whereIn('tokenable_id', $removeIds)
                        ->where('tokenable_type', 'App\\Models\\User')
                        ->delete();
                }
                DB::table('users')->where('pharmacy_id', $pharmacyId)->where('id', '!=', $adminToKeep->id)->delete();
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'تم تصفير بيانات الصيدلية مع الإبقاء على حساب مدير واحد',
                'pharmacy_id' => $pharmacyId,
                'stats_before_reset' => $stats,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => '❌ فشل تصفير الصيدلية: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * حالة المال العام للعاملين (الرواتب)
     */













// تقبيض كل العمال











}