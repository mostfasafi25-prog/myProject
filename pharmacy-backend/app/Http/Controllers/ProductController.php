<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\PurchaseItem;
use App\Models\Purchase;
use App\Models\Category;
use App\Models\Treasury;
use App\Models\TreasuryTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    /**
     * عرض جميع المنتجات مع الترقيم والبحث
     */
public function index(Request $request)
{
    try {
        $perPage = $request->get('per_page', 15);
        $search = $request->get('search');
        $categoryId = $request->get('category_id');
        $stockStatus = $request->get('stock_status');
        
        \Log::info('📦 Products API Called', [
            'category_id' => $categoryId,
            'search' => $search,
            'stock_status' => $stockStatus
        ]);
        
        // ⭐⭐ التعديل: استبدل category بـ categories
        $query = Product::query()
            ->with(['categories:id,name']) // ⭐ هنا التعديل
            ->withCount('purchaseItems');
        
        // ⭐ فلترة حسب النطاق: مشتريات فقط أو مبيعات فقط
        if ($request->get('scope') === 'purchase') {
            $query->where(function ($q) {
                $q->whereHas('category', fn($c) => $c->where('scope', 'purchase'))
                    ->orWhereHas('categories', fn($c) => $c->where('scope', 'purchase'))
                    ->orWhereNull('category_id');
            });
        } elseif ($request->get('scope') === 'sales') {
            $query->where(function ($q) {
                $q->whereHas('category', fn($c) => $c->where('scope', 'sales'))
                    ->orWhereHas('categories', fn($c) => $c->where('scope', 'sales'));
            });
        }
        
        // ⭐ فلترة حسب القسم (من الأقسام المتعددة)
        if ($categoryId) {
            $query->whereHas('categories', function ($q) use ($categoryId) {
                $q->where('categories.id', $categoryId);
            });
        }
        
        // البحث
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                  ->orWhere('description', 'LIKE', "%{$search}%")
                  ->orWhere('sku', 'LIKE', "%{$search}%")
                  ->orWhere('barcode', 'LIKE', "%{$search}%");
            });
        }
        
        // التصفية حسب حالة المخزون
        if ($stockStatus) {
            switch ($stockStatus) {
                case 'low':
                    $query->whereRaw('stock <= reorder_point AND stock > 0');
                    break;
                case 'out':
                    $query->where('stock', '<=', 0);
                    break;
                case 'normal':
                    $query->whereRaw('stock > reorder_point');
                    break;
            }
        }
        
        // المنتجات النشطة فقط إذا لم يطلب غير ذلك
        if (!$request->has('include_inactive')) {
            $query->where('is_active', true);
        }
        
        $query->orderBy('name');
        $products = $query->paginate($perPage);
        
        // ⭐⭐ حساب الإحصائيات
        $statsQuery = Product::query();
        
        // تطبيق نفس الفلاتر على الإحصائيات
        if ($categoryId) {
            $statsQuery->whereHas('categories', function ($q) use ($categoryId) {
                $q->where('categories.id', $categoryId);
            });
        }
        
        if ($search) {
            $statsQuery->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                  ->orWhere('description', 'LIKE', "%{$search}%")
                  ->orWhere('sku', 'LIKE', "%{$search}%")
                  ->orWhere('barcode', 'LIKE', "%{$search}%");
            });
        }
        
        // حساب الإحصائيات العامة
        $totalStats = Product::select([
            DB::raw('COUNT(*) as total_products'),
            DB::raw('SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products'),
            DB::raw('SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_products'),
            DB::raw('SUM(CASE WHEN stock <= reorder_point AND stock > 0 THEN 1 ELSE 0 END) as low_stock'),
            DB::raw('SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END) as out_of_stock'),
            DB::raw('SUM(stock) as total_stock'),
            DB::raw('SUM(stock * cost_price) as inventory_value')
        ])->first();
        
        // إحصائيات بعد الفلاتر
        $filteredStats = $statsQuery->select([
            DB::raw('COUNT(*) as filtered_count'),
            DB::raw('SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as filtered_active'),
            DB::raw('SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as filtered_inactive')
        ])->first();
        
        \Log::info('📊 Products Query Result', [
            'total' => $products->total(),
            'category_filter' => $categoryId,
            'first_product_categories' => $products->first()?->categories ?? []
        ]);
        
        return response()->json([
            'success' => true,
            'data' => $products->items(),
            'pagination' => [
                'total' => $products->total(),
                'per_page' => $products->perPage(),
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
            ],
            'stats' => [
                'general' => [
                    'total_products' => (int) ($totalStats->total_products ?? 0),
                    'active_products' => (int) ($totalStats->active_products ?? 0),
                    'inactive_products' => (int) ($totalStats->inactive_products ?? 0),
                    'low_stock' => (int) ($totalStats->low_stock ?? 0),
                    'out_of_stock' => (int) ($totalStats->out_of_stock ?? 0),
                    'total_stock' => (float) ($totalStats->total_stock ?? 0),
                    'inventory_value' => (float) ($totalStats->inventory_value ?? 0)
                ],
                'filtered' => [
                    'total' => (int) ($filteredStats->filtered_count ?? 0),
                    'active' => (int) ($filteredStats->filtered_active ?? 0),
                    'inactive' => (int) ($filteredStats->filtered_inactive ?? 0),
                    'showing' => count($products->items())
                ]
            ],
            'filters' => [
                'search' => $search,
                'category_id' => $categoryId,
                'stock_status' => $stockStatus,
                'include_inactive' => $request->has('include_inactive')
            ],
            'message' => 'تم جلب المنتجات بنجاح'
        ]);
        
    } catch (\Exception $e) {
        \Log::error('🔥 Products index error: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب بيانات المنتجات',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}










    /**
     * إنشاء منتج جديد
     */
public function store(Request $request)
{
    // ⭐ LOG 1: البيانات الواردة
    \Log::info('📦 STORE REQUEST:', ['data' => $request->all()]);
    
    // ⭐⭐ التحقق أولاً إذا كان الاسم موجود مسبقاً
    $existingProduct = Product::where('name', $request->name)->first();
    if ($existingProduct) {
        \Log::warning('❌ DUPLICATE PRODUCT NAME:', [
            'requested_name' => $request->name,
            'existing_id' => $existingProduct->id,
            'existing_code' => $existingProduct->code
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'خطأ في إضافة المنتج',
            'errors' => [
                'name' => ['اسم المنتج "' . $request->name . '" موجود مسبقاً (الكود: ' . $existingProduct->code . ')']
            ]
        ], 422);
    }
    
    $validator = Validator::make($request->all(), [
        'name' => 'required|string|max:255|unique:products,name',
        'code' => 'nullable|string|unique:products,code',
        'description' => 'nullable|string',
        'image_url' => 'nullable|string|max:2048',
        'price' => ['required', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'purchase_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'cost_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'profit_amount' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'], // ⭐ جديد: فقط رقم الربح
        'category_id' => 'nullable|exists:categories,id',
        'stock' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'min_stock' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'max_stock' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'reorder_point' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'unit' => 'required|string|in:piece,kg,gram,liter,ml,box,pack,meter,cm',
        'sku' => 'nullable|string|max:100|unique:products,sku',
        'barcode' => 'nullable|string|max:100|unique:products,barcode',
        'has_addons' => 'boolean',
        'is_active' => 'boolean',
        'categories' => 'nullable|array',
        'categories.*' => 'exists:categories,id'
    ], [
        'name.unique' => 'اسم المنتج "{{value}}" موجود مسبقاً في النظام',
        'code.unique' => 'الكود "{{value}}" مستخدم مسبقاً',
        'sku.unique' => 'الرقم التسلسلي "{{value}}" مستخدم مسبقاً',
        'barcode.unique' => 'الباركود "{{value}}" مستخدم مسبقاً',
    ]);
    
    if ($validator->fails()) {
        // ⭐ LOG 2: فشل التحقق
        \Log::warning('❌ VALIDATION FAILED:', $validator->errors()->toArray());
        
        // ⭐⭐ تحسين رسائل الخطأ
        $errors = $validator->errors()->toArray();
        $formattedErrors = [];
        
        foreach ($errors as $field => $messages) {
            if ($field === 'name') {
                $formattedErrors[$field] = ['⚠️ ' . $messages[0] . ' - الرجاء اختيار اسم مختلف'];
            } elseif ($field === 'code') {
                $formattedErrors[$field] = ['🔢 ' . $messages[0] . ' - هذا الكود مستخدم بالفعل'];
            } elseif ($field === 'sku') {
                $formattedErrors[$field] = ['🏷️ ' . $messages[0] . ' - هذا الرقم التسلسلي مستخدم'];
            } elseif ($field === 'barcode') {
                $formattedErrors[$field] = ['📊 ' . $messages[0] . ' - هذا الباركود مستخدم'];
            } else {
                $formattedErrors[$field] = $messages;
            }
        }
        
        return response()->json([
            'success' => false,
            'message' => 'تحقق من الأخطاء التالية:',
            'errors' => $formattedErrors
        ], 422);
    }

    // ⭐ المنتجات لأقسام المشتريات فقط
    $categoryIds = array_filter(array_merge(
        $request->category_id ? [$request->category_id] : [],
        $request->categories ?? []
    ));
    foreach ($categoryIds as $cid) {
        $cat = Category::find($cid);
        if ($cat && ($cat->scope ?? 'purchase') !== 'purchase') {
            return response()->json([
                'success' => false,
                'message' => 'المنتجات ترتبط بأقسام المشتريات فقط. القسم المختار ليس من أقسام المشتريات.',
                'errors' => ['category_id' => ['اختر قسماً من أقسام المشتريات']]
            ], 422);
        }
    }
    
    try {
        // ⭐ LOG 3: قبل الإنشاء
        \Log::info('✅ CREATING PRODUCT...', [
            'name' => $request->name,
            'category_id' => $request->category_id
        ]);
        
        $code = $request->code;
        if (empty($code)) {
            $lastProduct = Product::orderBy('id', 'desc')->first();
            $sequence = $lastProduct ? $lastProduct->id + 1 : 1;
            $code = 'PRD-' . date('Ymd') . '-' . str_pad($sequence, 4, '0', STR_PAD_LEFT);
        }
        
        // ⭐⭐ حساب سعر البيع إذا تم إدخال رقم الربح
        $price = $request->price;
        $costPrice = $request->cost_price ?? $request->purchase_price;
        
        if ($request->filled('profit_amount') && $costPrice) {
            // ⭐ حساب السعر = سعر التكلفة + الربح المطلوب
            $price = $costPrice + $request->profit_amount;
        }
        
        $product = Product::create([
            'name' => $request->name,
            'code' => $code,
            'description' => $request->description,
            'image_url' => $request->image_url,
            'price' => $price, // ⭐ تم التعديل
            'purchase_price' => $request->purchase_price,
            'cost_price' => $costPrice,
            'profit_amount' => $request->profit_amount ?? ($price - $costPrice), // ⭐ جديد: خزن رقم الربح
            'category_id' => $request->category_id,
            'stock' => $request->stock ?? 0,
            'min_stock' => $request->min_stock ?? 0,
            'max_stock' => $request->max_stock,
            'reorder_point' => $request->reorder_point ?? 0,
            'unit' => $request->unit ?? 'piece',
            'sku' => $request->sku,
            'barcode' => $request->barcode,
            'has_addons' => $request->boolean('has_addons', false),
            'is_active' => $request->boolean('is_active', true)
        ]);
        
        if ($request->has('categories') && is_array($request->categories)) {
            $product->categories()->attach($request->categories);
        }
        
        // ⭐ LOG 4: النجاح
        \Log::info('🎉 PRODUCT CREATED:', [
            'id' => $product->id,
            'name' => $product->name,
            'code' => $product->code,
            'stock' => $product->stock,
            'profit_amount' => $product->profit_amount, // ⭐ جديد
            'price' => $product->price,
            'cost_price' => $product->cost_price
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء المنتج "' . $product->name . '" بنجاح',
            'data' => $product->load(['category:id,name', 'categories:id,name']),
            'profit_info' => [ // ⭐ جديد
                'profit_amount' => $product->profit_amount,
                'price' => $product->price,
                'cost_price' => $product->cost_price
            ]
        ], 201);
        
    } catch (\Exception $e) {
        // ⭐ LOG 5: الخطأ
        \Log::error('🔥 STORE ERROR:', [
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => '❌ حدث خطأ غير متوقع أثناء إنشاء المنتج',
            'error' => env('APP_DEBUG') ? [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ] : null
        ], 500);
    }
}










public function getProductsByCategory($categoryId)
{
    try {
        $category = Category::find($categoryId);
        
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }
        
        // جلب المنتجات المرتبطة بالقسم (many-to-many)
     $products = Product::whereHas('categories', function ($query) use ($categoryId) {
        $query->where('categories.id', $categoryId);
    })
    ->orWhere('category_id', $categoryId)
    ->select([
        'id', 'name', 'description', 'image_url', 'price', 'purchase_price', // ⭐ أضف purchase_price
        'cost_price', 'stock', 'unit', 'sku', 'barcode',
        'category_id', 'supplier_id', 'min_stock', 'max_stock',
        'reorder_point', 'is_active'
    ])
    ->with(['category:id,name', 'supplier:id,name'])
    ->withCount('purchaseItems')
    ->orderBy('name')
    ->get();
        
        // إحصائيات
        $stats = [
            'total_products' => $products->count(),
            'total_stock' => $products->sum('stock'),
            'total_value' => $products->sum(function($product) {
                return $product->stock * $product->cost_price;
            }),
            'low_stock' => $products->filter(function($product) {
                return $product->stock <= $product->reorder_point && $product->stock > 0;
            })->count(),
            'out_of_stock' => $products->filter(function($product) {
                return $product->stock <= 0;
            })->count()
        ];
        
        return response()->json([
            'success' => true,
            'data' => [
                'category' => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                    'description' => $category->description
                ],
                'products' => $products,
                'stats' => $stats
            ],
            'message' => 'تم جلب منتجات القسم بنجاح'
        ]);
        
    } catch (\Exception $e) {
        \Log::error('Error fetching products by category: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب بيانات المنتجات',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}
    /**
     * عرض منتج محدد
     */
    public function show($id)
    {
        try {
            $product = Product::with([
                'category:id,name',
                'supplier:id,name,phone,email',
                'purchaseItems' => function ($query) {
                    $query->with('purchase:id,invoice_number,purchase_date,supplier_id')
                          ->orderBy('created_at', 'desc')
                          ->limit(10);
                }
            ])->find($id);
            
            if (!$product) {
                return response()->json([
                    'success' => false,
                    'message' => 'المنتج غير موجود'
                ], 404);
            }
            
            // حساب إحصائيات المشتريات
            $purchaseStats = PurchaseItem::where('product_id', $id)
                ->select([
                    DB::raw('COUNT(*) as total_purchases'),
                    DB::raw('SUM(quantity) as total_quantity_purchased'),
                    DB::raw('AVG(unit_price) as average_purchase_price'),
                    DB::raw('MAX(unit_price) as max_purchase_price'),
                    DB::raw('MIN(unit_price) as min_purchase_price'),
                    DB::raw('MAX(created_at) as last_purchase_date')
                ])->first();
            
            $product->purchase_stats = $purchaseStats;
            
            return response()->json([
                'success' => true,
                'data' => $product,
                'message' => 'تم جلب بيانات المنتج بنجاح'
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
     * تحديث منتج محدد
     */
   public function update(Request $request, $id)
{
    $product = Product::find($id);
    
    if (!$product) {
        return response()->json([
            'success' => false,
            'message' => 'المنتج غير موجود'
        ], 404);
    }
    
    $validator = Validator::make($request->all(), [
        'name' => 'sometimes|string|max:255|unique:products,name,' . $id, // ⭐ إضافة استثناء
        'description' => 'nullable|string',
        'image_url' => 'nullable|string|max:2048',
        'code' => 'sometimes|string|max:100|unique:products,code,' . $id, // ⭐ إضافة استثناء هنا
        'price' => ['sometimes', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'purchase_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'cost_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'category_id' => 'nullable|exists:categories,id',
        'supplier_id' => 'nullable|exists:suppliers,id',
        'stock' => ['sometimes', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'min_stock' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'max_stock' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'reorder_point' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
        'unit' => 'sometimes|string|in:piece,kg,liter,box,pack,meter',
        'sku' => 'nullable|string|max:100|unique:products,sku,' . $id,
        'barcode' => 'nullable|string|max:100|unique:products,barcode,' . $id,
        'has_addons' => 'boolean',
        'is_active' => 'boolean',
        'categories' => 'nullable|array', // ⭐ إضافة هذا
        'categories.*' => 'exists:categories,id' // ⭐ إضافة هذا
    ]);
    
    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'خطأ في التحقق من البيانات',
            'errors' => $validator->errors()
        ], 422);
    }

    // ⭐ المنتجات لأقسام المشتريات فقط
    $categoryIds = array_filter(array_merge(
        $request->has('category_id') ? [$request->category_id] : [],
        $request->categories ?? []
    ));
    foreach ($categoryIds as $cid) {
        $cat = Category::find($cid);
        if ($cat && ($cat->scope ?? 'purchase') !== 'purchase') {
            return response()->json([
                'success' => false,
                'message' => 'المنتجات ترتبط بأقسام المشتريات فقط.',
                'errors' => ['category_id' => ['اختر قسماً من أقسام المشتريات']]
            ], 422);
        }
    }
    
    try {
        // تحديث البيانات الأساسية
        $product->update([
            'name' => $request->name ?? $product->name,
            'description' => $request->has('description') ? $request->description : $product->description,
            'image_url' => $request->has('image_url') ? $request->image_url : $product->image_url,
            'code' => $request->has('code') ? $request->code : $product->code,
            'price' => $request->price ?? $product->price,
            'purchase_price' => $request->has('purchase_price') ? $request->purchase_price : $product->purchase_price,
            'cost_price' => $request->has('cost_price') ? $request->cost_price : $product->cost_price,
            'category_id' => $request->has('category_id') ? $request->category_id : $product->category_id,
            'supplier_id' => $request->has('supplier_id') ? $request->supplier_id : $product->supplier_id,
            'stock' => $request->stock ?? $product->stock,
            'min_stock' => $request->has('min_stock') ? $request->min_stock : $product->min_stock,
            'max_stock' => $request->has('max_stock') ? $request->max_stock : $product->max_stock,
            'reorder_point' => $request->has('reorder_point') ? $request->reorder_point : $product->reorder_point,
            'unit' => $request->unit ?? $product->unit,
            'sku' => $request->has('sku') ? $request->sku : $product->sku,
            'barcode' => $request->has('barcode') ? $request->barcode : $product->barcode,
            'has_addons' => $request->has('has_addons') ? $request->boolean('has_addons') : $product->has_addons,
            'is_active' => $request->has('is_active') ? $request->boolean('is_active') : $product->is_active
        ]);
        
        // ⭐⭐ تحديث الأقسام المتعددة
        if ($request->has('categories')) {
            $product->categories()->sync($request->categories);
        }
        
        // ⭐⭐ إعادة تحميل العلاقات
        $product->load(['categories:id,name']);
        
        return response()->json([
            'success' => true,
            'message' => 'تم تحديث المنتج بنجاح',
            'data' => $product
        ]);
        
    } catch (\Exception $e) {
        \Log::error('🔥 UPDATE ERROR:', [
            'id' => $id,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء تحديث المنتج',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}
    



    /**
 * استعادة منتج محذوف
 */
public function restore($id)
{
    try {
        $product = Product::withTrashed()->find($id);
        
        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'المنتج غير موجود حتى في المحذوفات'
            ], 404);
        }
        
        $product->restore();
        
        return response()->json([
            'success' => true,
            'message' => 'تم استعادة المنتج بنجاح',
            'data' => $product->load(['categories'])
        ]);
        
    } catch (\Exception $e) {
        \Log::error('🔥 RESTORE ERROR:', [
            'id' => $id,
            'error' => $e->getMessage()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء استعادة المنتج',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}

/**
 * عرض المنتجات المحذوفة
 */
public function trashed(Request $request)
{
    try {
        $perPage = $request->get('per_page', 15);
        
        $products = Product::onlyTrashed()
            ->with(['categories:id,name'])
            ->orderBy('deleted_at', 'desc')
            ->paginate($perPage);
        
        return response()->json([
            'success' => true,
            'data' => $products->items(),
            'pagination' => [
                'total' => $products->total(),
                'per_page' => $products->perPage(),
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
            ],
            'message' => 'تم جلب المنتجات المحذوفة بنجاح'
        ]);
        
    } catch (\Exception $e) {
        \Log::error('🔥 TRASHED ERROR:', [
            'error' => $e->getMessage()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب المنتجات المحذوفة',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}


    /**
     * حذف منتج
     */


/**
 * حذف منتج - عند وجود مشتريات: تراجع الكمية من المخزون وإرجاع المبلغ للخزنة ثم الحذف
 */
public function destroy($id)
{
    try {
        $product = Product::withCount(['purchaseItems'])->find($id);

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'المنتج غير موجود'
            ], 404);
        }

        // منع الحذف فقط إذا كان الصنف مستخدماً في مبيعات (طلبات/فواتير)
        if (\Schema::hasTable('order_items')) {
            $orderItemsCount = 0;
            if (\Schema::hasColumn('order_items', 'product_id')) {
                $orderItemsCount = \DB::table('order_items')->where('product_id', $id)->count();
            } elseif (\Schema::hasColumn('order_items', 'item_id') && \Schema::hasColumn('order_items', 'item_type')) {
                $orderItemsCount = \DB::table('order_items')
                    ->where('item_type', 'App\Models\Product')
                    ->where('item_id', $id)
                    ->count();
            }
            if ($orderItemsCount > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن حذف المنتج',
                    'reasons' => ['يوجد ' . $orderItemsCount . ' عملية بيع مرتبطة بهذا المنتج. يمكنك تعطيل المنتج بدلاً من حذفه.'],
                ], 422);
            }
        }
        if (\Schema::hasTable('invoice_items') && \Schema::hasColumn('invoice_items', 'product_id')) {
            $invoiceItemsCount = \DB::table('invoice_items')->where('product_id', $id)->count();
            if ($invoiceItemsCount > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن حذف المنتج',
                    'reasons' => ['يوجد فواتير مرتبطة بهذا المنتج. يمكنك تعطيل المنتج بدلاً من حذفه.'],
                ], 422);
            }
        }

        DB::beginTransaction();

        if ($product->purchase_items_count > 0) {
            $items = PurchaseItem::where('product_id', $id)->with('purchase')->get();
            $purchasesToUpdate = [];

            foreach ($items as $item) {
                $qty = (float) $item->quantity;
                $product->decrement('stock', $qty);
                $purchaseId = $item->purchase_id;
                if (!isset($purchasesToUpdate[$purchaseId])) {
                    $purchasesToUpdate[$purchaseId] = [
                        'purchase' => $item->purchase,
                        'deleted_total' => 0,
                    ];
                }
                $purchasesToUpdate[$purchaseId]['deleted_total'] += (float) $item->total_price;
            }

            $treasury = Treasury::first();
            foreach ($purchasesToUpdate as $purchaseId => $data) {
                $purchase = $data['purchase'];
                if (!$purchase) {
                    continue;
                }
                $deletedTotal = $data['deleted_total'];
                $purchaseTotal = (float) $purchase->total_amount;
                $paidAmount = (float) $purchase->paid_amount;
                $refundAmount = $purchaseTotal > 0 ? ($deletedTotal / $purchaseTotal) * $paidAmount : 0;
                $refundAmount = round($refundAmount, 2);

                if ($refundAmount > 0 && $treasury) {
                    $treasury->balance += $refundAmount;
                    $treasury->save();
                    TreasuryTransaction::create([
                        'treasury_id' => $treasury->id,
                        'type' => 'income',
                        'amount' => $refundAmount,
                        'description' => 'إرجاع مبلغ صنف محذوف: ' . $product->name . ' - فاتورة ' . $purchase->invoice_number,
                        'category' => 'other_income',
                        'reference_type' => 'purchase',
                        'reference_id' => $purchase->id,
                        'created_by' => auth()->id() ?? 1,
                        'transaction_date' => now()->toDateString(),
                    ]);
                }

                PurchaseItem::where('product_id', $id)->where('purchase_id', $purchaseId)->delete();

                $newTotal = (float) $purchase->total_amount - $deletedTotal;
                $newPaid = $paidAmount - $refundAmount;
                $purchase->update([
                    'total_amount' => max(0, $newTotal),
                    'paid_amount' => max(0, $newPaid),
                    'remaining_amount' => max(0, $newTotal - $newPaid),
                ]);

                if ($purchase->items()->count() === 0) {
                    $remainingPaid = $paidAmount - $refundAmount;
                    if ($remainingPaid > 0 && $treasury) {
                        $treasury->balance += $remainingPaid;
                        $treasury->save();
                    }
                    TreasuryTransaction::where('purchase_id', $purchase->id)
                        ->orWhere(function ($q) use ($purchase) {
                            $q->where('reference_type', 'purchase')->where('reference_id', $purchase->id);
                        })->delete();
                    $purchase->delete();
                }
            }
        }

        $product->categories()->detach();
        $product->delete();

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف المنتج بنجاح. تم استرجاع الكمية من المخزون وإرجاع المبلغ للخزنة.',
            'data' => [
                'id' => $product->id,
                'name' => $product->name,
            ]
        ]);
    } catch (\Exception $e) {
        DB::rollBack();
        \Log::error('🔥 DELETE ERROR:', [
            'id' => $id,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء حذف المنتج',
            'reasons' => [env('APP_DEBUG') ? $e->getMessage() : 'تفاصيل الخطأ غير متوفرة. تحقق من سجلات السيرفر.'],
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}
    
    /**
     * البحث المتقدم عن منتجات
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
            $products = Product::with(['category:id,name', 'supplier:id,name'])
                ->where(function ($query) use ($request) {
                    $query->where('name', 'LIKE', '%' . $request->query . '%')
                          ->orWhere('description', 'LIKE', '%' . $request->query . '%')
                          ->orWhere('sku', 'LIKE', '%' . $request->query . '%')
                          ->orWhere('barcode', 'LIKE', '%' . $request->query . '%');
                })
                ->where('is_active', true)
                ->orderBy('name')
                ->limit(20)
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => $products,
                'count' => $products->count(),
                'message' => 'تم العثور على ' . $products->count() . ' منتج'
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
     * المنتجات منخفضة المخزون
     */
    public function lowStock(Request $request)
    {
        try {
            $perPage = $request->get('per_page', 20);
            
            $products = Product::with(['category:id,name', 'supplier:id,name'])
                ->where('is_active', true)
                ->whereRaw('stock <= reorder_point AND stock > 0')
                ->orderByRaw('stock / GREATEST(reorder_point, 1)') // الترتيب حسب نسبة النفاد
                ->paginate($perPage);
            
            $totalValue = Product::whereRaw('stock <= reorder_point AND stock > 0')
                ->select(DB::raw('SUM(stock * cost_price) as total_value'))
                ->first()->total_value ?? 0;
            
            return response()->json([
                'success' => true,
                'data' => $products->items(),
                'pagination' => [
                    'total' => $products->total(),
                    'per_page' => $products->perPage(),
                    'current_page' => $products->currentPage(),
                    'last_page' => $products->lastPage(),
                ],
                'stats' => [
                    'total_products' => $products->total(),
                    'total_value' => $totalValue,
                    'critical_count' => Product::where('stock', '<=', 0)->count()
                ],
                'message' => 'تم جلب المنتجات منخفضة المخزون بنجاح'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب المنتجات منخفضة المخزون',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    /**
     * المنتجات المنتهية من المخزون
     */
    public function outOfStock(Request $request)
    {
        try {
            $perPage = $request->get('per_page', 20);
            
            $products = Product::with(['category:id,name', 'supplier:id,name,phone'])
                ->where('is_active', true)
                ->where('stock', '<=', 0)
                ->orderBy('name')
                ->paginate($perPage);
            
            return response()->json([
                'success' => true,
                'data' => $products->items(),
                'pagination' => $products->pagination(),
                'stats' => [
                    'total_products' => $products->total(),
                    'suppliers_count' => $products->unique('supplier_id')->count(),
                    'categories_count' => $products->unique('category_id')->count()
                ],
                'message' => 'تم جلب المنتجات المنتهية بنجاح'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب المنتجات المنتهية',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    /**
     * زيادة مخزون منتج (للمشتريات)
     */
    public function increaseStock(Request $request, $id)
    {
        $product = Product::find($id);
        
        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'المنتج غير موجود'
            ], 404);
        }
        
        $validator = Validator::make($request->all(), [
            'quantity' => ['required', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0.1'],
            'purchase_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
            'reason' => 'nullable|string|max:255',
            'reference' => 'nullable|string|max:100'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            DB::transaction(function () use ($product, $request) {
                // زيادة المخزون
                $oldStock = $product->stock;
                $newStock = $oldStock + $request->quantity;
                
                // تحديث سعر الشراء إذا تم إدخاله
                if ($request->purchase_price) {
                    $product->purchase_price = $request->purchase_price;
                    $product->cost_price = $request->purchase_price;
                }
                
                $product->stock = $newStock;
                $product->save();
                
                // تسجيل حركة المخزون (إذا عندك جدول stock_movements)
                // StockMovement::create([...]);
                
                // تحديث سجل المشتريات (سيتم من خلال PurchaseController)
            });
            
            return response()->json([
                'success' => true,
                'message' => 'تم زيادة المخزون بنجاح',
                'data' => [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'old_stock' => $oldStock,
                    'added_quantity' => $request->quantity,
                    'new_stock' => $newStock,
                    'updated_purchase_price' => $request->purchase_price
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء زيادة المخزون',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    /**
     * تقليل مخزون منتج (للبيع أو التالف)
     */
    public function decreaseStock(Request $request, $id)
    {
        $product = Product::find($id);
        
        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'المنتج غير موجود'
            ], 404);
        }
        
        $validator = Validator::make($request->all(), [
            'quantity' => ['required', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0.1', 'max:' . $product->stock],
            'reason' => 'required|string|in:sale,damaged,expired,adjustment',
            'notes' => 'nullable|string|max:500',
            'reference' => 'nullable|string|max:100'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            DB::transaction(function () use ($product, $request) {
                $oldStock = $product->stock;
                $newStock = max(0, $oldStock - $request->quantity);
                
                $product->stock = $newStock;
                $product->save();
                
                // تسجيل حركة المخزون
                // StockMovement::create([...]);
            });
            
            return response()->json([
                'success' => true,
                'message' => 'تم تقليل المخزون بنجاح',
                'data' => [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'old_stock' => $oldStock,
                    'removed_quantity' => $request->quantity,
                    'new_stock' => $newStock,
                    'reason' => $request->reason
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تقليل المخزون',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
    
    /**
     * إحصائيات المنتجات
     */
    public function stats()
    {
        try {
            $stats = Product::select([
                DB::raw('COUNT(*) as total_products'),
                DB::raw('SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products'),
                DB::raw('SUM(CASE WHEN stock <= reorder_point AND stock > 0 THEN 1 ELSE 0 END) as low_stock_products'),
                DB::raw('SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END) as out_of_stock_products'),
                DB::raw('SUM(stock) as total_stock'),
                DB::raw('SUM(stock * cost_price) as total_inventory_value'),
                DB::raw('AVG(price) as average_price'),
                DB::raw('AVG(cost_price) as average_cost_price')
            ])->first();
            
            // إحصائيات حسب الفئة
            $byCategory = Product::join('categories', 'products.category_id', '=', 'categories.id')
                ->select('categories.name', DB::raw('COUNT(products.id) as product_count'))
                ->groupBy('categories.id', 'categories.name')
                ->orderBy('product_count', 'desc')
                ->limit(10)
                ->get();
            
            // إحصائيات حسب المورد
            $bySupplier = Product::join('suppliers', 'products.supplier_id', '=', 'suppliers.id')
                ->select('suppliers.name', DB::raw('COUNT(products.id) as product_count'))
                ->groupBy('suppliers.id', 'suppliers.name')
                ->orderBy('product_count', 'desc')
                ->limit(10)
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => [
                    'summary' => $stats,
                    'by_category' => $byCategory,
                    'by_supplier' => $bySupplier
                ],
                'message' => 'تم جلب إحصائيات المنتجات بنجاح'
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
     * البحث عن منتج بالباركود أو SKU
     */
    public function searchByCode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|max:100'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'أدخل رمز البحث',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            $product = Product::with(['category:id,name', 'supplier:id,name'])
                ->where('barcode', $request->code)
                ->orWhere('sku', $request->code)
                ->where('is_active', true)
                ->first();
            
            if (!$product) {
                return response()->json([
                    'success' => false,
                    'message' => 'لم يتم العثور على المنتج'
                ], 404);
            }
            
            return response()->json([
                'success' => true,
                'data' => $product,
                'message' => 'تم العثور على المنتج بنجاح'
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
 * تعطيل/تفعيل منتج
 */
public function toggleStatus($id)
{
    try {
        $product = Product::find($id);
        
        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'المنتج غير موجود'
            ], 404);
        }
        
        // حفظ الحالة القديمة للـlog
        $oldStatus = $product->is_active;
        
        // تغيير الحالة
        $product->is_active = !$product->is_active;
        $product->save();
        
        // تحميل العلاقات
        $product->load(['categories:id,name']);
        
        $status = $product->is_active ? 'مفعل' : 'معطل';
        
        \Log::info('🔄 PRODUCT STATUS CHANGED:', [
            'id' => $product->id,
            'name' => $product->name,
            'old_status' => $oldStatus ? 'نشط' : 'معطل',
            'new_status' => $status
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'تم ' . $status . ' المنتج "' . $product->name . '" بنجاح',
            'data' => [
                'id' => $product->id,
                'name' => $product->name,
                'is_active' => $product->is_active,
                'status_text' => $status,
                'updated_at' => $product->updated_at
            ]
        ]);
        
    } catch (\Exception $e) {
        \Log::error('🔥 TOGGLE STATUS ERROR:', [
            'id' => $id,
            'error' => $e->getMessage()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء تغيير حالة المنتج',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}

/**
 * تعطيل منتج محدد
 */
public function disable($id)
{
    try {
        $product = Product::find($id);
        
        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'المنتج غير موجود'
            ], 404);
        }
        
        if (!$product->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'المنتج معطل بالفعل'
            ], 400);
        }
        
        $product->is_active = false;
        $product->save();
        
        \Log::info('⏸️ PRODUCT DISABLED:', [
            'id' => $product->id,
            'name' => $product->name,
            'disabled_by' => auth()->id() ?? 'system'
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'تم تعطيل المنتج "' . $product->name . '" بنجاح',
            'data' => [
                'id' => $product->id,
                'name' => $product->name,
                'code' => $product->code,
                'is_active' => false,
                'status' => 'معطل',
                'note' => 'تم تعطيل المنتج ولن يظهر في قوائم البيع'
            ]
        ]);
        
    } catch (\Exception $e) {
        \Log::error('🔥 DISABLE ERROR:', [
            'id' => $id,
            'error' => $e->getMessage()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء تعطيل المنتج',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}

/**
 * تفعيل منتج محدد
 */
public function enable($id)
{
    try {
        $product = Product::find($id);
        
        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'المنتج غير موجود'
            ], 404);
        }
        
        if ($product->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'المنتج مفعل بالفعل'
            ], 400);
        }
        
        $product->is_active = true;
        $product->save();
        
        \Log::info('✅ PRODUCT ENABLED:', [
            'id' => $product->id,
            'name' => $product->name,
            'enabled_by' => auth()->id() ?? 'system'
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'تم تفعيل المنتج "' . $product->name . '" بنجاح',
            'data' => [
                'id' => $product->id,
                'name' => $product->name,
                'code' => $product->code,
                'is_active' => true,
                'status' => 'مفعل',
                'note' => 'تم تفعيل المنتج ويمكن الآن بيعه'
            ]
        ]);
        
    } catch (\Exception $e) {
        \Log::error('🔥 ENABLE ERROR:', [
            'id' => $id,
            'error' => $e->getMessage()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء تفعيل المنتج',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}


}