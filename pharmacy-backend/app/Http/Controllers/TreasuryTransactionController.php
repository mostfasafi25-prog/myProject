<?php

namespace App\Http\Controllers;

use App\Models\TreasuryTransaction;
use App\Models\Treasury;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class TreasuryTransactionController extends Controller
{
    /**
     * جلب جميع حركات الخزنة
     */
    public function getTransactions(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'start_date' => 'nullable|date',
                'end_date' => 'nullable|date|after_or_equal:start_date',
                'type' => 'nullable|in:income,expense',
                'category' => 'nullable|string',
                'payment_method' => 'nullable|in:cash,bank_transfer,check,card',
                'search' => 'nullable|string',
                'per_page' => 'nullable|integer|min:1|max:100',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'خطأ في التحقق',
                    'errors' => $validator->errors()
                ], 422);
            }

            $perPage = $request->per_page ?? 15;
            
            $query = TreasuryTransaction::with([
                'treasury:id,balance',
                'createdBy:id,name'
            ])->orderBy('transaction_date', 'desc')
              ->orderBy('created_at', 'desc');

            // التصفية حسب التاريخ
            if ($request->start_date) {
                $query->whereDate('transaction_date', '>=', $request->start_date);
            }
            
            if ($request->end_date) {
                $query->whereDate('transaction_date', '<=', $request->end_date);
            }

            // التصفية حسب النوع
            if ($request->type) {
                $query->where('type', $request->type);
            }

            // التصفية حسب الفئة
            if ($request->category) {
                $query->where('category', $request->category);
            }

            // التصفية حسب طريقة الدفع
            if ($request->payment_method) {
                $query->where('payment_method', $request->payment_method);
            }

            // البحث
            if ($request->search) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('transaction_number', 'LIKE', "%{$search}%")
                      ->orWhere('description', 'LIKE', "%{$search}%")
                      ->orWhere('amount', 'LIKE', "%{$search}%");
                });
            }

            $transactions = $query->paginate($perPage);

            // حساب الإحصائيات
            $stats = [
                'total_income' => $query->clone()->where('type', 'income')->sum('amount'),
                'total_expense' => $query->clone()->where('type', 'expense')->sum('amount'),
                'net_balance' => $query->clone()->where('type', 'income')->sum('amount') - 
                                $query->clone()->where('type', 'expense')->sum('amount'),
                'count' => $transactions->total(),
            ];

            return response()->json([
                'success' => true,
                'data' => $transactions->items(),
                'pagination' => [
                    'total' => $transactions->total(),
                    'per_page' => $transactions->perPage(),
                    'current_page' => $transactions->currentPage(),
                    'last_page' => $transactions->lastPage(),
                ],
                'stats' => $stats,
                'filters' => $request->all()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب الحركات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * إيداع مبلغ في الخزنة
     */
    public function deposit(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'amount' => 'required|numeric|min:0.01',
                'description' => 'required|string|max:500',
                'category' => 'required|in:deposit,sales_income,other_income',
                'payment_method' => 'nullable|in:cash,bank_transfer,check,card',
                'transaction_date' => 'nullable|date',
                'metadata' => 'nullable|array',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'خطأ في التحقق',
                    'errors' => $validator->errors()
                ], 422);
            }

            DB::beginTransaction();

            // جلب الخزنة النشطة
            $treasury = Treasury::first();
            if (!$treasury) {
                return response()->json([
                    'success' => false,
                    'message' => 'الخزنة غير مهيأة'
                ], 400);
            }

            // زيادة الرصيد
            $treasury->balance += $request->amount;
            $treasury->total_income += $request->amount;
            $treasury->save();

            // إنشاء المعاملة
            $transaction = TreasuryTransaction::create([
                'treasury_id' => $treasury->id,
                'transaction_number' => $this->generateTransactionNumber(),
                'type' => 'income',
                'amount' => $request->amount,
                'description' => $request->description,
                'category' => $request->category,
                'payment_method' => $request->payment_method ?? 'cash',
                'transaction_date' => $request->transaction_date ?? now(),
                'created_by' => auth()->id(),
                'metadata' => $request->metadata,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'تم إيداع المبلغ بنجاح',
                'data' => [
                    'transaction' => $transaction,
                    'treasury' => $treasury->fresh()
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في عملية الإيداع',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * سحب مبلغ من الخزنة
     */
    public function withdraw(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'amount' => 'required|numeric|min:0.01',
                'description' => 'required|string|max:500',
                'category' => 'required|in:withdraw,purchase_expense,salary_expense,other_expense',
                'payment_method' => 'nullable|in:cash,bank_transfer,check,card',
                'transaction_date' => 'nullable|date',
                'metadata' => 'nullable|array',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'خطأ في التحقق',
                    'errors' => $validator->errors()
                ], 422);
            }

            DB::beginTransaction();

            $treasury = Treasury::first();
            if (!$treasury) {
                return response()->json([
                    'success' => false,
                    'message' => 'الخزنة غير مهيأة'
                ], 400);
            }

            // التحقق من الرصيد الكافي
            if ($treasury->balance < $request->amount) {
                return response()->json([
                    'success' => false,
                    'message' => 'رصيد الخزنة غير كافي',
                    'available_balance' => $treasury->balance
                ], 400);
            }

            // خصم المبلغ
            $treasury->balance -= $request->amount;
            $treasury->total_expenses += $request->amount;
            $treasury->save();

            // إنشاء المعاملة
            $transaction = TreasuryTransaction::create([
                'treasury_id' => $treasury->id,
                'transaction_number' => $this->generateTransactionNumber(),
                'type' => 'expense',
                'amount' => $request->amount,
                'description' => $request->description,
                'category' => $request->category,
                'payment_method' => $request->payment_method ?? 'cash',
                'transaction_date' => $request->transaction_date ?? now(),
                'created_by' => auth()->id(),
                'metadata' => $request->metadata,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'تم سحب المبلغ بنجاح',
                'data' => [
                    'transaction' => $transaction,
                    'treasury' => $treasury->fresh()
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في عملية السحب',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * جلب إحصائيات الخزنة
     */
    public function getStats(Request $request)
    {
        try {
            $treasury = Treasury::first();
            if (!$treasury) {
                return response()->json([
                    'success' => false,
                    'message' => 'الخزنة غير مهيأة'
                ], 404);
            }

            $today = now()->format('Y-m-d');
            $month = now()->format('Y-m');
            
            $stats = [
                'balance' => $treasury->balance,
                'total_income' => $treasury->total_income,
                'total_expenses' => $treasury->total_expenses,
                'today' => [
                    'income' => TreasuryTransaction::where('type', 'income')
                        ->whereDate('transaction_date', $today)
                        ->sum('amount'),
                    'expenses' => TreasuryTransaction::where('type', 'expense')
                        ->whereDate('transaction_date', $today)
                        ->sum('amount'),
                ],
                'this_month' => [
                    'income' => TreasuryTransaction::where('type', 'income')
                        ->whereYear('transaction_date', now()->year)
                        ->whereMonth('transaction_date', now()->month)
                        ->sum('amount'),
                    'expenses' => TreasuryTransaction::where('type', 'expense')
                        ->whereYear('transaction_date', now()->year)
                        ->whereMonth('transaction_date', now()->month)
                        ->sum('amount'),
                ],
                'by_category' => TreasuryTransaction::select('category', 'type')
                    ->selectRaw('SUM(amount) as total')
                    ->groupBy('category', 'type')
                    ->get(),
            ];

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب الإحصائيات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * إنشاء رقم معاملة
     */
    private function generateTransactionNumber()
    {
        $last = TreasuryTransaction::latest()->first();
        $number = $last ? $last->id + 1 : 1;
        return 'TRX-' . str_pad($number, 6, '0', STR_PAD_LEFT);
    }

    /**
     * جلب معاملة محددة
     */
    public function show($id)
    {
        try {
            $transaction = TreasuryTransaction::with([
                'treasury:id,balance',
                'createdBy:id,name',
                'reference'
            ])->find($id);

            if (!$transaction) {
                return response()->json([
                    'success' => false,
                    'message' => 'المعاملة غير موجودة'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $transaction
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب المعاملة',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
}