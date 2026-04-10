<?php

namespace App\Http\Controllers;

use App\Models\Meal;
use App\Models\Category;
use App\Models\MealIngredient; 
use App\Models\MealOption; 
use App\Models\MealProductIngredient;
use App\Models\Product;
use App\Models\MealOrderItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB; // ⭐ هذا هنا في الأعلى

class MealController extends Controller
{
 

public function index(Request $request)
{
    try {
        $perPage = $request->get('per_page', 15);
        $search = $request->get('search');
        $categoryId = $request->get('category_id');
        $withIngredients = $request->get('with_ingredients', false); // ⭐ جديد
        
        $query = Meal::with(['category:id,name,icon']);
        
        if ($withIngredients) {
            $query->with(['ingredients.category:id,name,parent_id,cost_price,sale_price']);
        }
        $query->with(['options' => fn($q) => $q->where('is_active', true)->orderBy('sort_order')->orderBy('id')]);
        
        $query->orderBy('name');
        
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('meals.name', 'LIKE', "%{$search}%")
                  ->orWhere('meals.description', 'LIKE', "%{$search}%")
                  ->orWhere('meals.code', 'LIKE', "%{$search}%")
                  ->orWhereHas('category', function ($q2) use ($search) {
                      $q2->where('name', 'LIKE', "%{$search}%");
                  });
            });
        }
        
        if ($categoryId) {
            $query->where('category_id', $categoryId);
        }
        
        $meals = $query->paginate($perPage);
        
        // ⭐ معالجة البيانات لتعرض المكونات بشكل منظم
        $mealsData = $meals->map(function ($meal) use ($withIngredients) {
            $mealData = [
                'id' => $meal->id,
                'name' => $meal->name,
                'code' => $meal->code,
                'description' => $meal->description,
                'cost_price' => $meal->cost_price,
                'sale_price' => $meal->sale_price,
                'profit_margin' => $meal->profit_margin,
                'quantity' => $meal->quantity,
                'min_quantity' => $meal->min_quantity,
                'max_quantity' => $meal->max_quantity,
                'track_quantity' => $meal->track_quantity,
                'is_active' => $meal->is_active,
                'category_id' => $meal->category_id,
                'created_at' => $meal->created_at,
                'updated_at' => $meal->updated_at,
                'category' => $meal->category ? [
                    'id' => $meal->category->id,
                    'name' => $meal->category->name,
                    'icon' => $meal->category->icon
                ] : null,
                'options' => $meal->relationLoaded('options') ? $meal->options->map(fn($o) => [
                    'id' => $o->id,
                    'name' => $o->name,
                    'price' => (float) $o->price,
                    'additional_cost' => (float) $o->additional_cost,
                    'group_name' => $o->group_name,
                    'sort_order' => $o->sort_order,
                ])->values()->all() : []
            ];
            
            // ⭐ إضافة المكونات إذا طلبها المستخدم
            if ($withIngredients && $meal->relationLoaded('ingredients')) {
                $mealData['ingredients'] = $meal->ingredients->map(function ($ingredient) {
                    return [
                        'id' => $ingredient->id,
                        'meal_id' => $ingredient->meal_id,
                        'sub_category' => $ingredient->category ? [
                            'id' => $ingredient->category->id,
                            'name' => $ingredient->category->name,
                            'parent_id' => $ingredient->category->parent_id,
                            'cost_price' => $ingredient->category->cost_price,
                            'sale_price' => $ingredient->category->sale_price,
                            'quantity' => $ingredient->category->quantity,
                            'track_quantity' => $ingredient->category->track_quantity
                        ] : null,
                        'quantity_used' => $ingredient->quantity,
                        'unit' => $ingredient->unit,
                        'unit_cost' => $ingredient->unit_cost,
                        'total_cost' => $ingredient->total_cost,
                        'notes' => $ingredient->notes,
                        'sort_order' => $ingredient->sort_order,
                        'calculated_cost' => $ingredient->unit_cost * $ingredient->quantity
                    ];
                });
                
                // ⭐ إحصائيات المكونات
                $mealData['ingredients_stats'] = [
                    'total_ingredients' => $meal->ingredients->count(),
                    'total_quantity_used' => $meal->ingredients->sum('quantity'),
                    'total_ingredients_cost' => $meal->ingredients->sum('total_cost'),
                    'average_unit_cost' => $meal->ingredients->avg('unit_cost')
                ];
            }
            
            return $mealData;
        });
        
        return response()->json([
            'success' => true,
            'data' => $mealsData,
            'pagination' => [
                'total' => $meals->total(),
                'per_page' => $meals->perPage(),
                'current_page' => $meals->currentPage(),
                'last_page' => $meals->lastPage(),
                'from' => $meals->firstItem(),
                'to' => $meals->lastItem()
            ],
            'message' => 'تم جلب الوجبات بنجاح' . ($withIngredients ? ' مع المكونات' : '')
        ]);
        
    } catch (\Exception $e) {
        Log::error('MealController@index - Error', [
            'error' => $e->getMessage(),
            'request' => $request->all()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب بيانات الوجبات',
            'error' => config('app.debug') ? $e->getMessage() : null
        ], 500);
    }
}






    
public function store(Request $request)
{
    $validator = Validator::make($request->all(), [
        'name' => 'required|string|max:255',
        'code' => 'nullable|string|max:50|unique:meals,code',
        'description' => 'nullable|string',
        'category_id' => 'required|exists:categories,id',
        'sale_price' => 'required|numeric|min:0',
        'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        
        'ingredients' => 'required|array|min:1',
        'ingredients.*.sub_category_id' => 'required|exists:categories,id',
        'ingredients.*.quantity_needed' => 'required|numeric|min:0.001',
        'ingredients.*.unit' => 'nullable|string|max:50',
        'ingredients.*.notes' => 'nullable|string',
        
        // ✅ إضافة التحقق من الخيارات
        'options' => 'nullable|array',
        'options.*.name' => 'required|string|max:255',
        'options.*.price' => 'required|numeric|min:0',
        'options.*.additional_cost' => 'nullable|numeric|min:0',
        'options.*.group_name' => 'nullable|string|max:255',
        'options.*.sort_order' => 'nullable|integer'
    ]);
    
    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'خطأ في التحقق من البيانات',
            'errors' => $validator->errors()
        ], 422);
    }
    
    DB::beginTransaction();
    
    try {
        // التحقق أن القسم الرئيسي للوجبة
        $mainCategory = Category::find($request->category_id);
        
        if (!$mainCategory) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'القسم الرئيسي غير موجود'
            ], 404);
        }
        
        if ($mainCategory->parent_id !== null) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'الوجبات يمكن إضافتها فقط تحت أقسام رئيسية'
            ], 422);
        }
        // ⭐ قسم الوجبة يجب أن يكون من أقسام المبيعات (لحوم أطباق، عصائر، سلطات...)
        if (($mainCategory->scope ?? 'purchase') !== 'sales') {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'يجب اختيار قسم من أقسام المبيعات (لحوم، عصائر، سلطات...)'
            ], 422);
        }
        
        $totalCost = 0;
        $ingredientsData = [];
        $errors = [];
        $stockUpdates = [];
        
        // حساب التكلفة الإجمالية من المكونات والتحقق من المخزون
        foreach ($request->ingredients as $index => $ingredient) {
            $subCategory = Category::find($ingredient['sub_category_id']);
            
            if (!$subCategory) {
                $errors[] = "المكون رقم " . ($index + 1) . ": القسم غير موجود";
                continue;
            }
            
            // التحقق أن المكون من قسم فرعي
            if ($subCategory->parent_id === null) {
                $errors[] = "المكون '{$subCategory->name}' يجب أن يكون قسم فرعي";
                continue;
            }
            // ⭐ المكونات من أقسام المشتريات فقط (مخزون المواد)
            if (($subCategory->scope ?? 'purchase') !== 'purchase') {
                $errors[] = "المكون '{$subCategory->name}' يجب أن يكون من أقسام المشتريات";
                continue;
            }
            
            $quantityNeeded = floatval($ingredient['quantity_needed']);
            $availableQuantity = floatval($subCategory->quantity);
            
            // التحقق من المخزون المتوفر
            if ($quantityNeeded > $availableQuantity) {
                $errors[] = "المكون '{$subCategory->name}': الكمية المطلوبة ({$quantityNeeded}) أكبر من المخزون المتوفر ({$availableQuantity})";
                continue;
            }
            
            // تسجيل تحديث المخزون المطلوب
            $stockUpdates[] = [
                'category' => $subCategory,
                'quantity_needed' => $quantityNeeded,
                'previous_quantity' => $availableQuantity
            ];
            
            // الحصول على سعر التكلفة
            $unitCost = 0;

            if (!is_null($subCategory->cost_price) && floatval($subCategory->cost_price) > 0) {
                $unitCost = floatval($subCategory->cost_price);
            } 
            elseif (!is_null($subCategory->sale_price) && floatval($subCategory->sale_price) > 0) {
                $unitCost = floatval($subCategory->sale_price);
            }

            if ($unitCost <= 0) {
                $errors[] = "المكون '{$subCategory->name}' ليس له سعر تكلفة محدد";
                continue;
            }
            
            // حساب تكلفة هذا المكون
            $ingredientCost = $unitCost * $quantityNeeded;
            $totalCost += $ingredientCost;
            
            // تخزين بيانات المكون
            $ingredientsData[] = [
                'category_id' => $subCategory->id,
                'sub_category_name' => $subCategory->name,
                'quantity_needed' => $quantityNeeded,
                'unit' => $ingredient['unit'] ?? 'piece',
                'unit_cost' => $unitCost,
                'ingredient_cost' => $ingredientCost,
                'notes' => $ingredient['notes'] ?? null,
                'available_quantity' => $availableQuantity
            ];
        }
        
        if (count($errors) > 0) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'أخطاء في المكونات',
                'errors' => $errors
            ], 422);
        }
        
        if ($totalCost <= 0) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن إنشاء وجبة بدون تكلفة'
            ], 422);
        }
        
        // خصم الكميات من المخزون
        $stockDeductions = [];
        foreach ($stockUpdates as $stockUpdate) {
            $category = $stockUpdate['category'];
            $quantityNeeded = $stockUpdate['quantity_needed'];
            $previousQuantity = $stockUpdate['previous_quantity'];
            
            $newQuantity = $previousQuantity - $quantityNeeded;
            
            $category->update([
                'quantity' => max(0, $newQuantity)
            ]);
            
            $category->refresh();
            
            $stockDeductions[] = [
                'category_id' => $category->id,
                'category_name' => $category->name,
                'quantity_deducted' => $quantityNeeded,
                'previous_quantity' => $previousQuantity,
                'new_quantity' => $category->quantity
            ];
        }
        
        // حساب سعر البيع
        $costPrice = round($totalCost, 2);
        $salePrice = round($request->sale_price, 2);
        $profitMargin = 0;        
        if ($costPrice > 0) {
            $profitMargin = round((($salePrice - $costPrice) / $costPrice) * 100, 2);
        }
        
        // إنشاء الوجبة
        $mealData = [
            'name' => $request->name,
            'code' => $request->code ?? 'ML' . time(),
            'description' => $request->description,
            'category_id' => $request->category_id,
            'cost_price' => $costPrice,
            'sale_price' => $salePrice,
            'profit_margin' => $profitMargin,
            'quantity' => 0,
            'min_quantity' => 0,
            'max_quantity' => 100,
            'track_quantity' => true,
            'is_active' => true
        ];

        // معالجة الصورة إذا تم رفعها
        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imageName = time() . '_' . uniqid() . '.' . $image->getClientOriginalExtension();
            $image->storeAs('meals', $imageName, 'public');
            $mealData['image'] = 'meals/' . $imageName;
        }

        $meal = Meal::create($mealData);
        
        // إضافة المكونات
        foreach ($ingredientsData as $index => $ingredient) {
            MealIngredient::create([
                'meal_id' => $meal->id,
                'category_id' => $ingredient['category_id'],
                'quantity' => $ingredient['quantity_needed'],
                'unit' => $ingredient['unit'],
                'unit_cost' => $ingredient['unit_cost'],
                'total_cost' => $ingredient['ingredient_cost'],
                'notes' => $ingredient['notes'],
                'sort_order' => $index
            ]);
        }
        
        // ✅ 🔥 الأهم: إضافة الخيارات إذا وجدت
        if ($request->has('options') && is_array($request->options)) {
            foreach ($request->options as $index => $optionData) {
                MealOption::create([
                    'meal_id' => $meal->id,
                    'name' => $optionData['name'],
                    'price' => $optionData['price'],
                    'additional_cost' => $optionData['additional_cost'] ?? 0,
                    'group_name' => $optionData['group_name'] ?? null,
                    'sort_order' => $optionData['sort_order'] ?? $index,
                    'is_active' => true
                ]);
            }
        }
        
        DB::commit();
        
        // ✅ تحميل الخيارات مع الوجبة للرد
        $meal->load('options');
        
        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الوجبة مع ' . count($ingredientsData) . ' مكون و ' . 
                        ($request->has('options') ? count($request->options) : 0) . ' خيار بنجاح ✓',
            'data' => [
                'meal' => [
                    'id' => $meal->id,
                    'name' => $meal->name,
                    'code' => $meal->code,
                    'description' => $meal->description,
                    'cost_price' => $meal->cost_price,
                    'sale_price' => $meal->sale_price,
                    'sale_price_entered' => $salePrice,
                    'profit_margin_calculated' => $profitMargin,
                    'profit_margin' => $meal->profit_margin,
                    'quantity' => $meal->quantity,
                    'category_id' => $meal->category_id
                ],
                'ingredients' => $ingredientsData,
                'options' => $meal->options, // ✅ الخيارات هنا
                'stock_deductions' => $stockDeductions,
                'cost_calculation' => [
                    'total_ingredients_cost' => $costPrice,
                    'profit_margin_percent' => $profitMargin,
                    'calculated_sale_price' => $salePrice,
                    'profit_amount' => $salePrice - $costPrice
                ]
            ]
        ], 201);
        
    } catch (\Exception $e) {
        DB::rollBack();
        
        Log::error('MealController@store - Error', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'request' => $request->all()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء إنشاء الوجبة',
            'error' => config('app.debug') ? $e->getMessage() : null
        ], 500);
    }
}

/**
 * إنشاء وجبة/منتج من أصناف المشتريات مع خصم المخزون وإضافتها لقسم مبيعات بسعر ثابت
 */
public function createFromProducts(Request $request)
{
    $validator = Validator::make($request->all(), [
        'name' => 'required|string|max:255',
        'code' => 'nullable|string|max:50|unique:meals,code',
        'description' => 'nullable|string',
        'category_id' => 'required|exists:categories,id',
        'sale_price' => 'required|numeric|min:0',
        'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        'ingredients' => 'required|array|min:1',
        'ingredients.*.product_id' => 'required|exists:products,id',
        'ingredients.*.quantity' => 'required|numeric|min:0.001',
        'options' => 'nullable|array',
        'options.*.name' => 'required_with:options|string|max:255',
        'options.*.price' => 'required_with:options|numeric|min:0',
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'خطأ في التحقق من البيانات',
            'errors' => $validator->errors()
        ], 422);
    }

    $mainCategory = Category::find($request->category_id);
    if (!$mainCategory) {
        return response()->json(['success' => false, 'message' => 'القسم غير موجود'], 404);
    }
    if (($mainCategory->scope ?? 'purchase') !== 'sales') {
        return response()->json([
            'success' => false,
            'message' => 'يجب اختيار قسم من أقسام المبيعات (لحوم، عصائر، سلطات...)'
        ], 422);
    }

    $errors = [];
    $totalCost = 0;
    $ingredientsData = [];

    foreach ($request->ingredients as $index => $row) {
        $product = Product::find($row['product_id']);
        if (!$product) {
            $errors[] = "المكون " . ($index + 1) . ": المنتج غير موجود";
            continue;
        }
        $qty = (float) $row['quantity'];
        $stock = (float) $product->stock;
        if ($qty > $stock) {
            $errors[] = "المكون '{$product->name}': الكمية المطلوبة ({$qty}) أكبر من المخزون ({$stock})";
            continue;
        }
        $unitCost = (float) ($product->cost_price ?? $product->purchase_price ?? 0);
        $totalCost += $unitCost * $qty;
        $ingredientsData[] = [
            'product' => $product,
            'quantity_used' => $qty,
            'unit_cost' => $unitCost,
        ];
    }

    if (count($errors) > 0) {
        return response()->json([
            'success' => false,
            'message' => 'أخطاء في المكونات',
            'errors' => $errors
        ], 422);
    }

    DB::beginTransaction();
    try {
        $costPrice = round($totalCost, 2);
        $hasOptions = $request->has('options') && is_array($request->options) && count($request->options) > 0;
        $salePrice = $hasOptions ? 0 : round((float) $request->sale_price, 2);
        $profitMargin = $costPrice > 0 ? round((($salePrice - $costPrice) / $costPrice) * 100, 2) : 0;

        $mealData = [
            'name' => $request->name,
            'code' => $request->code ?? 'ML' . time(),
            'description' => $request->description,
            'category_id' => $request->category_id,
            'cost_price' => $costPrice,
            'sale_price' => $salePrice,
            'profit_margin' => $profitMargin,
            'fixed_price' => true,
            'min_quantity' => 0,
            'max_quantity' => 0,
            'track_quantity' => false,
            'is_available' => true,
        ];

        // معالجة الصورة إذا تم رفعها
        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imageName = time() . '_' . uniqid() . '.' . $image->getClientOriginalExtension();
            $image->storeAs('meals', $imageName, 'public');
            $mealData['image'] = 'meals/' . $imageName;
        }

        $meal = Meal::create($mealData);

        foreach ($ingredientsData as $item) {
            MealProductIngredient::create([
                'meal_id' => $meal->id,
                'product_id' => $item['product']->id,
                'quantity_used' => $item['quantity_used'],
            ]);
            $item['product']->decreaseStock($item['quantity_used']);
        }

        if ($hasOptions) {
            foreach ($request->options as $index => $opt) {
                MealOption::create([
                    'meal_id' => $meal->id,
                    'name' => $opt['name'],
                    'price' => round((float) ($opt['price'] ?? 0), 2),
                    'additional_cost' => 0,
                    'group_name' => 'الحجم',
                    'sort_order' => $index,
                    'is_active' => true,
                ]);
            }
        }

        DB::commit();

        $meal->load(['category:id,name,icon', 'productIngredients.product:id,name,stock,cost_price', 'options']);

        return response()->json([
            'success' => true,
            'message' => $hasOptions
                ? 'تم إنشاء الوجبة مع الأحجام/الخيارات وخصم المكونات من المخزون'
                : 'تم إنشاء الوجبة وخصم المكونات من المخزون، وتظهر في الكاشير بالسعر الثابت',
            'data' => [
                'meal' => [
                    'id' => $meal->id,
                    'name' => $meal->name,
                    'code' => $meal->code,
                    'category_id' => $meal->category_id,
                    'sale_price' => $meal->sale_price,
                    'cost_price' => $meal->cost_price,
                    'fixed_price' => true,
                    'category' => $meal->category ? ['id' => $meal->category->id, 'name' => $meal->category->name, 'icon' => $meal->category->icon] : null,
                ],
                'options' => $meal->relationLoaded('options') ? $meal->options->map(fn ($o) => ['id' => $o->id, 'name' => $o->name, 'price' => (float) $o->price])->values() : [],
                'product_ingredients' => $meal->productIngredients->map(fn ($pi) => [
                    'product_id' => $pi->product_id,
                    'product_name' => $pi->product->name ?? null,
                    'quantity_used' => $pi->quantity_used,
                ]),
            ]
        ], 201);

    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('MealController@createFromProducts', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'request' => $request->all()
        ]);
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء إنشاء الوجبة',
            'error' => config('app.debug') ? $e->getMessage() : null
        ], 500);
    }
}

public function updateSalePrice(Request $request, $id)
{
    $meal = Meal::find($id);
    
    if (!$meal) {
        return response()->json([
            'success' => false,
            'message' => 'الوجبة غير موجودة'
        ], 404);
    }

    if ($meal->fixed_price) {
        return response()->json([
            'success' => false,
            'message' => 'هذه الوجبة ذات سعر ثابت ولا يمكن تغيير سعر البيع منها'
        ], 422);
    }
    
    $validator = Validator::make($request->all(), [
        'sale_price' => 'required|numeric|min:0',
        'update_profit_margin' => 'boolean|nullable', // إذا أردنا تحديث هامش الربح تلقائياً
        'reason' => 'nullable|string|max:255', // سبب التعديل (اختياري)
        'apply_to_all_similar' => 'boolean|nullable' // تطبيق على الوجبات المشابهة
    ]);
    
    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'خطأ في التحقق من البيانات',
            'errors' => $validator->errors()
        ], 422);
    }
    
    DB::beginTransaction();
    
    try {
        $oldSalePrice = $meal->sale_price;
        $oldProfitMargin = $meal->profit_margin;
        
        // حساب هامش الربح الجديد إذا طُلب
        $newProfitMargin = $oldProfitMargin;
        if ($request->get('update_profit_margin', false) && $meal->cost_price > 0) {
            $newProfitMargin = round((($request->sale_price - $meal->cost_price) / $meal->cost_price) * 100, 2);
        }
        
        // تحديث الوجبة
        $meal->update([
            'sale_price' => $request->sale_price,
            'profit_margin' => $newProfitMargin
        ]);
        
        // إذا طُلب تطبيق السعر على الوجبات المشابهة (بنفس التكلفة أو الاسم)
        $similarMealsUpdated = 0;
        if ($request->get('apply_to_all_similar', false)) {
            $similarMeals = Meal::where('id', '!=', $id)
                ->where('cost_price', $meal->cost_price)
                ->orWhere('name', 'LIKE', "%{$meal->name}%")
                ->get();
            
            foreach ($similarMeals as $similarMeal) {
                $similarMeal->update([
                    'sale_price' => $request->sale_price,
                    'profit_margin' => $newProfitMargin
                ]);
                $similarMealsUpdated++;
            }
        }
        
        DB::commit();
        
        // تسجيل النشاط في السجل (إذا كان لديك نظام للسجلات)
        Log::info('Meal sale price updated', [
            'meal_id' => $meal->id,
            'meal_name' => $meal->name,
            'old_price' => $oldSalePrice,
            'new_price' => $request->sale_price,
            'old_margin' => $oldProfitMargin,
            'new_margin' => $newProfitMargin,
            'reason' => $request->reason,
            'updated_by' => auth()->id() ?? null
        ]);
        
        $response = [
            'success' => true,
            'message' => 'تم تحديث سعر البيع بنجاح',
            'data' => [
                'meal' => [
                    'id' => $meal->id,
                    'name' => $meal->name,
                    'old_sale_price' => $oldSalePrice,
                    'new_sale_price' => $meal->sale_price,
                    'cost_price' => $meal->cost_price,
                    'old_profit_margin' => $oldProfitMargin,
                    'new_profit_margin' => $meal->profit_margin,
                    'profit_amount' => $meal->sale_price - $meal->cost_price
                ],
                'similar_meals_updated' => $similarMealsUpdated
            ]
        ];
        
        // إضافة تحذير إذا كان سعر البيع أقل من سعر التكلفة
        if ($meal->sale_price < $meal->cost_price) {
            $response['warning'] = '⚠️ سعر البيع أقل من سعر التكلفة!';
        }
        
        return response()->json($response);
        
    } catch (\Exception $e) {
        DB::rollBack();
        
        Log::error('MealController@updateSalePrice - Error', [
            'error' => $e->getMessage(),
            'meal_id' => $id,
            'request' => $request->all()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء تحديث سعر البيع',
            'error' => config('app.debug') ? $e->getMessage() : null
        ], 500);
    }
}


/**
 * استعادة الكميات من المخزون (عند حذف الوجبة)
 */
public function restoreStock($mealId)
{
    $meal = Meal::with('ingredients.category')->find($mealId);
    
    if (!$meal) {
        return false;
    }
    
    DB::beginTransaction();
    
    try {
        foreach ($meal->ingredients as $ingredient) {
            if ($ingredient->category && $ingredient->category->track_quantity) {
                $ingredient->category->increment('quantity', $ingredient->quantity);
            }
        }
        
        DB::commit();
        return true;
        
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Failed to restore stock', ['error' => $e->getMessage()]);
        return false;
    }
}

// استخدمها في دالة destroy
public function destroy($id)
{
    try {
        $meal = Meal::find($id);
        
        if (!$meal) {
            return response()->json([
                'success' => false,
                'message' => 'الوجبة غير موجودة'
            ], 404);
        }
        
        // استعادة الكميات أولاً
        $this->restoreStock($id);
        
        $meal->delete();
        
        return response()->json([
            'success' => true,
            'message' => 'تم حذف الوجبة واستعادة المخزون بنجاح'
        ]);
        
    } catch (\Exception $e) {
        Log::error('MealController@destroy - Error', [
            'error' => $e->getMessage(),
            'meal_id' => $id
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء حذف الوجبة'
        ], 500);
    }
}


/**
 * تقرير مفصل للوجبات مع المكونات
 */
public function getMealsDetailedReport(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'category_id' => 'nullable|exists:categories,id',
            'meal_id' => 'nullable|exists:meals,id',
            'search' => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:1|max:100'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }

        // بناء الاستعلام
        $query = Meal::with([
            'category:id,name',
            'ingredients' => function ($q) {
                $q->with(['category' => function ($q2) {
                    $q2->select('id', 'name', 'parent_id', 'cost_price', 'sale_price', 'quantity');
                }])
                ->orderBy('sort_order');
            },
            'productIngredients' => function ($q) {
                $q->with(['product:id,name,unit,cost_price,purchase_price,stock']);
            }
        ]);

        // تطبيق الفلاتر
        if ($request->start_date) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }

        if ($request->end_date) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        if ($request->category_id) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->meal_id) {
            $query->where('id', $request->meal_id);
        }

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'LIKE', "%{$request->search}%")
                  ->orWhere('code', 'LIKE', "%{$request->search}%");
            });
        }

        // الترتيب
        $query->orderBy('created_at', 'desc');

        // التقسيم (pagination)
        $perPage = $request->get('per_page', 50);
        $meals = $query->paginate($perPage);

        // تجهيز البيانات للعرض (مع الكمية المباعة في نطاق التاريخ إن وُجد)
        $startDate = $request->start_date ? \Carbon\Carbon::parse($request->start_date)->startOfDay() : null;
        $endDate = $request->end_date ? \Carbon\Carbon::parse($request->end_date)->endOfDay() : null;

        $mealsData = $meals->map(function ($meal) use ($startDate, $endDate) {
            $ingredientsList = [];
            $totalIngredientsCost = 0;

            // مكونات من جدول meal_ingredients (أقسام)
            foreach ($meal->ingredients as $ingredient) {
                if ($ingredient->category) {
                    $ingredientCost = $ingredient->total_cost ?? 
                                     ($ingredient->unit_cost * $ingredient->quantity);
                    $totalIngredientsCost += $ingredientCost;

                    $ingredientsList[] = [
                        'name' => $ingredient->category->name,
                        'quantity' => number_format($ingredient->quantity, 3),
                        'unit' => $ingredient->unit ?? 'قطعة',
                        'unit_cost' => $ingredient->unit_cost,
                        'total_cost' => $ingredientCost,
                        'available_stock' => $ingredient->category->quantity ?? 0
                    ];
                }
            }

            // مكونات من جدول meal_product_ingredients (أصناف المشتريات)
            if ($meal->relationLoaded('productIngredients')) {
                foreach ($meal->productIngredients as $pi) {
                    $product = $pi->product;
                    if (!$product) continue;
                    $qty = (float) $pi->quantity_used;
                    $unitCost = (float) ($product->cost_price ?? $product->purchase_price ?? 0);
                    $ingTotal = $qty * $unitCost;
                    $totalIngredientsCost += $ingTotal;
                    $ingredientsList[] = [
                        'name' => $product->name,
                        'quantity' => number_format($qty, 3),
                        'unit' => $product->unit ?? 'وحدة',
                        'unit_cost' => $unitCost,
                        'total_cost' => $ingTotal,
                        'available_stock' => $product->stock ?? 0
                    ];
                }
            }

            // إذا لم يكن هناك مكونات محسوبة، استخدم cost_price المخزن في الوجبة
            if ($totalIngredientsCost <= 0 && ($meal->cost_price ?? 0) > 0) {
                $totalIngredientsCost = (float) $meal->cost_price;
            }

            // الكمية المباعة (مع أو بدون نطاق تاريخ) + تفصيل كاش/تطبيق
            $baseOrderQuery = function ($q) use ($startDate, $endDate) {
                $q->where('status', 'paid');
                if ($startDate && $endDate) {
                    $q->whereBetween('created_at', [$startDate, $endDate]);
                }
            };
            $quantitySold = (float) MealOrderItem::where('meal_id', $meal->id)
                ->whereHas('order', $baseOrderQuery)
                ->sum('quantity');

            $quantitySoldCash = (float) MealOrderItem::where('meal_id', $meal->id)
                ->whereHas('order', function ($q) use ($startDate, $endDate) {
                    $q->where('status', 'paid')->where('payment_method', 'cash');
                    if ($startDate && $endDate) {
                        $q->whereBetween('created_at', [$startDate, $endDate]);
                    }
                })
                ->sum('quantity');

            $quantitySoldApp = (float) MealOrderItem::where('meal_id', $meal->id)
                ->whereHas('order', function ($q) use ($startDate, $endDate) {
                    $q->where('status', 'paid')->where('payment_method', 'app');
                    if ($startDate && $endDate) {
                        $q->whereBetween('created_at', [$startDate, $endDate]);
                    }
                })
                ->sum('quantity');

            $amountSoldCash = (float) MealOrderItem::where('meal_id', $meal->id)
                ->whereHas('order', function ($q) use ($startDate, $endDate) {
                    $q->where('status', 'paid')->where('payment_method', 'cash');
                    if ($startDate && $endDate) {
                        $q->whereBetween('created_at', [$startDate, $endDate]);
                    }
                })
                ->sum('total_price');

            $amountSoldApp = (float) MealOrderItem::where('meal_id', $meal->id)
                ->whereHas('order', function ($q) use ($startDate, $endDate) {
                    $q->where('status', 'paid')->where('payment_method', 'app');
                    if ($startDate && $endDate) {
                        $q->whereBetween('created_at', [$startDate, $endDate]);
                    }
                })
                ->sum('total_price');

            return [
                'id' => $meal->id,
                'name' => $meal->name,
                'code' => $meal->code,
                'category' => $meal->category->name ?? 'غير محدد',
                'created_at' => $meal->created_at->format('Y-m-d H:i:s'),
                'created_date' => $meal->created_at->format('Y-m-d'),
                'cost_price' => $meal->cost_price,
                'sale_price' => $meal->sale_price,
                'profit_margin' => $meal->profit_margin,
                'profit_amount' => $meal->sale_price - $meal->cost_price,
                'is_active' => $meal->is_active,
                'ingredients_count' => count($ingredientsList),
                'ingredients' => $ingredientsList,
                'total_ingredients_cost' => round($totalIngredientsCost, 2),
                'ingredients_json' => json_encode($ingredientsList, JSON_UNESCAPED_UNICODE),
                'quantity_sold' => $quantitySold,
                'quantity_sold_cash' => $quantitySoldCash,
                'quantity_sold_app' => $quantitySoldApp,
                'amount_sold_cash' => round($amountSoldCash, 2),
                'amount_sold_app' => round($amountSoldApp, 2),
            ];
        });

        // إحصائيات عامة
        $stats = [
            'total_meals' => $meals->total(),
            'total_cost_value' => $mealsData->sum('total_ingredients_cost'),
            'total_sale_value' => $mealsData->sum('sale_price'),
            'total_profit' => $mealsData->sum('profit_amount'),
            'total_quantity_sold' => $mealsData->sum('quantity_sold'),
            'average_profit_margin' => $mealsData->avg('profit_margin'),
            'total_ingredients_used' => $mealsData->sum('ingredients_count')
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'meals' => $mealsData,
                'stats' => $stats,
                'pagination' => [
                    'current_page' => $meals->currentPage(),
                    'per_page' => $meals->perPage(),
                    'total' => $meals->total(),
                    'last_page' => $meals->lastPage()
                ],
                'filters' => $request->all()
            ],
            'message' => 'تم جلب تقرير الوجبات بنجاح'
        ]);

    } catch (\Exception $e) {
        Log::error('خطأ في تقرير الوجبات', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);

        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب التقرير',
            'error' => config('app.debug') ? $e->getMessage() : null
        ], 500);
    }
}


    public function deleteMealsByCategory($categoryId)
    {
        try {
            DB::beginTransaction();

            $meals = Meal::where('category_id', $categoryId)->get();
            $count = $meals->count();

            if ($count === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا توجد وجبات في هذا القسم'
                ], 404);
            }

            $deletedMeals = [];

            foreach ($meals as $meal) {
                $deletedMeals[] = [
                    'id' => $meal->id,
                    'name' => $meal->name
                ];
                $meal->delete();
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => sprintf('تم حذف %d وجبة من القسم', $count),
                'data' => [
                    'category_id' => $categoryId,
                    'deleted_count' => $count,
                    'deleted_meals' => $deletedMeals
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('خطأ في حذف وجبات القسم', [
                'category_id' => $categoryId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء حذف وجبات القسم',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }


    
    public function deleteMeal($id)
    {
        try {
            Log::info('بدء حذف وجبة', ['id' => $id]);
            
            $meal = Meal::find($id);
            
            if (!$meal) {
                return response()->json([
                    'success' => false,
                    'message' => 'الوجبة غير موجودة'
                ], 404);
            }

            // حفظ معلومات الوجبة قبل الحذف
            $mealInfo = [
                'id' => $meal->id,
                'name' => $meal->name,
                'code' => $meal->code,
                'category' => $meal->category?->name
            ];

            // حذف الوجبة (soft delete)
            $meal->delete();

            Log::info('تم حذف الوجبة بنجاح', $mealInfo);

            return response()->json([
                'success' => true,
                'message' => 'تم حذف الوجبة بنجاح',
                'data' => [
                    'deleted_meal' => $mealInfo,
                    'restore_endpoint' => "/api/meals/{$id}/restore",
                    'force_delete_endpoint' => "/api/meals/{$id}/force"
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('خطأ في حذف الوجبة', [
                'id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء حذف الوجبة',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * حذف وجبات متعددة دفعة واحدة
     */
    public function deleteMultipleMeals(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|exists:meals,id',
            'force' => 'nullable|boolean' // حذف نهائي؟
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'بيانات غير صالحة',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $deleted = [];
            $failed = [];
            $force = $request->get('force', false);

            foreach ($request->ids as $id) {
                $meal = Meal::find($id);
                
                if (!$meal) {
                    $failed[] = [
                        'id' => $id,
                        'reason' => 'الوجبة غير موجودة'
                    ];
                    continue;
                }

                $mealInfo = [
                    'id' => $meal->id,
                    'name' => $meal->name,
                    'code' => $meal->code
                ];

                if ($force) {
                    // حذف نهائي
                    $meal->forceDelete();
                    $mealInfo['deleted_type'] = 'permanent';
                } else {
                    // حذف ناعم
                    $meal->delete();
                    $mealInfo['deleted_type'] = 'soft';
                }

                $deleted[] = $mealInfo;
            }

            DB::commit();

            $message = $force ? 
                sprintf('تم حذف %d وجبات نهائياً', count($deleted)) :
                sprintf('تم حذف %d وجبات بنجاح', count($deleted));

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => [
                    'deleted' => $deleted,
                    'failed' => $failed,
                    'count' => [
                        'success' => count($deleted),
                        'failed' => count($failed),
                        'total' => count($request->ids)
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('خطأ في حذف وجبات متعددة', [
                'ids' => $request->ids,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء حذف الوجبات',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

public function getAllMeals(Request $request)
{
    try {
        Log::info('MealController@getAllMeals - بدء جلب الوجبات');
        
        // ⭐⭐ الأهم: تجاهل category_id تماماً إذا ما في داعي
        $search = $request->get('search');
        $perPage = $request->get('per_page', 15);
        $withTrashed = $request->get('with_trashed', false);
        $deletedOnly = $request->get('deleted_only', false);
        
        // بناء Query
        $query = Meal::query();
        
        // التحكم بالبيانات المحذوفة
        if ($withTrashed || $deletedOnly) {
            $query->withTrashed();
        }
        if ($deletedOnly) {
            $query->onlyTrashed();
        }
        
        // ⭐⭐ تحميل العلاقات
        $query->with([
            'category:id,name,icon,parent_id',
            'ingredients.category:id,name,parent_id'
        ]);
        
        // ⭐⭐ بحث فقط - بدون فلتر category_id
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                  ->orWhere('code', 'LIKE', "%{$search}%")
                  ->orWhere('description', 'LIKE', "%{$search}%")
                  ->orWhereHas('category', function ($q2) use ($search) {
                      $q2->where('name', 'LIKE', "%{$search}%");
                  });
            });
        }
        
        // ⭐⭐ لا تستخدم category_id في الفلتر - علقها أو احذفها
        // if ($categoryId) { ... } // 👈 مش هاد الوقت
        
        // ترتيب
        $query->orderBy('created_at', 'desc');
        
        // جلب البيانات
        $meals = $query->paginate($perPage);
        
        // تحقق: شو القيم عندك
        Log::info('Sample meal category_id:', [
            'sample' => Meal::with('category')->first()?->toArray()
        ]);
        
        return response()->json([
            'success' => true,
            'data' => [
                'meals' => $meals->items(),
                'pagination' => [
                    'current_page' => $meals->currentPage(),
                    'per_page' => $meals->perPage(),
                    'total' => $meals->total(),
                    'last_page' => $meals->lastPage(),
                ]
            ],
            'message' => "تم جلب {$meals->total()} وجبة"
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'خطأ: ' . $e->getMessage()
        ], 500);
    }
}

/**
 * ⭐⭐ دالة مساعدة لجلب جميع IDs الأقسام (الرئيسي + الفروع)
 */
private function getAllCategoryIds($categoryId)
{
    $ids = [(int)$categoryId];
    
    try {
        // جلب الأقسام الفرعية
        $subCategories = \App\Models\Category::where('parent_id', $categoryId)
            ->pluck('id')
            ->toArray();
        
        $ids = array_merge($ids, $subCategories);
        
        // جلب أقسام المستوى الثالث
        foreach ($subCategories as $subId) {
            $childCategories = \App\Models\Category::where('parent_id', $subId)
                ->pluck('id')
                ->toArray();
            $ids = array_merge($ids, $childCategories);
        }
        
    } catch (\Exception $e) {
        Log::warning('خطأ في جلب الأقسام الفرعية', [
            'category_id' => $categoryId,
            'error' => $e->getMessage()
        ]);
    }
    
    return array_unique($ids);
}

/**
 * دالة للحصول على حالة المخزون
 */
private function getStockStatus($meal)
{
    if (!$meal->track_quantity) {
        return 'غير متتبع';
    }
    
    if ($meal->quantity <= 0) {
        return 'نفذ';
    }
    
    if ($meal->quantity <= $meal->min_quantity) {
        return 'منخفض';
    }
    
    if ($meal->max_quantity > 0 && $meal->quantity >= $meal->max_quantity) {
        return 'ممتلئ';
    }
    
    return 'متوفر';
}
/**
 * جلب كل الوجبات مع كل التفاصيل والمكونات
 */
public function getAllMealsWithDetails(Request $request)
{
    try {
        // معاملات البحث والتصفية
        $search = $request->get('search');
        $categoryId = $request->get('category_id');
        $minCost = $request->get('min_cost');
        $maxCost = $request->get('max_cost');
        $minSale = $request->get('min_sale');
        $maxSale = $request->get('max_sale');
        $hasIngredients = $request->get('has_ingredients'); // true/false
        $sortBy = $request->get('sort_by', 'name');
        $sortOrder = $request->get('sort_order', 'asc');
        $limit = $request->get('limit', 100);
        $withTrashed = $request->get('with_trashed', false);
        
        // بناء الـ Query
        $query = Meal::query();
        
        if ($withTrashed) {
            $query->withTrashed();
        }
        
        // ⭐⭐ تحميل العلاقات - مع إضافة options
        $query->with([
            'category:id,name,icon,description',
            'ingredients' => function ($q) {
                $q->with(['category' => function ($q2) {
                    $q2->select('id', 'name', 'parent_id', 'cost_price', 'sale_price', 'quantity', 'track_quantity');
                }])
                ->orderBy('sort_order')
                ->orderBy('id');
            },
            'options' => function ($q) {  // ⭐⭐ تحميل الخيارات
                $q->orderBy('sort_order')->orderBy('id');
            }
        ]);
        
        // التصفية حسب البحث
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                  ->orWhere('description', 'LIKE', "%{$search}%")
                  ->orWhere('code', 'LIKE', "%{$search}%")
                  ->orWhereHas('category', function ($q2) use ($search) {
                      $q2->where('name', 'LIKE', "%{$search}%");
                  })
                  ->orWhereHas('ingredients.category', function ($q2) use ($search) {
                      $q2->where('name', 'LIKE', "%{$search}%");
                  });
            });
        }
        
        // التصفية حسب القسم
        if ($categoryId) {
            $query->where('category_id', $categoryId);
        }
        
        // التصفية حسب سعر التكلفة
        if ($minCost) {
            $query->where('cost_price', '>=', $minCost);
        }
        if ($maxCost) {
            $query->where('cost_price', '<=', $maxCost);
        }
        
        // التصفية حسب سعر البيع
        if ($minSale) {
            $query->where('sale_price', '>=', $minSale);
        }
        if ($maxSale) {
            $query->where('sale_price', '<=', $maxSale);
        }
        
        // التصفية حسب وجود المكونات
        if ($hasIngredients === 'true') {
            $query->has('ingredients');
        } elseif ($hasIngredients === 'false') {
            $query->doesntHave('ingredients');
        }
        
        // الترتيب
        $allowedSortColumns = ['id', 'name', 'code', 'cost_price', 'sale_price', 'quantity', 'created_at', 'profit_margin'];
        $sortBy = in_array($sortBy, $allowedSortColumns) ? $sortBy : 'name';
        $sortOrder = $sortOrder === 'desc' ? 'desc' : 'asc';
        $query->orderBy($sortBy, $sortOrder);
        
        // الحد الأقصى
        $query->limit($limit);
        
        // جلب البيانات
        $meals = $query->get();
        
        // معالجة البيانات
        $mealsData = $meals->map(function ($meal) {
            // البيانات الأساسية للوجبة
            $mealData = [
                'id' => $meal->id,
                'name' => $meal->name,
                'code' => $meal->code,
                'description' => $meal->description,
                'cost_price' => $meal->cost_price,
                'sale_price' => $meal->sale_price,
                'profit_margin' => $meal->profit_margin,
                'fixed_price' => (bool) ($meal->fixed_price ?? false),
                'quantity' => $meal->quantity,
                'min_quantity' => $meal->min_quantity,
                'max_quantity' => $meal->max_quantity,
                'track_quantity' => $meal->track_quantity,
                'image' => $meal->image,
                'preparation_time' => $meal->preparation_time,
                'is_available' => $meal->is_available,
                'calories' => $meal->calories,
                'sort_order' => $meal->sort_order,
                'is_featured' => $meal->is_featured,
                'tags' => $meal->tags,
                'is_active' => $meal->is_active,
                'deleted_at' => $meal->deleted_at,
                'created_at' => $meal->created_at,
                'updated_at' => $meal->updated_at,
                'category' => $meal->category ? [
                    'id' => $meal->category->id,
                    'name' => $meal->category->name,
                    'icon' => $meal->category->icon,
                    'description' => $meal->category->description
                ] : null,
                // ⭐⭐ إضافة الخيارات
                'options' => $meal->options ? $meal->options->map(function ($option) {
                    return [
                        'id' => $option->id,
                        'name' => $option->name,
                        'price' => $option->price,
                        'additional_cost' => $option->additional_cost,
                        'group_name' => $option->group_name,
                        'sort_order' => $option->sort_order,
                        'is_active' => $option->is_active,
                        'created_at' => $option->created_at,
                        'updated_at' => $option->updated_at
                    ];
                }) : []
            ];
            
            // إضافة المكونات إذا كانت موجودة
            if ($meal->relationLoaded('ingredients')) {
                $mealData['ingredients'] = $meal->ingredients->map(function ($ingredient) use ($meal) {
                    $ingredientData = [
                        'id' => $ingredient->id,
                        'meal_id' => $ingredient->meal_id,
                        'quantity_used' => $ingredient->quantity,
                        'unit' => $ingredient->unit,
                        'unit_cost' => $ingredient->unit_cost,
                        'total_cost' => $ingredient->total_cost,
                        'notes' => $ingredient->notes,
                        'sort_order' => $ingredient->sort_order,
                        'created_at' => $ingredient->created_at,
                        'updated_at' => $ingredient->updated_at
                    ];
                    
                    // بيانات القسم الفرعي
                    if ($ingredient->category) {
                        $ingredientData['sub_category'] = [
                            'id' => $ingredient->category->id,
                            'name' => $ingredient->category->name,
                            'parent_id' => $ingredient->category->parent_id,
                            'cost_price' => $ingredient->category->cost_price,
                            'sale_price' => $ingredient->category->sale_price,
                            'quantity' => $ingredient->category->quantity,
                            'track_quantity' => $ingredient->category->track_quantity
                        ];
                        
                        // حسابات إضافية
                        $ingredientData['calculated_values'] = [
                            'unit_cost_at_time' => $ingredient->unit_cost,
                            'total_cost_at_time' => $ingredient->total_cost,
                            'percentage_of_meal_cost' => $meal->cost_price > 0 ? 
                                round(($ingredient->total_cost / $meal->cost_price) * 100, 2) : 0,
                            'cost_per_unit' => $ingredient->quantity > 0 ? 
                                round($ingredient->total_cost / $ingredient->quantity, 3) : 0
                        ];
                    }
                    
                    return $ingredientData;
                })->values();
                
                // إحصائيات المكونات
                $mealData['ingredients_summary'] = [
                    'total_ingredients' => $meal->ingredients->count(),
                    'total_quantity_used' => $meal->ingredients->sum('quantity'),
                    'total_ingredients_cost' => $meal->ingredients->sum('total_cost'),
                    'average_unit_cost' => $meal->ingredients->avg('unit_cost'),
                    'ingredients_by_category' => $meal->ingredients->groupBy(function ($ingredient) {
                        return $ingredient->category ? $ingredient->category->name : 'غير محدد';
                    })->map(function ($group) {
                        return [
                            'count' => $group->count(),
                            'total_quantity' => $group->sum('quantity'),
                            'total_cost' => $group->sum('total_cost'),
                            'average_unit_cost' => $group->avg('unit_cost')
                        ];
                    })
                ];
                
                // تحليل التكلفة
                $totalIngredientsCost = $meal->ingredients->sum('total_cost');
                $mealData['cost_analysis'] = [
                    'meal_cost_price' => $meal->cost_price,
                    'total_ingredients_cost' => $totalIngredientsCost,
                    'difference' => $meal->cost_price - $totalIngredientsCost,
                    'is_cost_accurate' => abs($meal->cost_price - $totalIngredientsCost) < 0.01,
                    'profit_margin_percent' => $meal->profit_margin,
                    'profit_amount' => $meal->sale_price - $meal->cost_price,
                    'profit_percentage' => $meal->cost_price > 0 ? 
                        round((($meal->sale_price - $meal->cost_price) / $meal->cost_price) * 100, 2) : 0,
                    'markup_percentage' => $totalIngredientsCost > 0 ? 
                        round((($meal->sale_price - $totalIngredientsCost) / $totalIngredientsCost) * 100, 2) : 0
                ];
                
                // معلومات المخزون
                $isLowStock = $meal->track_quantity && $meal->quantity <= $meal->min_quantity;
                $isOutOfStock = $meal->track_quantity && $meal->quantity <= 0;
                $stockPercentage = $meal->max_quantity > 0 ? 
                    round(($meal->quantity / $meal->max_quantity) * 100, 2) : 0;
                
                $mealData['stock_info'] = [
                    'has_stock' => $meal->quantity > 0,
                    'stock_level' => $meal->quantity,
                    'is_low_stock' => $isLowStock,
                    'is_out_of_stock' => $isOutOfStock,
                    'stock_percentage' => $stockPercentage,
                    'stock_status' => $isOutOfStock ? 'نفذ' : ($isLowStock ? 'منخفض' : 'متوفر')
                ];
                
            } else {
                // إذا لم يكن هناك مكونات
                $mealData['ingredients'] = [];
                $mealData['ingredients_summary'] = [
                    'total_ingredients' => 0,
                    'total_quantity_used' => 0,
                    'total_ingredients_cost' => 0,
                    'average_unit_cost' => null,
                    'ingredients_by_category' => []
                ];
                $mealData['cost_analysis'] = [
                    'meal_cost_price' => $meal->cost_price,
                    'total_ingredients_cost' => 0,
                    'difference' => $meal->cost_price,
                    'is_cost_accurate' => false,
                    'profit_margin_percent' => $meal->profit_margin,
                    'profit_amount' => $meal->sale_price - $meal->cost_price,
                    'profit_percentage' => $meal->cost_price > 0 ? 
                        round((($meal->sale_price - $meal->cost_price) / $meal->cost_price) * 100, 2) : 0
                ];
                $mealData['stock_info'] = [
                    'has_stock' => $meal->quantity > 0,
                    'stock_level' => $meal->quantity,
                    'is_low_stock' => false,
                    'is_out_of_stock' => false,
                    'stock_percentage' => 0
                ];
            }
            
            // معلومات إضافية
            $daysSinceCreated = now()->diffInDays($meal->created_at);
            $mealData['additional_info'] = [
                'profit_per_item' => $meal->sale_price - $meal->cost_price,
                'profit_margin_calculated' => $meal->cost_price > 0 ? 
                    round((($meal->sale_price - $meal->cost_price) / $meal->cost_price) * 100, 2) : 0,
                'days_since_created' => $daysSinceCreated,
                'is_new' => $daysSinceCreated <= 7,
                'value_in_stock' => $meal->cost_price * $meal->quantity,
                'potential_revenue' => $meal->sale_price * $meal->quantity,
                'age_category' => $daysSinceCreated < 1 ? 'جديد اليوم' : 
                                 ($daysSinceCreated <= 7 ? 'جديد' : 
                                 ($daysSinceCreated <= 30 ? 'شهري' : 'قديم'))
            ];
            
            return $mealData;
        });
        
        // حساب الإحصائيات
        $lowStockMealsCount = $meals->filter(function ($meal) {
            return $meal->track_quantity && $meal->quantity <= $meal->min_quantity;
        })->count();
        
        // إحصائيات عامة
        $totalStats = [
            'total_meals' => $meals->count(),
            'total_with_ingredients' => $meals->filter(function ($meal) {
                return $meal->ingredients->count() > 0;
            })->count(),
            'total_with_options' => $meals->filter(function ($meal) { // ⭐⭐ إحصائية جديدة
                return $meal->options->count() > 0;
            })->count(),
            'total_cost_value' => $meals->sum('cost_price'),
            'total_sale_value' => $meals->sum('sale_price'),
            'total_profit_potential' => $meals->sum(function ($meal) {
                return $meal->sale_price - $meal->cost_price;
            }),
            'average_cost' => $meals->avg('cost_price'),
            'average_sale' => $meals->avg('sale_price'),
            'average_profit_margin' => $meals->avg('profit_margin'),
            'total_ingredients_across_all' => $meals->sum(function ($meal) {
                return $meal->ingredients->count();
            }),
            'total_options_across_all' => $meals->sum(function ($meal) { // ⭐⭐ إحصائية جديدة
                return $meal->options->count();
            }),
            'active_meals' => $meals->where('is_active', true)->count(),
            'featured_meals' => $meals->where('is_featured', true)->count(),
            'low_stock_meals' => $lowStockMealsCount,
            'out_of_stock_meals' => $meals->where('track_quantity', true)
                ->where('quantity', '<=', 0)
                ->count(),
            'meals_by_category' => $meals->groupBy('category_id')->map(function ($group) {
                return [
                    'count' => $group->count(),
                    'category_name' => $group->first()->category->name ?? 'غير محدد'
                ];
            })
        ];
        
        return response()->json([
            'success' => true,
            'data' => [
                'meals' => $mealsData,
                'total_count' => $meals->count(),
                'stats' => $totalStats,
                'filters_applied' => [
                    'search' => $search,
                    'category_id' => $categoryId,
                    'min_cost' => $minCost,
                    'max_cost' => $maxCost,
                    'min_sale' => $minSale,
                    'max_sale' => $maxSale,
                    'has_ingredients' => $hasIngredients,
                    'sort_by' => $sortBy,
                    'sort_order' => $sortOrder,
                    'limit' => $limit,
                    'with_trashed' => $withTrashed
                ]
            ],
            'message' => 'تم جلب ' . $meals->count() . ' وجبة مع جميع التفاصيل والخيارات بنجاح'
        ]);
        
    } catch (\Exception $e) {
        Log::error('MealController@getAllMealsWithDetails - Error', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'request' => $request->all()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب بيانات الوجبات',
            'error' => config('app.debug') ? $e->getMessage() : null
        ], 500);
    }
}

public function show($id)
{
    try {
        // تأكد من استخدام with بشكل صحيح
        $meal = Meal::with([
            'category:id,name,icon,description',
            'ingredients' => function ($query) {
                $query->with(['category' => function ($q) {
                    $q->select('id', 'name', 'parent_id', 'cost_price', 'sale_price', 'quantity', 'track_quantity');
                }])
                ->orderBy('sort_order')
                ->orderBy('id');
            },
            'options' => fn($q) => $q->where('is_active', true)->orderBy('sort_order')->orderBy('id')
        ])->find($id);
        
        if (!$meal) {
            return response()->json([
                'success' => false,
                'message' => 'الوجبة غير موجودة'
            ], 404);
        }
        
        // معالجة البيانات
        $mealData = [
            'id' => $meal->id,
            'name' => $meal->name,
            'code' => $meal->code,
            'description' => $meal->description,
            'cost_price' => $meal->cost_price,
            'sale_price' => $meal->sale_price,
            'profit_margin' => $meal->profit_margin,
            'quantity' => $meal->quantity,
            'min_quantity' => $meal->min_quantity,
            'max_quantity' => $meal->max_quantity,
            'track_quantity' => $meal->track_quantity,
            'image' => $meal->image,
            'preparation_time' => $meal->preparation_time,
            'is_available' => $meal->is_available,
            'calories' => $meal->calories,
            'sort_order' => $meal->sort_order,
            'is_featured' => $meal->is_featured,
            'tags' => $meal->tags,
            'is_active' => $meal->is_active,
            'category_id' => $meal->category_id,
            'created_at' => $meal->created_at,
            'updated_at' => $meal->updated_at,
            'category' => $meal->category ? [
                'id' => $meal->category->id,
                'name' => $meal->category->name,
                'icon' => $meal->category->icon,
                'description' => $meal->category->description
            ] : null,
            'options' => $meal->relationLoaded('options') ? $meal->options->map(fn($o) => [
                'id' => $o->id,
                'name' => $o->name,
                'price' => (float) $o->price,
                'additional_cost' => (float) $o->additional_cost,
                'group_name' => $o->group_name,
                'sort_order' => $o->sort_order,
            ])->values()->all() : []
        ];
        
        // معالجة المكونات إذا كانت موجودة
        if ($meal->relationLoaded('ingredients') && $meal->ingredients->isNotEmpty()) {
            $mealData['ingredients'] = $meal->ingredients->map(function ($ingredient) use ($meal) {
                $ingredientData = [
                    'id' => $ingredient->id,
                    'meal_id' => $ingredient->meal_id,
                    'quantity_used' => $ingredient->quantity,
                    'unit' => $ingredient->unit,
                    'unit_cost' => $ingredient->unit_cost,
                    'total_cost' => $ingredient->total_cost,
                    'notes' => $ingredient->notes,
                    'sort_order' => $ingredient->sort_order,
                    'created_at' => $ingredient->created_at,
                    'updated_at' => $ingredient->updated_at
                ];
                
                // إضافة بيانات القسم الفرعي
                if ($ingredient->relationLoaded('category') && $ingredient->category) {
                    $ingredientData['sub_category'] = [
                        'id' => $ingredient->category->id,
                        'name' => $ingredient->category->name,
                        'parent_id' => $ingredient->category->parent_id,
                        'cost_price' => $ingredient->category->cost_price,
                        'sale_price' => $ingredient->category->sale_price,
                        'quantity' => $ingredient->category->quantity,
                        'track_quantity' => $ingredient->category->track_quantity
                    ];
                    
                    // معلومات حسابية
                    $ingredientData['calculated_values'] = [
                        'unit_cost_at_time' => $ingredient->unit_cost,
                        'total_cost_at_time' => $ingredient->total_cost,
                        'percentage_of_meal_cost' => $meal->cost_price > 0 ? 
                            round(($ingredient->total_cost / $meal->cost_price) * 100, 2) : 0
                    ];
                }
                
                return $ingredientData;
            });
            
            // إحصائيات المكونات
            $mealData['ingredients_summary'] = [
                'total_ingredients' => $meal->ingredients->count(),
                'total_quantity_used' => $meal->ingredients->sum('quantity'),
                'total_ingredients_cost' => $meal->ingredients->sum('total_cost'),
                'average_unit_cost' => $meal->ingredients->avg('unit_cost'),
                'ingredients_by_category' => $meal->ingredients->groupBy(function ($ingredient) {
                    return $ingredient->category ? $ingredient->category->name : 'غير محدد';
                })->map(function ($group) {
                    return [
                        'count' => $group->count(),
                        'total_quantity' => $group->sum('quantity'),
                        'total_cost' => $group->sum('total_cost')
                    ];
                })
            ];
            
            // تحليل التكلفة
            $mealData['cost_analysis'] = [
                'meal_cost_price' => $meal->cost_price,
                'total_ingredients_cost' => $meal->ingredients->sum('total_cost'),
                'difference' => $meal->cost_price - $meal->ingredients->sum('total_cost'),
                'profit_margin_percent' => $meal->profit_margin,
                'profit_amount' => $meal->sale_price - $meal->cost_price,
                'profit_percentage' => $meal->cost_price > 0 ? 
                    round((($meal->sale_price - $meal->cost_price) / $meal->cost_price) * 100, 2) : 0
            ];
            
        } else {
            // إذا لم يكن هناك مكونات
            $mealData['ingredients'] = [];
            $mealData['ingredients_summary'] = [
                'total_ingredients' => 0,
                'total_quantity_used' => 0,
                'total_ingredients_cost' => 0,
                'average_unit_cost' => null,
                'ingredients_by_category' => []
            ];
            $mealData['cost_analysis'] = [
                'meal_cost_price' => $meal->cost_price,
                'total_ingredients_cost' => 0,
                'difference' => $meal->cost_price,
                'profit_margin_percent' => $meal->profit_margin,
                'profit_amount' => $meal->sale_price - $meal->cost_price,
                'profit_percentage' => $meal->cost_price > 0 ? 
                    round((($meal->sale_price - $meal->cost_price) / $meal->cost_price) * 100, 2) : 0
            ];
        }
        
        return response()->json([
            'success' => true,
            'data' => $mealData,
            'message' => 'تم جلب بيانات الوجبة بنجاح'
        ]);
        
    } catch (\Exception $e) {
        Log::error('MealController@show - Error', [
            'error' => $e->getMessage(),
            'meal_id' => $id,
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب بيانات الوجبة',
            'error' => config('app.debug') ? $e->getMessage() : null
        ], 500);
    }
}





    /**
     * تحديث وجبة
     */
    public function update(Request $request, $id)
    {
        $meal = Meal::find($id);
        
        if (!$meal) {
            return response()->json([
                'success' => false,
                'message' => 'الوجبة غير موجودة'
            ], 404);
        }
        
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'code' => 'nullable|string|max:50|unique:meals,code,' . $id,
            'description' => 'nullable|string',
            'cost_price' => 'nullable|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'profit_margin' => 'nullable|numeric|min:0|max:100',
            'quantity' => 'nullable|integer|min:0',
            'min_quantity' => 'nullable|integer|min:0',
            'max_quantity' => 'nullable|integer|min:0',
            'track_quantity' => 'boolean',
            'is_active' => 'boolean',
            'category_id' => 'nullable|exists:categories,id'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            if ($request->has('category_id')) {
                $category = Category::find($request->category_id);
                if ($category->parent_id !== null) {
                    return response()->json([
                        'success' => false,
                       'message' => 'يجب اختيار قسم رئيسي، وليس قسم فرعي'
                    ], 422);
                }
            }

            $allowed = [
                'name', 'code', 'description', 'cost_price', 'sale_price',
                'profit_margin', 'quantity', 'min_quantity', 'max_quantity',
                'track_quantity', 'is_active', 'category_id'
            ];
            if ($meal->fixed_price) {
                $allowed = array_diff($allowed, ['sale_price', 'profit_margin']);
            }
            
            $meal->update($request->only($allowed));
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث الوجبة بنجاح',
                'data' => $meal->load('category:id,name,icon')
            ]);
            
        } catch (\Exception $e) {
            Log::error('MealController@update - Error', [
                'error' => $e->getMessage(),
                'meal_id' => $id,
                'request' => $request->all()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تحديث الوجبة'
            ], 500);
        }
    }
    
   

    
    /**
     * جلب وجبات قسم معين
     */
    public function getCategoryMeals($categoryId)
    {
        try {
            $category = Category::find($categoryId);
            
            if (!$category) {
                return response()->json([
                    'success' => false,
                    'message' => 'القسم غير موجود'
                ], 404);
            }
            
            // التحقق أن القسم رئيسي
            if ($category->parent_id !== null) {
                return response()->json([
                    'success' => false,
                    'message' => 'يجب اختيار قسم رئيسي، وليس قسم فرعي'
                ], 422);
            }
            
            $meals = Meal::with('category:id,name,icon')
                ->where('category_id', $categoryId)
                ->where('is_active', true)
                ->orderBy('name')
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => [
                    'category' => $category->only(['id', 'name', 'icon']),
                    'meals' => $meals,
                    'count' => $meals->count()
                ],
                'message' => 'تم جلب وجبات القسم بنجاح'
            ]);
            
        } catch (\Exception $e) {
            Log::error('MealController@getCategoryMeals - Error', [
                'error' => $e->getMessage(),
                'category_id' => $categoryId
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب الوجبات'
            ], 500);
        }
    }
    
    /**
     * تحديث كمية وجبة
     */
    public function updateQuantity(Request $request, $id)
    {
        $meal = Meal::find($id);
        
        if (!$meal) {
            return response()->json([
                'success' => false,
                'message' => 'الوجبة غير موجودة'
            ], 404);
        }
        
        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer|min:0',
            'operation' => 'nullable|in:increase,decrease,set'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            $oldQuantity = $meal->quantity;
            
            switch ($request->operation) {
                case 'increase':
                    $meal->increaseQuantity($request->quantity);
                    $message = "تم زيادة الكمية من {$oldQuantity} إلى {$meal->quantity}";
                    break;
                    
                case 'decrease':
                    $meal->decreaseQuantity($request->quantity);
                    $message = "تم نقصان الكمية من {$oldQuantity} إلى {$meal->quantity}";
                    break;
                    
                case 'set':
                default:
                    $meal->quantity = $request->quantity;
                    $meal->save();
                    $message = "تم تعيين الكمية إلى {$meal->quantity}";
                    break;
            }
            
            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => [
                    'id' => $meal->id,
                    'name' => $meal->name,
                    'old_quantity' => $oldQuantity,
                    'new_quantity' => $meal->quantity,
                    'difference' => $meal->quantity - $oldQuantity
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('MealController@updateQuantity - Error', [
                'error' => $e->getMessage(),
                'meal_id' => $id,
                'request' => $request->all()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تحديث الكمية'
            ], 500);
        }
    }
    
    /**
     * البحث في الوجبات
     */
    public function search(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'query' => 'required|string|min:2'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'أدخل كلمة بحث صحيحة (من حرفين على الأقل)',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            $meals = Meal::with('category:id,name')
                ->where('is_active', true)
                ->where(function ($q) use ($request) {
                    $q->where('name', 'LIKE', "%{$request->query}%")
                      ->orWhere('description', 'LIKE', "%{$request->query}%")
                      ->orWhere('code', 'LIKE', "%{$request->query}%");
                })
                ->orderBy('name')
                ->limit(20)
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => $meals,
                'count' => $meals->count(),
                'message' => 'تم العثور على ' . $meals->count() . ' وجبة'
            ]);
            
        } catch (\Exception $e) {
            Log::error('MealController@search - Error', [
                'error' => $e->getMessage(),
                'query' => $request->query
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في البحث'
            ], 500);
        }
    }
    
    /**
     * إحصائيات الوجبات
     */
    public function stats()
    {
        try {
            $stats = [
                'total_meals' => Meal::count(),
                'active_meals' => Meal::where('is_active', true)->count(),
                'total_quantity' => Meal::where('track_quantity', true)->sum('quantity'),
                'total_cost_value' => Meal::where('track_quantity', true)
                    ->sum(DB::raw('cost_price * quantity')),
                'total_sale_value' => Meal::where('track_quantity', true)
                    ->sum(DB::raw('sale_price * quantity')),
                'low_quantity_meals' => Meal::whereRaw('quantity <= min_quantity')
                    ->where('track_quantity', true)
                    ->count(),
                'out_of_stock_meals' => Meal::where('quantity', 0)
                    ->where('track_quantity', true)
                    ->count()
            ];
            
            return response()->json([
                'success' => true,
                'data' => $stats,
                'message' => 'تم جلب إحصائيات الوجبات بنجاح'
            ]);
            
        } catch (\Exception $e) {
            Log::error('MealController@stats - Error', [
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب الإحصائيات'
            ], 500);
        }
    }
}