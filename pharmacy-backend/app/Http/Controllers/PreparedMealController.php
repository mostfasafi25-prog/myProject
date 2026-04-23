<?php
// app/Http/Controllers/PreparedMealController.php
namespace App\Http\Controllers;

use App\Models\ReturnedMeal;
use Illuminate\Support\Facades\Schema;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\PreparedMeal;
use Illuminate\Http\Request;
use App\Models\Treasury;
use App\Models\TreasuryTransaction;

class PreparedMealController extends Controller
{
    public function index(Request $request)
    {
        $query = PreparedMeal::orderBy('prepared_at', 'desc');
        
        if ($request->has('date_from')) {
            $query->whereDate('prepared_at', '>=', $request->date_from);
        }
        
        if ($request->has('date_to')) {
            $query->whereDate('prepared_at', '<=', $request->date_to);
        }
        
        if ($request->has('meal_name')) {
            $query->where('meal_name', 'like', "%{$request->meal_name}%");
        }
        
        $meals = $query->paginate(20);
        
        return response()->json([
            'success' => true,
            'data' => $meals
        ]);
    }
    
    public function show($id)
    {
        $meal = PreparedMeal::findOrFail($id);
        
        return response()->json([
            'success' => true,
            'data' => $meal
        ]);
    }
    
    public function stats(Request $request)
    {
        // إحصائيات
        $totalMeals = PreparedMeal::count();
        $todayMeals = PreparedMeal::whereDate('prepared_at', today())->count();
        $totalCost = PreparedMeal::sum('total_cost');
        $totalSaleValue = PreparedMeal::sum('sale_price');
        
        return response()->json([
            'success' => true,
            'data' => [
                'total_meals' => $totalMeals,
                'today_meals' => $todayMeals,
                'total_cost' => $totalCost,
                'total_sale_value' => $totalSaleValue,
                'estimated_profit' => $totalSaleValue - $totalCost
            ]
        ]);
    }
    
    public function returnMeal(Request $request, $id)
    {
        try {
            DB::beginTransaction();
            
            $meal = PreparedMeal::findOrFail($id);
            
            // تحقق إذا كانت الوجبة مسترجعة مسبقاً
            if ($meal->returned_at) {
                return response()->json([
                    'success' => false,
                    'message' => 'هذه الوجبة مسترجعة مسبقاً'
                ], 400);
            }
            
            $ingredients = json_decode($meal->ingredients, true);
            $returnDetails = [];
            
            // إرجاع المكونات للمخزون
            foreach ($ingredients as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                if ($product) {
                    $oldStock = $product->stock;
                    $returnQuantity = $ingredient['quantity'] ?? 0;
                    $product->stock += $returnQuantity;
                    $product->save();
                    
                    $returnDetails[] = [
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'returned_quantity' => $returnQuantity,
                        'old_stock' => $oldStock,
                        'new_stock' => $product->stock,
                        'unit' => $ingredient['unit'] ?? 'وحدة'
                    ];
                }
            }
            
            // إرجاع المال للخزنة
            $totalCost = $meal->total_cost;
            $salePrice = $meal->sale_price ?? $totalCost * 1.5; // استخدام سعر البيع إذا كان موجوداً
            $treasury = Treasury::first();
            
            if ($treasury && $totalCost > 0) {
                $oldBalance = $treasury->balance;
                $oldExpenses = $treasury->total_expenses;
                
                // 1. خصم المبلغ من إجمالي المصروفات
                $treasury->total_expenses -= $totalCost;
                
                // 2. إضافة المبلغ للرصيد
                $treasury->adjustCashLegacy($totalCost);
                $treasury->save();
                
                // 3. تسجيل معاملة الدخل (استرجاع الأموال)
                TreasuryTransaction::create([
                    'treasury_id' => $treasury->id,
                    'type' => 'income',
                    'amount' => $totalCost,
                    'description' => "استرجاع أموال وجبة: {$meal->meal_name} (سعر البيع: {$salePrice})",
                    'category' => 'meal_return',
                    'transaction_date' => now(),
                    'transaction_number' => 'MEAL-RETURN-' . time(),
                    'status' => 'completed',
                    'payment_method' => 'cash',
                    'created_by' => auth()->id() ?? 1,
                    'reference_type' => 'meal_return',
                    'reference_id' => $id,
                    'metadata' => json_encode([
                        'meal_name' => $meal->meal_name,
                        'meal_id' => $id,
                        'total_cost' => $totalCost,
                        'sale_price' => $salePrice,
                        'operation' => 'استرجاع أموال وجبة محضرة',
                        'old_balance' => $oldBalance,
                        'new_balance' => $treasury->balance,
                        'old_expenses' => $oldExpenses,
                        'new_expenses' => $treasury->total_expenses
                    ])
                ]);
                
                // 4. تسجيل معاملة مصروف بالسالب (لتعويض المصروف السابق)
                TreasuryTransaction::create([
                    'treasury_id' => $treasury->id,
                    'type' => 'expense',
                    'amount' => -$totalCost, // بالسالب لخصم من المصروفات
                    'description' => "استرجاع - خصم من المصروفات: {$meal->meal_name}",
                    'category' => 'meal_preparation_return',
                    'transaction_date' => now(),
                    'transaction_number' => 'MEAL-EXP-RET-' . time(),
                    'status' => 'completed',
                    'payment_method' => 'cash',
                    'created_by' => auth()->id() ?? 1,
                    'reference_type' => 'meal_return_expense',
                    'reference_id' => $id,
                    'metadata' => json_encode([
                        'note' => 'مصروف سالب لتعويض مصروف تحضير الوجبة',
                        'original_meal' => $meal->meal_name,
                        'sale_price' => $salePrice
                    ])
                ]);
            }
            
            // حفظ في جدول الاسترجاعات
            if (Schema::hasTable('returned_meals')) {
                try {
                    $returnedMeal = [
                        'prepared_meal_id' => $id,
                        'saved_meal_id' => null,
                        'meal_name' => $meal->meal_name,
                        'ingredients' => $meal->ingredients,
                        'total_cost' => $meal->total_cost,
                        'sale_price' => $meal->sale_price, // حفظ سعر البيع
                        'amount_returned' => $totalCost,
                        'returned_by' => auth()->check() ? auth()->user()->name : 'النظام',
                        'return_date' => now(),
                        'return_reason' => $request->return_reason ?? 'غير محدد',
                        'return_details' => json_encode($returnDetails)
                    ];
                    
                    \DB::table('returned_meals')->insert($returnedMeal);
                } catch (\Exception $e) {
                    \Log::error('خطأ في حفظ الاسترجاع:', ['error' => $e->getMessage()]);
                }
            }
            
            // حذف الوجبة
            $meal->delete();
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'تم استرجاع الوجبة بنجاح',
                'data' => [
                    'meal_name' => $meal->meal_name,
                    'total_cost_returned' => $totalCost,
                    'sale_price' => $salePrice,
                    'treasury_update' => $treasury ? [
                        'الرصيد_السابق' => number_format($oldBalance, 2),
                        'الرصيد_الجديد' => number_format($treasury->balance, 2),
                        'المضاف_للرصيد' => number_format($totalCost, 2),
                        'المصروفات_السابقة' => number_format($oldExpenses, 2),
                        'المصروفات_الجديدة' => number_format($treasury->total_expenses, 2),
                        'الفرق_في_المصروفات' => number_format(-$totalCost, 2)
                    ] : null,
                    'details' => $returnDetails
                ]
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            \Log::error('خطأ في استرجاع وجبة محضرة', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'meal_id' => $id
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'خطأ في استرجاع الوجبة: ' . $e->getMessage()
            ], 500);
        }
    }

    // دالة جديدة لبيع الوجبات الجاهزة
    public function sellMeal(Request $request)
    {
        try {
            DB::beginTransaction();
            
            $request->validate([
                'meal_id' => 'required|exists:prepared_meals,id',
                'quantity' => 'required|integer|min:1',
                'customer_id' => 'nullable|exists:customers,id',
                'payment_method' => 'required|in:cash,app',
                'paid_amount' => 'required|numeric|min:0',
            ]);
            
            $meal = PreparedMeal::findOrFail($request->meal_id);
            
            // التحقق من الكمية المتاحة
            if ($meal->quantity < $request->quantity) {
                return response()->json([
                    'success' => false,
                    'message' => 'الكمية غير متاحة. المتاح: ' . $meal->quantity
                ], 400);
            }
            
            // حساب المبلغ
            $salePrice = $meal->sale_price ?? ($meal->total_cost * 1.5);
            $totalAmount = $salePrice * $request->quantity;
            $dueAmount = max(0, $totalAmount - $request->paid_amount);
            
            // خصم الكمية
            $meal->quantity -= $request->quantity;
            $meal->save();
            
            // تحديث الخزنة
            $treasury = Treasury::first();
            if ($treasury) {
                $treasury->adjustCashLegacy((float) $request->paid_amount);
                $treasury->total_income += $request->paid_amount;
                $treasury->save();
                
                // تسجيل معاملة الخزنة
                TreasuryTransaction::create([
                    'treasury_id' => $treasury->id,
                    'type' => 'income',
                    'amount' => $request->paid_amount,
                    'description' => "بيع وجبة: {$meal->meal_name} (x{$request->quantity})",
                    'category' => 'meal_sale',
                    'transaction_date' => now(),
                    'transaction_number' => 'MEAL-SALE-' . time(),
                    'status' => 'completed',
                    'payment_method' => $request->payment_method,
                    'created_by' => auth()->id() ?? 1,
                    'reference_type' => 'meal_sale',
                    'reference_id' => $meal->id,
                    'metadata' => json_encode([
                        'meal_name' => $meal->meal_name,
                        'quantity' => $request->quantity,
                        'sale_price_per_unit' => $salePrice,
                        'total_amount' => $totalAmount,
                        'paid_amount' => $request->paid_amount,
                        'due_amount' => $dueAmount
                    ])
                ]);
            }
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'تم بيع الوجبة بنجاح',
                'data' => [
                    'meal' => $meal->fresh(),
                    'sale_details' => [
                        'سعر_الوحدة' => $salePrice,
                        'الكمية' => $request->quantity,
                        'المبلغ_الإجمالي' => $totalAmount,
                        'المبلغ_المدفوع' => $request->paid_amount,
                        'المبلغ_المتبقي' => $dueAmount,
                        'طريقة_الدفع' => $request->payment_method
                    ]
                ]
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            \Log::error('خطأ في بيع وجبة جاهزة', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request' => $request->all()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'خطأ في بيع الوجبة: ' . $e->getMessage()
            ], 500);
        }
    }

    // دالة لتحديث سعر بيع وجبة
    public function updateSalePrice(Request $request, $id)
    {
        try {
            $request->validate([
                'sale_price' => 'required|numeric|min:0'
            ]);
            
            $meal = PreparedMeal::findOrFail($id);
            
            $oldPrice = $meal->sale_price;
            $meal->sale_price = $request->sale_price;
            $meal->save();
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث سعر البيع بنجاح',
                'data' => [
                    'meal_name' => $meal->meal_name,
                    'old_sale_price' => $oldPrice,
                    'new_sale_price' => $meal->sale_price,
                    'total_cost' => $meal->total_cost,
                    'profit_per_unit' => $meal->sale_price - $meal->total_cost,
                    'profit_percentage' => $meal->total_cost > 0 
                        ? (($meal->sale_price - $meal->total_cost) / $meal->sale_price) * 100 
                        : 0
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في تحديث سعر البيع: ' . $e->getMessage()
            ], 500);
        }
    }
}