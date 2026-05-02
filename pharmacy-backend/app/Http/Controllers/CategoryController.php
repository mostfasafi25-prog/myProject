<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Models\Product;
use Illuminate\Support\Facades\Log;
use App\Models\TreasuryTransaction;
use App\Support\ActivityLogger;
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

        ActivityLogger::log($request, [
            'action_type' => 'category_create',
            'entity_type' => 'category',
            'entity_id' => $category->id,
            'description' => "إضافة قسم: {$category->name}",
            'meta' => ['scope' => $category->scope],
        ]);
        
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

            ActivityLogger::log($request, [
                'action_type' => 'category_update',
                'entity_type' => 'category',
                'entity_id' => $category->id,
                'description' => "تحديث قسم: {$category->name}",
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
            
            $categoryName = $category->name;
            $category->delete();

            ActivityLogger::log(request(), [
                'action_type' => 'category_delete',
                'entity_type' => 'category',
                'entity_id' => $id,
                'description' => "حذف قسم: {$categoryName}",
            ]);
            
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
     * أقسام المشتريات/المبيعات للكاشير — scope=purchase|sales
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

}