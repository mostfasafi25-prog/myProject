<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

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
            'balance' => 'nullable|numeric|min:0',
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
            'balance' => 'nullable|numeric|min:0',
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
            
            $supplier->delete();
            
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
}