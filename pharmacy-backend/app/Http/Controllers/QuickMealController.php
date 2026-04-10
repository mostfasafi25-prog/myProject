<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\Category;
use App\Models\PreparedMeal;
use App\Models\QuickMeal;
use Illuminate\Support\Facades\Log;

class QuickMealController extends Controller
{
    // الحصول على الأقسام مع منتجاتها
    public function getCategoriesWithProducts()
{
    try {
        \Log::info('[QuickMeal] بدء جلب الأقسام مع المنتجات');
        
        $categories = Category::with(['products' => function($query) {
            \Log::info('[QuickMeal] جلب المنتجات مع stock > 0');
            $query->where('stock', '>', 0)
                  ->orderBy('name');
        }])->whereHas('products', function($query) {
            $query->where('stock', '>', 0);
        })->orderBy('name')->get();

        \Log::info('[QuickMeal] عدد الأقسام التي تم جلبها: ' . $categories->count());
        
        // تسجيل تفاصيل الأقسام والمنتجات
        foreach ($categories as $category) {
            \Log::info('[QuickMeal] القسم: ' . $category->name . ' (ID: ' . $category->id . ')');
            \Log::info('[QuickMeal] عدد المنتجات في القسم: ' . $category->products->count());
            
            foreach ($category->products as $product) {
                \Log::info('[QuickMeal] المنتج: ' . $product->name . 
                          ' | المخزون: ' . $product->stock . 
                          ' | السعر: ' . $product->price);
            }
        }

        \Log::info('[QuickMeal] تم جلب الأقسام بنجاح، إرجاع البيانات');
        
        return response()->json([
            'success' => true,
            'data' => $categories,
            'debug_info' => [
                'categories_count' => $categories->count(),
                'total_products' => $categories->sum(function($category) {
                    return $category->products->count();
                }),
                'timestamp' => now()->toDateTimeString()
            ]
        ]);
        
    } catch (\Exception $e) {
        \Log::error('[QuickMeal] خطأ في جلب الأقسام: ' . $e->getMessage());
        \Log::error('[QuickMeal] الملف: ' . $e->getFile());
        \Log::error('[QuickMeal] السطر: ' . $e->getLine());
        \Log::error('[QuickMeal] الـ Trace: ' . $e->getTraceAsString());
        
        return response()->json([
            'success' => false,
            'message' => 'خطأ في جلب البيانات',
            'error' => $e->getMessage(),
            'error_details' => env('APP_DEBUG') ? [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ] : null
        ], 500);
    }
}

    // تحضير وجبة بسيطة
    public function prepareMeal(Request $request)
    {
        $request->validate([
            'meal_name' => 'required|string|max:255',
            'ingredients' => 'required|array|min:1',
            'ingredients.*.product_id' => 'required|integer|exists:products,id',
            'ingredients.*.quantity' => 'required|numeric|min:0.01'
        ]);

        try {
            // 1. فحص توفر المكونات
            $insufficient = [];
            
            foreach ($request->ingredients as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                
                if (!$product) {
                    return response()->json([
                        'success' => false,
                        'message' => 'المنتج غير موجود'
                    ], 404);
                }
                
                if ($product->stock < $ingredient['quantity']) {
                    $insufficient[] = [
                        'product' => $product->name,
                        'required' => $ingredient['quantity'],
                        'available' => $product->stock,
                        'unit' => $product->unit
                    ];
                }
            }

            // 2. إذا كان هناك نقص
            if (!empty($insufficient)) {
                return response()->json([
                    'success' => false,
                    'message' => 'المخزون غير كافٍ',
                    'insufficient_ingredients' => $insufficient
                ], 400);
            }

            // 3. خصم الكميات من المخزون
            foreach ($request->ingredients as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                $product->decrement('stock', $ingredient['quantity']);
                
                // تسجيل في سجل المخزون
                \App\Models\InventoryLog::create([
                    'product_id' => $product->id,
                    'type' => 'quick_meal',
                    'quantity' => -$ingredient['quantity'],
                    'notes' => "تحضير وجبة سريعة: {$request->meal_name}"
                ]);
            }

            // 4. إعداد تفاصيل الوجبة
            $ingredientsDetails = [];
            foreach ($request->ingredients as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                $ingredientsDetails[] = [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'quantity' => $ingredient['quantity'],
                    'unit' => $product->unit,
                    'price_per_unit' => $product->price ?? 0
                ];
            }

            // 5. حساب التكلفة
            $totalCost = $this->calculateCost($ingredientsDetails);

            // 6. حفظ الوجبة
            $meal = QuickMeal::create([
                'meal_name' => $request->meal_name,
                'ingredients' => json_encode($ingredientsDetails),
                'total_cost' => $totalCost,
                'prepared_by' => auth()->id() ?? 1
            ]);

            return response()->json([
                'success' => true,
                'message' => "تم تحضير '{$request->meal_name}' بنجاح",
                'data' => [
                    'id' => $meal->id,
                    'meal_name' => $meal->meal_name,
                    'ingredients' => json_decode($meal->ingredients, true),
                    'total_cost' => $meal->total_cost,
                    'created_at' => $meal->created_at->format('Y-m-d H:i:s')
                ]
            ]);
 PreparedMeal::create([
            'meal_name' => 'وجبة سريعة: ' . ($request->meal_name ?? 'سريعة'),
            'ingredients' => json_encode($preparedIngredients), // تأكد من هذا المتغير
            'total_cost' => $this->calculateTotalCost($preparedIngredients), // أو احسب بطريقة أخرى
            'quantity' => 1,
            'prepared_by' => $request->prepared_by ?? 'غير معروف',
            'notes' => 'وجبة سريعة',
            'prepared_at' => now()
        ]);
        
        \Log::info('📝 تم حفظ السجل الدائم للوجبة السريعة');
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ: ' . $e->getMessage()
            ], 500);
        }
    }

    // حساب تكلفة الوجبة
    private function calculateCost($ingredients)
    {
        $total = 0;
        foreach ($ingredients as $ingredient) {
            $total += ($ingredient['price_per_unit'] ?? 0) * $ingredient['quantity'];
        }
        return $total;
    }

    // سجل الوجبات المحضرة
    public function mealHistory(Request $request)
    {
        try {
            $query = QuickMeal::orderBy('created_at', 'desc');
            
            // فلترة حسب التاريخ
            if ($request->has('date_from')) {
                $query->whereDate('created_at', '>=', $request->date_from);
            }
            
            if ($request->has('date_to')) {
                $query->whereDate('created_at', '<=', $request->date_to);
            }
            
            if ($request->has('meal_name')) {
                $query->where('meal_name', 'like', '%' . $request->meal_name . '%');
            }
            
            $meals = $query->paginate($request->per_page ?? 20);

            return response()->json([
                'success' => true,
                'data' => $meals
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في جلب السجل',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // فحص المكونات قبل التحضير
    public function checkIngredients(Request $request)
    {
        $request->validate([
            'ingredients' => 'required|array',
            'ingredients.*.product_id' => 'required|exists:products,id',
            'ingredients.*.quantity' => 'required|numeric|min:0.01'
        ]);

        try {
            $results = [];
            $allAvailable = true;
            $totalCost = 0;
            
            foreach ($request->ingredients as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                $available = $product->stock >= $ingredient['quantity'];
                $cost = ($product->price ?? 0) * $ingredient['quantity'];
                $totalCost += $cost;
                
                $results[] = [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'required' => $ingredient['quantity'],
                    'available' => $product->stock,
                    'unit' => $product->unit,
                    'is_available' => $available,
                    'price_per_unit' => $product->price,
                    'total_cost' => $cost
                ];
                
                if (!$available) {
                    $allAvailable = false;
                }
            }

            return response()->json([
                'success' => true,
                'all_available' => $allAvailable,
                'total_estimated_cost' => $totalCost,
                'ingredients' => $results
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في فحص المكونات',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}