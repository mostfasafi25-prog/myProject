<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\MealPreparation;
use App\Models\PreparedMeal;
use App\Models\Product;
use App\Models\InventoryLog;
use Illuminate\Support\Facades\Log;

class MealPreparationController extends Controller
{
 public function prepare(Request $request)
{
    try {
        \Log::info('🔵 بدء تحضير وجبة جديدة', ['request' => $request->all()]);
        
        // تحقق من البيانات (إزالة prepared_by من الفاليديشن)
        $request->validate([
            'meal_name' => 'required|string|max:255',
            'ingredients' => 'required|array|min:1',
            'ingredients.*.product_id' => 'required|integer|exists:products,id',
            'ingredients.*.quantity' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string'
        ]);

        \Log::info('✅ تحقق البيانات تم بنجاح');

        $insufficientIngredients = [];
        
        // 1. فحص توفر كل مكون أولاً
        foreach ($request->ingredients as $ingredient) {
            $product = Product::find($ingredient['product_id']);
            
            \Log::debug('فحص المنتج', [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'stock' => $product->stock,
                'required' => $ingredient['quantity']
            ]);
            
            if ($product->stock < $ingredient['quantity']) {
                $insufficientIngredients[] = [
                    'product' => $product->name,
                    'required' => $ingredient['quantity'],
                    'available' => $product->stock,
                    'unit' => $product->unit ?? 'وحدة'
                ];
            }
        }

        // 2. إذا كان هناك نقص
        if (!empty($insufficientIngredients)) {
            \Log::warning('❌ مخزون غير كافٍ', ['insufficient' => $insufficientIngredients]);
            return response()->json([
                'success' => false,
                'message' => 'المخزون غير كافٍ',
                'insufficient_ingredients' => $insufficientIngredients
            ], 400);
        }

        // 3. خصم الكميات من المخزون
        foreach ($request->ingredients as $ingredient) {
            $product = Product::find($ingredient['product_id']);
            $oldStock = $product->stock;
            $product->stock -= $ingredient['quantity'];
            $product->save();
            
            \Log::info('خصم المخزون', [
                'product' => $product->name,
                'old_stock' => $oldStock,
                'new_stock' => $product->stock,
                'quantity_deducted' => $ingredient['quantity']
            ]);
        }

        // 4. إعداد بيانات المكونات للحفظ
        $ingredientsData = [];
        foreach ($request->ingredients as $ingredient) {
            $product = Product::find($ingredient['product_id']);
            $ingredientsData[] = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'quantity' => $ingredient['quantity'],
                'unit' => $product->unit ?? 'وحدة'
            ];
        }

        \Log::info('📋 بيانات المكونات جاهزة', ['ingredients_count' => count($ingredientsData)]);

        // 5. حفظ عملية التحضير باستخدام رقم افتراضي
        $preparation = MealPreparation::create([
            'meal_name' => $request->meal_name,
            'ingredients' => json_encode($ingredientsData),
            'notes' => $request->notes ?? '',
            'prepared_by' => 1 // قيمة رقمية افتراضية
        ]);

        \Log::info('✅ تم حفظ الوجبة في MealPreparation', ['id' => $preparation->id]);

        // 6. إضافة prepared_by_text كـ notes إضافية إذا أرسل
        $preparedByText = '';
        if ($request->has('prepared_by') && $request->prepared_by) {
            $preparedByText = " - المحضر: " . $request->prepared_by;
            $preparation->notes .= $preparedByText;
            $preparation->save();
            \Log::info('تم إضافة اسم المحضر', ['prepared_by' => $request->prepared_by]);
        }

        // ⭐⭐⭐⭐ الكود الجديد: حفظ في جدول PreparedMeal للسجل الدائم
        try {
            // حساب التكلفة الإجمالية
            $totalCost = 0;
            foreach ($ingredientsData as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                $price = $product->price ?? $product->purchase_price ?? 0;
                $totalCost += ($price * $ingredient['quantity']);
            }

            \Log::info('💰 حساب التكلفة', ['total_cost' => $totalCost]);

            $preparedMeal = PreparedMeal::create([
                'meal_name' => $request->meal_name,
                'ingredients' => json_encode($ingredientsData), // تأكد من استخدام json_encode
                'total_cost' => $totalCost,
                'quantity' => 1,
                'prepared_by' => $request->prepared_by ?? 'غير معروف',
                'notes' => $request->notes . $preparedByText,
                'prepared_at' => now()
            ]);

            \Log::info('📝 تم حفظ السجل الدائم في PreparedMeal', [
                'id' => $preparedMeal->id,
                'meal_name' => $preparedMeal->meal_name,
                'prepared_at' => $preparedMeal->prepared_at
            ]);

        } catch (\Exception $e) {
            \Log::error('❌ خطأ في حفظ PreparedMeal', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            // لا توقف العملية إذا فشل حفظ السجل الدائم
        }
        // ⭐⭐⭐⭐ نهاية الكود الجديد

        \Log::info('🎉 تم تحضير الوجبة بنجاح', [
            'meal_name' => $request->meal_name,
            'ingredients_count' => count($ingredientsData),
            'preparedMeal_id' => $preparedMeal->id ?? 'لم يتم الحفظ'
        ]);

        return response()->json([
            'success' => true,
            'message' => "✅ تم تحضير '{$request->meal_name}' بنجاح",
            'data' => [
                'id' => $preparation->id,
                'meal_name' => $preparation->meal_name,
                'notes' => $preparation->notes,
                'prepared_by_text' => $request->prepared_by ?? 'غير محدد',
                'ingredients' => json_decode($preparation->ingredients, true),
                'created_at' => $preparation->created_at->format('Y-m-d H:i:s'),
                'prepared_meal_record_id' => $preparedMeal->id ?? null // إرجاع ID السجل الدائم
            ]
        ]);

    } catch (\Exception $e) {
        \Log::error('🔥 خطأ فادح في تحضير الوجبة', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'request' => $request->all()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ: ' . $e->getMessage(),
            'hint' => 'حاول إرسال الطلب بدون حقل prepared_by'
        ], 500);
    }
}

    public function history(Request $request)
    {
        $query = MealPreparation::orderBy('created_at', 'desc');
        
        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        
        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }
        
        if ($request->has('meal_name')) {
            $query->where('meal_name', 'like', "%{$request->meal_name}%");
        }

        $preparations = $query->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $preparations
        ]);
    }

    public function checkIngredients(Request $request)
    {
        $request->validate([
            'ingredients' => 'required|array',
            'ingredients.*.product_id' => 'required|exists:products,id',
            'ingredients.*.quantity' => 'required|numeric|min:0.01'
        ]);

        $results = [];
        $allAvailable = true;
        
        foreach ($request->ingredients as $ingredient) {
            $product = Product::find($ingredient['product_id']);
            $available = $product->stock >= $ingredient['quantity'];
            
            $results[] = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'required' => $ingredient['quantity'],
                'available' => $product->stock,
                'unit' => $product->unit,
                'is_available' => $available,
                'deficit' => $available ? 0 : $ingredient['quantity'] - $product->stock
            ];
            
            if (!$available) {
                $allAvailable = false;
            }
        }

        return response()->json([
            'success' => true,
            'all_available' => $allAvailable,
            'ingredients' => $results
        ]);
    }
}