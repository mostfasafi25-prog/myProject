<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\SavedMeal;
use App\Models\Product;
use App\Models\ReturnedMeal;
use App\Models\PreparedMeal;
use App\Models\Treasury;
use App\Models\TreasuryTransaction;
use Illuminate\Support\Facades\DB;
use App\Models\MealPreparation;
use Illuminate\Support\Facades\Log;
use App\Models\PreparedMealStorage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;

class SavedMealController extends Controller
{
    // تعريف الأصناف الرئيسية والفرعية
    private $mainCategories = [
        'لحوم' => ['دجاج', 'لحم بقري', 'سمك', 'لحم غنم'],
        'مقبلات' => ['سلطات', 'مقبلات ساخنة', 'مقبلات باردة'],
        'أطباق رئيسية' => ['أرز', 'معكرونة', 'مشاوي', 'مقليات'],
        'حلويات' => ['كنافة', 'بقلاوة', 'مثلجات', 'كيك'],
        'مشروبات' => ['عصائر', 'مشروبات ساخنة', 'مشروبات غازية'],
        'بهارات وتوابل' => ['خلطات بهارات', 'صلصات', 'منكهات'],
        'أخرى' => []
    ];

    /**
     * جلب جميع الأصناف
     */
    public function getCategories()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'main_categories' => array_keys($this->mainCategories),
                'subcategories' => $this->mainCategories
            ]
        ]);
    }

    /**
     * جلب الوجبات حسب الصنف
     */
    public function getMealsByCategory(Request $request)
    {
        try {
            $category = $request->query('category');
            $subcategory = $request->query('subcategory');
            
            $query = SavedMeal::query();
            
            if ($category) {
                $query->where('category', $category);
            }
            
            if ($subcategory) {
                $query->where('subcategory', $subcategory);
            }
            
            $meals = $query->orderBy('created_at', 'desc')->get();
            
            // تجميع النتائج حسب الصنف للعرض المنظم
            $groupedMeals = $meals->groupBy('category')->map(function ($items, $category) {
                return [
                    'category' => $category,
                    'meals' => $items,
                    'subcategories' => $items->groupBy('subcategory')
                ];
            });
            
            return response()->json([
                'success' => true,
                'data' => $groupedMeals,
                'summary' => [
                    'total_meals' => $meals->count(),
                    'categories_count' => $groupedMeals->count()
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في جلب الوجبات حسب الصنف: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * عرض الوجبات مع فلترة حسب الأصناف (للبيع)
     */
    public function getMealsForSale(Request $request)
    {
        try {
            // معلمات الفلترة
            $category = $request->query('category');
            $subcategory = $request->query('subcategory');
            $search = $request->query('search');
            $sortBy = $request->query('sort_by', 'name');
            $sortOrder = $request->query('sort_order', 'asc');
            
            $query = SavedMeal::query();
            
            // فلترة حسب الصنف
            if ($category && $category !== 'الكل') {
                $query->where('category', $category);
            }
            
            // فلترة حسب الصنف الفرعي
            if ($subcategory && $subcategory !== 'الكل') {
                $query->where('subcategory', $subcategory);
            }
            
            // بحث بالاسم
            if ($search) {
                $query->where('name', 'like', "%{$search}%");
            }
            
            // الترتيب
            $allowedSort = ['name', 'sale_price', 'total_cost', 'created_at'];
            if (in_array($sortBy, $allowedSort)) {
                $query->orderBy($sortBy, $sortOrder);
            }
            
            $meals = $query->get();
            
            // تجميع حسب الصنف للعرض في واجهة البيع
            $groupedByCategory = $meals->groupBy('category')->map(function ($categoryMeals, $categoryName) {
                $subcategories = $categoryMeals->groupBy('subcategory')->map(function ($subcategoryMeals, $subcategoryName) {
                    return [
                        'subcategory' => $subcategoryName,
                        'meals' => $subcategoryMeals->map(function ($meal) {
                            return [
                                'id' => $meal->id,
                                'name' => $meal->name,
                                'price' => $meal->sale_price,
                                'cost' => $meal->total_cost,
                                'profit_margin' => $meal->profit_margin,
                                'ingredients_count' => count($meal->ingredients),
                                'category' => $meal->category,
                                'subcategory' => $meal->subcategory
                            ];
                        })
                    ];
                });
                
                return [
                    'category' => $categoryName,
                    'subcategories' => $subcategories,
                    'meal_count' => $categoryMeals->count(),
                    'total_value' => $categoryMeals->sum('sale_price')
                ];
            });
            
            // إحصائيات
            $stats = [
                'total_meals' => $meals->count(),
                'categories_count' => $groupedByCategory->count(),
                'total_value' => $meals->sum('sale_price'),
                'average_price' => $meals->avg('sale_price'),
                'cheapest' => $meals->min('sale_price'),
                'most_expensive' => $meals->max('sale_price')
            ];
            
            return response()->json([
                'success' => true,
                'data' => [
                    'grouped_meals' => $groupedByCategory,
                    'flat_list' => $meals,
                    'filters' => [
                        'category' => $category,
                        'subcategory' => $subcategory,
                        'search' => $search
                    ],
                    'stats' => $stats
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في جلب الوجبات للبيع: ' . $e->getMessage()
            ], 500);
        }
    }

    // جلب الوجبات المحفوظة
public function index()
{
    // إعداد الـ logger
    $logger = app('log');
    $logger->channel('meal_log')->info('بدء جلب قائمة الوجبات', [
        'time' => now()->toDateTimeString(),
        'user_ip' => request()->ip(),
        'endpoint' => request()->fullUrl()
    ]);
    
    try {
        $logger->channel('meal_log')->debug('بدء الاستعلام عن الوجبات');
        
        // يمكنك إضافة فلترة إذا كان هناك معلمات
        $filters = request()->only(['category', 'subcategory', 'search']);
        if (!empty(array_filter($filters))) {
            $logger->channel('meal_log')->info('فلترة الوجبات', ['filters' => $filters]);
        }
        
        // بناء الاستعلام
        $query = SavedMeal::query();
        
        // تطبيق الفلاتر إذا وجدت
        if (request()->has('category') && request('category')) {
            $query->where('category', request('category'));
        }
        
        if (request()->has('subcategory') && request('subcategory')) {
            $query->where('subcategory', request('subcategory'));
        }
        
        if (request()->has('search') && request('search')) {
            $searchTerm = request('search');
            $query->where(function($q) use ($searchTerm) {
                $q->where('name', 'like', "%{$searchTerm}%")
                  ->orWhere('category', 'like', "%{$searchTerm}%")
                  ->orWhere('subcategory', 'like', "%{$searchTerm}%");
            });
        }
        
        // تسجيل الاستعلام قبل التنفيذ
        $logger->channel('meal_log')->debug('استعلام SQL', [
            'sql' => $query->toSql(),
            'bindings' => $query->getBindings()
        ]);
        
        // تنفيذ الاستعلام
        $startTime = microtime(true);
        $meals = $query->orderBy('created_at', 'desc')->get();
        $endTime = microtime(true);
        
        $executionTime = round(($endTime - $startTime) * 1000, 2); // بالمللي ثانية
        
        $logger->channel('meal_log')->info('تم جلب الوجبات بنجاح', [
            'total_meals' => $meals->count(),
            'execution_time_ms' => $executionTime,
            'memory_usage_mb' => round(memory_get_peak_usage() / 1024 / 1024, 2)
        ]);
        
        // تسجيل عينة من البيانات (في وضع التطوير فقط)
        if (app()->environment('local') && $meals->isNotEmpty()) {
            $sampleData = $meals->take(3)->map(function($meal) {
                return [
                    'id' => $meal->id,
                    'name' => $meal->name,
                    'category' => $meal->category,
                    'total_cost' => $meal->total_cost
                ];
            })->toArray();
            
            $logger->channel('meal_log')->debug('عينة من البيانات', $sampleData);
        }
        
        // تحقق إذا كانت النتيجة فارغة
        if ($meals->isEmpty()) {
            $logger->channel('meal_log')->warning('لا توجد وجبات في قاعدة البيانات');
            
            return response()->json([
                'success' => true,
                'message' => 'لا توجد وجبات في قاعدة البيانات',
                'data' => [],
                'meta' => [
                    'total' => 0,
                    'execution_time_ms' => $executionTime
                ]
            ]);
        }
        
        return response()->json([
            'success' => true,
            'data' => $meals,
            'meta' => [
                'total' => $meals->count(),
                'execution_time_ms' => $executionTime,
                'has_filters' => !empty(array_filter($filters))
            ]
        ]);
        
    } catch (\Illuminate\Database\QueryException $e) {
        $logger->channel('meal_log')->error('خطأ في استعلام قاعدة البيانات', [
            'error_code' => $e->getCode(),
            'error_message' => $e->getMessage(),
            'sql' => $e->getSql(),
            'bindings' => $e->getBindings()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'خطأ في قاعدة البيانات: ' . $e->getMessage(),
            'error_code' => $e->getCode(),
            'suggestion' => 'الرجاء التحقق من اتصال قاعدة البيانات وهيكل الجداول'
        ], 500);
        
    } catch (\Exception $e) {
        $logger->channel('meal_log')->error('خطأ عام في جلب الوجبات', [
            'error_message' => $e->getMessage(),
            'error_file' => $e->getFile(),
            'error_line' => $e->getLine(),
            'error_trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'خطأ في جلب الوجبات: ' . $e->getMessage(),
            'error_details' => $e->getFile() . ':' . $e->getLine()
        ], 500);
        
    } finally {
        $logger->channel('meal_log')->info('انتهاء عملية جلب الوجبات', [
            'time' => now()->toDateTimeString(),
            'final_memory_usage' => round(memory_get_usage() / 1024 / 1024, 2) . ' MB'
        ]);
    }
}

    // حفظ وجبة جديدة
  public function store(Request $request)
{
    // إعداد الـ logger
    $logger = app('log');
    $logger->channel('meal_log')->info('بدء حفظ وجبة جديدة', [
        'request_data' => $request->all(),
        'time' => now()->toDateTimeString(),
        'user_ip' => $request->ip(),
        'user_agent' => $request->userAgent()
    ]);
    
    try {
        $logger->channel('meal_log')->debug('بدء عملية التحقق من البيانات');
        
        // تحقق من البيانات
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'category' => 'required|string',
            'ingredients' => 'required|array',
            'ingredients.*.product_id' => 'required|exists:products,id',
            'ingredients.*.quantity' => 'required|numeric|min:0.1'
        ]);
        
        if ($validator->fails()) {
            $logger->channel('meal_log')->warning('فشل التحقق من البيانات', [
                'errors' => $validator->errors()->toArray(),
                'input_data' => $request->all()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'البيانات غير صالحة',
                'errors' => $validator->errors()
            ], 400);
        }
        
        $logger->channel('meal_log')->debug('التحقق من البيانات ناجح');
        $logger->channel('meal_log')->info('بدء حساب التكلفة', [
            'ingredients_count' => count($request->ingredients)
        ]);
        
        // حساب التكلفة
        $totalCost = 0;
        $ingredientDetails = [];
        
        foreach ($request->ingredients as $index => $ingredient) {
            $logger->channel('meal_log')->debug("معالجة المكون {$index}", [
                'product_id' => $ingredient['product_id'],
                'quantity' => $ingredient['quantity']
            ]);
            
            $product = Product::find($ingredient['product_id']);
            
            if (!$product) {
                $logger->channel('meal_log')->error('المنتج غير موجود', [
                    'product_id' => $ingredient['product_id'],
                    'ingredient_index' => $index
                ]);
                continue;
            }
            
            $ingredientCost = ($product->price ?? 0) * $ingredient['quantity'];
            $totalCost += $ingredientCost;
            
            $ingredientDetails[] = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'product_price' => $product->price,
                'quantity' => $ingredient['quantity'],
                'ingredient_cost' => $ingredientCost
            ];
            
            $logger->channel('meal_log')->debug("تمت معالجة المكون {$index}", [
                'product_name' => $product->name,
                'price' => $product->price,
                'quantity' => $ingredient['quantity'],
                'cost' => $ingredientCost
            ]);
        }
        
        $logger->channel('meal_log')->info('تم حساب التكلفة الإجمالية', [
            'total_cost' => $totalCost,
            'ingredients_details' => $ingredientDetails
        ]);
        
        // حساب سعر البيع إذا لم يتم إدخاله
        $salePrice = $request->sale_price ?? ($totalCost * 1.5); // نسبة ربح 50% إذا لم يتم تحديد سعر
        $profitMargin = $salePrice > 0 ? (($salePrice - $totalCost) / $salePrice) * 100 : 0;
        
        $logger->channel('meal_log')->info('حساب سعر البيع والربح', [
            'input_sale_price' => $request->sale_price,
            'calculated_sale_price' => $salePrice,
            'profit_margin' => $profitMargin,
            'total_cost' => $totalCost
        ]);
        
        $logger->channel('meal_log')->debug('بدء إنشاء السجل في قاعدة البيانات');
        
        $meal = SavedMeal::create([
            'name' => $request->name,
            'category' => $request->category,
            'subcategory' => $request->subcategory,
            'ingredients' => $request->ingredients,
            'total_cost' => $totalCost,
            'sale_price' => $salePrice,
            'profit_margin' => $profitMargin
        ]);
        
        $logger->channel('meal_log')->info('تم حفظ الوجبة بنجاح', [
            'meal_id' => $meal->id,
            'meal_name' => $meal->name,
            'created_at' => $meal->created_at
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'تم حفظ الوجبة بنجاح',
            'data' => $meal
        ]);
        
    } catch (\Illuminate\Database\QueryException $e) {
        $logger->channel('meal_log')->error('خطأ في قاعدة البيانات', [
            'error_code' => $e->getCode(),
            'error_message' => $e->getMessage(),
            'sql_query' => $e->getSql(),
            'bindings' => $e->getBindings()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'خطأ في قاعدة البيانات: ' . $e->getMessage(),
            'error_code' => $e->getCode()
        ], 500);
        
    } catch (\Exception $e) {
        $logger->channel('meal_log')->error('خطأ عام في حفظ الوجبة', [
            'error_message' => $e->getMessage(),
            'error_file' => $e->getFile(),
            'error_line' => $e->getLine(),
            'error_trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'خطأ في حفظ الوجبة: ' . $e->getMessage(),
            'error_details' => $e->getFile() . ':' . $e->getLine()
        ], 500);
    } finally {
        $logger->channel('meal_log')->info('انتهاء عملية حفظ الوجبة', [
            'time' => now()->toDateTimeString(),
            'memory_usage' => memory_get_usage() / 1024 / 1024 . ' MB'
        ]);
    }
}

    /**
     * تحديث صنف وجبة
     */
    public function updateCategory(Request $request, $id)
    {
        try {
            $meal = SavedMeal::findOrFail($id);
            
            $validator = Validator::make($request->all(), [
                'category' => 'required|string',
                'subcategory' => 'nullable|string'
            ]);
            
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'البيانات غير صالحة',
                    'errors' => $validator->errors()
                ], 400);
            }
            
            $meal->category = $request->category;
            $meal->subcategory = $request->subcategory;
            $meal->save();
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث صنف الوجبة بنجاح',
                'data' => $meal
            ]);
            
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'الوجبة غير موجودة'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في تحديث الصنف: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * بيع وجبة مع تسجيل الصنف
     */
    public function sellMeal(Request $request, $id)
    {
        try {
            DB::beginTransaction();
            
            $meal = SavedMeal::findOrFail($id);
            $quantity = $request->quantity ?? 1;
            $paymentMethod = $request->payment_method ?? 'cash';
            
            // حساب المبلغ الإجمالي
            $totalAmount = $meal->sale_price * $quantity;
            
            // إضافة المبلغ للخزنة
            $treasury = Treasury::first();
            $oldBalance = $treasury->balance;
            $treasury->adjustCashLegacy($totalAmount);
            $treasury->total_income += $totalAmount;
            $treasury->save();
            
            // تسجيل معاملة الخزنة مع الصنف
            $transaction = TreasuryTransaction::create([
                'treasury_id' => $treasury->id,
                'type' => 'income',
                'amount' => $totalAmount,
                'description' => "بيع وجبة: {$meal->name} (x{$quantity}) - الصنف: {$meal->category}",
                'category' => 'meal_sales',
                'transaction_date' => now(),
                'transaction_number' => 'SALE-' . time(),
                'status' => 'completed',
                'payment_method' => $paymentMethod,
                'created_by' => auth()->id() ?? 1,
                'reference_type' => 'saved_meal',
                'reference_id' => $meal->id,
                'metadata' => json_encode([
                    'meal_id' => $meal->id,
                    'meal_name' => $meal->name,
                    'category' => $meal->category,
                    'subcategory' => $meal->subcategory,
                    'quantity' => $quantity,
                    'unit_price' => $meal->sale_price,
                    'total_amount' => $totalAmount
                ])
            ]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => "✅ تم بيع {$quantity} وجبة من {$meal->name}",
                'data' => [
                    'sale_details' => [
                        'meal_id' => $meal->id,
                        'meal_name' => $meal->name,
                        'category' => $meal->category,
                        'quantity' => $quantity,
                        'unit_price' => $meal->sale_price,
                        'total_amount' => $totalAmount,
                        'payment_method' => $paymentMethod,
                        'sold_at' => now(),
                        'sold_by' => auth()->user()?->name ?? 'نظام'
                    ],
                    'treasury' => [
                        'الرصيد_السابق' => $oldBalance,
                        'الرصيد_الجديد' => $treasury->balance,
                        'المبلغ_المضاف' => $totalAmount
                    ],
                    'transaction' => $transaction,
                    'category_info' => [
                        'الصنف_الرئيسي' => $meal->category,
                        'الصنف_الفرعي' => $meal->subcategory
                    ]
                ]
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'خطأ في بيع الوجبة: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * إحصائيات المبيعات حسب الأصناف
     */
    public function getSalesStatistics(Request $request)
    {
        try {
            $startDate = $request->query('start_date', now()->subMonth()->toDateString());
            $endDate = $request->query('end_date', now()->toDateString());
            
            // جلب معاملات المبيعات
            $transactions = TreasuryTransaction::where('category', 'meal_sales')
                ->whereBetween('transaction_date', [$startDate, $endDate])
                ->get();
            
            // تجميع المبيعات حسب الصنف
            $categoryStats = [];
            $totalSales = 0;
            
            foreach ($transactions as $transaction) {
                $metadata = json_decode($transaction->metadata, true);
                
                if (isset($metadata['category'])) {
                    $category = $metadata['category'];
                    $subcategory = $metadata['subcategory'] ?? 'غير محدد';
                    $amount = $transaction->amount;
                    
                    if (!isset($categoryStats[$category])) {
                        $categoryStats[$category] = [
                            'category' => $category,
                            'total_sales' => 0,
                            'transaction_count' => 0,
                            'subcategories' => []
                        ];
                    }
                    
                    $categoryStats[$category]['total_sales'] += $amount;
                    $categoryStats[$category]['transaction_count']++;
                    $totalSales += $amount;
                    
                    // تجميع حسب الصنف الفرعي
                    if (!isset($categoryStats[$category]['subcategories'][$subcategory])) {
                        $categoryStats[$category]['subcategories'][$subcategory] = [
                            'subcategory' => $subcategory,
                            'total_sales' => 0,
                            'transaction_count' => 0
                        ];
                    }
                    
                    $categoryStats[$category]['subcategories'][$subcategory]['total_sales'] += $amount;
                    $categoryStats[$category]['subcategories'][$subcategory]['transaction_count']++;
                }
            }
            
            // ترتيب الأصناف حسب المبيعات
            usort($categoryStats, function ($a, $b) {
                return $b['total_sales'] <=> $a['total_sales'];
            });
            
            return response()->json([
                'success' => true,
                'data' => [
                    'statistics' => $categoryStats,
                    'summary' => [
                        'total_sales' => $totalSales,
                        'category_count' => count($categoryStats),
                        'period' => [
                            'start_date' => $startDate,
                            'end_date' => $endDate
                        ]
                    ]
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في جلب إحصائيات المبيعات: ' . $e->getMessage()
            ], 500);
        }
    }

    // تحضير وجبة جديدة مع خصم من الخزنة
    public function prepareMealFromScratch(Request $request)
    {
        try {
            DB::beginTransaction();
            
            // التحقق من البيانات بما في ذلك الصنف
            $validator = Validator::make($request->all(), [
                'name' => 'required|string',
                'category' => 'required|string',
                'ingredients' => 'required|array'
            ]);
            
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'البيانات غير مكتملة',
                    'errors' => $validator->errors()
                ], 400);
            }
            
            // حساب التكلفة
            $totalCost = 0;
            foreach ($request->ingredients as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                if ($product) {
                    $totalCost += ($product->price ?? 0) * $ingredient['quantity'];
                }
            }
            
            // حساب سعر البيع وهامش الربح
            $salePrice = $request->sale_price ?? ($totalCost * 1.5); // إذا لم يتم إدخال سعر، استخدم التكلفة × 1.5
            if ($salePrice <= 0) {
                $salePrice = $totalCost * 1.5; // تأكيد أن السعر موجب
            }
            
            // حساب هامش الربح
            $profitMargin = 0;
            if ($salePrice > 0 && $totalCost > 0) {
                $profitMargin = (($salePrice - $totalCost) / $salePrice) * 100;
            }
            
            // 1. التحقق من المخزون
            foreach ($request->ingredients as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                
                if (!$product) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => "المنتج غير موجود",
                        'product_id' => $ingredient['product_id'],
                        'required' => $ingredient['quantity']
                    ], 400);
                }
                
                if ($product->stock < $ingredient['quantity']) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => "المنتج {$product->name} غير متوفر بالكمية المطلوبة",
                        'product' => $product->name,
                        'required' => $ingredient['quantity'],
                        'available' => $product->stock,
                        'deficit' => $ingredient['quantity'] - $product->stock
                    ], 400);
                }
            }
            
            // 2. التحقق من رصيد الخزنة
            $treasury = Treasury::first();
            if (!$treasury || $treasury->balance < $totalCost) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'رصيد الخزنة غير كافي',
                    'required' => $totalCost,
                    'available' => $treasury ? $treasury->balance : 0
                ], 400);
            }
            
            // 3. خصم المخزون
            foreach ($request->ingredients as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                if ($product) {
                    $product->stock -= $ingredient['quantity'];
                    $product->save();
                }
            }
            
            // 4. خصم من الخزنة
            $oldBalance = $treasury->balance;
            $treasury->adjustCashLegacy(-$totalCost);
            $treasury->total_expenses += $totalCost;
            $treasury->save();
            
            // 5. تسجيل معاملة الخزنة
            $transaction = TreasuryTransaction::create([
                'treasury_id' => $treasury->id,
                'type' => 'expense',
                'amount' => $totalCost,
                'description' => "تكلفة وجبة: {$request->name} (سعر البيع: {$salePrice} شيكل) - الصنف: {$request->category}",
                'category' => 'meal_preparation',
                'transaction_date' => now(),
                'transaction_number' => 'MEAL-' . time(),
                'status' => 'completed',
                'payment_method' => 'cash',
                'created_by' => auth()->id() ?? 1,
                'reference_type' => 'meal_preparation',
                'reference_id' => 0,
                'metadata' => json_encode([
                    'meal_name' => $request->name,
                    'category' => $request->category,
                    'subcategory' => $request->subcategory,
                    'ingredients_count' => count($request->ingredients),
                    'total_cost' => $totalCost,
                    'sale_price' => $salePrice,
                    'profit_margin' => $profitMargin
                ])
            ]);
            
            // 6. حفظ الوجبة المحفوظة
            $savedMeal = SavedMeal::create([
                'name' => $request->name,
                'category' => $request->category,
                'subcategory' => $request->subcategory,
                'ingredients' => $request->ingredients,
                'total_cost' => $totalCost,
                'sale_price' => $salePrice,
                'profit_margin' => $profitMargin,
                'prepared_at' => now()
            ]);
            
            // 7. تسجيل في prepared_meals
            $preparedMeal = PreparedMeal::create([
                'meal_name' => $request->name,
                'saved_meal_id' => $savedMeal->id,
                'ingredients' => json_encode($request->ingredients),
                'total_cost' => $totalCost,
                'sale_price' => $salePrice,
                'quantity' => $request->quantity ?? 1,
                'prepared_by' => auth()->user()?->name ?? 'نظام',
                'notes' => $request->notes ?? 'وجبة محضرة',
                'prepared_at' => now()
            ]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => '✅ تم تحضير الوجبة وخصم تكلفتها من الخزنة',
                'data' => [
                    'saved_meal' => $savedMeal,
                    'prepared_meal' => $preparedMeal,
                    'category_info' => [
                        'الصنف_الرئيسي' => $request->category,
                        'الصنف_الفرعي' => $request->subcategory
                    ],
                    'pricing' => [
                        'التكلفة' => $totalCost,
                        'سعر_البيع' => $salePrice,
                        'هامش_الربح' => round($profitMargin, 2) . '%',
                        'قيمة_الربح' => $salePrice - $totalCost
                    ],
                    'treasury' => [
                        'الرصيد_السابق' => $oldBalance,
                        'الرصيد_الجديد' => $treasury->balance,
                        'المبلغ_المخصوم' => $totalCost
                    ],
                    'transaction' => [
                        'id' => $transaction->id,
                        'transaction_number' => $transaction->transaction_number
                    ]
                ]
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('Error in prepareMealFromScratch', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request' => $request->all()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'خطأ في تحضير الوجبة: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getStorage()
    {
        try {
            $storage = PreparedMealStorage::where('status', 'جاهزة')
                ->orderBy('expiry_date', 'asc')
                ->get();
            
            $totalValue = $storage->sum(function($item) {
                return $item->current_price * $item->quantity;
            });
            
            $totalQuantity = $storage->sum('quantity');
            
            return response()->json([
                'success' => true,
                'data' => $storage,
                'summary' => [
                    'عدد_الوجبات' => $totalQuantity,
                    'القيمة_الإجمالية' => $totalValue,
                    'عدد_الأنواع' => $storage->count()
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في جلب محتويات المخزن: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * بيع وجبة من المخزن
     */
    public function sellFromStorage(Request $request, $storageId)
    {
        try {
            DB::beginTransaction();
            
            $storageItem = PreparedMealStorage::findOrFail($storageId);
            $quantityToSell = $request->quantity ?? 1;
            
            if ($storageItem->status !== 'جاهزة') {
                return response()->json([
                    'success' => false,
                    'message' => 'الوجبة غير جاهزة للبيع'
                ], 400);
            }
            
            if ($storageItem->quantity < $quantityToSell) {
                return response()->json([
                    'success' => false,
                    'message' => 'الكمية غير متوفرة في المخزن',
                    'available' => $storageItem->quantity,
                    'requested' => $quantityToSell
                ], 400);
            }
            
            // حساب المبلغ
            $saleAmount = $storageItem->current_price * $quantityToSell;
            
            // إضافة المبلغ للخزنة
            $treasury = Treasury::first();
            $oldBalance = $treasury->balance;
            $treasury->adjustCashLegacy($saleAmount);
            $treasury->total_income += $saleAmount;
            $treasury->save();
            
            // تحديث المخزن
            $storageItem->quantity -= $quantityToSell;
            if ($storageItem->quantity == 0) {
                $storageItem->status = 'مباعة';
            }
            $storageItem->save();
            
            // تسجيل المعاملة
       $transaction = TreasuryTransaction::create([
    'treasury_id' => $treasury->id,
    'type' => 'income',
    'amount' => $saleAmount,
    'description' => "بيع وجبة من المخزن: {$storageItem->meal_name} (x{$quantityToSell}) - الصنف: " . ($storageItem->meal_category ?? 'غير محدد'),
    'category' => 'meal_sales',
    'transaction_date' => now(),
    'transaction_number' => 'SELL-' . time(),
    'status' => 'completed',
    'payment_method' => $request->payment_method ?? 'cash',
    'created_by' => auth()->id() ?? 1,
    'reference_type' => 'meal_storage',
    'reference_id' => $storageItem->id,
    'metadata' => json_encode([
        'storage_id' => $storageItem->id,
        'meal_name' => $storageItem->meal_name,
        'category' => $storageItem->meal_category ?? 'غير محدد',
        'quantity' => $quantityToSell,
        'unit_price' => $storageItem->current_price,
        'total_amount' => $saleAmount
    ])
]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => "✅ تم بيع {$quantityToSell} وجبة من {$storageItem->meal_name}",
                'data' => [
                    'meal' => $storageItem->meal_name,
                    'quantity_sold' => $quantityToSell,
                    'unit_price' => $storageItem->current_price,
                    'total_amount' => $saleAmount,
                    'remaining_quantity' => $storageItem->quantity,
                    'treasury' => [
                        'الرصيد_السابق' => $oldBalance,
                        'الرصيد_الجديد' => $treasury->balance,
                        'المبلغ_المضاف' => $saleAmount
                    ],
                    'transaction' => $transaction
                ]
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'خطأ في بيع الوجبة: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * تحديث سعر وجبة واحدة
     */
    public function updateMealPrice(Request $request, $id)
    {
        try {
            // التحقق من صحة البيانات
            $validated = $request->validate([
                'sale_price' => 'required|numeric|min:0'
            ]);
            
            $meal = SavedMeal::findOrFail($id);
            
            // حفظ السعر القديم للتسجيل
            $oldPrice = $meal->sale_price;
            
            // تحديث السعر فقط - بدون حساب profit_margin
            $meal->sale_price = $validated['sale_price'];
            $meal->save();
            
            Log::info('تم تحديث سعر الوجبة', [
                'meal_id' => $meal->id,
                'meal_name' => $meal->name,
                'old_price' => $oldPrice,
                'new_price' => $meal->sale_price
            ]);
            
            return response()->json([
                'success' => true,
                'message' => '✅ تم تحديث سعر الوجبة بنجاح',
                'data' => [
                    'meal_id' => $meal->id,
                    'meal_name' => $meal->name,
                    'category' => $meal->category,
                    'sale_price' => $meal->sale_price,
                    'total_cost' => $meal->total_cost,
                    'profit_value' => $meal->sale_price - $meal->total_cost
                ]
            ]);
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $e->errors()
            ], 422);
            
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'الوجبة غير موجودة'
            ], 404);
            
        } catch (\Exception $e) {
            Log::error('خطأ في تحديث سعر الوجبة', [
                'meal_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'خطأ في تحديث السعر: ' . $e->getMessage()
            ], 500);
        }
    }

    public function storePreparedMeal(Request $request)
    {
        try {
            DB::beginTransaction();
            
            // التحقق من البيانات
            if (!$request->meal_id || !$request->quantity) {
                return response()->json([
                    'success' => false,
                    'message' => 'معرف الوجبة والكمية مطلوبان'
                ], 400);
            }
            
            $meal = SavedMeal::findOrFail($request->meal_id);
            $quantity = $request->quantity;
            
            Log::info('بدء تخزين وجبة في المخزن', [
                'meal_id' => $meal->id,
                'meal_name' => $meal->name,
                'quantity' => $quantity
            ]);
            
            // 1. التحقق من توفر المكونات
            foreach ($meal->ingredients as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                
                if (!$product) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => "المنتج غير موجود",
                        'product_id' => $ingredient['product_id']
                    ], 400);
                }
                
                $requiredQuantity = ($ingredient['quantity'] ?? 0) * $quantity;
                
                if ($product->stock < $requiredQuantity) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => "المخزون غير كافٍ للمنتج: {$product->name}",
                        'product' => $product->name,
                        'required' => $requiredQuantity,
                        'available' => $product->stock
                    ], 400);
                }
            }
            
            // 2. التحقق من رصيد الخزنة
            $treasury = Treasury::first();
            $totalCost = $meal->total_cost * $quantity;
            
            if (!$treasury || $treasury->balance < $totalCost) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'رصيد الخزنة غير كافي',
                    'required' => $totalCost,
                    'available' => $treasury ? $treasury->balance : 0
                ], 400);
            }
            
            // 3. خصم المخزون
            foreach ($meal->ingredients as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                if ($product) {
                    $requiredQuantity = ($ingredient['quantity'] ?? 0) * $quantity;
                    $product->stock -= $requiredQuantity;
                    $product->save();
                    
                    Log::info('خصم المخزون', [
                        'product' => $product->name,
                        'quantity_deducted' => $requiredQuantity,
                        'new_stock' => $product->stock
                    ]);
                }
            }
            
            // 4. خصم من الخزنة
            $oldBalance = $treasury->balance;
            $treasury->adjustCashLegacy(-$totalCost);
            $treasury->total_expenses += $totalCost;
            $treasury->save();
            
            // 5. تسجيل معاملة الخزنة
            $transaction = TreasuryTransaction::create([
                'treasury_id' => $treasury->id,
                'type' => 'expense',
                'amount' => $totalCost,
                'description' => "تحضير وتخزين وجبة: {$meal->name} (x{$quantity}) - الصنف: {$meal->category}",
                'category' => 'meal_preparation',
                'transaction_date' => now(),
                'transaction_number' => 'STORE-' . time(),
                'status' => 'completed',
                'payment_method' => 'cash',
                'created_by' => 1,
                'reference_type' => 'meal_storage',
                'reference_id' => 0,
                'metadata' => json_encode([
                    'meal_id' => $meal->id,
                    'meal_name' => $meal->name,
                    'category' => $meal->category,
                    'subcategory' => $meal->subcategory,
                    'quantity' => $quantity,
                    'total_cost' => $totalCost
                ])
            ]);
            
            // 6. تحديد السعر
            $costPerUnit = $meal->total_cost;
            $currentPrice = $request->has('custom_price') 
                ? $request->custom_price 
                : ($meal->sale_price ?? ($costPerUnit * 1.5));
            
            // 7. تخزين في مخزن الوجبات الجاهزة
            $storageItem = PreparedMealStorage::create([
                'saved_meal_id' => $meal->id,
                'meal_name' => $meal->name,
                'meal_category' => $meal->category,
                'ingredients' => $meal->ingredients,
                
                // التكاليف
                'cost_per_unit' => $costPerUnit,
                'total_cost' => $totalCost,
                
                // الأسعار
                'original_price' => $meal->sale_price,
                'current_price' => $currentPrice,
                'sale_price' => $currentPrice,
                
                // الكميات
                'quantity' => $quantity,
                'initial_quantity' => $quantity,
                
                // معلومات إضافية
                'prepared_date' => now(),
                'expiry_date' => $request->expiry_date ?? now()->addDays(3),
                'status' => 'جاهزة',
                'prepared_by' => 'المسؤول',
                'batch_number' => 'BATCH-' . time(),
                'storage_location' => $request->storage_location ?? 'المخزن الرئيسي',
                'notes' => $request->notes ?? 'تم التخزين تلقائياً'
            ]);
            
            // 8. تسجيل في سجل التحضير
            $preparedMeal = PreparedMeal::create([
                'meal_name' => $meal->name . " (مخزنة)",
                'saved_meal_id' => $meal->id,
                'storage_id' => $storageItem->id,
                'ingredients' => json_encode($meal->ingredients),
                'total_cost' => $totalCost,
                'sale_price' => $currentPrice,
                'quantity' => $quantity,
                'prepared_by' => 'المسؤول',
                'notes' => 'تم تخزينها في مخزن الوجبات الجاهزة',
                'prepared_at' => now()
            ]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => "✅ تم تخزين {$quantity} وجبة من {$meal->name} في المخزن",
                'data' => [
                    'storage_id' => $storageItem->id,
                    'meal' => $storageItem->meal_name,
                    'category' => $meal->category,
                    'quantity' => $storageItem->quantity,
                    'pricing' => [
                        'تكلفة_الوحدة' => $costPerUnit,
                        'سعر_البيع' => $currentPrice,
                        'هامش_الربح' => round((($currentPrice - $costPerUnit) / $currentPrice) * 100, 2) . '%',
                        'الربح_للوحدة' => $currentPrice - $costPerUnit,
                        'الربح_الإجمالي' => ($currentPrice - $costPerUnit) * $quantity
                    ],
                    'dates' => [
                        'تاريخ_التخزين' => $storageItem->prepared_date,
                        'تاريخ_الانتهاء' => $storageItem->expiry_date
                    ],
                    'treasury' => [
                        'الرصيد_السابق' => $oldBalance,
                        'الرصيد_الجديد' => $treasury->balance,
                        'المبلغ_المخصوم' => $totalCost
                    ],
                    'transaction' => [
                        'id' => $transaction->id,
                        'transaction_number' => $transaction->transaction_number
                    ]
                ]
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('خطأ في تخزين الوجبة', [
                'meal_id' => $request->meal_id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'خطأ في تخزين الوجبة: ' . $e->getMessage()
            ], 500);
        }
    }

    // استخدام وجبة محفوظة مع خصم من الخزنة
    public function useMeal(Request $request, $id)
    {
        try {
            DB::beginTransaction();
            
            $meal = SavedMeal::findOrFail($id);
            $quantity = $request->input('quantity', 1);
            
            Log::info('بدء استخدام وجبة محفوظة', [
                'meal_id' => $id,
                'meal_name' => $meal->name,
                'category' => $meal->category,
                'quantity' => $quantity,
                'ingredients' => $meal->ingredients
            ]);
            
            // التحقق من توفر المكونات
            $unavailableIngredients = [];
            $available = true;
            
            foreach ($meal->ingredients as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                
                if (!$product) {
                    $available = false;
                    $unavailableIngredients[] = [
                        'product' => $ingredient['product_name'] ?? 'غير معروف',
                        'reason' => 'المنتج غير موجود',
                        'required' => ($ingredient['quantity'] ?? 0) * $quantity
                    ];
                    Log::warning('المنتج غير موجود', ['product_id' => $ingredient['product_id']]);
                    continue;
                }
                
                $requiredQuantity = ($ingredient['quantity'] ?? 0) * $quantity;
                
                Log::info('فحص المخزون', [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'required' => $requiredQuantity,
                    'current_stock' => $product->stock
                ]);
                
                if ($product->stock < $requiredQuantity) {
                    $available = false;
                    $unavailableIngredients[] = [
                        'product_id' => $product->id,
                        'product' => $product->name,
                        'required' => $requiredQuantity,
                        'available' => $product->stock,
                        'deficit' => $requiredQuantity - $product->stock,
                        'unit' => $product->unit
                    ];
                    Log::warning('المخزون غير كافٍ', [
                        'product' => $product->name,
                        'required' => $requiredQuantity,
                        'available' => $product->stock
                    ]);
                }
            }
            
            // إذا كان هناك مكونات غير متوفرة
            if (!$available) {
                DB::rollBack();
                Log::error('المخزون غير كافٍ لتحضير الوجبة', [
                    'meal_id' => $id,
                    'unavailable_ingredients' => $unavailableIngredients
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'المخزون غير كافٍ',
                    'unavailable_ingredients' => $unavailableIngredients,
                    'all_available' => false
                ], 400);
            }
            
            // التحقق من رصيد الخزنة
            $treasury = Treasury::first();
            $totalCost = $meal->total_cost * $quantity;
            
            if (!$treasury || $treasury->balance < $totalCost) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'رصيد الخزنة غير كافي',
                    'required' => $totalCost,
                    'available' => $treasury ? $treasury->balance : 0
                ], 400);
            }
            
            Log::info('جميع المكونات متوفرة، جاري خصم المخزون');
            
            // خصم المخزون
            foreach ($meal->ingredients as $ingredient) {
                $product = Product::find($ingredient['product_id']);
                if ($product) {
                    $requiredQuantity = ($ingredient['quantity'] ?? 0) * $quantity;
                    
                    Log::info('خصم المخزون', [
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'quantity_before' => $product->stock,
                        'quantity_to_deduct' => $requiredQuantity,
                        'quantity_after' => $product->stock - $requiredQuantity
                    ]);
                    
                    $product->stock -= $requiredQuantity;
                    $product->save();
                    
                    Log::info('تم تحديث المخزون', [
                        'product_id' => $product->id,
                        'new_stock' => $product->stock
                    ]);
                }
            }
            
            // خصم من الخزنة
            $oldBalance = $treasury->balance;
            $treasury->adjustCashLegacy(-$totalCost);
            $treasury->total_expenses += $totalCost;
            $treasury->save();
            
            // تسجيل معاملة الخزنة
            $transaction = TreasuryTransaction::create([
                'treasury_id' => $treasury->id,
                'type' => 'expense',
                'amount' => $totalCost,
                'description' => "استخدام وجبة محفوظة: {$meal->name} (x{$quantity}) - الصنف: {$meal->category}",
                'category' => 'meal_preparation',
                'transaction_date' => now(),
                'transaction_number' => 'USEMEAL-' . time(),
                'status' => 'completed',
                'payment_method' => 'cash',
                'created_by' => auth()->id() ?? 1,
                'reference_type' => 'saved_meal',
                'reference_id' => $meal->id,
                'metadata' => json_encode([
                    'meal_id' => $meal->id,
                    'meal_name' => $meal->name,
                    'category' => $meal->category,
                    'subcategory' => $meal->subcategory,
                    'quantity' => $quantity,
                    'total_cost' => $totalCost
                ])
            ]);
            
            Log::info('جاري تسجيل الوجبة في سجل التحضير');
            
            // تسجيل الوجبة في سجل التحضير
            $preparedMeal = PreparedMeal::create([
                'meal_name' => $meal->name . " (محفوظة)",
                'saved_meal_id' => $meal->id,
                'ingredients' => json_encode($meal->ingredients),
                'total_cost' => $totalCost,
                'sale_price' => $meal->sale_price,
                'quantity' => $quantity,
                'prepared_by' => $request->input('prepared_by', auth()->user()?->name ?? 'نظام'),
                'notes' => $request->input('notes', 'استخدام وجبة محفوظة'),
                'prepared_at' => now()
            ]);
            
            Log::info('تم تسجيل الوجبة المحضرة', [
                'prepared_meal_id' => $preparedMeal->id,
                'meal_name' => $meal->name
            ]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => "✅ تم استخدام '{$meal->name}' وخصم تكلفتها من الخزنة",
                'data' => [
                    'meal' => $meal,
                    'category_info' => [
                        'الصنف_الرئيسي' => $meal->category,
                        'الصنف_الفرعي' => $meal->subcategory
                    ],
                    'prepared_record' => $preparedMeal,
                    'quantity' => $quantity,
                    'treasury' => [
                        'الرصيد_السابق' => $oldBalance,
                        'الرصيد_الجديد' => $treasury->balance,
                        'المبلغ_المخصوم' => $totalCost
                    ],
                    'transaction' => $transaction
                ]
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('خطأ في استخدام الوجبة', [
                'meal_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'خطأ في استخدام الوجبة: ' . $e->getMessage()
            ], 500);
        }
    }

    // استرجاع وجبة
    public function returnMeal(Request $request, $id)
    {
        try {
            DB::beginTransaction();
            
            // 1. البحث عن الوجبة
            $meal = SavedMeal::find($id);
            
            if (!$meal) {
                return response()->json([
                    'success' => false,
                    'message' => 'الوجبة غير موجودة'
                ], 404);
            }
            
            Log::info('الوجبة التي سيتم استرجاعها:', ['meal' => $meal]);
            
            // 2. جلب المكونات
            $ingredients = $meal->ingredients;
            Log::info('مكونات الوجبة:', ['ingredients' => $ingredients]);
            
            if (empty($ingredients)) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا توجد مكونات لهذه الوجبة'
                ], 400);
            }
            
            // 3. إرجاع المكونات للمخزون
            $ingredientsReturned = [];
            foreach ($ingredients as $ingredient) {
                Log::info('معالجة المكون:', ['ingredient' => $ingredient]);
                
                $product = Product::find($ingredient['product_id']);
                
                if ($product) {
                    Log::info('قبل تحديث المخزون:', [
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'current_stock' => $product->stock
                    ]);
                    
                    // إضافة الكمية للمخزون
                    $quantityToAdd = $ingredient['quantity'] ?? 0;
                    $product->stock += $quantityToAdd;
                    $product->save();
                    
                    Log::info('بعد تحديث المخزون:', [
                        'product_id' => $product->id,
                        'new_stock' => $product->stock,
                        'added_quantity' => $quantityToAdd
                    ]);
                    
                    $ingredientsReturned[] = [
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'quantity_returned' => $quantityToAdd,
                        'new_stock' => $product->stock
                    ];
                } else {
                    Log::warning('المنتج غير موجود:', ['product_id' => $ingredient['product_id']]);
                }
            }
            
            // 4. تسجيل الاسترجاع في التاريخ
            Log::info('إنشاء سجل الاسترجاع');
            
            // تحقق من وجود جدول returned_meals
            if (Schema::hasTable('returned_meals')) {
                $returnRecord = ReturnedMeal::create([
                    'saved_meal_id' => $meal->id,
                    'meal_name' => $meal->name,
                    'category' => $meal->category,
                    'ingredients' => json_encode($ingredients),
                    'total_cost' => $meal->total_cost,
                    'returned_by' => 'نظام',
                    'return_date' => now(),
                ]);
                Log::info('تم إنشاء سجل الاسترجاع:', ['return_id' => $returnRecord->id]);
            } else {
                Log::warning('جدول returned_meals غير موجود');
                $returnRecord = null;
            }
            
            DB::commit();
            
            Log::info('تم استرجاع الوجبة بنجاح', ['meal_id' => $meal->id]);
            
            return response()->json([
                'success' => true,
                'message' => 'تم استرجاع الوجبة بنجاح وإرجاع المكونات للمخزون',
                'data' => [
                    'meal' => $meal,
                    'category_info' => [
                        'الصنف_الرئيسي' => $meal->category,
                        'الصنف_الفرعي' => $meal->subcategory
                    ],
                    'return_record' => $returnRecord,
                    'ingredients_returned' => $ingredientsReturned
                ]
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('خطأ في استرجاع الوجبة:', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'meal_id' => $id
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'خطأ في استرجاع الوجبة',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ], 500);
        }
    }
    
    // عرض تاريخ الاسترجاعات
    public function returnHistory()
    {
        try {
            Log::info('جلب تاريخ الاسترجاعات');
            
            // تحقق من وجود الجدول أولاً
            if (!Schema::hasTable('returned_meals')) {
                Log::warning('جدول returned_meals غير موجود');
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'count' => 0,
                    'message' => 'الجدول غير موجود'
                ]);
            }
            
            $returns = ReturnedMeal::orderBy('created_at', 'desc')->get();
            Log::info('عدد سجلات الاسترجاعات:', ['count' => $returns->count()]);
            
            return response()->json([
                'success' => true,
                'data' => $returns,
                'count' => $returns->count()
            ]);
            
        } catch (\Exception $e) {
            Log::error('خطأ في جلب تاريخ الاسترجاعات:', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'خطأ في جلب تاريخ الاسترجاعات: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getPreparationHistory($id)
    {
        try {
            $history = MealPreparation::where('saved_meal_id', $id)
                ->orderBy('created_at', 'desc')
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => $history
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في جلب سجل التحضيرات'
            ], 500);
        }
    }
    
    // حذف وجبة محفوظة
    public function destroy($id)
    {
        try {
            Log::info('حذف وجبة محفوظة:', ['meal_id' => $id]);
            
            $meal = SavedMeal::find($id);
            
            if (!$meal) {
                return response()->json([
                    'success' => false,
                    'message' => 'الوجبة غير موجودة'
                ], 404);
            }
            
            $meal->delete();
            
            Log::info('تم حذف الوجبة:', ['meal_id' => $id]);
            
            return response()->json([
                'success' => true,
                'message' => 'تم حذف الوجبة بنجاح'
            ]);
        } catch (\Exception $e) {
            Log::error('خطأ في حذف الوجبة:', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'meal_id' => $id
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'خطأ في حذف الوجبة: ' . $e->getMessage()
            ], 500);
        }
    }
}