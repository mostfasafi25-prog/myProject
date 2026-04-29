<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\PurchaseItem;
use App\Models\Purchase;
use App\Models\Category;
use App\Models\Treasury;
use App\Models\TreasuryTransaction;
use App\Models\SystemNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Support\ActivityLogger;

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
                ->with(['categories:id,name'])
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
            
            // ✅✅✅ التعديل: التحقق إذا كان الطلب من الـ POS
            $forPos = $request->get('for_pos', false);
            $splitPart = $request->get('split_part'); // 1 = نصف, 2 = ثلث, 3 = ربع
            
            if ($forPos === 'true' || $forPos === '1' || $forPos === true) {
                // معالجة المنتجات للبيع (POS)
                $items = collect($products->items())->map(function ($product) use ($splitPart) {
                    $productArray = $product->toArray();
                    $productArray['sale_type_names'] = $this->getProductSaleTypeNames($product);
                    
                    // إضافة الاسم المُجزأ للعرض
                    $productArray['split_display_name'] = $this->getSplitProductName($product, $splitPart);
                    
                    // إذا تم تحديد جزء معين والمنتج يسمح بالتجزئة
                    if ($splitPart && $product->allow_split_sales) {
                        $divideInto = (int) ($product->divide_into ?: 1);
                        $originalPrice = (float) $product->price;
                        $partPrice = $originalPrice / $divideInto;
                        
                        $productArray['original_price'] = $originalPrice;
                        $productArray['price'] = round($partPrice, 2);
                        $productArray['split_part'] = (int) $splitPart;
                        $productArray['divide_into'] = $divideInto;
                        $productArray['part_price'] = round($partPrice, 2);
                    }
                    
                    return $productArray;
                });
                
                \Log::info('📊 Products for POS', [
                    'total' => $products->total(),
                    'split_part' => $splitPart,
                    'for_pos' => true
                ]);
                
                return response()->json([
                    'success' => true,
                    'data' => $items,
                    'pagination' => [
                        'total' => $products->total(),
                        'per_page' => $products->perPage(),
                        'current_page' => $products->currentPage(),
                        'last_page' => $products->lastPage(),
                    ],
                    'for_pos' => true,
                    'message' => 'تم جلب المنتجات للبيع بنجاح'
                ]);
            }
            
            // الوضع العادي (للوحة الإدارة والمشتريات)
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
 * الحصول على اسم المنتج مع التجزئة للبيع
 * 
 * @param Product $product
 * @param int|null $splitPart (1 = نصف, 2 = ثلث, 3 = ربع)
 * @return string
 */
private function getSplitProductName($product, $splitPart = null)
{
    if (!$product->allow_split_sales) {
        return $product->name;
    }
    
    $divideInto = (int) ($product->divide_into ?: 1);
    
    // إذا لم يتم تحديد جزء معين، نرجع الاسم مع ذكر إمكانية التجزئة
    if ($splitPart === null) {
        return null;
    }
    
    // أسماء الأجزاء حسب العدد
    $partNames = [
        2 => 'نصف',
        3 => 'ثلث',
        4 => 'ربع',
        5 => 'خمس',
        6 => 'سدس',
        7 => 'سبع',
        8 => 'ثمن',
    ];
    
    $partName = $partNames[$divideInto] ?? ('1/' . $divideInto);
    
    // إذا كان هناك اسم مخصص للوحدة الكاملة (مثل "علبة"، "شريط")
    $fullUnitName = $product->full_unit_name ?? '';
    $suffix = $fullUnitName ? ' ' . $fullUnitName : '';
    
    return $product->name . ' - ' . $partName . $suffix;
}

private function getProductSaleTypeNames($product): array
{
    $baseName = trim((string) ($product->name ?? ''));
    if ($baseName === '') {
        $baseName = 'منتج';
    }

    if (!$product->allow_split_sales) {
        return [
            'box' => $baseName,
            'strip' => $baseName,
            'pill' => $baseName,
            'default' => $baseName,
        ];
    }

    $fullUnitName = trim((string) ($product->full_unit_name ?? ''));
    $splitItemName = trim((string) ($product->split_item_name ?? 'حبة'));
    $divideInto = max(1, (int) ($product->divide_into ?: 1));

    $boxLabel = $fullUnitName !== '' ? $fullUnitName : 'علبة';
    $stripLabel = $divideInto > 1 ? 'شريط' : ($fullUnitName !== '' ? $fullUnitName : 'وحدة');
    $pillLabel = $splitItemName !== '' ? $splitItemName : 'حبة';

    return [
        'box' => $baseName . ' - ' . $boxLabel,
        'strip' => $baseName . ' - ' . $stripLabel,
        'pill' => $baseName . ' - ' . $pillLabel,
        'default' => $baseName . ' - ' . $boxLabel,
    ];
}





    /**
     * إنشاء منتج جديد
     */
    public function store(Request $request)
{
    // ⭐ LOG 1: البيانات الواردة
    \Log::info('📦 STORE REQUEST:', ['data' => $request->all()]);

    $incomingBarcode = trim((string) $request->input('barcode', ''));
    if ($incomingBarcode === '') {
        $request->merge(['barcode' => $this->generateUniqueBarcode()]);
    } else {
        $request->merge(['barcode' => $incomingBarcode]);
    }

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
        'usage_how_to' => 'nullable|string|max:2000',
        'image_url' => 'nullable|string|max:50000',
        'split_level1_name' => 'nullable|string|max:80',
        'split_level2_name' => 'nullable|string|max:80',
        'price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
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
        'custom_child_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
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
        \Log::warning('❌ VALIDATION FAILED:', $validator->errors()->toArray());
        
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
        
        // ⭐⭐⭐ حساب الأسعار
        $costPrice = $request->cost_price ?? $request->purchase_price;
        $price = $request->price;
        
        if ($request->filled('profit_amount') && $costPrice) {
            $price = $costPrice + $request->profit_amount;
        }
        
        if ($price === null || $price === '') {
            $price = null;
        }

        $allowSplitPricing = $request->boolean('allow_split_sales');
        $divideForPricing = (int) ($request->input('divide_into', 0) ?: 0);
        $piecesForPricing = (int) ($request->input('pieces_count', 0) ?: 0);
        
        $this->applyAutoSplitPricingDefaults(
            $request,
            (float) ($costPrice ?? 0),
            $price !== null ? (float) $price : null,
            $divideForPricing,
            $piecesForPricing,
            $allowSplitPricing
        );

        $pricingError = $this->validateNoLossPricing(
            $request,
            (float) ($costPrice ?? 0),
            $price !== null ? (float) $price : null,
            $divideForPricing,
            $piecesForPricing,
            $allowSplitPricing
        );
        
        if ($pricingError) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن حفظ الصنف بسعر بيع يسبب خسارة',
                'errors' => $pricingError,
            ], 422);
        }
        
        // ⭐⭐ بناء $productPayload هنا
        $packagingFields = $this->packagingFieldsForPersistence($request, null);
        $stockInput = (float) ($request->input('stock', 0) ?? 0);
        $stockNormalized = $this->normalizeStockToInventoryPieces($stockInput, [
            'unit' => $request->input('unit', $request->input('sale_unit', 'box')),
            'sale_unit' => $request->input('sale_unit', $request->input('unit', 'box')),
            'purchase_unit' => $request->input('purchase_unit', 'box'),
            'allow_split_sales' => $request->boolean('allow_split_sales', false),
            ...$packagingFields,
        ]);

        $productPayload = [
            'name' => $request->name,
            'code' => $code,
            'description' => $request->description,
            'usage_how_to' => $request->input('usage_how_to'),
            'image_url' => $request->image_url,
            'price' => $price,
            'purchase_price' => $request->purchase_price,
            'cost_price' => $costPrice,
            'profit_amount' => $request->profit_amount ?? ($price && $costPrice ? $price - $costPrice : null),
            'category_id' => $request->category_id,
            'stock' => $stockNormalized,
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

        // ⭐ إضافة الحقول الإضافية إذا كانت موجودة في الجدول
        if (\Schema::hasColumn('products', 'split_sale_price')) {
            $productPayload['split_sale_price'] = $request->split_sale_price;
        }
        if (\Schema::hasColumn('products', 'custom_child_price')) {
            $productPayload['custom_child_price'] = $request->input('custom_child_price');
        }
        if (\Schema::hasColumn('products', 'split_level1_name')) {
            $productPayload['split_level1_name'] = $request->input('split_level1_name');
        }
        if (\Schema::hasColumn('products', 'split_level2_name')) {
            $productPayload['split_level2_name'] = $request->input('split_level2_name');
        }

        // ⭐ دمج حقول التعبئة
        foreach ($packagingFields as $key => $value) {
            if (\Schema::hasColumn('products', $key)) {
                $productPayload[$key] = $value;
            }
        }

        $product = Product::create($productPayload);
        
        if ($request->has('categories') && is_array($request->categories)) {
            $product->categories()->attach($request->categories);
        }
        
        \Log::info('🎉 PRODUCT CREATED:', [
            'id' => $product->id,
            'name' => $product->name,
            'code' => $product->code,
            'stock' => $product->stock,
            'profit_amount' => $product->profit_amount,
            'price' => $product->price,
            'cost_price' => $product->cost_price
        ]);

        ActivityLogger::log($request, [
            'action_type' => 'product_create',
            'entity_type' => 'product',
            'entity_id' => $product->id,
            'description' => "إضافة صنف جديد: {$product->name}",
            'meta' => [
                'price' => (float) ($product->price ?? 0),
                'stock' => (float) ($product->stock ?? 0),
                'barcode' => $product->barcode,
            ],
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
        if ($request->has('barcode')) {
            $request->merge(['barcode' => trim((string) $request->input('barcode', ''))]);
        }

        $product = Product::find($id);
        
        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'المنتج غير موجود'
            ], 404);
        }
        if ($request->has('split_level1_name') && \Schema::hasColumn('products', 'split_level1_name')) {
            $updatePayload['split_level1_name'] = $request->input('split_level1_name');
        }
        if ($request->has('split_level2_name') && \Schema::hasColumn('products', 'split_level2_name')) {
            $updatePayload['split_level2_name'] = $request->input('split_level2_name');
        }
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255|unique:products,name,' . $id,
            'description' => 'nullable|string',
            'usage_how_to' => 'nullable|string|max:2000',
            'image_url' => 'nullable|string|max:50000',
            'code' => 'sometimes|string|max:100|unique:products,code,' . $id,
            'price' => ['sometimes', 'nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'], // ⭐ أضف nullable
            'purchase_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'profit_amount' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'], // ⭐ أضف هذا
            'split_sale_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'custom_child_price' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'category_id' => 'nullable|exists:categories,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
'stock' => ['sometimes', 'numeric', 'regex:/^-?\d+(\.\d{1,2})?$/'],
            'min_stock' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'max_stock' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'reorder_point' => ['nullable', 'numeric', 'regex:/^\d+(\.\d{1,2})?$/', 'min:0'],
            'unit' => 'sometimes|string|in:piece,kg,gram,liter,ml,box,pack,meter,cm,strip,pill,bottle,sachet',
            'allow_split_sales' => 'nullable|boolean',
            'strip_unit_count' => 'nullable|numeric|min:1',
            'split_level1_name' => 'nullable|string|max:80',
'split_level2_name' => 'nullable|string|max:80',
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

            $divForPricing = $request->has('divide_into')
                ? (int) $request->input('divide_into')
                : (int) ($product->divide_into ?? $product->strips_per_box ?? 0);
            $piecesForPricing = $request->has('pieces_count')
                ? (int) $request->input('pieces_count')
                : (int) ($product->pieces_count ?? 0);
            $allowSplitPricing = $request->has('allow_split_sales')
                ? $request->boolean('allow_split_sales')
                : (bool) $product->allow_split_sales;

            $this->applyAutoSplitPricingDefaults(
                $request,
                (float) ($costPrice ?? 0),
                $price !== null ? (float) $price : null,
                $divForPricing,
                $piecesForPricing,
                $allowSplitPricing
            );

            $pricingError = $this->validateNoLossPricing(
                $request,
                (float) ($costPrice ?? 0),
                $price !== null ? (float) $price : null,
                $divForPricing,
                $piecesForPricing,
                $allowSplitPricing
            );
            if ($pricingError) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن حفظ الصنف بسعر بيع يسبب خسارة',
                    'errors' => $pricingError,
                ], 422);
            }
            
            // تحديث البيانات الأساسية
            $beforeSnapshot = [
                'name' => (string) ($product->name ?? ''),
                'barcode' => (string) ($product->barcode ?? ''),
                'price' => (float) ($product->price ?? 0),
                'cost_price' => (float) ($product->cost_price ?? 0),
                'stock' => (float) ($product->stock ?? 0),
                'category_id' => $product->category_id,
                'is_active' => (bool) ($product->is_active ?? true),
            ];

            $packagingFields = $this->packagingFieldsForPersistence($request, $product);
            $updatePayload = [
                'name' => $request->name ?? $product->name,
                'description' => $request->has('description') ? $request->description : $product->description,
                'usage_how_to' => $request->has('usage_how_to') ? $request->input('usage_how_to') : $product->usage_how_to,
                'image_url' => $request->has('image_url') ? $request->image_url : $product->image_url,
                'code' => $request->has('code') ? $request->code : $product->code,
                'price' => $price,
                'purchase_price' => $request->has('purchase_price') ? $request->purchase_price : $product->purchase_price,
                'cost_price' => $costPrice,
                'profit_amount' => $profitAmount, // ⭐ تحديث رقم الربح
                'category_id' => $request->has('category_id') ? $request->category_id : $product->category_id,
                'supplier_id' => $request->has('supplier_id') ? $request->supplier_id : $product->supplier_id,
                'stock' => $request->has('stock')
                    ? $this->normalizeStockToInventoryPieces((float) ($request->input('stock') ?? 0), [
                        'unit' => $request->input('unit', $request->input('sale_unit', $product->unit)),
                        'sale_unit' => $request->input('sale_unit', $request->input('unit', $product->sale_unit)),
                        'purchase_unit' => $request->input('purchase_unit', $product->purchase_unit),
                        'allow_split_sales' => $request->has('allow_split_sales')
                            ? $request->boolean('allow_split_sales')
                            : (bool) $product->allow_split_sales,
                        ...$packagingFields,
                    ])
                    : $product->stock,
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
            if ($request->has('custom_child_price') && \Schema::hasColumn('products', 'custom_child_price')) {
                $updatePayload['custom_child_price'] = $request->input('custom_child_price');
            }

            foreach ($packagingFields as $key => $value) {
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

            $afterSnapshot = [
                'name' => (string) ($product->name ?? ''),
                'barcode' => (string) ($product->barcode ?? ''),
                'price' => (float) ($product->price ?? 0),
                'cost_price' => (float) ($product->cost_price ?? 0),
                'stock' => (float) ($product->stock ?? 0),
                'category_id' => $product->category_id,
                'is_active' => (bool) ($product->is_active ?? true),
            ];
            $changes = [];
            foreach ($afterSnapshot as $field => $afterValue) {
                $beforeValue = $beforeSnapshot[$field] ?? null;
                if ((string) $beforeValue !== (string) $afterValue) {
                    $changes[$field] = [
                        'before' => $beforeValue,
                        'after' => $afterValue,
                    ];
                }
            }

            ActivityLogger::log($request, [
                'action_type' => 'product_update',
                'entity_type' => 'product',
                'entity_id' => $product->id,
                'description' => "تحديث الصنف: {$product->name}",
                'meta' => [
                    'price' => (float) ($product->price ?? 0),
                    'stock' => (float) ($product->stock ?? 0),
                    'before' => $beforeSnapshot,
                    'after' => $afterSnapshot,
                    'changes' => $changes,
                ],
            ]);
            
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
   /**
 * حقول التعبئة كما في صفحة المشتريات + اشتقاق strips_per_box / pieces_per_strip / split_sale_options للكاشير.
 *
 * @return array<string, mixed>
 */
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

    // حساب pieces_count
    $piecesCount = null;
    if ($request->has('pieces_count')) {
        $piecesCount = max(0, (int) $request->input('pieces_count'));
    } elseif ($request->has('strips_per_box') && $request->has('pieces_per_strip')) {
        $sb = (int) $request->input('strips_per_box');
        $ps = (int) $request->input('pieces_per_strip');
        if ($sb > 0 && $ps > 0) {
            $piecesCount = $sb * $ps;
        }
    } elseif ($existing) {
        $sb = (int) ($existing->strips_per_box ?? 0);
        $ps = (int) ($existing->pieces_per_strip ?? 0);
        if ($sb > 0 && $ps > 0) {
            $piecesCount = $sb * $ps;
        } else {
            $piecesCount = (int) ($existing->pieces_count ?? 0);
        }
    }

    // جلب سعر البيع
    $salePrice = $request->has('price') 
        ? (float) $request->input('price') 
        : ($existing ? (float) $existing->price : null);

    if (!$allowSplit) {
        return [
            'full_unit_name' => $fullUnitName,
            'divide_into' => $divideInto > 0 ? $divideInto : null,
            'allow_small_pieces' => false,
            'pieces_count' => null,
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
        $splitItemName = $request->input('split_item_name', 'حبة');
    }

    // ⭐⭐⭐ بناء خيارات التجزئة تلقائياً
    $customSplitOptions = null;
    
    if ($allowSplit && $salePrice !== null && $salePrice > 0.00001) {
        // أسماء الأجزاء
        $fullLabel = !empty($fullUnitName) ? $fullUnitName : 'وحدة كاملة';
        $lvl1Label = $request->input('split_level1_name');
        if (empty($lvl1Label)) {
            $lvl1Label = $divideInto == 2 ? 'نصف' : ($divideInto == 3 ? 'ثلث' : ($divideInto == 4 ? 'ربع' : 'جزء'));
        }
        $lvl2Label = $request->input('split_level2_name');
        if (empty($lvl2Label)) {
            $lvl2Label = 'حبة';
        }
        
        // حساب سعر الجزء
        $lvl1Price = round($salePrice / $divideInto, 2);
        
        $options = [
            ['id' => 'full', 'label' => $fullLabel, 'price' => round($salePrice, 2), 'saleType' => 'box'],
            ['id' => 'level1', 'label' => $lvl1Label, 'price' => $lvl1Price, 'saleType' => 'strip'],
        ];
        
        // حساب سعر القطعة الصغيرة إذا وجدت
        if ($allowSmall && $piecesCount > 0 && $piecesCount % $divideInto === 0) {
            $partsPerSplit = max(1, (int) round($piecesCount / $divideInto));
            $lvl2Price = round($lvl1Price / $partsPerSplit, 2);
            $options[] = ['id' => 'level2', 'label' => $lvl2Label, 'price' => $lvl2Price, 'saleType' => 'pill'];
        }
        
        $customSplitOptions = $options;
        
        // ⭐⭐ تحديث الـ request بالأسعار المحسوبة تلقائياً
        if (!$request->has('split_sale_price')) {
            $request->merge(['split_sale_price' => $lvl1Price]);
        }
        if (!$request->has('custom_child_price') && isset($lvl2Price)) {
            $request->merge(['custom_child_price' => $lvl2Price]);
        }
    }

    return [
        'full_unit_name' => $fullUnitName,
        'divide_into' => $divideInto,
        'allow_small_pieces' => $allowSmall,
        'pieces_count' => $pcsStored,
        'strips_per_box' => $stripsPerBox,
        'pieces_per_strip' => $piecesPerStrip,
        'strip_unit_count' => $stripUnitCount,
        'split_sale_options' => $customSplitOptions,
        'split_item_name' => $splitItemName,
        'purchase_unit' => 'box',
        'sale_unit' => 'box',
        'unit' => 'box',
    ];
}

/**
 * يحوّل كمية المخزون المُدخلة (بوحدة البيع) إلى وحدة التخزين الداخلية (pieces).
 */
private function normalizeStockToInventoryPieces(float $stockInput, array $shape): float
{
    $qty = max(0.0, (float) $stockInput);
    if ($qty <= 0.0) {
        return 0.0;
    }

    $productShape = new Product();
    foreach ($shape as $key => $value) {
        $productShape->{$key} = $value;
    }

    $saleUnit = (string) ($shape['sale_unit'] ?? $shape['unit'] ?? 'box');
    $normalized = $productShape->saleQuantityToInventoryPieces($qty, $saleUnit);
    return max(0.0, round((float) $normalized, 3));
}

    /**
     * يمنع حفظ تسعير يسبب خسارة (سعر بيع أقل من التكلفة) للوحدة الكاملة أو الفروع.
     *
     * @return array<string, array<int, string>>|null
     */
    private function validateNoLossPricing(
        Request $request,
        float $costPrice,
        ?float $salePrice,
        int $divideInto,
        int $piecesCount,
        bool $allowSplitSales
    ): ?array {
        if ($costPrice <= 0) {
            return null;
        }
    
        if ($salePrice !== null && $salePrice + 0.0001 < $costPrice) {
            return ['price' => ['سعر بيع الوحدة الكاملة أقل من التكلفة']];
        }
    
        if (!$allowSplitSales) {
            return null;
        }
    
        $div = max(1, $divideInto);
        $pieceCount = max(0, $piecesCount);
    
        // ⭐⭐ التحقق من أن piecesCount يقبل القسمة على divideInto
        if ($pieceCount > 0 && $div > 0 && $pieceCount % $div !== 0) {
            return ['pieces_count' => ['عدد القطع (' . $pieceCount . ') يجب أن يقبل القسمة على عدد الأجزاء (' . $div . ')']];
        }
    
        $splitSalePrice = $request->has('split_sale_price') ? (float) $request->input('split_sale_price') : null;
        if ($splitSalePrice !== null) {
            $minSplitCost = $costPrice / $div;
            if ($splitSalePrice + 0.0001 < $minSplitCost) {
                return ['split_sale_price' => ['سعر بيع الجزء أقل من تكلفته']];
            }
        }
    
        // ⭐⭐ التحقق من سعر القطعة الصغيرة
        $customChildPrice = $request->has('custom_child_price') ? (float) $request->input('custom_child_price') : null;
        if ($customChildPrice !== null && $pieceCount > 0) {
            $minChildCost = $costPrice / $pieceCount;
            if ($customChildPrice + 0.0001 < $minChildCost) {
                return ['custom_child_price' => ['سعر بيع القطعة الصغيرة أقل من تكلفتها (' . number_format($minChildCost, 2) . ' شيكل)']];
            }
        }
    
        $options = $request->input('split_sale_options');
        if (is_array($options)) {
            foreach ($options as $option) {
                if (!is_array($option)) {
                    continue;
                }
                $optPrice = isset($option['price']) ? (float) $option['price'] : null;
                if ($optPrice === null) {
                    continue;
                }
                $saleType = strtolower((string) ($option['saleType'] ?? $option['sale_type'] ?? ''));
                $minCost = $costPrice;
                if ($saleType === 'strip') {
                    $minCost = $costPrice / $div;
                } elseif ($saleType === 'pill' && $pieceCount > 0) {
                    $minCost = $costPrice / $pieceCount;
                }
                if ($optPrice + 0.0001 < $minCost) {
                    return ['split_sale_options' => ['إحدى أسعار الفروع أقل من التكلفة وستسبب خسارة']];
                }
            }
        }
    
        return null;
    }

    /**
     * اشتقاق أسعار التجزئة تلقائياً عند الإنشاء/التعديل إذا لم يرسلها المستخدم صراحةً.
     * الهدف: مرونة التعديل اليدوي مع ضمان توفر قيم دقيقة افتراضياً.
     */
    private function applyAutoSplitPricingDefaults(
        Request $request,
        float $costPrice,
        ?float $salePrice,
        int $divideInto,
        int $piecesCount,
        bool $allowSplitSales
    ): void {
        if (!$allowSplitSales || $salePrice === null || $salePrice <= 0.00001) {
            return;
        }
    
        $div = max(1, $divideInto);
        
        // حساب سعر الجزء تلقائياً
        $lvl1Price = round($salePrice / $div, 2);
        
        if (!$request->has('split_sale_price')) {
            $request->merge(['split_sale_price' => $lvl1Price]);
        }
        
        // حساب سعر القطعة الصغيرة
        if ($piecesCount > 0 && $piecesCount % $div === 0) {
            $partsPerSplit = max(1, (int) round($piecesCount / $div));
            $lvl2Price = round($lvl1Price / $partsPerSplit, 2);
            
            if (!$request->has('custom_child_price')) {
                $request->merge(['custom_child_price' => $lvl2Price]);
            }
        }
        
        // حساب الربح
        if (!$request->has('profit_amount') && $costPrice > 0) {
            $request->merge(['profit_amount' => round($salePrice - $costPrice, 2)]);
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

        $deletedProductId = $product->id;
        $deletedProductName = $product->name;
        $product->categories()->detach();
        $product->delete();

        ActivityLogger::log(request(), [
            'action_type' => 'product_delete',
            'entity_type' => 'product',
            'entity_id' => $deletedProductId,
            'description' => "حذف الصنف: {$deletedProductName}",
        ]);

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
 * تطبيق جرد المخزون دفعة واحدة مع تسجيل النشاط وإشعار الإدارة.
 */
public function applyStocktake(Request $request)
{
    $validated = $request->validate([
        'session_id' => 'nullable|string|max:120',
        'title' => 'nullable|string|max:255',
        'lines' => 'required|array|min:1',
        'lines.*.product_id' => 'required|integer|exists:products,id',
        'lines.*.system_qty' => 'nullable|numeric',
        'lines.*.counted_qty' => 'required|numeric|min:0',
    ]);

    DB::beginTransaction();
    try {
        $lines = is_array($validated['lines'] ?? null) ? $validated['lines'] : [];
        $applied = [];
        $totalChanged = 0;

        foreach ($lines as $line) {
            $productId = (int) ($line['product_id'] ?? 0);
            $countedQty = round((float) ($line['counted_qty'] ?? 0), 3);
            $product = Product::lockForUpdate()->find($productId);
            if (!$product) {
                continue;
            }

            $beforeQty = round((float) ($product->stock ?? 0), 3);
            $deltaQty = round($countedQty - $beforeQty, 3);
            if (abs($deltaQty) < 0.0001) {
                continue;
            }

            $product->stock = $countedQty;
            $product->save();
            $totalChanged++;

            $row = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'before_qty' => $beforeQty,
                'after_qty' => $countedQty,
                'difference' => $deltaQty,
                'barcode' => $product->barcode,
            ];
            $applied[] = $row;

        }

        if ($totalChanged > 0) {
            ActivityLogger::log($request, [
                'action_type' => 'stocktake_apply',
                'entity_type' => 'stocktake',
                'entity_id' => null,
                'description' => "تطبيق جرد مخزون على {$totalChanged} صنف",
                'meta' => [
                    'stocktake_session_id' => $validated['session_id'] ?? null,
                    'stocktake_title' => $validated['title'] ?? 'جرد مخزون',
                    'items_count' => $totalChanged,
                    'items' => $applied,
                ],
            ]);
        }

        if ($totalChanged > 0 && \Schema::hasTable('system_notifications')) {
            $detailsLines = array_map(function ($x) {
                $sign = (float) $x['difference'] >= 0 ? '+' : '';
                return "{$x['product_name']} | {$x['before_qty']} → {$x['after_qty']} | فرق {$sign}{$x['difference']}";
            }, array_slice($applied, 0, 30));

            SystemNotification::create([
                'type' => 'stocktake',
                'pref_category' => 'stocktake',
                'title' => 'تم تنفيذ جرد مخزون',
                'message' => "تم تطبيق الجرد على {$totalChanged} صنف",
                'details' => implode("\n", $detailsLines),
                'from_management' => true,
                'management_label' => 'نظام الجرد',
                'recipients_type' => 'all',
                'meta' => [
                    'stocktake_session_id' => $validated['session_id'] ?? null,
                    'stocktake_title' => $validated['title'] ?? 'جرد مخزون',
                    'changed_count' => $totalChanged,
                    'items' => $applied,
                ],
                'created_by' => $request->user()?->username ?? null,
            ]);
        }

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => "تم تطبيق الجرد على {$totalChanged} صنف",
            'data' => [
                'changed_count' => $totalChanged,
                'items' => $applied,
            ],
        ]);
    } catch (\Exception $e) {
        DB::rollBack();
        return response()->json([
            'success' => false,
            'message' => 'تعذر تطبيق الجرد',
            'error' => config('app.debug') ? $e->getMessage() : null,
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

private function generateUniqueBarcode(): string
{
    do {
        $candidate = 'BC' . now()->format('ymdHis') . random_int(100, 999);
    } while (Product::where('barcode', $candidate)->exists());

    return $candidate;
}

}