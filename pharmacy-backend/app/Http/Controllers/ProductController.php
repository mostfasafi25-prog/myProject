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
        
        // ⭐ فلترة حسب النطاق: مشتريات فقط أو مبيعات فقط — scope=all يعرض كل الأصناف (لوحات الإدارة)
        $scope = $request->get('scope');
        if ($scope === 'purchase') {
            $query->where(function ($q) {
                $q->whereHas('category', fn($c) => $c->where('scope', 'purchase'))
                    ->orWhereHas('categories', fn($c) => $c->where('scope', 'purchase'))
                    ->orWhereNull('category_id');
            });
        } elseif ($scope === 'sales') {
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
        
        // ⭐⭐⭐ التعديل 1: جعل price اختياري في قواعد التحقق
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:products,name',
            'code' => 'nullable|string|unique:products,code',
            'description' => 'nullable|string',
            'image_url' => 'nullable|string|max:50000',
            'price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'], // ⭐ تم التعديل: required → nullable
            'purchase_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'profit_amount' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'category_id' => 'nullable|exists:categories,id',
'stock' => ['nullable', 'numeric', 'regex:/^-?\d+(\.\d{1,2})?$/'],
            'min_stock' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'max_stock' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'reorder_point' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'unit' => 'required|string|in:piece,kg,gram,liter,ml,box,pack,meter,cm,strip,pill,bottle,sachet',
            'pieces_per_strip' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,3})?$/', 'min:1'],
            'strips_per_box' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,3})?$/', 'min:1'],
            'purchase_unit' => 'nullable|string|in:box,strip,pill,piece',
            'sale_unit' => 'nullable|string|in:box,strip,pill,piece',
            'allow_split_sales' => 'nullable|boolean',
            'split_sale_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'strip_unit_count' => 'nullable|numeric|min:1',
            'split_item_name' => 'nullable|string|max:50',
            'split_sale_options' => 'nullable|array',
            'split_sale_options.*.id' => 'nullable|string|max:40',
            'split_sale_options.*.label' => 'required_with:split_sale_options|string|max:80',
            'split_sale_options.*.price' => ['required_with:split_sale_options', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'split_sale_options.*.saleType' => 'nullable|string|in:pill,strip,box,bottle,sachet,piece',
            'sku' => 'nullable|string|max:100|unique:products,sku',
            'barcode' => 'nullable|string|max:100|unique:products,barcode',
            'has_addons' => 'boolean',
            'is_active' => 'boolean',
            'categories' => 'nullable|array',
            'categories.*' => 'exists:categories,id',
            'full_unit_name' => 'nullable|string|max:120',
            'divide_into' => 'nullable|integer|min:1',
            'allow_small_pieces' => 'nullable|boolean',
            'pieces_count' => 'nullable|integer|min:0',
        ], [
            'name.unique' => 'اسم المنتج "{{value}}" موجود مسبقاً في النظام',
            'code.unique' => 'الكود "{{value}}" مستخدم مسبقاً',
            'sku.unique' => 'الرقم التسلسلي "{{value}}" مستخدم مسبقاً',
            'barcode.unique' => 'الباركود "{{value}}" مستخدم مسبقاً',
        ]);
        
        // ⭐⭐⭐ التعديل 2: التأكد من أن price موجود في الـ request (حتى لو كان null)
        if (!$request->has('price') || $request->price === null || $request->price === '') {
            $request->merge(['price' => null]);
        }
        
        if ($validator->fails()) {
            // ⭐ LOG 2: فشل التحقق
            \Log::warning('❌ VALIDATION FAILED:', $validator->errors()->toArray());
            
            // ⭐⭐ تحسين رسائل الخطأ
         
            $errors = $validator->errors()->toArray();
            $formattedErrors = [];
            if (isset($errors['name']) && str_contains($errors['name'][0], 'already taken')) {
                $errors['name'] = ['اسم المنتج "' . $request->name . '" موجود مسبقاً في النظام'];
            }
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

        if ($request->boolean('allow_split_sales')) {
            $div = (int) ($request->input('divide_into', 0));
            if ($div < 1) {
                return response()->json([
                    'success' => false,
                    'message' => 'تحقق من بيانات التجزئة',
                    'errors' => [
                        'divide_into' => ['أدخل عدد الأجزاء المتساوية للوحدة الكاملة (مثال: 2 لنصف، 4 لربع)'],
                    ],
                ], 422);
            }
            // ⭐ جعل pieces_count اختياري - لا نتحقق منه
            // فقط نتحقق إذا كان المستخدم أدخل قيمة أقل من 1
            if ($request->boolean('allow_small_pieces') && $request->has('pieces_count') && (int) $request->input('pieces_count') < 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'تحقق من بيانات التجزئة',
                    'errors' => [
                        'pieces_count' => ['عدد القطع يجب أن يكون 1 على الأقل'],
                    ],
                ], 422);
            }
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
            
            // ⭐⭐⭐ التعديل 3: حساب سعر البيع مع دعم القيمة null
            $costPrice = $request->cost_price ?? $request->purchase_price;
            $price = $request->price; // يمكن أن تكون null
            
            // إذا تم إدخال رقم الربح، نحسب السعر من التكلفة + الربح
            if ($request->filled('profit_amount') && $costPrice) {
                $price = $costPrice + $request->profit_amount;
            }
            
            // عمود price في قاعدة البيانات غير قابل لـ null، لذلك نضع قيمة افتراضية آمنة
            if ($price === null || $price === '') {
                $price = null;
            }
            
            $productPayload = [
                'name' => $request->name,
                'code' => $code,
                'description' => $request->description,
                'image_url' => $request->image_url,
                'price' => $price, // ⭐ تم التعديل: يمكن أن تكون null
                'purchase_price' => $request->purchase_price,
                'cost_price' => $costPrice,
                'profit_amount' => $request->profit_amount ?? ($price && $costPrice ? $price - $costPrice : null),
                'category_id' => $request->category_id,
                'stock' => $request->stock ?? 0,
                'min_stock' => $request->min_stock ?? 0,
                'max_stock' => $request->max_stock,
                'reorder_point' => $request->reorder_point ?? 0,
                'unit' => $request->unit ?? $request->sale_unit ?? 'box',
                'allow_split_sales' => $request->boolean('allow_split_sales', false),
                'sku' => $request->sku,
                'barcode' => $request->barcode,
                'has_addons' => $request->boolean('has_addons', false),
                'is_active' => $request->boolean('is_active', true),
            ];

            if (\Schema::hasColumn('products', 'split_sale_price')) {
                $productPayload['split_sale_price'] = $request->split_sale_price;
            }

            foreach ($this->packagingFieldsForPersistence($request, null) as $key => $value) {
                if (\Schema::hasColumn('products', $key)) {
                    $productPayload[$key] = $value;
                }
            }

            $product = Product::create($productPayload);
            
            if ($request->has('categories') && is_array($request->categories)) {
                $product->categories()->attach($request->categories);
            }
            
            // ⭐ LOG 4: النجاح
            \Log::info('🎉 PRODUCT CREATED:', [
                'id' => $product->id,
                'name' => $product->name,
                'code' => $product->code,
                'stock' => $product->stock,
                'profit_amount' => $product->profit_amount,
                'price' => $product->price,
                'cost_price' => $product->cost_price
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'تم إنشاء المنتج "' . $product->name . '" بنجاح',
                'data' => $product->load(['category:id,name', 'categories:id,name']),
                'profit_info' => [
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
        'cost_price', 'stock', 'unit', 'sale_unit', 'sku', 'barcode',
        'strips_per_box', 'pieces_per_strip', 'strip_unit_count',
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
            'total_value' => $products->sum(fn ($product) => $product->stockInventoryValue()),
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
            
            if ($purchaseStats) {
                $mult = $product->piecesPerSaleUnit();
                $perPieceAvg = (float) ($purchaseStats->average_purchase_price ?? 0);
                $purchaseStats->average_purchase_price_per_piece = $perPieceAvg;
                $purchaseStats->average_purchase_price_per_sale_unit = $mult > 0
                    ? round($perPieceAvg * $mult, 2)
                    : $perPieceAvg;
            }
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
            'name' => 'sometimes|string|max:255|unique:products,name,' . $id,
            'description' => 'nullable|string',
            'image_url' => 'nullable|string|max:50000',
            'code' => 'sometimes|string|max:100|unique:products,code,' . $id,
            'price' => ['sometimes', 'nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'], // ⭐ أضف nullable
            'purchase_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'profit_amount' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'], // ⭐ أضف هذا
            'split_sale_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'category_id' => 'nullable|exists:categories,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
'stock' => ['sometimes', 'numeric', 'regex:/^-?\d+(\.\d{1,2})?$/'],
            'min_stock' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'max_stock' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'reorder_point' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'unit' => 'sometimes|string|in:piece,kg,gram,liter,ml,box,pack,meter,cm,strip,pill,bottle,sachet',
            'allow_split_sales' => 'nullable|boolean',
            'strip_unit_count' => 'nullable|numeric|min:1',
            'pieces_per_strip' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,3})?$/', 'min:1'],
            'strips_per_box' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,3})?$/', 'min:1'],
            'purchase_unit' => 'nullable|string|in:box,strip,pill,piece',
            'sale_unit' => 'nullable|string|in:box,strip,pill,piece',
            'split_item_name' => 'nullable|string|max:50',
            'split_sale_options' => 'nullable|array',
            'split_sale_options.*.id' => 'nullable|string|max:40',
            'split_sale_options.*.label' => 'required_with:split_sale_options|string|max:80',
            'split_sale_options.*.price' => ['required_with:split_sale_options', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'split_sale_options.*.saleType' => 'nullable|string|in:pill,strip,box,bottle,sachet,piece',
            'sku' => 'nullable|string|max:100|unique:products,sku,' . $id,
            'barcode' => 'nullable|string|max:100|unique:products,barcode,' . $id,
            'has_addons' => 'boolean',
            'is_active' => 'boolean',
            'categories' => 'nullable|array',
            'categories.*' => 'exists:categories,id',
            'full_unit_name' => 'nullable|string|max:120',
            'divide_into' => 'nullable|integer|min:1',
            'allow_small_pieces' => 'nullable|boolean',
            'pieces_count' => 'nullable|integer|min:0',
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }

        $effectiveAllowSplit = $request->has('allow_split_sales')
            ? $request->boolean('allow_split_sales')
            : (bool) $product->allow_split_sales;
        if ($effectiveAllowSplit) {
            $div = $request->has('divide_into')
                ? (int) $request->input('divide_into')
                : (int) ($product->divide_into ?? $product->strips_per_box ?? 0);
            if ($div < 1) {
                return response()->json([
                    'success' => false,
                    'message' => 'تحقق من بيانات التجزئة',
                    'errors' => [
                        'divide_into' => ['أدخل عدد الأجزاء المتساوية للوحدة الكاملة (مثال: 2 لنصف، 4 لربع)'],
                    ],
                ], 422);
            }
            $effectiveSmall = $request->has('allow_small_pieces')
                ? $request->boolean('allow_small_pieces')
                : (bool) $product->allow_small_pieces;
                if ($effectiveSmall) {
                    $pc = $request->has('pieces_count')
                        ? (int) $request->input('pieces_count')
                        : (int) ($product->pieces_count ?? 0);
                    // ⭐ جعل pieces_count اختياري - لا نتحقق منه إذا كان 0
                    // فقط نتحقق إذا كان المستخدم أدخل قيمة أقل من 1 (وليس إذا كانت القيمة صفراً من النظام)
                    if ($pc < 0) {
                        return response()->json([
                            'success' => false,
                            'message' => 'تحقق من بيانات التجزئة',
                            'errors' => [
                                'pieces_count' => ['عدد القطع يجب أن يكون 1 على الأقل إذا كنت تريد تفعيل القطع الصغيرة'],
                            ],
                        ], 422);
                    }
                    // ⭐ إذا كان pc = 0، نمرره بدون خطأ (يعني لا توجد قطع صغيرة)
                }
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
            // ⭐⭐ حساب السعر والربح إذا تغيرت التكلفة أو الربح
            $costPrice = $request->has('cost_price') 
                ? $request->cost_price 
                : ($request->has('purchase_price') 
                    ? $request->purchase_price 
                    : $product->cost_price);
            
            $price = $request->has('price') ? $request->price : $product->price;
            $profitAmount = $request->has('profit_amount') ? $request->profit_amount : $product->profit_amount;
            
            // إذا تم إدخال رقم ربح جديد، نعيد حساب السعر
            if ($request->has('profit_amount') && $costPrice) {
                $price = $costPrice + $request->profit_amount;
                $profitAmount = $request->profit_amount;
            }
            
            // إذا تم تغيير سعر التكلفة فقط، نعيد حساب الربح
            if ($request->has('cost_price') && !$request->has('profit_amount') && $price && $costPrice) {
                $profitAmount = $price - $costPrice;
            }
            
            // تحديث البيانات الأساسية
            $updatePayload = [
                'name' => $request->name ?? $product->name,
                'description' => $request->has('description') ? $request->description : $product->description,
                'image_url' => $request->has('image_url') ? $request->image_url : $product->image_url,
                'code' => $request->has('code') ? $request->code : $product->code,
                'price' => $price,
                'purchase_price' => $request->has('purchase_price') ? $request->purchase_price : $product->purchase_price,
                'cost_price' => $costPrice,
                'profit_amount' => $profitAmount, // ⭐ تحديث رقم الربح
                'category_id' => $request->has('category_id') ? $request->category_id : $product->category_id,
                'supplier_id' => $request->has('supplier_id') ? $request->supplier_id : $product->supplier_id,
                'stock' => $request->stock ?? $product->stock,
                'min_stock' => $request->has('min_stock') ? $request->min_stock : $product->min_stock,
                'max_stock' => $request->has('max_stock') ? $request->max_stock : $product->max_stock,
                'reorder_point' => $request->has('reorder_point') ? $request->reorder_point : $product->reorder_point,
                'unit' => $request->unit ?? $request->sale_unit ?? $product->unit,
                'allow_split_sales' => $request->has('allow_split_sales') ? $request->boolean('allow_split_sales') : $product->allow_split_sales,
                'sku' => $request->has('sku') ? $request->sku : $product->sku,
                'barcode' => $request->has('barcode') ? $request->barcode : $product->barcode,
                'has_addons' => $request->has('has_addons') ? $request->boolean('has_addons') : $product->has_addons,
                'is_active' => $request->has('is_active') ? $request->boolean('is_active') : $product->is_active
            ];
            
            // ⭐⭐ دعم split_sale_price (جديد)
            if ($request->has('split_sale_price') && \Schema::hasColumn('products', 'split_sale_price')) {
                $updatePayload['split_sale_price'] = $request->split_sale_price;
            }

            foreach ($this->packagingFieldsForPersistence($request, $product) as $key => $value) {
                if (\Schema::hasColumn('products', $key)) {
                    $updatePayload[$key] = $value;
                }
            }
            
            $product->update($updatePayload);
            
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
     * حقول التعبئة كما في صفحة المشتريات + اشتقاق strips_per_box / pieces_per_strip / split_sale_options للكاشير.
     *
     * @return array<string, mixed>
     */
    private function packagingFieldsForPersistence(Request $request, ?Product $existing = null): array
    {
        $allowSplit = $request->has('allow_split_sales')
            ? $request->boolean('allow_split_sales')
            : (bool) ($existing?->allow_split_sales ?? false);

        $rawFull = $request->input('full_unit_name');
        if ($rawFull !== null && $rawFull !== '') {
            $fullUnitName = (string) $rawFull;
        } else {
            $fullUnitName = $existing?->full_unit_name;
        }
        if ($fullUnitName === '') {
            $fullUnitName = null;
        }

        $divideInto = $request->has('divide_into')
            ? max(0, (int) $request->input('divide_into'))
            : (int) ($existing?->divide_into ?? 0);
        if ($divideInto < 1 && $existing) {
            $divideInto = (int) ($existing->strips_per_box ?? 0);
        }

        $allowSmall = $request->has('allow_small_pieces')
            ? $request->boolean('allow_small_pieces')
            : (bool) ($existing?->allow_small_pieces ?? false);

        $piecesCount = $request->has('pieces_count')
            ? max(0, (int) $request->input('pieces_count'))
            : (int) ($existing?->pieces_count ?? 0);

        if ($piecesCount < 1 && $existing) {
            $ps = (int) ($existing->pieces_per_strip ?? 0);
            $sb = (int) ($existing->strips_per_box ?? 0);
            if ($ps > 0 && $sb > 0) {
                $piecesCount = $ps * $sb;
            } elseif ($ps > 0) {
                $piecesCount = $ps;
            }
        }

        // واجهة قديمة: strip_unit_count فقط
        if (
            $existing === null
            && $request->boolean('allow_split_sales')
            && !$request->has('divide_into')
            && $request->filled('strip_unit_count')
            && !$request->has('pieces_count')
        ) {
            $divideInto = max(1, $divideInto);
            $allowSmall = true;
            $piecesCount = max($piecesCount, (int) $request->input('strip_unit_count'));
        }

        if (!$allowSplit) {
            return [
                'full_unit_name' => $fullUnitName,
                'divide_into' => $divideInto > 0 ? $divideInto : null,
                'allow_small_pieces' => false,
                'pieces_count' => $piecesCount > 0 ? $piecesCount : null,
                'strip_unit_count' => null,
                'split_item_name' => null,
                'split_sale_options' => null,
                'pieces_per_strip' => null,
                'strips_per_box' => null,
                'purchase_unit' => $request->input('purchase_unit', $existing?->purchase_unit ?? 'box'),
                'sale_unit' => $request->input('sale_unit', $existing?->sale_unit ?? 'box'),
                'unit' => $request->input('unit', $existing?->unit ?? 'box'),
            ];
        }

        $allowSmall = $allowSmall && $allowSplit;
        $divideInto = max(1, $divideInto);
        $stripsPerBox = $divideInto;

        $piecesPerStrip = 1;
        $stripUnitCount = null;
        $splitItemName = null;
        $pcsStored = null;

        if ($allowSmall && $piecesCount > 0) {
            $piecesPerStrip = max(1, (int) round($piecesCount / max(1, $stripsPerBox)));
            $stripUnitCount = $piecesPerStrip;
            $pcsStored = $piecesCount;
            $splitItemName = 'حبة';
        } elseif ($allowSmall && $piecesCount <= 0) {
            // ⭐ إذا تم تفعيل القطع الصغيرة ولكن لم يتم إدخال عدد القطع
            // نستخدم قيمة افتراضية (مثلاً 1) أو نتركها null
            $pcsStored = null;
            $piecesPerStrip = 1;
            $stripUnitCount = 1;
            $splitItemName = 'حبة';
        }

        $customSplitOptions = null;
        if ($request->has('split_sale_options') && is_array($request->input('split_sale_options'))) {
            $tmp = [];
            foreach ($request->input('split_sale_options') as $idx => $row) {
                if (!is_array($row)) {
                    continue;
                }
                $label = trim((string) ($row['label'] ?? ''));
                $price = isset($row['price']) ? (float) $row['price'] : null;
                if ($label === '' || $price === null || $price < 0) {
                    continue;
                }
                $tmp[] = [
                    'id' => (string) ($row['id'] ?? ('opt_' . $idx)),
                    'label' => $label,
                    'price' => round($price, 2),
                    'saleType' => (string) ($row['saleType'] ?? ''),
                ];
            }
            if (!empty($tmp)) {
                $customSplitOptions = array_values($tmp);
            }
        }

        $splitOptions = ['box'];
        if ($stripsPerBox > 1) $splitOptions[] = 'strip';
        if ($allowSmall && $piecesCount > 0) $splitOptions[] = 'pill';
        $splitOptions = array_values(array_unique($splitOptions));

        return [
            'full_unit_name' => $fullUnitName,
            'divide_into' => $divideInto,
            'allow_small_pieces' => $allowSmall,
            'pieces_count' => $pcsStored,
            'strips_per_box' => $stripsPerBox,
            'pieces_per_strip' => $piecesPerStrip,
            'strip_unit_count' => $stripUnitCount,
            'split_sale_options' => $customSplitOptions ?? $splitOptions,
            'split_item_name' => $splitItemName,
            'purchase_unit' => 'box',
            'sale_unit' => 'box',
            'unit' => 'box',
        ];
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
                    $treasury->adjustCashLegacy($refundAmount);
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
                        $treasury->adjustCashLegacy($remainingPaid);
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
                ->get(['stock', 'cost_price', 'sale_unit', 'unit', 'strips_per_box', 'pieces_per_strip', 'strip_unit_count'])
                ->sum(fn ($p) => $p->stockInventoryValue());
            
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
            $statsRow = Product::select([
                DB::raw('COUNT(*) as total_products'),
                DB::raw('SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products'),
                DB::raw('SUM(CASE WHEN stock <= reorder_point AND stock > 0 THEN 1 ELSE 0 END) as low_stock_products'),
                DB::raw('SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END) as out_of_stock_products'),
                DB::raw('SUM(stock) as total_stock'),
                DB::raw('AVG(price) as average_price'),
                DB::raw('AVG(cost_price) as average_cost_price')
            ])->first();

            $totalInventoryValue = Product::query()
                ->get(['stock', 'cost_price', 'sale_unit', 'unit', 'strips_per_box', 'pieces_per_strip', 'strip_unit_count'])
                ->sum(fn ($p) => $p->stockInventoryValue());

            $summary = array_merge(
                $statsRow ? $statsRow->toArray() : [],
                ['total_inventory_value' => round($totalInventoryValue, 2)]
            );
            
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
                    'summary' => $summary,
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

/**
 * تصفير الأصناف (حذف جميع المنتجات وربطها بالأقسام) بشكل مركزي من الباك اند.
 */
public function resetAllProducts()
{
    try {
        DB::beginTransaction();

        if (\Schema::hasTable('category_product')) {
            DB::table('category_product')->delete();
        }

        DB::table('products')->delete();

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => 'تم تصفير جميع الأصناف بنجاح'
        ]);
    } catch (\Exception $e) {
        DB::rollBack();
        \Log::error('🔥 RESET PRODUCTS ERROR:', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);

        return response()->json([
            'success' => false,
            'message' => 'فشل تصفير الأصناف',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}

}