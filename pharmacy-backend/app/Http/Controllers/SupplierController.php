<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use App\Models\Purchase;
use App\Models\Treasury;
use App\Models\TreasuryTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Support\ActivityLogger;

class SupplierController extends Controller
{
    public function index(Request $request)
    {
        try {
            $perPage = $request->get('per_page', 15);
            $search = $request->get('search');
            
            $query = Supplier::query();
            
            if ($search) {
                $query->where('name', 'LIKE', "%{$search}%")
                      ->orWhere('phone', 'LIKE', "%{$search}%")
                      ->orWhere('email', 'LIKE', "%{$search}%");
            }
            
            $suppliers = $query->orderBy('name')->paginate($perPage);
            
            return response()->json([
                'success' => true,
                'data' => $suppliers->items(),
                'pagination' => [
                    'total' => $suppliers->total(),
                    'per_page' => $suppliers->perPage(),
                    'current_page' => $suppliers->currentPage(),
                    'last_page' => $suppliers->lastPage()
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب بيانات الموردين',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:500',
            'tax_number' => 'nullable|string|max:50',
            'balance' => 'nullable|numeric',
            'notes' => 'nullable|string',
            'is_active' => 'boolean'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            $supplier = Supplier::create([
                'name' => $request->name,
                'phone' => $request->phone,
                'email' => $request->email,
                'address' => $request->address,
                'tax_number' => $request->tax_number,
                'balance' => $request->balance ?? 0,
                'notes' => $request->notes,
                'is_active' => $request->boolean('is_active', true)
            ]);

            ActivityLogger::log($request, [
                'action_type' => 'supplier_create',
                'entity_type' => 'supplier',
                'entity_id' => $supplier->id,
                'description' => "إضافة مورد جديد: {$supplier->name}",
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'تم إنشاء المورد بنجاح',
                'data' => $supplier
            ], 201);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء إنشاء المورد',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    public function show($id)
    {
        try {
            $supplier = Supplier::find($id);
            
            if (!$supplier) {
                return response()->json([
                    'success' => false,
                    'message' => 'المورد غير موجود'
                ], 404);
            }
            
            return response()->json([
                'success' => true,
                'data' => $supplier
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب البيانات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    public function update(Request $request, $id)
    {
        $supplier = Supplier::find($id);
        
        if (!$supplier) {
            return response()->json([
                'success' => false,
                'message' => 'المورد غير موجود'
            ], 404);
        }
        
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:500',
            'tax_number' => 'nullable|string|max:50',
            'balance' => 'nullable|numeric',
            'notes' => 'nullable|string',
            'is_active' => 'boolean'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            $supplier->update([
                'name' => $request->name ?? $supplier->name,
                'phone' => $request->has('phone') ? $request->phone : $supplier->phone,
                'email' => $request->has('email') ? $request->email : $supplier->email,
                'address' => $request->has('address') ? $request->address : $supplier->address,
                'tax_number' => $request->has('tax_number') ? $request->tax_number : $supplier->tax_number,
                'balance' => $request->has('balance') ? $request->balance : $supplier->balance,
                'notes' => $request->has('notes') ? $request->notes : $supplier->notes,
                'is_active' => $request->has('is_active') ? $request->boolean('is_active') : $supplier->is_active
            ]);

            ActivityLogger::log($request, [
                'action_type' => 'supplier_update',
                'entity_type' => 'supplier',
                'entity_id' => $supplier->id,
                'description' => "تحديث بيانات المورد: {$supplier->name}",
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث المورد بنجاح',
                'data' => $supplier
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تحديث المورد',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    public function destroy($id)
    {
        $supplier = Supplier::find($id);
        
        if (!$supplier) {
            return response()->json([
                'success' => false,
                'message' => 'المورد غير موجود'
            ], 404);
        }
        
        try {
            // التحقق من وجود مشتريات مرتبطة
            if ($supplier->purchases()->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن حذف المورد لأنه مرتبط بمشتريات'
                ], 400);
            }
            
            // التحقق من وجود منتجات مرتبطة
            if ($supplier->products()->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن حذف المورد لأنه مرتبط بمنتجات'
                ], 400);
            }
            
            $supplierName = $supplier->name;
            $supplier->delete();

            ActivityLogger::log(request(), [
                'action_type' => 'supplier_delete',
                'entity_type' => 'supplier',
                'entity_id' => $id,
                'description' => "حذف المورد: {$supplierName}",
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'تم حذف المورد بنجاح'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء حذف المورد',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    public function search(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'query' => 'required|string|min:2'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'أدخل كلمة بحث صحيحة',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            $suppliers = Supplier::where('name', 'LIKE', "%{$request->query}%")
                ->orWhere('phone', 'LIKE', "%{$request->query}%")
                ->orWhere('email', 'LIKE', "%{$request->query}%")
                ->orderBy('name')
                ->limit(20)
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => $suppliers,
                'count' => $suppliers->count()
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في البحث',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    public function purchases($id)
    {
        try {
            $supplier = Supplier::find($id);
            
            if (!$supplier) {
                return response()->json([
                    'success' => false,
                    'message' => 'المورد غير موجود'
                ], 404);
            }
            
            $purchases = $supplier->purchases()
                ->orderBy('purchase_date', 'desc')
                ->paginate(15);
            
            return response()->json([
                'success' => true,
                'data' => $purchases
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب المشتريات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    public function balance($id)
    {
        try {
            $supplier = Supplier::find($id);
            
            if (!$supplier) {
                return response()->json([
                    'success' => false,
                    'message' => 'المورد غير موجود'
                ], 404);
            }
            
            // حساب إجمالي المشتريات والمدفوعات
            $totalPurchases = $supplier->purchases()->sum('grand_total');
            $totalPaid = $supplier->purchases()->sum('paid_amount');
            $totalDue = $supplier->purchases()->sum('due_amount');
            
            return response()->json([
                'success' => true,
                'data' => [
                    'supplier' => $supplier,
                    'balance_info' => [
                        'total_purchases' => $totalPurchases,
                        'total_paid' => $totalPaid,
                        'total_due' => $totalDue,
                        'current_balance' => $supplier->balance,
                        'balance_status' => $totalDue > 0 ? 'مدين' : ($supplier->balance > 0 ? 'دائن' : 'متوازن')
                    ]
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في حساب الرصيد',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    public function payBalance(Request $request, $id)
{
    $validator = Validator::make($request->all(), [
        'amount' => 'required|numeric|min:0.01',
        'payment_method' => 'required|in:cash,bank_transfer,check',
        'notes' => 'nullable|string|max:500'
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
        
        $supplier = Supplier::find($id);
        
        if (!$supplier) {
            return response()->json([
                'success' => false,
                'message' => 'المورد غير موجود'
            ], 404);
        }
        
        // خصم من رصيد المورد
        if ($request->amount > $supplier->balance) {
            return response()->json([
                'success' => false,
                'message' => 'المبلغ أكبر من الرصيد المتاح',
                'current_balance' => $supplier->balance
            ], 400);
        }
        
        $supplier->balance -= $request->amount;
        $supplier->save();
        
        // تسجيل المعاملة في الخزنة
        $treasury = \App\Models\Treasury::getActive();
        $treasury->addExpense(
            amount: $request->amount,
            description: 'سداد رصيد للمورد: ' . $supplier->name,
            category: 'purchases',
            referenceModel: $supplier,
            notes: $request->notes // إضافة الملاحظات إذا كانت موجودة
        );
        
        DB::commit();
        
        return response()->json([
            'success' => true,
            'message' => 'تم سداد الرصيد بنجاح',
            'data' => [
                'supplier' => $supplier,
                'payment_details' => [
                    'amount' => $request->amount,
                    'payment_method' => $request->payment_method,
                    'new_balance' => $supplier->balance,
                    'notes' => $request->notes
                ]
            ]
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء عملية السداد',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}
    
    public function products($id)
    {
        try {
            $supplier = Supplier::find($id);
            
            if (!$supplier) {
                return response()->json([
                    'success' => false,
                    'message' => 'المورد غير موجود'
                ], 404);
            }
            
            $products = $supplier->products()
                ->where('is_active', true)
                ->orderBy('name')
                ->paginate(15);
            
            return response()->json([
                'success' => true,
                'data' => $products
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب المنتجات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    public function suppliersStats()
    {
        try {
            $totalSuppliers = Supplier::count();
            $activeSuppliers = Supplier::where('is_active', true)->count();
            $totalBalance = Supplier::sum('balance');
            
            $suppliersWithBalance = Supplier::where('balance', '>', 0)
                ->orderBy('balance', 'desc')
                ->limit(10)
                ->get(['id', 'name', 'balance']);
            
            return response()->json([
                'success' => true,
                'data' => [
                    'total_suppliers' => $totalSuppliers,
                    'active_suppliers' => $activeSuppliers,
                    'total_balance' => $totalBalance,
                    'average_balance' => $totalSuppliers > 0 ? $totalBalance / $totalSuppliers : 0,
                    'top_suppliers_by_balance' => $suppliersWithBalance
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب الإحصائيات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    public function activeSuppliers()
    {
        try {
            $suppliers = Supplier::where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'phone', 'email']);
            
            return response()->json([
                'success' => true,
                'data' => $suppliers
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب الموردين النشطين',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }

    public function payDebt(Request $request, Supplier $supplier)
    {
        try {
            $validated = $request->validate([
                'amount' => 'required|numeric|min:0.01',
                'payment_method' => 'required|in:cash,app,mixed',
                'cash_amount' => 'nullable|numeric|min:0',
                'app_amount' => 'nullable|numeric|min:0',
                'notes' => 'nullable|string'
            ]);

            $amount = round((float) $validated['amount'], 2);
            $paymentMethod = $validated['payment_method'];
            $cashAmount = round((float) ($validated['cash_amount'] ?? 0), 2);
            $appAmount = round((float) ($validated['app_amount'] ?? 0), 2);

            // Normalize by payment method
            if ($paymentMethod === 'cash') {
                $cashAmount = $amount;
                $appAmount = 0.0;
            } elseif ($paymentMethod === 'app') {
                $appAmount = $amount;
                $cashAmount = 0.0;
            }

            // Validate mixed payment amounts
            if ($paymentMethod === 'mixed') {
                if ($cashAmount <= 0.0001 || $appAmount <= 0.0001) {
                    return response()->json([
                        'success' => false,
                        'message' => 'في الدفع المختلط يجب إدخال كاش وتطبيق معاً'
                    ], 422);
                }
                if (abs($cashAmount + $appAmount - $amount) > 0.01) {
                    return response()->json([
                        'success' => false,
                        'message' => 'مجموع الكاش والتطبيق يجب أن يساوي إجمالي المبلغ'
                    ], 422);
                }
            } else {
                if (abs(($cashAmount + $appAmount) - $amount) > 0.01) {
                    return response()->json([
                        'success' => false,
                        'message' => 'مبالغ الكاش/التطبيق لا تطابق المبلغ الإجمالي لهذه الطريقة'
                    ], 422);
                }
            }

            // Get supplier's pending/partially paid purchases
            $purchases = Purchase::where('supplier_id', $supplier->id)
                ->whereIn('status', ['pending', 'partially_paid'])
                ->orderBy('purchase_date', 'asc')
                ->get();

            $totalRemaining = round((float) $purchases->sum('remaining_amount'), 2);

            if ($amount > $totalRemaining + 0.01) {
                return response()->json([
                    'success' => false,
                    'message' => 'مبلغ التسديد أكبر من إجمالي الدين المتبقي'
                ], 422);
            }

            DB::beginTransaction();

            $remainingToPay = $amount;
            $paidPurchases = [];

            foreach ($purchases as $purchase) {
                if ($remainingToPay <= 0.00001) break;

                $purchaseRemaining = round((float) $purchase->remaining_amount, 2);
                $payForThis = round(min($purchaseRemaining, $remainingToPay), 2);
                if ($payForThis <= 0.00001) {
                    continue;
                }

                $prevPaid = round((float) $purchase->paid_amount, 2);
                $totalInv = round((float) $purchase->total_amount, 2);
                $newPaidAmount = round($prevPaid + $payForThis, 2);
                $newRemainingAmount = round(max(0, $totalInv - $newPaidAmount), 2);

                // Determine new status
                if ($newRemainingAmount <= 0.01) {
                    $purchase->status = 'completed';
                } elseif ($newPaidAmount > 0) {
                    $purchase->status = 'partially_paid';
                }

                $purchase->paid_amount = $newPaidAmount;
                $purchase->remaining_amount = $newRemainingAmount;
                $purchase->save();

                $paidPurchases[] = [
                    'purchase_id' => $purchase->id,
                    'invoice_number' => $purchase->invoice_number,
                    'amount_paid' => $payForThis
                ];

                $remainingToPay -= $payForThis;
            }

            // Update supplier balance if tracked
            $bal = (float) ($supplier->balance ?? 0);
            if ($bal > 0.00001) {
                $supplier->balance = round(max(0, $bal - $amount), 2);
                $supplier->save();
            }

            $treasury = Treasury::first();
            if ($treasury) {
                $deductCash = 0.0;
                $deductApp = 0.0;
                if ($paymentMethod === 'cash') {
                    $deductCash = round($amount, 2);
                } elseif ($paymentMethod === 'app') {
                    $deductApp = round($amount, 2);
                } else {
                    $deductCash = round((float) $cashAmount, 2);
                    $deductApp = round((float) $appAmount, 2);
                }
                $totalDeduct = round($deductCash + $deductApp, 2);
                if (abs($totalDeduct - round($amount, 2)) > 0.05) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'مجموع خصم الكاش والتطبيق لا يطابق المبلغ',
                    ], 422);
                }

                $availableCash = (float) ($treasury->balance_cash ?? 0);
                $availableApp = (float) ($treasury->balance_app ?? 0);
                if ($deductCash > $availableCash + 0.0001) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'لا يوجد رصيد كاش كافٍ (فش معك مصاري كاش)',
                        'data' => [
                            'required_cash' => round($deductCash, 2),
                            'available_cash' => round($availableCash, 2),
                        ],
                    ], 422);
                }
                if ($deductApp > $availableApp + 0.0001) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'لا يوجد رصيد تطبيق كافٍ (فش معك مصاري تطبيق)',
                        'data' => [
                            'required_app' => round($deductApp, 2),
                            'available_app' => round($availableApp, 2),
                        ],
                    ], 422);
                }
                foreach (
                    [
                        ['amt' => $deductCash, 'method' => 'cash', 'suffix' => ' — كاش'],
                        ['amt' => $deductApp, 'method' => 'app', 'suffix' => ' — تطبيق'],
                    ] as $leg
                ) {
                    if ($leg['amt'] > 0.00001) {
                        TreasuryTransaction::create([
                            'treasury_id' => $treasury->id,
                            'type' => 'expense',
                            'amount' => $leg['amt'],
                            'description' => ($validated['notes'] ?? "تسديد دين مورد: {$supplier->name}") . $leg['suffix'],
                            'category' => 'purchase_expense',
                            'payment_method' => $leg['method'],
                            'transaction_date' => now(),
                            'created_by' => auth()->id() ?? 1,
                        ]);
                    }
                }
                if ($totalDeduct > 0.00001) {
                    $treasury->applyLiquidityDelta(-$deductCash, -$deductApp);
                    $treasury->total_expenses += $totalDeduct;
                    $treasury->save();
                }
            }

            DB::commit();

            ActivityLogger::log($request, [
                'action_type' => 'supplier_debt_payment',
                'entity_type' => 'supplier',
                'entity_id' => $supplier->id,
                'description' => "تسديد دين مورد: {$supplier->name}",
                'meta' => [
                    'amount_paid' => (float) $amount,
                    'payment_method' => $paymentMethod,
                    'cash_amount' => round($cashAmount, 2),
                    'app_amount' => round($appAmount, 2),
                ],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'تم تسديد الدين بنجاح',
                'data' => [
                    'amount_paid' => $amount,
                    'payment_method' => $paymentMethod,
                    'purchases_updated' => $paidPurchases,
                    'supplier_new_balance' => $supplier->balance
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في تسديد الدين',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
}