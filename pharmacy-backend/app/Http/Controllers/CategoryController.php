<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Models\Product;
use Illuminate\Support\Facades\Log;
use App\Models\TreasuryTransaction;
use Carbon\Carbon;
class CategoryController extends Controller
{
    /**
     * عرض جميع الأقسام مع الترقيم
     */
   public function index(Request $request)
{
    try {
        // Log بداية الطلب
        \Log::info('CategoryController@index - بدء جلب الأقسام', [
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'query_params' => $request->all()
        ]);
        
        $perPage = $request->get('per_page', 15);
        $search = $request->get('search');
        
        \Log::debug('CategoryController@index - معاملات البحث', [
            'perPage' => $perPage,
            'search' => $search
        ]);
        
        $query = Category::withCount('products')
            ->with('parent:id,name,icon')
            ->orderBy('name');
        
        if ($search) {
            \Log::info('CategoryController@index - بحث بالنص', ['search_term' => $search]);
            
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                  ->orWhere('description', 'LIKE', "%{$search}%");
            });
        }
        
        // Log الاستعلام النهائي
        \Log::debug('CategoryController@index - SQL Query', [
            'sql' => $query->toSql(),
            'bindings' => $query->getBindings()
        ]);
        
        $categories = $query->paginate($perPage);
        
        // Log نتيجة الاستعلام
        \Log::info('CategoryController@index - نتيجة جلب الأقسام', [
            'total_categories' => $categories->total(),
            'current_page' => $categories->currentPage(),
            'per_page' => $categories->perPage(),
            'has_more_pages' => $categories->hasMorePages()
        ]);
        
        // Log تفاصيل إذا كان هناك نتائج قليلة
        if ($categories->count() > 0 && $categories->count() <= 5) {
            \Log::debug('CategoryController@index - تفاصيل الأقسام المنجزة', [
                'category_names' => $categories->pluck('name')->toArray(),
                'category_ids' => $categories->pluck('id')->toArray()
            ]);
        }
        
        return response()->json([
            'success' => true,
            'data' => $categories->items(),
            'pagination' => [
                'total' => $categories->total(),
                'per_page' => $categories->perPage(),
                'current_page' => $categories->currentPage(),
                'last_page' => $categories->lastPage(),
            ],
            'message' => 'تم جلب الأقسام بنجاح'
        ]);
        
    } catch (\Exception $e) {
        // Log الخطأ بالتفاصيل
        \Log::error('CategoryController@index - حدث خطأ', [
            'error_message' => $e->getMessage(),
            'error_file' => $e->getFile(),
            'error_line' => $e->getLine(),
            'error_trace' => $e->getTraceAsString(),
            'request_data' => $request->all(),
            'request_url' => $request->fullUrl(),
            'request_method' => $request->method(),
            'user_id' => auth()->id() ?? 'guest'
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب بيانات الأقسام',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}
    
/**
 * إنشاء قسم جديد (ذكي)
 */
public function store(Request $request)
{
    $validator = Validator::make($request->all(), [
        'name' => 'required|string|max:255|unique:categories,name',
        'description' => 'nullable|string|max:500',
        'icon' => 'nullable|string|in:fastfood,kitchen,local_drink,grocery,category,bakery,dairy,other',
        'parent_id' => 'nullable|exists:categories,id',
        'is_main' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer|min:0',
        'scope' => 'nullable|in:purchase,sales',
        
        // ⭐ الحقول الجديدة للأسعار والكميات
        'cost_price' => 'nullable|numeric|min:0',
        'profit_margin' => 'nullable|numeric|min:0',
        'sale_price' => 'nullable|numeric|min:0',
        'quantity' => 'nullable|numeric|min:0',
        'min_quantity' => 'nullable|numeric|min:0',
        'max_quantity' => 'nullable|numeric|min:0',
        
        // ⭐⭐⭐ الأهم: حقول الوحدة
        'unit_type' => 'nullable|in:kg,gram,quantity',  // نوع الوحدة
        'unit' => 'nullable|in:kg,gram,quantity',       // الوحدة المستخدمة
        
        'track_quantity' => 'boolean',
        'auto_calculate' => 'boolean'
    ]);
    
    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'خطأ في التحقق من البيانات',
            'errors' => $validator->errors()
        ], 422);
    }
    
    try {
        $data = [
            'name' => $request->name,
            'description' => $request->description,
            'icon' => $request->icon ?? 'category',
            'is_active' => $request->has('is_active') ? (bool) $request->is_active : true,
            'sort_order' => $request->sort_order ?? 0,
            
            // ⭐ الأسعار والكميات
            'cost_price' => $request->cost_price,
            'profit_margin' => $request->profit_margin,
            'sale_price' => $request->sale_price,
            'quantity' => $request->quantity ?? 0,
            'min_quantity' => $request->min_quantity ?? 0,
            'max_quantity' => $request->max_quantity ?? 1000,
            
            // ⭐⭐⭐ الوحدات - الأهم هنا
            'unit_type' => $request->unit_type ?? 'kg',  // افتراضي كيلو
            'unit' => $request->unit ?? 'kg',            // افتراضي كيلو
            
            'track_quantity' => $request->has('track_quantity') ? (bool) $request->track_quantity : false,
            'auto_calculate' => $request->has('auto_calculate') ? (bool) $request->auto_calculate : true
        ];
        
        // معالجة parent_id حسب نوع القسم
        if ($request->has('is_main') && $request->is_main == true) {
            $data['parent_id'] = null;  // قسم رئيسي
        } elseif ($request->has('parent_id')) {
            $data['parent_id'] = $request->parent_id;  // قسم فرعي
        } else {
            $data['parent_id'] = null;  // افتراضي قسم رئيسي
        }
        if ($request->has('scope') && in_array($request->scope, ['purchase', 'sales'], true)) {
            $data['scope'] = $request->scope;
        } else {
            $data['scope'] = 'purchase';
        }
        
        $category = Category::create($data);
        
        return response()->json([
            'success' => true,
            'message' => $data['parent_id'] ? 
                'تم إنشاء القسم الفرعي بنجاح' : 
                'تم إنشاء القسم الرئيسي بنجاح',
            'data' => $category->load('parent:id,name')
        ], 201);
        
    } catch (\Exception $e) {
        \Log::error('Category store error: ' . $e->getMessage(), [
            'request' => $request->all()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء إنشاء القسم',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}





/**
 * إحصائيات مخزون الأقسام
 */
public function getInventoryStats()
{
    try {
        $stats = [
            'total_categories' => Category::count(),
            'tracked_categories' => Category::tracked()->count(),
            'total_quantity' => Category::tracked()->sum('quantity'),
            'total_cost_value' => Category::tracked()->sum('total_cost'),
            'total_sale_value' => Category::tracked()->sum('total_value'),
            'expected_profit' => Category::tracked()->sum(DB::raw('(sale_price - cost_price) * quantity')),
            'low_quantity_categories' => Category::lowQuantity()->count(),
            'out_of_stock_categories' => Category::tracked()->where('quantity', 0)->count(),
            'categories_by_profit' => Category::tracked()
                ->select('id', 'name', DB::raw('(sale_price - cost_price) * quantity as profit'))
                ->orderBy('profit', 'desc')
                ->limit(10)
                ->get()
        ];

        return response()->json([
            'success' => true,
            'data' => $stats,
            'message' => 'تم جلب إحصائيات المخزون بنجاح'
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب الإحصائيات'
        ], 500);
    }
}

public function updateQuantityAndPrices(Request $request, $id)
{
    $category = Category::find($id);
    
    if (!$category) {
        return response()->json([
            'success' => false,
            'message' => 'القسم غير موجود'
        ], 404);
    }

    $validator = Validator::make($request->all(), [
        'quantity' => 'nullable|numeric|min:0',      // ⭐ تم التعديل
        'cost_price' => 'nullable|numeric|min:0',
        'profit_margin' => 'nullable|numeric|min:0',
        'sale_price' => 'nullable|numeric|min:0',
        'operation' => 'nullable|in:increase,decrease,set', // زيادة، نقصان، تعيين
        'amount' => 'nullable|numeric|min:0'
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'errors' => $validator->errors()
        ], 422);
    }

    try {
        DB::beginTransaction();

        // تحديث الكمية حسب العملية
        if ($request->has('operation') && $request->has('amount')) {
            switch ($request->operation) {
                case 'increase':
                    $category->increaseQuantity($request->amount);
                    break;
                case 'decrease':
                    $category->decreaseQuantity($request->amount);
                    break;
                case 'set':
                    $category->quantity = $request->amount;
                    $category->save();
                    $category->recalculateTotals();
                    break;
            }
        } else if ($request->has('quantity')) {
            $category->quantity = $request->quantity;
            $category->recalculateTotals();
        }

        // تحديث الأسعار
        $updateData = [];
        
        if ($request->has('cost_price')) {
            $updateData['cost_price'] = $request->cost_price;
        }
        
        if ($request->has('profit_margin')) {
            $updateData['profit_margin'] = $request->profit_margin;
        }
        
        if ($request->has('sale_price')) {
            $updateData['sale_price'] = $request->sale_price;
            $updateData['auto_calculate'] = false; // تعطيل الحساب التلقائي
        }

        if (!empty($updateData)) {
            $category->update($updateData);
            $category->recalculateTotals();
        }

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الكمية والأسعار بنجاح',
            'data' => [
                'category' => $category->only(['id', 'name', 'quantity', 'cost_price', 'profit_margin', 'sale_price']),
                'totals' => [
                    'total_cost' => $category->total_cost,
                    'total_value' => $category->total_value,
                    'expected_profit' => $category->expected_profit,
                    'profit_percentage' => $category->profit_percentage
                ],
                'status' => [
                    'is_low_quantity' => $category->isLowQuantity(),
                    'is_over_max' => $category->isOverMaxQuantity(),
                    'remaining_value' => $category->remaining_value
                ]
            ]
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        
        \Log::error('Update quantity error', [
            'id' => $id,
            'error' => $e->getMessage()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء التحديث'
        ], 500);
    }
}


public function purchasesDetailedReport(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'period' => 'required|in:daily,weekly,monthly,custom',
            'start_date' => 'required_if:period,custom|date',
            'end_date' => 'required_if:period,custom|date|after_or_equal:start_date',
            'category_id' => 'nullable|exists:categories,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في البيانات المدخلة',
                'errors' => $validator->errors()
            ], 422);
        }

        // تحديد نطاق التاريخ حسب الفترة
        $startDate = null;
        $endDate = null;
        $period = $request->period;

        switch ($period) {
            case 'daily':
                $startDate = now()->startOfDay();
                $endDate = now()->endOfDay();
                break;
            case 'weekly':
                $startDate = now()->startOfWeek();
                $endDate = now()->endOfWeek();
                break;
            case 'monthly':
                $startDate = now()->startOfMonth();
                $endDate = now()->endOfMonth();
                break;
            case 'custom':
                $startDate = Carbon::parse($request->start_date)->startOfDay();
                $endDate = Carbon::parse($request->end_date)->endOfDay();
                break;
        }

        // جلب معاملات الشراء من الخزنة (purchase_expense = مصروف فاتورة شراء)
        $purchasesQuery = TreasuryTransaction::where('type', 'expense')
            ->whereIn('category', ['purchases', 'purchase_expense'])
            ->whereBetween('transaction_date', [$startDate, $endDate])
            ->orderBy('transaction_date', 'desc');

        if ($request->category_id) {
            $purchasesQuery->where('reference_id', $request->category_id)
                ->where('reference_type', 'App\\Models\\Category');
        }

        $purchases = $purchasesQuery->get();

        // تجهيز بيانات المشتريات التفصيلية
        $purchasesData = [];
        $totalAmount = 0;
        $totalItems = 0;
        $totalPurchases = $purchases->count();

        foreach ($purchases as $purchase) {
            $metadata = json_decode($purchase->metadata, true) ?? [];
            $items = $metadata['items'] ?? [];
            
            $purchaseItems = [];
            $purchaseTotal = 0;
            
            foreach ($items as $item) {
                $category = Category::find($item['category_id'] ?? $item['id'] ?? null);
                $itemTotal = ($item['cost_price'] ?? 0) * ($item['quantity'] ?? 0);
                $purchaseTotal += $itemTotal;
                
                $purchaseItems[] = [
                    'category_id' => $item['category_id'] ?? $item['id'] ?? null,
                    'category_name' => $category->name ?? ($item['category_name'] ?? 'غير معروف'),
                    'quantity' => $item['quantity'] ?? 0,
                    'cost_price' => $item['cost_price'] ?? 0,
                    'total_cost' => $itemTotal,
                    'old_quantity' => $item['old_quantity'] ?? 0,
                    'new_quantity' => $item['new_quantity'] ?? 0,
                ];
            }

            $purchasesData[] = [
                'id' => $purchase->id,
                'transaction_number' => $purchase->transaction_number,
                'date' => $purchase->transaction_date->format('Y-m-d'),
                'time' => $purchase->created_at->format('H:i:s'),
                'datetime' => $purchase->created_at->format('Y-m-d H:i:s'),
                'description' => $purchase->description,
                'amount' => $purchase->amount,
                'payment_method' => $purchase->payment_method,
                'items_count' => count($purchaseItems),
                'items' => $purchaseItems,
                'notes' => $purchase->notes,
                'metadata' => $metadata
            ];

            $totalAmount += $purchase->amount;
            $totalItems += count($purchaseItems);
        }

        // إحصائيات
        $stats = [
            'period' => [
                'type' => $period,
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
                'days' => $startDate->diffInDays($endDate) + 1
            ],
            'summary' => [
                'total_purchases' => $totalPurchases,
                'total_amount' => $totalAmount,
                'total_items' => $totalItems,
                'average_purchase' => $totalPurchases > 0 ? round($totalAmount / $totalPurchases, 2) : 0,
            ]
        ];

        // أكثر الأقسام شراءً
        $topCategories = [];
        $categoryStats = [];

        foreach ($purchasesData as $purchase) {
            foreach ($purchase['items'] as $item) {
                $catId = $item['category_id'];
                if (!isset($categoryStats[$catId])) {
                    $categoryStats[$catId] = [
                        'category_id' => $catId,
                        'category_name' => $item['category_name'],
                        'total_quantity' => 0,
                        'total_cost' => 0,
                        'purchases_count' => 0
                    ];
                }
                $categoryStats[$catId]['total_quantity'] += $item['quantity'];
                $categoryStats[$catId]['total_cost'] += $item['total_cost'];
                $categoryStats[$catId]['purchases_count']++;
            }
        }

        $topCategories = collect($categoryStats)
            ->sortByDesc('total_cost')
            ->values()
            ->take(10)
            ->toArray();

        return response()->json([
            'success' => true,
            'message' => 'تم جلب تقرير المشتريات بنجاح',
            'data' => [
                'filters' => $request->all(),
                'stats' => $stats,
                'purchases' => $purchasesData,
                'analysis' => [
                    'top_categories' => $topCategories,
                ]
            ]
        ]);

    } catch (\Exception $e) {
        Log::error('خطأ في تقرير المشتريات: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString()
        ]);

        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب تقرير المشتريات',
            'error' => config('app.debug') ? $e->getMessage() : null
        ], 500);
    }
}
public function updateSubCategory(Request $request, $parentId = null, $subId = null)
{
    try {
        \Log::info('=== بداية updateSubCategory (BULK) ===', [
            'request_data' => $request->all()
        ]);
        
        // التحقق من البيانات
        $validator = Validator::make($request->all(), [
            'quantity' => 'nullable|numeric|min:0',      // ⭐ تم التعديل
            'cost_price' => 'nullable|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'profit_margin' => 'nullable|numeric|min:0',
            'items' => 'nullable|array',
            'items.*.id' => 'required_with:items|exists:categories,id',
            'items.*.quantity' => 'nullable|numeric|min:0',
            'items.*.cost_price' => 'nullable|numeric|min:0',
            'items.*.sale_price' => 'nullable|numeric|min:0'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        // ⭐⭐ حساب إجمالي المبلغ للخصم وجمع البيانات
        $totalCost = 0;
        $items = [];
        $priceHistory = []; // ⭐ لتخزين تاريخ الأسعار
        
        if ($request->has('items')) {
            // Bulk update مع items
            $items = $request->items;
            
            // ⭐⭐ جلب الأسعار القديمة قبل التحديث
            foreach ($items as &$item) {
                $category = Category::find($item['id']);
                if ($category) {
                    $item['old_cost_price'] = $category->cost_price; // ⭐ السعر القديم
                    $item['old_quantity'] = $category->quantity;     // ⭐ الكمية القديمة
                    
                    // ⭐ تخزين في price_history
                    $priceHistory[] = [
                        'category_id' => $item['id'],
                        'category_name' => $category->name,
                        'old_price' => $category->cost_price,
                        'new_price' => ($category->cost_price ?? 0) + ($item['cost_price'] ?? 0),
                        'old_quantity' => $category->quantity,
                        'new_quantity' => ($category->quantity ?? 0) + ($item['quantity'] ?? 0),
                        'added_quantity' => $item['quantity'] ?? 0,
                        'added_cost' => ($item['quantity'] ?? 0) * ($item['cost_price'] ?? 0)
                    ];
                }
            }
            
            // حساب totalCost
            foreach ($items as $item) {
                if (isset($item['quantity']) && isset($item['cost_price'])) {
                    $totalCost += $item['quantity'] * $item['cost_price'];
                }
            }
        } else {
            // Single update
            $category = Category::find($subId ?? $request->id);
            
            $oldPrice = $category->cost_price ?? 0;
            $oldQuantity = $category->quantity ?? 0;
            
            $items = [[
                'id' => $subId ?? $request->id,
                'quantity' => $request->quantity,
                'cost_price' => $request->cost_price,
                'sale_price' => $request->sale_price,
                'profit_margin' => $request->profit_margin,
                'old_cost_price' => $oldPrice,
                'old_quantity' => $oldQuantity
            ]];
            
            if ($request->has('quantity') && $request->has('cost_price')) {
                $totalCost = $request->quantity * $request->cost_price;
            }
            
            // ⭐ تخزين في price_history
            $priceHistory[] = [
                'category_id' => $category->id,
                'category_name' => $category->name,
                'old_price' => $oldPrice,
                'new_price' => $oldPrice + ($request->cost_price ?? 0),
                'old_quantity' => $oldQuantity,
                'new_quantity' => $oldQuantity + ($request->quantity ?? 0),
                'added_quantity' => $request->quantity ?? 0,
                'added_cost' => ($request->quantity ?? 0) * ($request->cost_price ?? 0)
            ];
        }
        
        \Log::info('💰 إجمالي المبلغ للخصم', [
            'totalCost' => $totalCost,
            'items_count' => count($items),
            'price_history' => $priceHistory
        ]);
        
        // ⭐⭐ التحقق من الخزنة
        if ($totalCost > 0) {
            $treasury = \App\Models\Treasury::first();
            
            if (!$treasury) {
                return response()->json([
                    'success' => false,
                    'message' => '❌ لا توجد خزنة في النظام'
                ], 400);
            }
            
            \Log::info('💰 حالة الخزنة', [
                'balance' => $treasury->balance,
                'required' => $totalCost,
            ]);
            // لا نمنع العملية لعجز الخزنة — الخصم يُنفَّذ وقد يصبح الرصيد سالباً

            // ⭐⭐ بدأ المعاملة
            DB::beginTransaction();
            
            try {
                // تنفيذ التحديثات
                $result = $this->addBulkPriceQuantity($request);
                
                $resultContent = json_decode($result->getContent(), true);
                
                if ($result->getStatusCode() === 200 && ($resultContent['success'] ?? false)) {
                    
                    // ⭐⭐ خصم المبلغ من الخزنة (كاش)
                    $oldBalance = $treasury->balance;
                    $treasury->adjustCashLegacy(-$totalCost);
                    $treasury->total_expenses += $totalCost;
                    $treasury->save();
                    
                    // ⭐⭐ تحضير metadata مع تفاصيل الأسعار
                    $metadata = [
                        'items' => $items,
                        'total_cost' => $totalCost,
                        'price_history' => $priceHistory, // ⭐⭐ إضافة تاريخ الأسعار
                        'purchase_date' => now()->toDateTimeString(),
                        'summary' => [
                            'total_items' => count($items),
                            'total_quantity' => array_sum(array_column($items, 'quantity')),
                            'average_price' => $totalCost / max(1, array_sum(array_column($items, 'quantity')))
                        ]
                    ];
                    
                    // ⭐⭐ تسجيل المعاملة
                    $transaction = \App\Models\TreasuryTransaction::create([
                        'treasury_id' => $treasury->id,
                        'type' => 'expense',
                        'amount' => $totalCost,
                        'description' => "شراء مواد - " . count($items) . " عناصر",
                        'category' => 'purchases',
                        'transaction_date' => now(),
                        'transaction_number' => 'PUR-' . time(),
                        'status' => 'completed',
                        'payment_method' => 'cash',
                        'created_by' => auth()->id() ?? 1,
                        'metadata' => json_encode($metadata) // ⭐⭐ تخزين metadata كاملة
                    ]);
                    
                    DB::commit();
                    
                    // تعديل الاستجابة
                    $resultContent['treasury'] = [
                        'old_balance' => number_format($oldBalance, 2),
                        'new_balance' => number_format($treasury->balance, 2),
                        'deducted' => number_format($totalCost, 2),
                        'transaction_id' => $transaction->id
                    ];
                    
                    // ⭐⭐ إضافة price_history للاستجابة
                    $resultContent['price_history'] = $priceHistory;
                    $resultContent['message'] = '✅ تمت العملية وخصم ' . number_format($totalCost, 2) . ' ₪ من الخزنة';
                    
                    return response()->json($resultContent);
                }
                
                DB::rollBack();
                return $result;
                
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
        }
        
        // إذا ما في خصم
        return $this->addBulkPriceQuantity($request);
        
    } catch (\Exception $e) {
        \Log::error('خطأ', [
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ: ' . $e->getMessage()
        ], 500);
    }
}
/**
 * زيادة الكمية والسعر لقسم واحد
 */
private function addSinglePriceQuantity(Request $request, $parentId, $subId)
{
    try {
        // التحقق من القسم الرئيسي
        $parentCategory = Category::find($parentId);
        if (!$parentCategory) {
            return response()->json([
                'success' => false,
                'message' => 'القسم الرئيسي غير موجود'
            ], 404);
        }
        
        // التحقق من القسم الفرعي
        $subCategory = Category::where('id', $subId)
            ->where('parent_id', $parentId)
            ->first();
        
        if (!$subCategory) {
            return response()->json([
                'success' => false,
                'message' => 'القسم الفرعي غير موجود تحت هذا القسم الرئيسي'
            ], 404);
        }
        
        // نسخة من القسم قبل التحديث
        $oldCategory = clone $subCategory;
        
        // زيادة الكمية
        if ($request->has('quantity') && $request->quantity > 0) {
            $subCategory->quantity += $request->quantity;
        }
        
        // زيادة سعر التكلفة
        if ($request->has('cost_price') && $request->cost_price > 0) {
            $subCategory->cost_price += $request->cost_price;
            // إذا كان الحساب التلقائي مفعلاً، إعادة حساب سعر البيع
            if ($subCategory->auto_calculate && $subCategory->profit_margin) {
                $subCategory->sale_price = $subCategory->cost_price * (1 + ($subCategory->profit_margin / 100));
            }
        }
        
        // زيادة سعر البيع
        if ($request->has('sale_price') && $request->sale_price > 0) {
            $subCategory->sale_price += $request->sale_price;
            // إذا تم تحديث سعر البيع يدوياً، تعطيل الحساب التلقائي
            $subCategory->auto_calculate = false;
        }
        
        // زيادة نسبة الربح
        if ($request->has('profit_margin') && $request->profit_margin > 0) {
            $subCategory->profit_margin += $request->profit_margin;
            // إذا كان الحساب التلقائي مفعلاً، إعادة حساب سعر البيع
            if ($subCategory->auto_calculate && $subCategory->cost_price) {
                $subCategory->sale_price = $subCategory->cost_price * (1 + ($subCategory->profit_margin / 100));
            }
        }
        
        // حفظ التغييرات
        $subCategory->recalculateTotals();
        $subCategory->save();
        $subCategory->refresh();
        
        // حساب الزيادات
        $increases = [
            'quantity' => $subCategory->quantity - $oldCategory->quantity,
            'cost_price' => $subCategory->cost_price - $oldCategory->cost_price,
            'sale_price' => $subCategory->sale_price - $oldCategory->sale_price,
            'profit_margin' => $subCategory->profit_margin - $oldCategory->profit_margin,
            'total_cost' => $subCategory->total_cost - ($oldCategory->total_cost ?? 0),
            'total_value' => $subCategory->total_value - ($oldCategory->total_value ?? 0)
        ];
        
        // ✅ تأكد أن الـ response فيه success = true
        return response()->json([
            'success' => true,  // هذا مهم جداً!
            'message' => 'تم زيادة القيم بنجاح',
            'data' => [
                'category' => [
                    'id' => $subCategory->id,
                    'name' => $subCategory->name,
                    'new_quantity' => $subCategory->quantity,
                    'new_cost_price' => $subCategory->cost_price,
                    'new_sale_price' => $subCategory->sale_price,
                    'new_profit_margin' => $subCategory->profit_margin
                ],
                'increases' => $increases,
                'totals' => [
                    'total_cost' => $subCategory->total_cost,
                    'total_value' => $subCategory->total_value,
                    'expected_profit' => $subCategory->expected_profit
                ]
            ]
        ]);
        
    } catch (\Exception $e) {
        // ✅ في حالة الخطأ، success = false
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء زيادة القيم',
            'error' => $e->getMessage()
        ], 500);
    }
}



/**
 * زيادة جماعية للأقسام
 */
private function addBulkPriceQuantity(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|exists:categories,id',
            'items.*.quantity' => 'nullable|numeric|min:0',
            'items.*.cost_price' => 'nullable|numeric|min:0',
            'items.*.sale_price' => 'nullable|numeric|min:0',
            'items.*.profit_margin' => 'nullable|numeric|min:0'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        $results = [
            'successful' => [],
            'failed' => []
        ];
        
        DB::beginTransaction();
        
        foreach ($request->items as $item) {
            try {
                $category = Category::find($item['id']);
                
                if (!$category) {
                    continue;
                }
                
                // ⭐⭐ تخزين القيم القديمة
                $oldValues = [
                    'quantity' => $category->quantity,
                    'cost_price' => $category->cost_price,
                    'sale_price' => $category->sale_price,
                    'profit_margin' => $category->profit_margin
                ];
                
                // ✅ تحديث الكمية
                if (isset($item['quantity']) && $item['quantity'] > 0) {
                    $category->quantity += $item['quantity'];
                }
                
                // ✅ ✅ الأهم: تحديث سعر التكلفة
                if (isset($item['cost_price']) && $item['cost_price'] > 0) {
                    $category->cost_price += $item['cost_price']; // ⭐ إضافة للتكلفة
                }
                
                // تحديث سعر البيع
                if (isset($item['sale_price']) && $item['sale_price'] > 0) {
                    $category->sale_price = $item['sale_price']; // تعيين مباشر
                }
                
                $category->recalculateTotals();
                $category->save();
                
                // ⭐⭐ إضافة القيم الجديدة مع القيم القديمة للنتائج
                $results['successful'][] = [
                    'id' => $category->id,
                    'name' => $category->name,
                    'old_values' => $oldValues,
                    'new_values' => [
                        'quantity' => $category->quantity,
                        'cost_price' => $category->cost_price,
                        'sale_price' => $category->sale_price,
                        'profit_margin' => $category->profit_margin
                    ],
                    'changes' => [
                        'quantity' => $category->quantity - $oldValues['quantity'],
                        'cost_price' => $category->cost_price - $oldValues['cost_price'],
                        'total_cost_added' => ($category->quantity - $oldValues['quantity']) * 
                                             ($category->cost_price - $oldValues['cost_price'])
                    ]
                ];
                
            } catch (\Exception $e) {
                $results['failed'][] = [
                    'id' => $item['id'] ?? 'unknown',
                    'error' => $e->getMessage()
                ];
                continue;
            }
        }
        
        DB::commit();
        
        return response()->json([
            'success' => true,
            'message' => sprintf('تم زيادة %d قسم بنجاح', count($results['successful'])),
            'data' => $results
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        
        \Log::error('Bulk add error', [
            'error' => $e->getMessage()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء الزيادة الجماعية'
        ], 500);
    }
}



/**
 * عرض تقرير تفصيلي للمشتريات مع تاريخ الأسعار
 */
public function getPurchaseDetails($transactionId)
{
    try {
        $transaction = \App\Models\TreasuryTransaction::find($transactionId);
        
        if (!$transaction || $transaction->category != 'purchases') {
            return response()->json([
                'success' => false,
                'message' => 'المعاملة غير موجودة'
            ], 404);
        }
        
        $metadata = json_decode($transaction->metadata, true);
        
        return response()->json([
            'success' => true,
            'data' => [
                'transaction' => [
                    'id' => $transaction->id,
                    'number' => $transaction->transaction_number,
                    'date' => $transaction->transaction_date,
                    'amount' => $transaction->amount,
                    'description' => $transaction->description
                ],
                'purchase_details' => $metadata,
                'summary' => [
                    'total_items' => count($metadata['items'] ?? []),
                    'total_cost' => $metadata['total_cost'] ?? 0,
                    'price_changes' => array_map(function($item) {
                        return [
                            'name' => $item['category_name'] ?? 'غير معروف',
                            'old_price' => $item['old_price'] ?? 0,
                            'new_price' => $item['new_price'] ?? 0,
                            'price_increase' => ($item['new_price'] ?? 0) - ($item['old_price'] ?? 0),
                            'old_quantity' => $item['old_quantity'] ?? 0,
                            'new_quantity' => $item['new_quantity'] ?? 0,
                            'added_quantity' => $item['added_quantity'] ?? 0
                        ];
                    }, $metadata['price_history'] ?? [])
                ]
            ]
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب التفاصيل'
        ], 500);
    }
}

/**
 * تحديث قسم فرعي واحد
 */
private function updateSingleSubCategory(Request $request, $parentId, $subId)
{
    // 1. التحقق من القسم الرئيسي
    $parentCategory = Category::find($parentId);
    if (!$parentCategory) {
        return response()->json([
            'success' => false,
            'message' => 'القسم الرئيسي غير موجود'
        ], 404);
    }
    
    // 2. التحقق من القسم الفرعي
    $subCategory = Category::where('id', $subId)
        ->where('parent_id', $parentId)
        ->first();
    
    if (!$subCategory) {
        return response()->json([
            'success' => false,
            'message' => 'القسم الفرعي غير موجود تحت هذا القسم الرئيسي'
        ], 404);
    }
    
    return $this->processCategoryUpdate($request, $subCategory, 'single');
}

/**
 * تحديث عدة أقسام فرعية
 */
private function updateBulkSubCategories(Request $request)
{
    $validator = Validator::make($request->all(), [
        'items' => 'required|array|min:1',
        'items.*.id' => 'required|exists:categories,id',
        'items.*.name' => 'sometimes|string|max:255',
        'items.*.cost_price' => 'nullable|numeric|min:0',
        'items.*.profit_margin' => 'nullable|numeric|min:0',
        'items.*.sale_price' => 'nullable|numeric|min:0',
'items.*.quantity' => 'nullable|numeric|min:0',  // ⭐ تم التعديل
        'items.*.operation' => 'nullable|in:increase,decrease,set',
        'items.*.amount' => 'nullable|numeric|min:0',
        'items.*.track_quantity' => 'nullable|boolean',
        'items.*.auto_calculate' => 'nullable|boolean'
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
        
        $updatedItems = [];
        $failedItems = [];
        
        foreach ($request->items as $itemData) {
            try {
                $category = Category::find($itemData['id']);
                
                if (!$category) {
                    $failedItems[] = [
                        'id' => $itemData['id'],
                        'error' => 'القسم غير موجود'
                    ];
                    continue;
                }
                
                // معالجة تحديث الكمية
                $this->handleQuantityUpdate($itemData, $category);
                
                // تحديث الحقول الأخرى
                $updateFields = $this->prepareUpdateFields($itemData);
                
                if (!empty($updateFields)) {
                    $category->update($updateFields);
                    
                    // إعادة حساب المجاميع
                    $category->recalculateTotals();
                    $category->refresh();
                }
                
                $updatedItems[] = $this->formatCategoryResponse($category);
                
            } catch (\Exception $e) {
                $failedItems[] = [
                    'id' => $itemData['id'] ?? 'unknown',
                    'error' => $e->getMessage()
                ];
                continue;
            }
        }
        
        DB::commit();
        
        return response()->json([
            'success' => true,
            'message' => sprintf('تم تحديث %d عنصر بنجاح', count($updatedItems)),
            'data' => [
                'updated' => $updatedItems,
                'failed' => $failedItems,
                'total_updated' => count($updatedItems),
                'total_failed' => count($failedItems)
            ]
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        
        \Log::error('Bulk update error: ' . $e->getMessage(), [
            'request' => $request->all()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء التحديث الجماعي',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}

/**
 * معالجة تحديث كمية القسم
 */
private function handleQuantityUpdate($data, $category)
{
    if (isset($data['operation']) && isset($data['amount'])) {
        switch ($data['operation']) {
            case 'increase':
                $category->increaseQuantity($data['amount']);
                break;
            case 'decrease':
                $category->decreaseQuantity($data['amount']);
                break;
            case 'set':
                $category->quantity = $data['amount'];
                $category->save();
                break;
        }
    } elseif (isset($data['quantity'])) {
        $category->quantity = $data['quantity'];
        $category->save();
    }
}

/**
 * تحضير حقول التحديث
 */
private function prepareUpdateFields($data)
{
    $allowedFields = [
        'name', 'description', 'icon',
        'is_active', 'sort_order',
        'cost_price', 'profit_margin', 'sale_price',
        'min_quantity', 'max_quantity',
        'track_quantity', 'auto_calculate'
    ];
    
    $fields = [];
    foreach ($allowedFields as $field) {
        if (isset($data[$field])) {
            $fields[$field] = $data[$field];
            
            // إذا تم تحديث سعر البيع، تعطيل الحساب التلقائي
            if ($field === 'sale_price') {
                $fields['auto_calculate'] = false;
            }
        }
    }
    
    return $fields;
}

/**
 * تنسيق استجابة القسم
 */
private function formatCategoryResponse($category)
{
    return [
        'id' => $category->id,
        'name' => $category->name,
        'quantity' => $category->quantity,
        'cost_price' => $category->cost_price,
        'profit_margin' => $category->profit_margin,
        'sale_price' => $category->sale_price,
        'total_cost' => $category->total_cost,
        'total_value' => $category->total_value,
        'expected_profit' => $category->expected_profit,
        'is_low_quantity' => $category->isLowQuantity(),
        'is_over_max' => $category->isOverMaxQuantity()
    ];
}

/**
 * معالجة تحديث القسم (مشترك بين Single و Bulk)
 */
private function processCategoryUpdate(Request $request, $category, $type = 'single')
{
    $validator = Validator::make($request->all(), [
        'name' => 'sometimes|string|max:255|unique:categories,name,' . $category->id,
        'description' => 'nullable|string|max:500',
        'icon' => 'nullable|string|in:fastfood,kitchen,local_drink,grocery,category,bakery,dairy,other',
        'is_active' => 'boolean',
        'sort_order' => 'integer|min:0',
        'cost_price' => 'nullable|numeric|min:0',
        'profit_margin' => 'nullable|numeric|min:0',
        'sale_price' => 'nullable|numeric|min:0',
        'quantity' => 'nullable|numeric|min:0',      // ⭐ تم التعديل
        'operation' => 'nullable|in:increase,decrease,set',
        'amount' => 'nullable|numeric|min:0',
        'min_quantity' => 'nullable|integer|min:0',
        'max_quantity' => 'nullable|integer|min:0',
        'track_quantity' => 'boolean',
        'auto_calculate' => 'boolean'
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
        
        // معالجة تحديث الكمية
        $this->handleQuantityUpdate($request->all(), $category);
        
        // تحديث الحقول الأخرى
        $updateFields = $this->prepareUpdateFields($request->all());
        
        if (!empty($updateFields)) {
            $category->update($updateFields);
        }
        
        // إعادة حساب المجاميع إذا تم تحديث الأسعار أو الكمية
        if ($request->hasAny(['cost_price', 'sale_price', 'profit_margin', 'quantity', 'operation', 'amount'])) {
            $category->recalculateTotals();
            $category->refresh();
        }
        
        DB::commit();
        
        return response()->json([
            'success' => true,
            'message' => $type === 'single' ? 
                'تم تحديث القسم الفرعي بنجاح' : 
                'تم تحديث العنصر بنجاح',
            'data' => [
                'category' => $this->formatCategoryResponse($category),
                'parent' => $category->parent ? [
                    'id' => $category->parent->id,
                    'name' => $category->parent->name
                ] : null
            ]
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        
        \Log::error('Category update error: ' . $e->getMessage(), [
            'category_id' => $category->id,
            'request' => $request->all()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء التحديث',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}


    public function getCategoriesWithProductCount()
{
    try {
        $categories = Category::withCount('products')
            ->orderBy('products_count', 'desc')
            ->get(['id', 'name', 'slug']);
        
        return response()->json([
            'success' => true,
            'data' => $categories,
            'message' => 'تم جلب الأقسام مع عدد المنتجات بنجاح'
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب البيانات',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}




/**
 * جلب جميع منتجات القسم مع جميع الحقول
 */
public function getCategoryProductsFull($id)
{
    try {
        $category = Category::find($id);
        
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }
        
        // جلب المنتجات مع جميع الحقول المطلوبة
        $products = Product::whereHas('categories', function ($query) use ($id) {
                $query->where('categories.id', $id);
            })
            ->orWhere('category_id', $id)
            ->select([
                'id', 'name', 'description', 'code',
                'price', 'purchase_price', 'cost_price',
                'stock', 'min_stock', 'max_stock', 'reorder_point',
                'unit', 'sku', 'barcode',
                'has_addons', 'is_active',
                'category_id', 'supplier_id',
                'created_at', 'updated_at'
            ])
            ->with(['category:id,name', 'supplier:id,name'])
            ->orderBy('name')
            ->get();
        
        // إحصائيات
        $stats = [
            'total_products' => $products->count(),
            'total_stock' => $products->sum('stock'),
            'total_value' => $products->sum(function($product) {
                return $product->stock * ($product->cost_price ?? $product->purchase_price ?? $product->price);
            }),
            'low_stock' => $products->filter(function($product) {
                return $product->stock <= $product->reorder_point && $product->stock > 0;
            })->count(),
            'out_of_stock' => $products->filter(function($product) {
                return $product->stock <= 0;
            })->count(),
            'active_products' => $products->where('is_active', true)->count(),
            'inactive_products' => $products->where('is_active', false)->count()
        ];
        
        return response()->json([
            'success' => true,
            'data' => [
                'category' => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                    'description' => $category->description,
                    'is_active' => $category->is_active
                ],
                'products' => $products,
                'stats' => $stats
            ],
            'message' => 'تم جلب جميع منتجات القسم بنجاح'
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب البيانات',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}


/**
 * الحصول على قسم معين مع عدد منتجاته
 */
public function getCategoryWithProducts($id)
{
    try {
        $category = Category::with(['products' => function ($query) {
                $query->select('products.id', 'products.name', 'products.price', 'products.stock')
                      ->orderBy('name');
            }])
            ->withCount('products')
            ->find($id);
        
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }
        
        return response()->json([
            'success' => true,
            'data' => [
                'category' => $category->only(['id', 'name', 'slug', 'products_count']),
                'products' => $category->products,
                'products_count' => $category->products_count,
                'stats' => [
                    'total_products' => $category->products_count,
                    'active_products' => $category->products()->where('is_active', true)->count(),
                    'low_stock_products' => $category->products()->whereRaw('stock <= reorder_point')->count(),
                    'total_stock_value' => round($category->products()->get(['stock', 'cost_price', 'sale_unit', 'unit', 'strips_per_box', 'pieces_per_strip', 'strip_unit_count'])->sum(fn ($p) => $p->stockInventoryValue()), 2)
                ]
            ],
            'message' => 'تم جلب بيانات القسم بنجاح'
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب البيانات',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}

    /**
     * عرض قسم محدد
     */
public function show($id)
{
    try {
        $category = Category::with([
            'parent:id,name,icon',
            'subCategories' => function ($query) {
                $query->select('id', 'name', 'icon', 'category_id', 'is_active', 'sort_order')
                      ->where('is_active', true)
                      ->orderBy('sort_order')
                      ->orderBy('name');
            },
            'productsWithDetails' => function ($query) {
                // ⭐⭐ حدد الأعمدة بوضوح مع اسم الجدول
                $query->select([
                    'products.id',
                    'products.name', 
                    'products.price',
                    'products.stock',
                    'products.is_active',
                    'products.description'
                ])->where('products.is_active', true)
                  ->orderBy('products.name')
                  ->limit(20);
            }
        ])
        ->select('id', 'name', 'icon', 'description', 'category_id', 'is_active', 'sort_order')
        ->find($id);
        
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }
        
        return response()->json([
            'success' => true,
            'data' => $category,
            'message' => 'تم جلب بيانات القسم بنجاح'
        ]);
        
    } catch (\Exception $e) {
        \Log::error('Category show error', [
            'id' => $id,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب البيانات',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}


/**
 * الشجرة الكاملة: أقسام رئيسية → أقسام فرعية → منتجات
 */
public function getCompleteTree()
{
    try {
        \Log::info('Fetching complete category tree with meals...');
        
        // 1. جلب الأقسام الرئيسية للمبيعات فقط (لحوم، عصائر، سلطات...)
        $mainCategories = Category::select([
            'id', 'name', 'icon', 'description', 
            'is_active', 'sort_order',
            'cost_price', 'profit_margin', 'sale_price',
            'quantity', 'min_quantity', 'max_quantity',
            'track_quantity', 'auto_calculate',
                'unit_type', // ⭐ أضف هذا

        ])
            ->whereNull('parent_id')
            ->where('scope', 'sales')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        \Log::debug('Found main categories', ['count' => $mainCategories->count()]);

        // 2. لكل قسم رئيسي، جلب أقسامه الفرعية والوجبات
        $tree = $mainCategories->map(function ($mainCategory) {
            \Log::debug('Processing main category', ['id' => $mainCategory->id, 'name' => $mainCategory->name]);
            
            // جلب الأقسام الفرعية (المستوى الثاني) - نفس نطاق المبيعات
            $subCategories = Category::select([
                'id', 'name', 'icon', 'description', 
                'is_active', 'sort_order',
                'parent_id',
                'cost_price', 'profit_margin', 'sale_price',
                'quantity', 'min_quantity', 'max_quantity',
                'track_quantity', 'auto_calculate',
                    'unit_type', // ⭐ أضف هذا

            ])
                ->where('parent_id', $mainCategory->id)
                ->where('scope', 'sales')
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get();

            // جلب الوجبات الخاصة بالقسم الرئيسي
            $mainMeals = \App\Models\Meal::select([
                'id', 'name', 'code', 'description',
                'cost_price', 'sale_price', 'profit_margin',
                'quantity', 'min_quantity', 'max_quantity',
                'track_quantity', 'is_active', 'created_at'
            ])
                ->where('category_id', $mainCategory->id) // أو sub_category_id
                ->where('is_active', true)
                ->orderBy('name')
                ->get();

            \Log::debug('Meals for main category', [
                'main' => $mainCategory->name,
                'meals_count' => $mainMeals->count()
            ]);

            // تحضير بيانات القسم الرئيسي
            $mainData = [
                'id' => $mainCategory->id,
                'name' => $mainCategory->name,
                'icon' => $mainCategory->icon,
                'description' => $mainCategory->description,
                'is_active' => $mainCategory->is_active,
                'type' => 'main',
                'sort_order' => $mainCategory->sort_order,
                'cost_price' => $mainCategory->cost_price,
                'profit_margin' => $mainCategory->profit_margin,
                'sale_price' => $mainCategory->sale_price,
                'quantity' => $mainCategory->quantity,
                'min_quantity' => $mainCategory->min_quantity,
                'max_quantity' => $mainCategory->max_quantity,
                'track_quantity' => (bool)$mainCategory->track_quantity,
                'auto_calculate' => (bool)$mainCategory->auto_calculate,
                'unit_type' => $mainCategory->unit_type, // ⭐ أضف هذا
    'unit' => $mainCategory->unit_type, // ⭐ أضف هذا (نفس القيمة)
                'sub_categories' => [],
                'products' => [],
                'meals' => [], // ⭐ أضف هذا الحقل للوجبات
                'meals_count' => $mainMeals->count(), // ⭐ عدد الوجبات
                'products_count' => 0
            ];

            // تحضير بيانات الوجبات
            $mainData['meals'] = $mainMeals->map(function ($meal) {
                return [
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
                    'track_quantity' => (bool)$meal->track_quantity,
                    'is_active' => (bool)$meal->is_active,
                    'created_at' => $meal->created_at->format('Y-m-d H:i:s')
                ];
            });

            // 3. لكل قسم فرعي، جلب أقسامه الفرعية والوجبات
            if ($subCategories->count() > 0) {
                $mainData['sub_categories'] = $subCategories->map(function ($subCategory) {
                    \Log::debug('Processing sub category', ['id' => $subCategory->id, 'name' => $subCategory->name]);
                    
                    // جلب الأقسام الفرعية (المستوى الثالث) - نفس نطاق المبيعات
                    $childCategories = Category::select([
                        'id', 'name', 'icon', 'description', 
                        'is_active', 'sort_order',
                        'parent_id',
                        'cost_price', 'profit_margin', 'sale_price',
                        'quantity', 'min_quantity', 'max_quantity',
                        'track_quantity', 'auto_calculate',
                            'unit_type', // ⭐ أضف هذا

                    ])
                        ->where('parent_id', $subCategory->id)
                        ->where('scope', 'sales')
                        ->where('is_active', true)
                        ->orderBy('sort_order')
                        ->orderBy('name')
                        ->get();

                    // ⭐ جلب الوجبات الخاصة بالقسم الفرعي
                    $subMeals = \App\Models\Meal::select([
                        'id', 'name', 'code', 'description',
                        'cost_price', 'sale_price', 'profit_margin',
                        'quantity', 'min_quantity', 'max_quantity',
                        'track_quantity', 'is_active', 'created_at'
                    ])
                        ->where('category_id', $subCategory->id) // أو sub_category_id
                        ->where('is_active', true)
                        ->orderBy('name')
                        ->get();

                    // تحضير بيانات القسم الفرعي
                    $subData = [
                        'id' => $subCategory->id,
                        'name' => $subCategory->name,
                        'icon' => $subCategory->icon,
                        'description' => $subCategory->description,
                        'is_active' => $subCategory->is_active,
                        'type' => 'sub',
                        'parent_id' => $subCategory->parent_id,
                        'sort_order' => $subCategory->sort_order,
                        'cost_price' => $subCategory->cost_price,
                        'profit_margin' => $subCategory->profit_margin,
                        'sale_price' => $subCategory->sale_price,
                        'quantity' => $subCategory->quantity,
                        'min_quantity' => $subCategory->min_quantity,
                        'max_quantity' => $subCategory->max_quantity,
                        'track_quantity' => (bool)$subCategory->track_quantity,
                        'auto_calculate' => (bool)$subCategory->auto_calculate,
                          'unit_type' => $subCategory->unit_type, // ⭐ أضف هذا
    'unit' => $subCategory->unit_type, // ⭐ أضف هذا
                        'sub_categories' => [],
                        'meals' => [], // ⭐ أضف هذا الحقل للوجبات
                        'meals_count' => $subMeals->count() // ⭐ عدد الوجبات
                    ];

                    // تحضير بيانات الوجبات للقسم الفرعي
                    $subData['meals'] = $subMeals->map(function ($meal) {
                        return [
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
                            'track_quantity' => (bool)$meal->track_quantity,
                            'is_active' => (bool)$meal->is_active,
                            'created_at' => $meal->created_at->format('Y-m-d H:i:s')
                        ];
                    });

                    // 4. تحضير الأقسام الفرعية للمستوى الثالث
                    if ($childCategories->count() > 0) {
                        $subData['sub_categories'] = $childCategories->map(function ($childCategory) {
                            
                            // ⭐ جلب الوجبات الخاصة بالقسم الفرعي (المستوى الثالث)
                            $childMeals = \App\Models\Meal::select([
                                'id', 'name', 'code', 'description',
                                'cost_price', 'sale_price', 'profit_margin',
                                'quantity', 'min_quantity', 'max_quantity',
                                'track_quantity', 'is_active', 'created_at'
                            ])
                                ->where('category_id', $childCategory->id) // أو sub_category_id
                                ->where('is_active', true)
                                ->orderBy('name')
                                ->get();

                            return [
                                'id' => $childCategory->id,
                                'name' => $childCategory->name,
                                'icon' => $childCategory->icon,
                                'description' => $childCategory->description,
                                'is_active' => $childCategory->is_active,
                                'type' => 'child',
                                'parent_id' => $childCategory->parent_id,
                                'sort_order' => $childCategory->sort_order,
                                'cost_price' => $childCategory->cost_price,
                                'profit_margin' => $childCategory->profit_margin,
                                'sale_price' => $childCategory->sale_price,
                                'quantity' => $childCategory->quantity,
                                'min_quantity' => $childCategory->min_quantity,
                                'max_quantity' => $childCategory->max_quantity,
                                'track_quantity' => (bool)$childCategory->track_quantity,
                                'auto_calculate' => (bool)$childCategory->auto_calculate, 'unit_type' => $childCategory->unit_type, // ⭐ أضف هذا
    'unit' => $childCategory->unit_type, // ⭐ أضف هذا
                                'meals' => $childMeals->map(function ($meal) {
                                    return [
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
                                        'track_quantity' => (bool)$meal->track_quantity,
                                        'is_active' => (bool)$meal->is_active,
                                        'created_at' => $meal->created_at->format('Y-m-d H:i:s')
                                    ];
                                }),
                                'meals_count' => $childMeals->count()
                            ];
                        });
                    }

                    return $subData;
                });
            }

            // 5. جلب المنتجات الخاصة بالقسم الرئيسي (إذا كان لديك)
            $mainProducts = Product::select('id', 'name', 'price', 'stock', 'is_active', 'description', 'sku')
                ->whereHas('categories', function ($query) use ($mainCategory) {
                    $query->where('categories.id', $mainCategory->id);
                })
                ->where('is_active', true)
                ->orderBy('name')
                ->get();

            $mainData['products'] = $mainProducts;
            $mainData['products_count'] = $mainProducts->count();

            return $mainData;
        });

        \Log::info('Complete tree with meals fetched successfully', [
            'total_main_categories' => $tree->count()
        ]);

        // إحصائيات
        $stats = [
            'total_sub_categories' => $tree->sum(function ($main) {
                $mainSubCount = count($main['sub_categories'] ?? []);
                $childSubCount = collect($main['sub_categories'] ?? [])->sum(function($sub) {
                    return count($sub['sub_categories'] ?? []);
                });
                return $mainSubCount + $childSubCount;
            }),
            'total_meals' => \App\Models\Meal::where('is_active', true)->count() // ⭐ أضف عدد الوجبات
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'tree' => $tree,
                'stats' => $stats,
                'total_items' => Category::count(),
                'total_products' => Product::count(),
                'total_meals' => \App\Models\Meal::where('is_active', true)->count(), // ⭐ أضف
                'timestamp' => now()->toDateTimeString()
            ],
            'message' => 'تم جلب الشجرة الكاملة مع الوجبات بنجاح'
        ]);
        
    } catch (\Exception $e) {
        \Log::error('Complete tree with meals error', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب الشجرة الكاملة مع الوجبات',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}




public function getAllCategoryProducts($id)
{
    try {
        $category = Category::find($id);
        
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }
        
        // جمع جميع IDs (الرئيسي + الفروع)
        $categoryIds = [$category->id];
        
        if ($category->category_id === null) {
            // إذا كان قسم رئيسي، جلب أقسامه الفرعية
            $subIds = Category::where('category_id', $category->id)
                ->pluck('id')
                ->toArray();
            $categoryIds = array_merge($categoryIds, $subIds);
        }
        
        // جلب المنتجات
        $products = Product::whereHas('categories', function ($query) use ($categoryIds) {
                $query->whereIn('categories.id', $categoryIds);
            })
            ->select('id', 'name', 'price', 'stock', 'is_active')
            ->where('is_active', true)
            ->orderBy('name')
            ->get();
        
        return response()->json([
            'success' => true,
            'data' => [
                'category' => $category->only(['id', 'name', 'icon']),
                'products' => $products,
                'total_products' => $products->count(),
                'category_ids' => $categoryIds
            ],
            'message' => 'تم جلب جميع المنتجات بنجاح'
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب المنتجات'
        ], 500);
    }
}


    
    /**
     * تحديث قسم محدد
     */
    public function update(Request $request, $id)
    {
        $category = Category::find($id);
        
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }
        
        $icons = array_keys(config('categories.icons', []));
        
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255|unique:categories,name,' . $id,
            'description' => 'nullable|string|max:500',
            'icon' => 'nullable|string|in:' . implode(',', $icons),
            'category_id' => 'nullable|exists:categories,id',
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            // منع إنشاء حلقة في التدرج الهرمي
            if ($request->has('category_id') && $request->category_id == $id) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن تعيين القسم كأب لنفسه'
                ], 422);
            }
            
            $category->update([
                'name' => $request->name ?? $category->name,
                'description' => $request->has('description') ? $request->description : $category->description,
                'icon' => $request->icon ?? $category->icon,
'parent_id' => $request->has('parent_id') ? $request->parent_id : $category->parent_id,                'is_active' => $request->has('is_active') ? $request->boolean('is_active') : $category->is_active,
                'sort_order' => $request->sort_order ?? $category->sort_order
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث القسم بنجاح',
                'data' => $category->load('parent:id,name')
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تحديث القسم',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    /**
     * حذف قسم
     */
    public function destroy($id)
    {
        $category = Category::find($id);
        
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }
        
        try {
            // التحقق من وجود منتجات
            if ($category->products()->exists()) {
                $productNames = $category->products()
                    ->limit(3)
                    ->pluck('name')
                    ->implode(', ');
                
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن حذف القسم لأنه يحتوي على منتجات. احذف الأصناف أولاً من نفس القسم ثم احذف القسم.',
                    'products_count' => $category->products()->count(),
                    'sample_products' => $productNames
                ], 400);
            }
            
            // التحقق من وجود وجبات تحت هذا القسم (أقسام المبيعات/الكاشير)
            if ($category->meals()->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن حذف القسم لأنه يحتوي على وجبات/منتجات في الكاشير. احذف الوجبات أولاً من «مخزون الوجبات» ثم احذف القسم.',
                    'meals_count' => $category->meals()->count()
                ], 400);
            }
            
            // التحقق من وجود أقسام فرعية
            if ($category->subCategories()->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن حذف القسم لأنه يحتوي على أقسام فرعية. احذف الأقسام الفرعية أولاً.',
                    'subcategories_count' => $category->subCategories()->count()
                ], 400);
            }
            
            $category->delete();
            
            return response()->json([
                'success' => true,
                'message' => 'تم حذف القسم بنجاح'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء حذف القسم',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    /**
     * الحصول على الأقسام الرئيسية
     */
    public function mainCategories()
    {
        try {
            $categories = Category::withCount('products')
                ->whereNull('parent_id')

                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => $categories,
                'count' => $categories->count(),
                'message' => 'تم جلب الأقسام الرئيسية بنجاح'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب الأقسام الرئيسية',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    /**
     * الحصول على شجرة الأقسام
     */
   /**
 * الحصول على شجرة الأقسام
 */
/**
 * الحصول على شجرة الأقسام
 */
public function tree()
{
    try {
        \Log::info('Fetching category tree...');
        
        // ⭐⭐ التصحيح: استبدل whereNull بـ where
        $categories = Category::with(['subCategories' => function ($query) {
                $query->with(['subCategories' => function ($subQuery) {
                    $subQuery->withCount('products')
                            ->where('is_active', true)
                            ->orderBy('sort_order')
                            ->orderBy('name');
                }])
                ->withCount('products')
                ->where('is_active', true)  // ⭐ حذف whereNull هنا
                ->orderBy('sort_order')
                ->orderBy('name');
            }])
            ->withCount('products')
            ->whereNull('parent_id')  // ⭐ هذه تبقى: فقط الأقسام الرئيسية
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(function ($category) {
                $data = [
                    'id' => $category->id,
                    'name' => $category->name,
                    'icon' => $category->icon,
                    'products_count' => $category->products_count,
                    'type' => 'main',
                    'parent_id' => $category->parent_id  // ⭐ استبدل category_id بـ parent_id
                ];
                
                // إضافة الأقسام الفرعية
                if ($category->subCategories && $category->subCategories->count() > 0) {
                    $data['sub_categories'] = $category->subCategories->map(function ($subCategory) {
                        $subData = [
                            'id' => $subCategory->id,
                            'name' => $subCategory->name,
                            'icon' => $subCategory->icon,
                            'products_count' => $subCategory->products_count,
                            'type' => 'sub',
                            'parent_id' => $subCategory->parent_id  // ⭐ استبدل category_id بـ parent_id
                        ];
                        
                        // الفروع من المستوى الثالث
                        if ($subCategory->subCategories && $subCategory->subCategories->count() > 0) {
                            $subData['sub_categories'] = $subCategory->subCategories->map(function ($childCategory) {
                                return [
                                    'id' => $childCategory->id,
                                    'name' => $childCategory->name,
                                    'icon' => $childCategory->icon,
                                    'products_count' => $childCategory->products_count,
                                    'type' => 'sub',
                                    'parent_id' => $childCategory->parent_id  // ⭐ استبدل category_id بـ parent_id
                                ];
                            });
                        }
                        
                        return $subData;
                    });
                } else {
                    $data['sub_categories'] = [];
                }
                
                return $data;
            });

        return response()->json([
            'success' => true,
            'data' => $categories,
            'message' => 'تم جلب هيكل الأقسام بنجاح'
        ]);
        
    } catch (\Exception $e) {
        \Log::error('Tree error', [
            'error' => $e->getMessage()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب الشجرة',
            'error' => $e->getMessage()
        ], 500);
    }
}



/**
 * شجرة الأقسام الكاملة مع كل المستويات
 */
public function getFullTree()
{
    try {
        \Log::info('Getting full category tree...');
        
        // دالة مساعدة تعمل بشكل متكرر
        function buildCategoryTree($parentId = null) {
            \Log::debug('Building tree for parent', ['parent_id' => $parentId]);
            
            $categories = Category::withCount('products')
->where('parent_id', $parentId)
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get();
            
            \Log::debug('Found categories', ['count' => $categories->count(), 'parent_id' => $parentId]);
            
            return $categories->map(function ($category) {
                $categoryData = [
                    'id' => $category->id,
                    'name' => $category->name,
                    'icon' => $category->icon,
                    'description' => $category->description,
                    'products_count' => $category->products_count,
                    'type' => $category->category_id ? 'sub' : 'main',
                    'category_id' => $category->category_id  // ⭐ غير من parent_id إلى category_id
                ];
                
                // جلب الأقسام الفرعية بشكل متكرر
                $children = buildCategoryTree($category->id);
                if ($children->count() > 0) {
                    $categoryData['sub_categories'] = $children;
                }
                
                return $categoryData;
            });
        }
        
        // البدء من null (الأقسام الرئيسية)
        $tree = buildCategoryTree(null);
        
        \Log::info('Tree built successfully', ['total_main_categories' => $tree->count()]);

        return response()->json([
            'success' => true,
            'data' => $tree,
            'total_categories' => Category::count(),
            'message' => 'تم جلب شجرة الأقسام الكاملة بنجاح'
        ]);
        
    } catch (\Exception $e) {
        \Log::error('Full tree error', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب الشجرة',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}


    /**
     * الحصول على مسار القسم
     */
    public function path($id)
    {
        try {
            $category = Category::with('parent')->find($id);
            
            if (!$category) {
                return response()->json([
                    'success' => false,
                    'message' => 'القسم غير موجود'
                ], 404);
            }
            
            $path = [];
            $current = $category;
            
            while ($current) {
                array_unshift($path, [
                    'id' => $current->id,
                    'name' => $current->name,
                    'icon' => $current->icon,
                    'icon_name' => $current->icon_name
                ]);
                $current = $current->parent;
            }
            
            return response()->json([
                'success' => true,
                'data' => [
                    'path' => $path,
                    'full_path' => implode(' → ', array_column($path, 'name'))
                ],
                'message' => 'تم جلب مسار القسم بنجاح'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب مسار القسم',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    /**
     * الحصول على إحصائيات الأقسام
     */
    public function stats()
    {
        try {
            $stats = Category::select([
                DB::raw('COUNT(*) as total_categories'),
               DB::raw('SUM(CASE WHEN parent_id IS NULL THEN 1 ELSE 0 END) as main_categories'),
DB::raw('SUM(CASE WHEN parent_id IS NOT NULL THEN 1 ELSE 0 END) as subcategories'),
                DB::raw('SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_categories'),
                DB::raw('SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_categories')
            ])->first();
            
            // إحصائيات حسب الأيقونة
            $byIcon = Category::select('icon', DB::raw('COUNT(*) as count'))
                ->groupBy('icon')
                ->get()
                ->map(function ($item) {
                    $category = new Category();
                    return [
                        'icon' => $item->icon,
                        'icon_name' => $category->getIconNameAttribute($item->icon),
                        'count' => $item->count
                    ];
                });
            
            return response()->json([
                'success' => true,
                'data' => [
                    'summary' => $stats,
                    'by_icon' => $byIcon
                ],
                'message' => 'تم جلب إحصائيات الأقسام بنجاح'
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
     * البحث في الأقسام
     */
    public function search(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'query' => 'required|string|min:2|max:100'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'أدخل كلمة بحث صحيحة (من 2 إلى 100 حرف)',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            $categories = Category::with('parent:id,name')
                ->withCount('products')
                ->where(function ($query) use ($request) {
                    $query->where('name', 'LIKE', '%' . $request->query . '%')
                          ->orWhere('description', 'LIKE', '%' . $request->query . '%');
                })
                ->where('is_active', true)
                ->orderBy('name')
                ->limit(20)
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => $categories,
                'count' => $categories->count(),
                'message' => 'تم العثور على ' . $categories->count() . ' قسم'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في البحث',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }


    /**
 * جلب الأقسام الرئيسية فقط (بدون فلاتر بحث)
 * استخدم ?scope=purchase لأقسام المشتريات أو ?scope=sales لأقسام المبيعات
 */

/**
 * جلب الأقسام الرئيسية فقط (بدون فلاتر بحث)
 * استخدم ?scope=purchase لأقسام المشتريات أو ?scope=sales لأقسام المبيعات
 * استخدم ?include_inactive=1 لعرض الأقسام المعطلة أيضاً
 */
public function getMainCategoriesSimple(Request $request)
{
    try {
        $scope = $request->get('scope', 'purchase');
        if (!in_array($scope, ['purchase', 'sales'], true)) {
            $scope = 'purchase';
        }
        
        // ✅ أضف هذا السطر: التحقق من include_inactive
        $includeInactive = filter_var($request->get('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        
        // roots_only=1: سلوك قديم (رئيسية فقط). الافتراضي: كل الأقسام النشطة في النطاق حتى تظهر الفروع في المخزون/الكاشير.
        $rootsOnly = filter_var($request->get('roots_only', false), FILTER_VALIDATE_BOOLEAN);
        
        $q = Category::query()
            ->where('scope', $scope);
        
        // ✅ تعديل هنا: إذا كان include_inactive = true، لا نفلتر is_active
        if (!$includeInactive) {
            $q->where('is_active', true);
        }
        
        if ($rootsOnly) {
            $q->whereNull('parent_id');
        }
        
        $categories = $q->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'icon', 'sort_order', 'scope', 'parent_id', 'is_active']); // ✅ أضف is_active

        return response()->json([
            'success' => true,
            'data' => $categories,
            'scope' => $scope,
            'include_inactive' => $includeInactive,
            'message' => $scope === 'sales' ? 'تم جلب أقسام المبيعات بنجاح' : 'تم جلب أقسام المشتريات بنجاح'
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب الأقسام الرئيسية'
        ], 500);
    }
}

/**
 * جلب الأقسام الرئيسية مع تفاصيلها وأقسامها الفرعية
 */
public function getMainCategoriesWithSubs(Request $request)
{
    try {
        $scope = $request->get('scope', 'purchase');
        if (!in_array($scope, ['purchase', 'sales'], true)) {
            $scope = 'purchase';
        }
        $categories = Category::with(['subCategories' => function ($query) use ($scope) {
                $query->where('is_active', true)
                      ->where('scope', $scope)
                      ->orderBy('sort_order')
                      ->orderBy('name');
            }])
            ->withCount('products')
            ->whereNull('parent_id')
            ->where('scope', $scope)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
            'scope' => $scope,
            'message' => $scope === 'sales' ? 'تم جلب أقسام المبيعات مع الفروع بنجاح' : 'تم جلب أقسام المشتريات مع الفروع بنجاح'
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب البيانات'
        ], 500);
    }
}

/**
 * جلب الأقسام الفرعية لقسم رئيسي معين
 */
public function getSubCategoriesByParent($parentId)
{
    try {
        $parentCategory = Category::find($parentId);
        
        if (!$parentCategory) {
            return response()->json([
                'success' => false,
                'message' => 'القسم الرئيسي غير موجود'
            ], 404);
        }

        $subCategories = Category::withCount('products')
            ->where('parent_id', $parentId)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'parent_category' => [
                    'id' => $parentCategory->id,
                    'name' => $parentCategory->name,
                    'icon' => $parentCategory->icon
                ],
                'sub_categories' => $subCategories
            ],
            'message' => 'تم جلب الأقسام الفرعية بنجاح'
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب الأقسام الفرعية'
        ], 500);
    }
}

/**
 * إنشاء قسم فرعي جديد تحت قسم رئيسي
 */
/**
 * إنشاء قسم فرعي جديد تحت قسم رئيسي
 */
public function storeSubCategory(Request $request, $parentId)
{
    // التحقق من وجود القسم الرئيسي
    $parentCategory = Category::find($parentId);
    
    if (!$parentCategory) {
        return response()->json([
            'success' => false,
            'message' => 'القسم الرئيسي غير موجود'
        ], 404);
    }

    $validator = Validator::make($request->all(), [
        'name' => 'required|string|max:255|unique:categories,name',
        'description' => 'nullable|string|max:500',
        'icon' => 'nullable|string|in:fastfood,kitchen,local_drink,grocery,category,bakery,dairy,other',
        'sort_order' => 'integer|min:0',
        'is_active' => 'boolean',
        'cost_price' => 'nullable|numeric|min:0',
        'profit_margin' => 'nullable|numeric|min:0',
        'sale_price' => 'nullable|numeric|min:0',
        'quantity' => 'nullable|numeric|min:0',
        // ⭐ أضف هذه الأسطر الجديدة
        'unit_type' => 'nullable|string|in:kg,gram,quantity,liter,ml,piece,box,none',
        'type' => 'nullable|string|in:main,sub', // اختياري
        'scope' => 'nullable|in:purchase,sales',
        'track_quantity' => 'boolean',
        'auto_calculate' => 'boolean',
        'min_quantity' => 'nullable|numeric|min:0',
        'max_quantity' => 'nullable|numeric|min:0'
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'خطأ في التحقق من البيانات',
            'errors' => $validator->errors()
        ], 422);
    }

    try {
        $parentScope = $parentCategory->scope ?? 'purchase';
        // ⭐⭐ إنشاء القسم الفرعي مع جميع الحقول
        $subCategory = Category::create([
            'name' => $request->name,
            'description' => $request->description,
            'icon' => $request->icon ?? $parentCategory->icon,
            'parent_id' => $parentId,
            'sort_order' => $request->sort_order ?? 0,
            'is_active' => $request->has('is_active') ? (bool) $request->is_active : true,
            'scope' => in_array($request->scope, ['purchase', 'sales'], true) ? $request->scope : $parentScope,
            
            // حقول التسعير والمخزون
            'cost_price' => $request->cost_price,
            'profit_margin' => $request->profit_margin,
            'sale_price' => $request->sale_price,
            'quantity' => $request->quantity ?? 0,
            'min_quantity' => $request->min_quantity ?? 0,
            'max_quantity' => $request->max_quantity ?? 1000,
            
            // ⭐⭐ الحقول الجديدة المهمة!
            'unit_type' => $request->unit_type ?? 'none',  // الوحدة
            'type' => 'sub', // ⭐⭐ دائماً sub للأقسام الفرعية!
            
            // حقول إضافية
            'track_quantity' => $request->has('track_quantity') ? (bool) $request->track_quantity : true,
            'auto_calculate' => $request->has('auto_calculate') ? (bool) $request->auto_calculate : true
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء القسم الفرعي بنجاح تحت ' . $parentCategory->name,
            'data' => $subCategory->load('parent:id,name,icon')
        ], 201);
        
    } catch (\Exception $e) {
        \Log::error('Store subcategory error', [
            'parent_id' => $parentId,
            'error' => $e->getMessage(),
            'request' => $request->all()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء إنشاء القسم الفرعي',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}


/**
 * شجرة الأقسام الكاملة مع المنتجات
 */
public function getFullCategoryTree()
{
    try {
        $categories = Category::with(['subCategories' => function ($query) {
                $query->withCount('products')
                      ->with(['products' => function ($q) {
                          $q->select('id', 'name', 'price', 'stock')
                            ->where('is_active', true)
                            ->limit(5);
                      }])
                      ->where('is_active', true)
                      ->orderBy('sort_order')
                      ->orderBy('name');
            }])
            ->withCount('products')
            ->whereNull('category_id')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
            'message' => 'تم جلب شجرة الأقسام الكاملة بنجاح'
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب شجرة الأقسام'
        ], 500);
    }
}

/**
 * تحويل قسم فرعي إلى قسم رئيسي
 */
public function makeCategoryMain($id)
{
    try {
        $category = Category::find($id);
        
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }

        $category->update([
            'category_id' => null
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم تحويل القسم إلى قسم رئيسي',
            'data' => $category
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء التحويل'
        ], 500);
    }
}

/**
 * نقل قسم فرعي إلى قسم رئيسي آخر
 */
public function moveSubCategory(Request $request, $id)
{
    $validator = Validator::make($request->all(), [
        'new_parent_id' => 'required|exists:categories,id'
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'errors' => $validator->errors()
        ], 422);
    }

    try {
        $category = Category::find($id);
        
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }

        // منع نقل القسم إلى نفسه
        if ($request->new_parent_id == $id) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن نقل القسم إلى نفسه'
            ], 422);
        }

        $category->update([
            'category_id' => $request->new_parent_id
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم نقل القسم بنجاح',
            'data' => $category->load('parent:id,name')
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء نقل القسم'
        ], 500);
    }

}}