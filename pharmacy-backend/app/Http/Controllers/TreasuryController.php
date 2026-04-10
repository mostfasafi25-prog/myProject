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
use App\Models\Employee;
use App\Models\SalaryPayment;

class TreasuryController extends Controller
{
    /**
     * عرض حالة المال العام
     */
    public function index(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'report_type' => 'nullable|in:summary,employees,expenses,sales,all',
                'start_date' => 'nullable|date',
                'end_date' => 'nullable|date|after_or_equal:start_date',
                'category' => 'nullable|in:purchases,salaries,rent,utilities,maintenance,other,sales',
                'department' => 'nullable|string',
                'customer_id' => 'nullable|exists:customers,id',
                'employee_id' => 'nullable|exists:customers,id',
                'payment_status' => 'nullable|in:paid,unpaid,partially_paid',
                'status' => 'nullable|in:pending,paid,cancelled'
            ]);
            
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'خطأ في التحقق من البيانات',
                    'errors' => $validator->errors()
                ], 422);
            }
            
            $treasury = Treasury::getActive();
            $reportType = $request->get('report_type', 'summary');
            
            // التقرير الأساسي (مثل الـ Dashboard)
            if ($reportType === 'summary' || $reportType === 'all') {
                // إحصائيات الموظفين
                $employeesStats = $this->getEmployeesStats();
                
                $stats = [
                    'today_income' => TreasuryTransaction::whereDate('created_at', today())
                        ->where('type', 'income')
                        ->sum('amount'),
                    'today_expenses' => TreasuryTransaction::whereDate('created_at', today())
                        ->where('type', 'expense')
                        ->sum('amount'),
                    'today_sales' => \App\Models\Order::whereDate('created_at', today())
                        ->sum('total'),
                    'monthly_income' => TreasuryTransaction::whereMonth('created_at', now()->month)
                        ->where('type', 'income')
                        ->sum('amount'),
                         'expenses_weekly' => TreasuryTransaction::whereBetween('created_at', [
            now()->startOfWeek(), 
            now()->endOfWeek()
        ])
        ->where('type', 'expense')
        ->sum('amount'),
                    'monthly_expenses' => TreasuryTransaction::whereMonth('created_at', now()->month)
                        ->where('type', 'expense')
                        ->sum('amount'),
                    'total_transactions' => TreasuryTransaction::count(),
                    'total_orders' => \App\Models\Order::count(),
                    'total_order_value' => \App\Models\Order::sum('total'),
                    'pending_payments' => \App\Models\Order::where('due_amount', '>', 0)
                        ->sum('due_amount'),
                    'employees_stats' => $employeesStats
                ];
            }
            
            // إحصائيات الموظفين (تقرير مفصل)
            if ($reportType === 'employees' || $reportType === 'all') {
                $employeesReport = $this->getEmployeesStatus($request);
            }
            
            // إحصائيات المصروفات (تقرير مفصل)
            if ($reportType === 'expenses' || $reportType === 'all') {
                $expensesReport = $this->getExpensesStatus($request);
            }
            
            // إحصائيات المبيعات (تقرير مفصل)
            if ($reportType === 'sales' || $reportType === 'all') {
                $salesReport = $this->getSalesStatus($request);
            }
            
            // بناء الاستجابة حسب نوع التقرير
            $response = [];
            
            if ($reportType === 'summary') {
                $response = [
                    'treasury' => $treasury,
                    'stats' => $stats,
                    'report_type' => 'summary',
                    'generated_at' => now()->format('Y-m-d H:i:s')
                ];
            }
            elseif ($reportType === 'employees') {
                $response = [
                    'report_type' => 'employees',
                    'data' => isset($employeesReport) ? $employeesReport : null
                ];
            }
            elseif ($reportType === 'expenses') {
                $response = [
                    'report_type' => 'expenses',
                    'data' => isset($expensesReport) ? $expensesReport : null
                ];
            }
            elseif ($reportType === 'sales') {
                $response = [
                    'report_type' => 'sales',
                    'data' => isset($salesReport) ? $salesReport : null
                ];
            }
            elseif ($reportType === 'all') {
                $response = [
                    'treasury' => $treasury,
                    'summary_stats' => $stats,
                    'employees_report' => isset($employeesReport) ? $employeesReport : null,
                    'expenses_report' => isset($expensesReport) ? $expensesReport : null,
                    'sales_report' => isset($salesReport) ? $salesReport : null,
                    'report_type' => 'all',
                    'filters_applied' => $request->except(['report_type']),
                    'generated_at' => now()->format('Y-m-d H:i:s')
                ];
            }
            
            return response()->json([
                'success' => true,
                'data' => $response
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Error in TreasuryController@index', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request' => $request->all()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب بيانات الخزنة',
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
        'transaction_date' => 'nullable|date'
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
        $treasury = Treasury::first();
        if (!$treasury) {
            $treasury = Treasury::create([
                'balance' => 0,
                'total_income' => 0,
                'total_expenses' => 0
            ]);
        }
        
        $oldBalance = $treasury->balance;
        
        // تحديث رصيد الخزنة فقط بدون تعديل total_income
        $treasury->balance += $request->amount;
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
            'payment_method' => 'cash',
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
        'transaction_date' => 'nullable|date'
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
        $treasury = Treasury::first();
        if (!$treasury) {
            return response()->json([
                'success' => false,
                'message' => 'لا توجد خزنة'
            ], 404);
        }
        
        $oldBalance = $treasury->balance;
        
        // التحقق من الرصيد الكافي
        if ($treasury->balance < $request->amount) {
            return response()->json([
                'success' => false,
                'message' => 'الرصيد غير كافي للسحب',
                'current_balance' => $treasury->balance,
                'required_amount' => $request->amount
            ], 400);
        }
        
        // تحديث رصيد الخزنة فقط بدون تعديل total_expenses
        $treasury->balance -= $request->amount;
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
            'payment_method' => 'cash',
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



// دفع تكلفة الوجبة من الخزنة
public function payMealCost(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'meal_name' => 'required|string|max:255',
            'total_cost' => 'required|numeric|min:0.01',
            'meal_id' => 'nullable|integer',
            'notes' => 'nullable|string|max:500'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        DB::beginTransaction();
        
        // جلب الخزنة
        $treasury = Treasury::first();
        if (!$treasury) {
            return response()->json([
                'success' => false,
                'message' => 'لا توجد خزنة في النظام'
            ], 404);
        }
        
        $oldBalance = $treasury->balance;
        $cost = $request->total_cost;
        
        // التحقق من الرصيد الكافي
        if ($treasury->balance < $cost) {
            return response()->json([
                'success' => false,
                'message' => 'رصيد الخزنة غير كافي',
                'details' => [
                    'المطلوب' => number_format($cost, 2),
                    'المتوفر' => number_format($treasury->balance, 2),
                    'النقص' => number_format($cost - $treasury->balance, 2)
                ]
            ], 400);
        }
        
        // خصم المبلغ من الخزنة
        $treasury->balance -= $cost;
        $treasury->total_expenses += $cost;
        $treasury->save();
        
        // تسجيل المعاملة
        $transaction = TreasuryTransaction::create([
            'treasury_id' => $treasury->id,
            'type' => 'expense',
            'amount' => $cost,
            'description' => "تكلفة وجبة: {$request->meal_name}" . 
                            ($request->notes ? " - {$request->notes}" : ''),
            'category' => 'meal_preparation',
            'transaction_date' => now(),
            'transaction_number' => 'MEAL-' . time(),
            'status' => 'completed',
            'payment_method' => 'cash',
            'created_by' => auth()->id() ?? 1,
            'reference_type' => 'meal_preparation',
            'reference_id' => $request->meal_id ?? 0,
            'metadata' => json_encode([
                'meal_name' => $request->meal_name,
                'meal_id' => $request->meal_id,
                'notes' => $request->notes
            ])
        ]);
        
        DB::commit();
        
        return response()->json([
            'success' => true,
            'message' => 'تم خصم تكلفة الوجبة من الخزنة',
            'data' => [
                'meal' => [
                    'name' => $request->meal_name,
                    'cost' => $cost
                ],
                'treasury' => [
                    'الرصيد_السابق' => number_format($oldBalance, 2),
                    'الرصيد_الجديد' => number_format($treasury->balance, 2),
                    'المبلغ_المخصوم' => number_format($cost, 2)
                ],
                'transaction' => [
                    'id' => $transaction->id,
                    'transaction_number' => $transaction->transaction_number,
                    'date' => $transaction->transaction_date->format('Y-m-d H:i:s')
                ]
            ]
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        
        \Log::error('Error in payMealCost', [
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'request' => $request->all()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'فشل في خصم تكلفة الوجبة: ' . $e->getMessage()
        ], 500);
    }
}
/* تقرير تقبض العاملين */
/**
 * تقرير تقبض العاملين
 */
public function getEmployeePaymentsReport(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'employee_id' => 'nullable|exists:customers,id',
            'department' => 'nullable|string',
            'month' => 'nullable|date_format:Y-m',
            'payment_method' => 'nullable|in:cash,bank_transfer,check',
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        // استعلام معاملات الرواتب
        $paymentsQuery = TreasuryTransaction::with(['employee:id,name,department,phone'])
            ->where('type', 'expense')
            ->where('category', 'salaries');
        
        // تطبيق الفلاتر
        if ($request->start_date) {
            $paymentsQuery->whereDate('transaction_date', '>=', $request->start_date);
        }
        
        if ($request->end_date) {
            $paymentsQuery->whereDate('transaction_date', '<=', $request->end_date);
        }
        
        if ($request->employee_id) {
            $paymentsQuery->where('employee_id', $request->employee_id);
        }
        
        if ($request->department) {
            $paymentsQuery->whereHas('employee', function($query) use ($request) {
                $query->where('department', $request->department);
            });
        }
        
        if ($request->month) {
            $paymentsQuery->whereMonth('transaction_date', Carbon::parse($request->month)->month)
                ->whereYear('transaction_date', Carbon::parse($request->month)->year);
        }
        
        if ($request->payment_method) {
            $paymentsQuery->where('payment_method', $request->payment_method);
        }
        
        // الحصول على البيانات
        $payments = $paymentsQuery->orderBy('transaction_date', 'desc')->get();
        
        // التحليل الشامل
        $summary = [
            'total_payments' => $payments->sum('amount'),
            'payments_count' => $payments->count(),
            'employees_count' => $payments->pluck('employee_id')->unique()->count(),
            'avg_payment' => $payments->count() > 0 ? $payments->sum('amount') / $payments->count() : 0,
        ];
        
        // التحليل حسب الشهر
        $monthlyAnalysis = [];
        $paymentsByMonth = $payments->groupBy(function($payment) {
            return Carbon::parse($payment->transaction_date)->format('Y-m');
        });
        
        foreach ($paymentsByMonth as $month => $monthPayments) {
            $monthlyAnalysis[] = [
                'month' => $month,
                'month_name' => Carbon::parse($month)->translatedFormat('F Y'),
                'total_payments' => $monthPayments->sum('amount'),
                'payments_count' => $monthPayments->count(),
                'employees_count' => $monthPayments->pluck('employee_id')->unique()->count(),
            ];
        }
        
        // التحليل حسب الموظف
        $employeeAnalysis = [];
        $paymentsByEmployee = $payments->groupBy('employee_id');
        
        foreach ($paymentsByEmployee as $employeeId => $employeePayments) {
            $employee = $employeePayments->first()->employee ?? null;
            if ($employee) {
                $employeeAnalysis[] = [
                    'employee_id' => $employeeId,
                    'employee_name' => $employee->name,
                    'department' => $employee->department,
                    'total_received' => $employeePayments->sum('amount'),
                    'payments_count' => $employeePayments->count(),
                    'last_payment_date' => $employeePayments->sortByDesc('transaction_date')->first()->transaction_date ?? null,
                ];
            }
        }
        
        // فرز الموظفين حسب إجمالي ما تقبضوا
        usort($employeeAnalysis, function($a, $b) {
            return $b['total_received'] <=> $a['total_received'];
        });
        
        // التفاصيل التفصيلية
        $detailedPayments = $payments->map(function($payment) {
            return [
                'id' => $payment->id,
                'transaction_date' => $payment->transaction_date,
                'transaction_number' => $payment->transaction_number,
                'amount' => $payment->amount,
                'description' => $payment->description,
                'payment_method' => $payment->payment_method,
                'employee_id' => $payment->employee_id,
                'employee_name' => $payment->employee ? $payment->employee->name : 'غير معروف',
                'employee_department' => $payment->employee ? $payment->employee->department : 'غير معروف',
                'notes' => $payment->notes,
                'created_by' => $payment->created_by,
                'created_at' => $payment->created_at,
            ];
        });
        
        // إحصائيات إضافية
        $additionalStats = [
            'highest_payment' => $payments->max('amount'),
            'lowest_payment' => $payments->min('amount'),
            'most_frequent_payment_day' => $payments->groupBy(function($p) {
                return Carbon::parse($p->transaction_date)->format('Y-m-d');
            })->sortByDesc->count()->keys()->first() ?? null,
        ];
        
        $response = [
            'success' => true,
            'data' => [
                'summary' => $summary,
                'monthly_analysis' => $monthlyAnalysis,
                'employee_analysis' => $employeeAnalysis,
                'detailed_payments' => $detailedPayments,
                'additional_stats' => $additionalStats,
                'filters' => $request->all(),
                'report_date' => now()->format('Y-m-d H:i:s'),
                'report_range' => [
                    'start_date' => $request->start_date,
                    'end_date' => $request->end_date,
                ],
            ],
        ];
        
        return response()->json($response);
        
    } catch (\Exception $e) {
        Log::error('Error in getEmployeePaymentsReport', [
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في إنشاء التقرير',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}
/**
 * تصحيح رصيد الخزنة يدويًا (تحديث مباشر)
 */
public function manualBalanceUpdate(Request $request)
{
    $validator = Validator::make($request->all(), [
        'new_balance' => 'required|numeric|min:0',
        'reason' => 'required|string|max:500',
        'transaction_date' => 'nullable|date'
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
        $treasury = Treasury::first();
        if (!$treasury) {
            $treasury = Treasury::create([
                'balance' => 0,
                'total_income' => 0,
                'total_expenses' => 0
            ]);
        }
        
        $oldBalance = $treasury->balance;
        $newBalance = $request->new_balance;
        $difference = $newBalance - $oldBalance;
        
        // تحديث رصيد الخزنة فقط بدون تعديل الإحصائيات
        $treasury->balance = $newBalance;
        $treasury->save();
        
        // تحديد نوع المعاملة
        $type = $difference >= 0 ? 'manual_adjustment_plus' : 'manual_adjustment_minus';
        
        // تسجيل المعاملة
        $transaction = TreasuryTransaction::create([
            'treasury_id' => $treasury->id,
            'type' => $type,
            'amount' => abs($difference),
            'description' => $request->reason . " (تصحيح رصيد: {$oldBalance} → {$newBalance})",
            'category' => 'balance_adjustment',
            'transaction_date' => $request->transaction_date ?? now(),
            'transaction_number' => 'ADJUST-' . time(),
            'status' => 'completed',
            'payment_method' => 'cash',
            'created_by' => auth()->id() ?? 1,
            'notes' => 'تصحيح يدوي للرصيد'
        ]);
        
        DB::commit();

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث رصيد الخزنة يدويًا',
            'data' => [
                'old_balance' => $oldBalance,
                'new_balance' => $newBalance,
                'difference' => $difference,
                'reason' => $request->reason,
                'transaction_id' => $transaction->id,
                'note' => '⚠️ تم تحديث الرصيد فقط دون تعديل إجمالي الدخل أو المصروفات'
            ]
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء التحديث اليدوي',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
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
        // تسجيل الإحصائيات
        $stats = [
            'orders_count' => \App\Models\Order::count(),
            'transactions_count' => TreasuryTransaction::count(),
            'purchases_count' => \App\Models\Purchase::count(),
            'treasury_balance' => Treasury::sum('balance') ?? 0
        ];

        DB::beginTransaction();

        // 1. حذف عناصر الطلبات أولاً
        \App\Models\OrderItem::query()->delete();
        
        // 2. حذف الطلبات
        \App\Models\Order::query()->delete();
        
        // 3. حذف عناصر المشتريات
        \App\Models\PurchaseItem::query()->delete();
        
        // 4. حذف المشتريات
        \App\Models\Purchase::query()->delete();
        
        // 5. حذف معاملات الخزنة
        TreasuryTransaction::query()->delete();

        // 6. تصفير الخزنة
        $treasury = Treasury::first();
        if ($treasury) {
            $treasury->balance = 0;
            $treasury->total_income = 0;
            $treasury->total_expenses = 0;
            $treasury->save();
        }

        // 7. تصفير المنتجات
        \App\Models\Product::query()->update(['stock' => 0]);

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => '✅ تم تصفير النظام بالكامل',
            'stats_before_reset' => $stats,
            'current_status' => [
                'الطلبات' => 0,
                'المشتريات' => 0,
                'المعاملات' => 0,
                'رصيد_الخزنة' => 0,
                'كمية_المنتجات' => 'جميعها صفر'
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
 * إضافة مبلغ إلى الخزنة (سحب/إيداع بسيط)
 */
public function deposit(Request $request)
{
    $validator = Validator::make($request->all(), [
        'amount' => 'required|numeric|min:0.01',
        'description' => 'required|string|max:500',
        'type' => 'required|in:deposit,withdraw' // deposit: إضافة, withdraw: سحب
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
        $treasury = Treasury::first();
        if (!$treasury) {
            $treasury = Treasury::create([
                'balance' => 0,
                'total_income' => 0,
                'total_expenses' => 0
            ]);
        }
        
        $oldBalance = $treasury->balance;
        
        // تحديث الرصيد حسب النوع
        if ($request->type === 'deposit') {
            $treasury->balance += $request->amount;
            $treasury->total_income += $request->amount;
            $message = 'تم إضافة المبلغ إلى الخزنة';
        } else {
            // تحقق إذا كان الرصيد كافي للسحب
            if ($treasury->balance < $request->amount) {
                return response()->json([
                    'success' => false,
                    'message' => 'الرصيد غير كافي للسحب',
                    'current_balance' => $treasury->balance,
                    'required_amount' => $request->amount
                ], 400);
            }
            
            $treasury->balance -= $request->amount;
            $treasury->total_expenses += $request->amount;
            $message = 'تم سحب المبلغ من الخزنة';
        }
        
        $treasury->save();
        
        // ⭐ لا نحتاج لتسجيل معاملة في جدول transactions (اختياري)
        // إذا أردت تسجيلها، أضف الكود هنا
        
        DB::commit();

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => [
                'old_balance' => $oldBalance,
                'new_balance' => $treasury->balance,
                'amount' => $request->amount,
                'type' => $request->type === 'deposit' ? 'إيداع' : 'سحب',
                'description' => $request->description,
                'transaction_date' => now()->format('Y-m-d H:i:s')
            ]
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء العملية',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}
    
    /**
     * حالة المال العام للعاملين (الرواتب)
     */
    public function getEmployeesStatus(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'start_date' => 'nullable|date',
                'end_date' => 'nullable|date|after_or_equal:start_date',
                'department' => 'nullable|string',
                'shift' => 'nullable|in:صباحي,مسائي'
            ]);
            
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'خطأ في التحقق من البيانات',
                    'errors' => $validator->errors()
                ], 422);
            }
            
            // جلب جميع الموظفين مع الفلترة
            $query = Customer::query();
            
            if ($request->has('department')) {
                $query->where('department', $request->department);
            }
            
            if ($request->has('shift')) {
                $query->where('shift', $request->shift);
            }
            
            $employees = $query->orderBy('department')->orderBy('name')->get();
            
            // جلب معاملات الرواتب من TreasuryTransaction
            $salaryTransactionsQuery = \App\Models\TreasuryTransaction::where('category', 'salaries')
                ->where('type', 'expense');
            
            if ($request->start_date) {
                $salaryTransactionsQuery->whereDate('created_at', '>=', $request->start_date);
            }
            
            if ($request->end_date) {
                $salaryTransactionsQuery->whereDate('created_at', '<=', $request->end_date);
            }
            
            $salaryTransactions = $salaryTransactionsQuery->get();
            
            // جلب الخزنة الحالية
            $treasury = Treasury::getActive();
            
            // تحليل البيانات
            $totalMonthlySalaries = $employees->sum('salary');
            $totalEmployees = $employees->count();
            
            // حساب المدفوعات
            $totalSalariesPaid = $salaryTransactions->sum('amount');
            
            // إحصائيات حسب القسم
            $departmentStats = $employees->groupBy('department')->map(function ($deptEmployees, $deptName) use ($salaryTransactions, $request) {
                $deptSalaryTotal = $deptEmployees->sum('salary');
                
                // حساب المدفوعات لهذا القسم (افتراضي من المعاملات)
                $deptPaid = $salaryTransactions->filter(function ($transaction) use ($deptName) {
                    return stripos($transaction->description, $deptName) !== false || 
                           stripos($transaction->description, 'رواتب') !== false;
                })->sum('amount');
                
                return [
                    'department_name' => $deptName,
                    'employee_count' => $deptEmployees->count(),
                    'total_salary' => $deptSalaryTotal,
                    'total_paid' => $deptPaid,
                    'remaining_due' => $deptSalaryTotal - $deptPaid,
                    'average_salary' => $deptEmployees->avg('salary')
                ];
            });
            
            // إحصائيات حسب الشهر
            $monthlySalaryStats = [];
            for ($i = 0; $i < 6; $i++) {
                $month = now()->subMonths($i);
                $monthStart = $month->copy()->startOfMonth();
                $monthEnd = $month->copy()->endOfMonth();
                
                $monthPaid = $salaryTransactions->filter(function ($transaction) use ($monthStart, $monthEnd) {
                    $transactionDate = \Carbon\Carbon::parse($transaction->created_at);
                    return $transactionDate->between($monthStart, $monthEnd);
                })->sum('amount');
                
                $monthlySalaryStats[] = [
                    'month' => $month->format('Y-m'),
                    'month_name' => $month->translatedFormat('F Y'),
                    'projected_salary' => $totalMonthlySalaries,
                    'actual_paid' => $monthPaid,
                    'payment_rate' => $totalMonthlySalaries > 0 ? ($monthPaid / $totalMonthlySalaries) * 100 : 0,
                    'is_paid_fully' => $monthPaid >= $totalMonthlySalaries
                ];
            }
            
            // الموظفين مع تفاصيل رواتبهم
            $employeesWithSalaryDetails = $employees->map(function ($employee) use ($salaryTransactions) {
                // حساب المدفوعات لهذا الموظف (يمكن تحسينه بربط مباشر)
                $employeePaid = $salaryTransactions->filter(function ($transaction) use ($employee) {
                    return stripos($transaction->description, $employee->name) !== false ||
                           stripos($transaction->description, 'رواتب') !== false;
                })->sum('amount');
                
                return [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'department' => $employee->department,
                    'shift' => $employee->shift,
                    'monthly_salary' => $employee->salary,
                    'total_paid' => $employeePaid,
                    'remaining_due' => $employee->salary - $employeePaid,
                    'is_salary_paid' => $employeePaid >= $employee->salary,
                    'phone' => $employee->phone,
                    'created_at' => $employee->created_at
                ];
            });
            
            // تحليل التكلفة
            $salaryAnalysis = [
                'total_annual_cost' => $totalMonthlySalaries * 12,
                'salary_to_treasury_ratio' => $treasury->balance > 0 ? ($totalMonthlySalaries / $treasury->balance) * 100 : 0,
                'can_afford_salaries' => $treasury->balance >= $totalMonthlySalaries,
                'months_can_afford' => $totalMonthlySalaries > 0 ? floor($treasury->balance / $totalMonthlySalaries) : 0
            ];
            
            $response = [
                'summary' => [
                    'total_employees' => $totalEmployees,
                    'total_monthly_salaries' => $totalMonthlySalaries,
                    'total_paid_salaries' => $totalSalariesPaid,
                    'remaining_salary_liability' => $totalMonthlySalaries - $totalSalariesPaid,
                    'average_salary' => $totalEmployees > 0 ? $totalMonthlySalaries / $totalEmployees : 0,
                    'salary_payment_rate' => $totalMonthlySalaries > 0 ? ($totalSalariesPaid / $totalMonthlySalaries) * 100 : 0,
                    'treasury_balance' => $treasury->balance,
                    'balance_after_salaries' => $treasury->balance - $totalMonthlySalaries
                ],
                'department_analysis' => $departmentStats->values(),
                'monthly_trend' => $monthlySalaryStats,
                'employees' => $employeesWithSalaryDetails,
                'salary_analysis' => $salaryAnalysis,
                'filters' => [
                    'start_date' => $request->start_date,
                    'end_date' => $request->end_date,
                    'department' => $request->department,
                    'shift' => $request->shift
                ],
                'report_date' => now()->format('Y-m-d H:i:s')
            ];
            
            return response()->json([
                'success' => true,
                'data' => $response
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب حالة المال العام للعاملين',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }




public function resetIncome(Request $request)
{
    try {
        // 1. جلب الخزنة
        $treasury = Treasury::first();
        
        if (!$treasury) {
            return response()->json([
                'success' => false,
                'message' => 'لم يتم العثور على الخزنة'
            ], 404);
        }

        // 2. حفظ قيمة الدخل قبل التصفير
        $oldIncome = $treasury->total_income;
        
        // 3. تصفير إجمالي الدخل فقط (دون التأثير على الرصيد)
        $treasury->total_income = 0;
        $treasury->save();

        // 4. تصفير معاملات الدخل (اختياري)
        // يمكنك أيضاً تصفير سجلات الدخل في treasury_transactions
        // TreasuryTransaction::where('type', 'income')->update(['amount' => 0]);

        return response()->json([
            'success' => true,
            'message' => 'تم تصفير إجمالي الدخل بنجاح',
            'data' => [
                'old_income' => $oldIncome,
                'new_income' => 0,
                'treasury_balance' => $treasury->balance, // الرصيد يبقى كما هو
                'reset_at' => now()->format('Y-m-d H:i:s')
            ]
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ: ' . $e->getMessage()
        ], 500);
    }
}




    /**
 * تصفير إجمالي المصروفات (إرجاع المبالغ المدفوعة للمشتريات)
 */
public function resetExpenses(Request $request)
{
    try {
        DB::beginTransaction();
        
        // 1. جلب الخزنة
        $treasury = Treasury::first();
        if (!$treasury) {
            return response()->json([
                'success' => false,
                'message' => 'لا توجد خزنة في النظام'
            ], 404);
        }
        
        // 2. جلب جميع المصروفات
        $expensesQuery = TreasuryTransaction::where('type', 'expense');
        $totalExpenses = $expensesQuery->sum('amount');
        $expensesCount = $expensesQuery->count();
        
        // 3. جلب جميع الدخل
        $incomeQuery = TreasuryTransaction::where('type', 'income');
        $totalIncome = $incomeQuery->sum('amount');
        $incomeCount = $incomeQuery->count();
        
        // 4. حفظ القيم القديمة للإرجاع
        $oldBalance = $treasury->balance;
        $oldTotalExpenses = $treasury->total_expenses;
        $oldTotalIncome = $treasury->total_income;
        
        // 5. ⭐ تصفير فقط بدون إرجاع أموال للخزنة
        // الخزنة تبقى كما هي (لا تغيير في الرصيد)
        // نغير فقط إجمالي المصروفات والدخل
        
        $treasury->total_expenses = 0;
        $treasury->total_income = 0;
        $treasury->save();
        
        // 6. ⭐ تصفير سجلات المعاملات (حذف كل السجلات)
        TreasuryTransaction::query()->delete();
        
        // 7. تسجيل معاملة واحدة للتصفير
        TreasuryTransaction::create([
            'treasury_id' => $treasury->id,
            'type' => 'expense',
            'amount' => 0,
            'description' => 'تصفير كامل لكل السجلات',
            'category' => 'other_expense',
            'transaction_date' => now(),
            'transaction_number' => 'RESET-' . time(),
            'status' => 'completed',
            'payment_method' => 'cash',
            'created_by' => auth()->id() ?? 1,
            'metadata' => json_encode([
                'operation' => 'تصفير كامل',
                'before_reset' => [
                    'balance' => $oldBalance,
                    'total_expenses' => $oldTotalExpenses,
                    'total_income' => $oldTotalIncome,
                    'transactions_count' => $expensesCount + $incomeCount,
                    'expenses_total' => $totalExpenses,
                    'income_total' => $totalIncome
                ],
                'note' => 'تم التصفير فقط دون تغيير الرصيد'
            ])
        ]);
        
        DB::commit();
        
        return response()->json([
            'success' => true,
            'message' => '✅ تم تصفير كل سجلات المصروفات والدخل',
            'data' => [
                'قبل_التصفير' => [
                    'رصيد_الخزنة' => number_format($oldBalance, 2),
                    'إجمالي_المصروفات' => number_format($oldTotalExpenses, 2),
                    'إجمالي_الدخل' => number_format($oldTotalIncome, 2),
                    'عدد_المعاملات' => $expensesCount + $incomeCount,
                    'مجموع_المصروفات_الفعلية' => number_format($totalExpenses, 2),
                    'مجموع_الدخل_الفعلي' => number_format($totalIncome, 2)
                ],
                'بعد_التصفير' => [
                    'رصيد_الخزنة' => number_format($treasury->balance, 2),
                    'إجمالي_المصروفات' => 0,
                    'إجمالي_الدخل' => 0,
                    'عدد_المعاملات' => 1,
                    'ملاحظة' => 'تم حذف كل السجلات وإنشاء سجل تصفير واحد فقط'
                ],
                'ملاحظات' => [
                    'الرصيد_لم_يتغير' => '✓',
                    'السجلات_محذوفة' => '✓',
                    'الإحصائيات_مصفرة' => '✓',
                    'المعاملات_القديمة' => 'محذوفة بالكامل'
                ]
            ]
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        
        \Log::error('خطأ في تصفير المصروفات', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => '❌ فشل في التصفير: ' . $e->getMessage()
        ], 500);
    }
}



    


/**
 * دفع راتب حسب نوع الدفع (يومي/شهري)
 */
public function paySalaryByType(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'employee_id' => 'required|exists:customers,id',
            'date' => 'required|date', // تاريخ اليوم للدفع
            'days_worked' => 'nullable|integer|min:1', // عدد الأيام للدفع اليومي
            'notes' => 'nullable|string|max:500'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        $employee = Customer::find($request->employee_id);
        $date = Carbon::parse($request->date);
        
        DB::beginTransaction();
        
        // حساب المبلغ حسب نوع الدفع
        if ($employee->payment_type === 'daily') {
            // الدفع اليومي
            $days = $request->days_worked ?? 1;
            $amount = $employee->daily_rate * $days;
            $description = "راتب يومي ({$days} يوم) - {$employee->name}";
            $month = $date->format('Y-m-d'); // تاريخ محدد بدلاً من شهر
        } else {
            // الدفع الشهري
            $amount = $employee->salary;
            $description = "راتب شهري - {$employee->name} - {$date->format('F Y')}";
            $month = $date->format('Y-m');
        }
        
        // جلب الخزنة والتحقق من الرصيد
        $treasury = Treasury::first();
        
        if (!$treasury) {
            return response()->json([
                'success' => false,
                'message' => 'لا توجد خزنة في النظام'
            ], 404);
        }
        
        if ($treasury->balance < $amount) {
            return response()->json([
                'success' => false,
                'message' => 'رصيد غير كافي',
                'details' => [
                    'المطلوب' => number_format($amount, 2),
                    'المتوفر' => number_format($treasury->balance, 2)
                ]
            ], 400);
        }
        
        // خصم المبلغ من الخزنة
        $oldBalance = $treasury->balance;
        $treasury->balance -= $amount;
        $treasury->total_expenses += $amount;
        $treasury->save();
        
        // تسجيل المعاملة
        TreasuryTransaction::create([
            'treasury_id' => $treasury->id,
            'type' => 'expense',
            'amount' => $amount,
            'description' => $description . ($request->notes ? " - {$request->notes}" : ''),
            'category' => 'salaries',
            'transaction_date' => now(),
            'transaction_number' => 'SAL-' . ($employee->payment_type === 'daily' ? 'DAY-' : 'MONTH-') . time(),
            'status' => 'completed',
            'payment_method' => 'cash',
            'created_by' => auth()->id() ?? 1,
            'employee_id' => $employee->id,
            'metadata' => json_encode([
                'payment_type' => $employee->payment_type,
                'days_worked' => $employee->payment_type === 'daily' ? ($request->days_worked ?? 1) : null,
                'month' => $month,
                'employee_salary' => $employee->salary,
                'daily_rate' => $employee->daily_rate,
                'note' => $request->notes
            ])
        ]);
        
        DB::commit();
        
        return response()->json([
            'success' => true,
            'message' => 'تم دفع الراتب بنجاح',
            'data' => [
                'employee' => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'payment_type' => $employee->payment_type,
                    'department' => $employee->department
                ],
                'payment' => [
                    'amount' => $amount,
                    'payment_type' => $employee->payment_type,
                    'date' => $date->format('Y-m-d'),
                    'month' => $month,
                    'days_worked' => $employee->payment_type === 'daily' ? ($request->days_worked ?? 1) : null,
                    'description' => $description
                ],
                'treasury' => [
                    'old_balance' => $oldBalance,
                    'new_balance' => $treasury->balance,
                    'amount_paid' => $amount
                ]
            ]
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        
        return response()->json([
            'success' => false,
            'message' => 'فشل في عملية الدفع: ' . $e->getMessage()
        ], 500);
    }
}


    /**
     * حالة المال العام للمصروفات
     */
    public function getExpensesStatus(Request $request)
    {
        \Log::info('========== START getExpensesStatus ==========');
        
        try {
            \Log::info('الطلب المستلم:', [
                'params' => $request->all(),
                'method' => $request->method(),
                'url' => $request->fullUrl()
            ]);

            $validator = Validator::make($request->all(), [
                'start_date' => 'nullable|date',
                'end_date' => 'nullable|date|after_or_equal:start_date',
                'category' => 'nullable|in:rent,utilities,maintenance,other,salaries,purchases',
                'source_type' => 'nullable|in:order,product,cash'

            ]);
            
            if ($validator->fails()) {
                \Log::warning('فشل التحقق من البيانات', [
                    'errors' => $validator->errors()->toArray()
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'خطأ في التحقق من البيانات',
                    'errors' => $validator->errors()
                ], 422);
            }
            
            \Log::info('بدأ إنشاء الاستعلام...');
            
            // استعلام المصروفات
            $expensesQuery = \App\Models\TreasuryTransaction::where('type', 'expense');
            
            \Log::info('استعلام المصروفات تم إنشاؤه', [
                'model_class' => get_class($expensesQuery->getModel()),
                'table_name' => $expensesQuery->getModel()->getTable()
            ]);
            
            // تحميل العلاقات
            try {
                \Log::info('محاولة تحميل العلاقات...');
                
                $model = new \App\Models\TreasuryTransaction();
                $relations = ['order', 'product'];
                
                foreach ($relations as $relation) {
                    if (method_exists($model, $relation)) {
                        \Log::info("✅ العلاقة {$relation} موجودة في النموذج");
                    } else {
                        \Log::error("❌ العلاقة {$relation} غير موجودة في النموذج!");
                    }
                }
                
                $expensesQuery->with([
                    'order:id,order_number,total,customer_id',
                    'product:id,name,code'
                ]);
                
                \Log::info('✅ العلاقات تم تحميلها بنجاح');
                
            } catch (\Exception $e) {
                \Log::error('❌ فشل تحميل العلاقات:', [
                    'message' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'trace' => $e->getTraceAsString()
                ]);
                
                // إذا فشلت العلاقة، استمر بدونها
                $expensesQuery->with([
                    'order:id,order_number,total,customer_id',
                    'product:id,name,code'
                ]);
            }
            
            // تطبيق الفلاتر
            \Log::info('تطبيق الفلاتر...', [
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'category' => $request->category,
                'source_type' => $request->source_type
            ]);
            
            if ($request->start_date) {
                $expensesQuery->whereDate('transaction_date', '>=', $request->start_date);
            }
            
            if ($request->end_date) {
                $expensesQuery->whereDate('transaction_date', '<=', $request->end_date);
            }
            
            if ($request->category) {
                $expensesQuery->where('category', $request->category);
            }
            
            if ($request->source_type) {
                if ($request->source_type === 'order') {
                    $expensesQuery->whereNotNull('order_id');
                } elseif ($request->source_type === 'product') {
                    $expensesQuery->whereNotNull('product_id');
                } elseif ($request->source_type === 'cash') {
                    $expensesQuery->whereNull('order_id')
                        ->whereNull('product_id');
                }
            }
            
            \Log::info('جلب البيانات...');
            
            $expenses = $expensesQuery->orderBy('transaction_date', 'desc')->get();
            \Log::info('✅ عدد السجلات المسترجعة: ' . $expenses->count());
            
            $totalExpenses = $expenses->sum('amount');
            \Log::info('✅ إجمالي المصروفات: ' . $totalExpenses);
            
            // التحليل حسب الفئة
            $categoryAnalysis = $expenses->groupBy('category')->map(function ($items, $category) {
                return [
                    'category' => $category,
                    'count' => $items->count(),
                    'total' => $items->sum('amount'),
                    'percentage' => $items->sum('amount') > 0 ? 
                        ($items->sum('amount') / $items->sum('amount')) * 100 : 0
                ];
            })->values();
            
            // التحليل حسب المصدر
            $sourceAnalysis = [
                'order_related' => [
                    'count' => $expenses->whereNotNull('order_id')->count(),
                    'total' => $expenses->whereNotNull('order_id')->sum('amount'),
                    'orders_count' => $expenses->whereNotNull('order_id')->pluck('order_id')->unique()->count()
                ],
                'product_related' => [
                    'count' => $expenses->whereNotNull('product_id')->count(),
                    'total' => $expenses->whereNotNull('product_id')->sum('amount'),
                    'products_count' => $expenses->whereNotNull('product_id')->pluck('product_id')->unique()->count()
                ],
                'cash_expenses' => [
                    'count' => $expenses->whereNull('order_id')
                        ->whereNull('product_id')->count(),
                    'total' => $expenses->whereNull('order_id')
                        ->whereNull('product_id')->sum('amount')
                ]
            ];
            
            // تحليل المصروفات الشهري
            $monthlyTrend = [];
            for ($i = 0; $i < 6; $i++) {
                $month = now()->subMonths($i);
                $monthStart = $month->copy()->startOfMonth();
                $monthEnd = $month->copy()->endOfMonth();
                
                $monthExpenses = $expenses->filter(function ($expense) use ($monthStart, $monthEnd) {
                    $expenseDate = \Carbon\Carbon::parse($expense->transaction_date);
                    return $expenseDate->between($monthStart, $monthEnd);
                });
                
                $monthlyTrend[] = [
                    'month' => $month->format('Y-m'),
                    'month_name' => $month->translatedFormat('F Y'),
                    'total_expenses' => $monthExpenses->sum('amount'),
                    'count' => $monthExpenses->count()
                ];
            }
            
            // جلب الخزنة الحالية
            $treasury = Treasury::getActive();
            
            // المصروفات التفصيلية
            $detailedExpenses = $expenses->map(function ($expense) {
                return [
                    'id' => $expense->id,
                    'amount' => $expense->amount,
                    'description' => $expense->description,
                    'category' => $expense->category,
                    'transaction_date' => $expense->transaction_date,
                    'order_id' => $expense->order_id,
                    'product_id' => $expense->product_id,
                    'order_number' => $expense->order ? $expense->order->order_number : null,
                    'product_name' => $expense->product ? $expense->product->name : null
                ];
            });
            
            $response = [
                'summary' => [
                    'total_expenses' => $totalExpenses,
                    'transactions_count' => $expenses->count(),
                    'average_expense' => $expenses->count() > 0 ? 
                        $totalExpenses / $expenses->count() : 0,
                    'treasury_balance' => $treasury ? $treasury->balance : 0,
                    'expenses_to_balance_ratio' => $treasury && $treasury->balance > 0 ? 
                        ($totalExpenses / $treasury->balance) * 100 : 0
                ],
                'category_analysis' => $categoryAnalysis,
                'source_analysis' => $sourceAnalysis,
                'monthly_trend' => $monthlyTrend,
                'detailed_expenses' => $detailedExpenses,
                'filters' => [
                    'start_date' => $request->start_date,
                    'end_date' => $request->end_date,
                    'category' => $request->category,
                    'source_type' => $request->source_type
                ],
                'report_date' => now()->format('Y-m-d H:i:s')
            ];
            
            \Log::info('========== END getExpensesStatus ==========');
            
            return response()->json([
                'success' => true,
                'data' => $response
            ]);
            
        } catch (\Exception $e) {
            \Log::error('❌ خطأ في getExpensesStatus:', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب حالة المال العام للمصروفات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    /**
     * حالة المال العام للمبيعات
     */
    public function getSalesStatus(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'start_date' => 'nullable|date',
                'end_date' => 'nullable|date|after_or_equal:start_date',
                'customer_id' => 'nullable|exists:customers,id',
                'employee_id' => 'nullable|exists:customers,id',
                'payment_status' => 'nullable|in:paid,unpaid,partially_paid',
                'payment_method' => 'nullable|in:cash,app',
                'status' => 'nullable|in:pending,paid,cancelled'
            ]);
            
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'خطأ في التحقق من البيانات',
                    'errors' => $validator->errors()
                ], 422);
            }
            
            // استعلام الطلبات
            $ordersQuery = \App\Models\Order::with([
                'customer:id,name,department',
                'items.product:id,name,price,cost_price',
                'createdBy:id,name'
            ]);
            
            // تطبيق الفلاتر
            if ($request->start_date) {
                $ordersQuery->whereDate('created_at', '>=', $request->start_date);
            }
            
            if ($request->end_date) {
                $ordersQuery->whereDate('created_at', '<=', $request->end_date);
            }
            
            if ($request->customer_id) {
                $ordersQuery->where('customer_id', $request->customer_id);
            }
            
            if ($request->employee_id) {
                $ordersQuery->where('created_by', $request->employee_id);
            }
            
            if ($request->payment_status) {
                if ($request->payment_status === 'paid') {
                    $ordersQuery->where('due_amount', 0);
                } elseif ($request->payment_status === 'unpaid') {
                    $ordersQuery->where('due_amount', '>', 0);
                } elseif ($request->payment_status === 'partially_paid') {
                    $ordersQuery->where('paid_amount', '>', 0)
                        ->where('due_amount', '>', 0);
                }
            }
            
            if ($request->payment_method) {
                $ordersQuery->where('payment_method', $request->payment_method);
            }
            
            if ($request->status) {
                $ordersQuery->where('status', $request->status);
            }
            
            $orders = $ordersQuery->orderBy('created_at', 'desc')->get();
            
            // دخل المبيعات
            $salesIncome = \App\Models\TreasuryTransaction::where('type', 'income')
                ->where('category', 'sales_income')
                ->when($request->start_date, function($query) use ($request) {
                    return $query->whereDate('transaction_date', '>=', $request->start_date);
                })
                ->when($request->end_date, function($query) use ($request) {
                    return $query->whereDate('transaction_date', '<=', $request->end_date);
                })
                ->get();
            
            // التحليل الشامل
            $totalSales = $orders->sum('total');
            $totalPaid = $orders->sum('paid_amount');
            $totalDue = $orders->sum('due_amount');
            $totalCost = 0;
            
            // حساب تكلفة البضاعة المباعة
            foreach ($orders as $order) {
                foreach ($order->items as $item) {
                    $product = $item->product;
                    if ($product && $product->cost_price) {
                        $totalCost += $item->quantity * $product->cost_price;
                    }
                }
            }
            
            $grossProfit = $totalSales - $totalCost;
            $grossMargin = $totalSales > 0 ? ($grossProfit / $totalSales) * 100 : 0;
            
            // تحديد الموظفين
            $employeeIds = \App\Models\Customer::where(function($query) {
                    $query->whereNotNull('salary')
                          ->orWhere('department', '!=', '');
                })
                ->where('salary', '>', 0)
                ->pluck('id')
                ->toArray();
            
            // التحليل حسب الموظفين
            $employeeSales = [];
            if (!empty($employeeIds)) {
                $employeeSales = $orders->whereIn('created_by', $employeeIds)
                    ->groupBy('created_by')
                    ->map(function ($employeeOrders, $employeeId) {
                        $employee = \App\Models\Customer::find($employeeId);
                        return [
                            'employee_id' => $employeeId,
                            'employee_name' => $employee ? $employee->name : 'غير معروف',
                            'total_sales' => $employeeOrders->sum('total'),
                            'orders_count' => $employeeOrders->count(),
                            'average_order_value' => $employeeOrders->count() > 0 ? 
                                $employeeOrders->sum('total') / $employeeOrders->count() : 0
                        ];
                    })
                    ->sortByDesc('total_sales')
                    ->values()
                    ->toArray();
            }
            
            // التحليل الشهري
            $monthlySales = [];
            for ($i = 0; $i < 6; $i++) {
                $month = now()->subMonths($i);
                $monthStart = $month->copy()->startOfMonth();
                $monthEnd = $month->copy()->endOfMonth();
                
                $monthOrders = $orders->filter(function ($order) use ($monthStart, $monthEnd) {
                    $orderDate = \Carbon\Carbon::parse($order->created_at);
                    return $orderDate->between($monthStart, $monthEnd);
                });
                
                $monthlySales[] = [
                    'month' => $month->format('Y-m'),
                    'month_name' => $month->translatedFormat('F Y'),
                    'total_sales' => $monthOrders->sum('total'),
                    'orders_count' => $monthOrders->count(),
                    'average_order_value' => $monthOrders->count() > 0 ? 
                        $monthOrders->sum('total') / $monthOrders->count() : 0
                ];
            }
            
            // أكثر المنتجات مبيعاً
            $productSales = [];
            foreach ($orders as $order) {
                foreach ($order->items as $item) {
                    $productId = $item->product_id;
                    $product = $item->product;
                    
                    if (!isset($productSales[$productId])) {
                        $productSales[$productId] = [
                            'product_id' => $productId,
                            'product_name' => $product ? $product->name : 'غير معروف',
                            'total_quantity' => 0,
                            'total_sales' => 0
                        ];
                    }
                    
                    $productSales[$productId]['total_quantity'] += $item->quantity;
                    $productSales[$productId]['total_sales'] += $item->quantity * $item->price;
                }
            }
            
            $topProducts = collect($productSales)
                ->sortByDesc('total_sales')
                ->take(5)
                ->values()
                ->toArray();
            
            // جلب الخزنة الحالية
            $treasury = Treasury::getActive();
            
            $response = [
                'summary' => [
                    'total_sales' => $totalSales,
                    'total_orders' => $orders->count(),
                    'total_paid' => $totalPaid,
                    'total_due' => $totalDue,
                    'collection_rate' => $totalSales > 0 ? ($totalPaid / $totalSales) * 100 : 0,
                    'total_cost' => $totalCost,
                    'gross_profit' => $grossProfit,
                    'gross_margin' => round($grossMargin, 2),
                    'average_order_value' => $orders->count() > 0 ? $totalSales / $orders->count() : 0,
                    'cash_sales' => $orders->where('payment_method', 'cash')->sum('total'),
                    'app_sales' => $orders->where('payment_method', 'app')->sum('total'),
                    'income_from_sales' => $salesIncome->sum('amount'),
                    'treasury_balance' => $treasury ? $treasury->balance : 0
                ],
                'employee_performance' => $employeeSales,
                'monthly_trend' => $monthlySales,
                'top_products' => $topProducts,
                'recent_orders' => $orders->take(10)->map(function($order) {
                    return [
                        'id' => $order->id,
                        'order_number' => $order->order_number,
                        'total' => $order->total,
                        'customer' => $order->customer ? $order->customer->name : 'غير معروف',
                        'employee' => $order->createdBy ? $order->createdBy->name : 'غير معروف',
                        'date' => $order->created_at->format('Y-m-d')
                    ];
                }),
                'filters' => $request->all(),
                'report_date' => now()->format('Y-m-d H:i:s')
            ];
            
            return response()->json([
                'success' => true,
                'data' => $response
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Error in getSalesStatus', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب حالة المال العام للمبيعات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }




// تقبيض عامل واحد فقط
public function paySalaries(Request $request)
{
    // بدء تسجيل العملية
    \Log::info('====== بدء عملية دفع راتب موظف ======', [
        'user_id' => auth()->id(),
        'request' => $request->all()
    ]);
    
    try {
        \Log::info('التحقق من صحة البيانات');
        
        $validator = \Validator::make($request->all(), [
            'employee_id' => 'required|exists:customers,id',
            'month' => 'required|date_format:Y-m',
            'amount' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string|max:500'
        ]);
        
        if ($validator->fails()) {
            \Log::error('فشل التحقق من البيانات', [
                'errors' => $validator->errors()->toArray()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'خطأ في البيانات المدخلة',
                'errors' => $validator->errors()
            ], 422);
        }
        
        $employeeId = $request->employee_id;
        $amount = $request->amount;
        $month = $request->month;
        
        \Log::info('جلب بيانات الموظف', ['employee_id' => $employeeId]);
        $employee = Customer::find($employeeId);
        
        if (!$employee) {
            \Log::error('الموظف غير موجود', ['employee_id' => $employeeId]);
            return response()->json([
                'success' => false,
                'message' => 'الموظف غير موجود'
            ], 404);
        }
        
        \Log::info('بيانات الموظف', [
            'id' => $employee->id,
            'name' => $employee->name,
            'salary' => $employee->salary
        ]);
        
        \Log::info('جلب بيانات الخزنة');
        $treasury = Treasury::first();
        
        if (!$treasury) {
            \Log::error('لا توجد خزنة في النظام');
            return response()->json([
                'success' => false,
                'message' => 'لا توجد خزنة في النظام'
            ], 404);
        }
        
        \Log::info('بيانات الخزنة', [
            'id' => $treasury->id,
            'balance' => $treasury->balance,
            'required_amount' => $amount
        ]);
        
        // التحقق من الرصيد
        if ($treasury->balance < $amount) {
            \Log::error('رصيد غير كافي', [
                'required' => $amount,
                'available' => $treasury->balance
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'رصيد الخزنة غير كافي',
                'details' => [
                    'مطلوب' => number_format($amount, 2),
                    'متوفر' => number_format($treasury->balance, 2),
                    'نقص' => number_format($amount - $treasury->balance, 2)
                ]
            ], 400);
        }
        
        \Log::info('بدء معاملة قاعدة البيانات');
        DB::beginTransaction();
        
        try {
            // حفظ الرصيد القديم
            $oldBalance = $treasury->balance;
            
            // خصم المبلغ من الخزنة
            \Log::info('خصم المبلغ من الخزنة', [
                'old_balance' => $oldBalance,
                'amount' => $amount,
                'new_balance' => $oldBalance - $amount
            ]);
            
            $treasury->balance -= $amount;
            $treasury->total_expenses += $amount;
            $treasury->save();
            
            \Log::info('تم تحديث الخزنة', [
                'new_balance' => $treasury->balance
            ]);
            
            // محاولة تسجيل المعاملة (إذا كان الجدول يدعمها)
            try {
                \Log::info('محاولة تسجيل معاملة الخزنة');
                
                $transactionData = [
                    'treasury_id' => $treasury->id,
                    'type' => 'expense',
                    'amount' => $amount,
                    'description' => "دفع راتب {$employee->name} لشهر {$month}" . 
                                    ($request->notes ? " - {$request->notes}" : ''),
                    'category' => 'salaries',
                    'date' => Carbon::now(),
                    'transaction_date' => Carbon::now(),
                    'transaction_number' => 'SAL-' . time(),
                    'status' => 'completed',
                    'payment_method' => 'cash',
                    'created_by' => auth()->id() ?? 1,
                    'notes' => $request->notes ?? 'دفع راتب موظف',
                ];
                
                // إضافة الحقول المطلوبة إذا كانت موجودة
                try {
                    // تحقق من وجود الأعمدة
                    $columns = DB::select('DESCRIBE treasury_transactions');
                    $columnNames = array_column($columns, 'Field');
                    
                    // إضافة القيم الافتراضية للحقول المطلوبة
                    if (in_array('order_id', $columnNames)) {
                        $transactionData['order_id'] = 0;
                    }
                    if (in_array('purchase_id', $columnNames)) {
                        $transactionData['purchase_id'] = 0;
                    }
                    if (in_array('product_id', $columnNames)) {
                        $transactionData['product_id'] = 0;
                    }
                    if (in_array('employee_id', $columnNames)) {
                        $transactionData['employee_id'] = $employee->id;
                    }
                    
                    \Log::info('بيانات المعاملة المعدلة', $transactionData);
                    
                    $transaction = TreasuryTransaction::create($transactionData);
                    \Log::info('تم تسجيل معاملة الخزنة', ['transaction_id' => $transaction->id]);
                    
                } catch (\Exception $e) {
                    \Log::warning('فشل تسجيل معاملة الخزنة، لكن الخصم تم', [
                        'error' => $e->getMessage()
                    ]);
                    // لا نوقف العملية إذا فشل تسجيل المعاملة
                }
                
            } catch (\Exception $e) {
                \Log::warning('تجاوز تسجيل المعاملة والاستمرار', [
                    'error' => $e->getMessage()
                ]);
            }
            
            \Log::info('تأكيد المعاملة');
            DB::commit();
            
            $response = [
                'success' => true,
                'message' => 'تم دفع راتب الموظف بنجاح',
                'data' => [
                    'employee' => [
                        'id' => $employee->id,
                        'name' => $employee->name,
                        'department' => $employee->department
                    ],
                    'payment' => [
                        'amount' => number_format($amount, 2),
                        'month' => $month,
                        'date' => Carbon::now()->format('Y-m-d H:i:s')
                    ],
                    'treasury' => [
                        'الرصيد_السابق' => number_format($oldBalance, 2),
                        'الرصيد_الجديد' => number_format($treasury->balance, 2),
                        'المبلغ_المخصوم' => number_format($amount, 2)
                    ]
                ]
            ];
            
            \Log::info('عملية دفع الراتب اكتملت بنجاح', $response);
            
            return response()->json($response);
            
        } catch (\Exception $e) {
            \Log::error('فشل في معاملة الخصم', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            DB::rollBack();
            \Log::info('تم التراجع عن المعاملة');
            
            return response()->json([
                'success' => false,
                'message' => 'فشل في عملية الخصم',
                'error' => $e->getMessage()
            ], 500);
        }
        
    } catch (\Exception $e) {
        \Log::error('خطأ خارجي في دالة دفع الرواتب', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ غير متوقع'
        ], 500);
    } finally {
        \Log::info('====== نهاية عملية دفع راتب موظف ======');
    }
}





// تقبيض كل العمال
public function payAllSalaries(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'month' => 'required|date_format:Y-m',
            'confirm' => 'boolean'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        $targetMonth = $request->input('month');
        
        // جلب جميع الموظفين الذين لهم راتب
        $employees = Customer::where('salary', '>', 0)->get();
        $totalSalaries = $employees->sum('salary');
        
        $treasury = Treasury::first();
        
        if (!$treasury) {
            return response()->json([
                'success' => false,
                'message' => 'لا توجد خزنة متاحة'
            ], 404);
        }
        
        // إذا لم يتم تأكيد، أرجع الحساب فقط
        if (!$request->input('confirm')) {
            return response()->json([
                'success' => true,
                'can_proceed' => $treasury->balance >= $totalSalaries,
                'total_salaries' => $totalSalaries,
                'employees_count' => $employees->count(),
                'treasury_balance' => $treasury->balance,
                'remaining_after_payment' => $treasury->balance - $totalSalaries,
                'month' => $targetMonth,
                'message' => $treasury->balance >= $totalSalaries 
                    ? 'يمكن خصم رواتب جميع الموظفين' 
                    : 'لا يوجد رصيد كافي في الخزنة'
            ]);
        }
        
        // بدء عملية دفع جميع الرواتب
        DB::beginTransaction();
        
        try {
            if ($treasury->balance < $totalSalaries) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يوجد رصيد كافي في الخزنة'
                ], 400);
            }
            
            // خصم المبلغ
            $treasury->balance -= $totalSalaries;
            $treasury->total_expenses += $totalSalaries;
            $treasury->save();
            
            // تسجيل معاملة واحدة للجميع
            $transactionId = uniqid();
            TreasuryTransaction::create([
                'treasury_id' => $treasury->id,
                'type' => 'expense',
                'amount' => $totalSalaries,
                'description' => 'دفع رواتب جميع الموظفين (' . $employees->count() . ') لشهر ' . $targetMonth,
                'category' => 'salaries',
                'date' => Carbon::now(),
                'reference_type' => 'salary_batch',
                'reference_id' => $transactionId
            ]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'تم دفع رواتب جميع الموظفين بنجاح',
                'total_paid' => $totalSalaries,
                'employees_count' => $employees->count(),
                'treasury_balance_after' => $treasury->balance,
                'month' => $targetMonth,
                'transaction_id' => $transactionId
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'فشل عملية دفع الرواتب: ' . $e->getMessage()
            ], 500);
        }
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ: ' . $e->getMessage()
        ], 500);
    }
}








    // في TreasuryController.php
public function reset(Request $request)
{
    try {
        // جلب الخزنة الحالية
        $treasury = Treasury::first();
        
        if (!$treasury) {
            return response()->json([
                'success' => false,
                'message' => 'لم يتم العثور على الخزنة'
            ], 404);
        }

        $oldBalance = $treasury->balance;

        // تحديث رصيد الخزنة إلى صفر فقط
        $treasury->balance = 0;
        $treasury->save();

        return response()->json([
            'success' => true,
            'message' => 'تم تصفير الخزنة بنجاح',
            'data' => [
                'old_balance' => $oldBalance,
                'new_balance' => 0,
                'reset_at' => now()->format('Y-m-d H:i:s'),
                'message' => 'تم تصفير مبلغ ' . number_format($oldBalance, 2) . ' شيكل'
            ]
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء تصفير الخزنة: ' . $e->getMessage()
        ], 500);
    }
}



}