<?php

namespace App\Http\Controllers;

use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Product;
use App\Models\Treasury;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\TreasuryTransaction;
use Illuminate\Support\Facades\Log;

class PurchaseController extends Controller
{
    // 1. قائمة المشتريات
    public function index(Request $request)
    {
        try {
            $perPage = $request->get('per_page', 15);
            $search = $request->get('search');
            $startDate = $request->get('start_date');
            $endDate = $request->get('end_date');
            
            $query = Purchase::with(['items']);
            
            if ($search) {
                $query->where('invoice_number', 'LIKE', "%{$search}%")
                      ->orWhereHas('items', function ($q) use ($search) {
                          $q->where('product_name', 'LIKE', "%{$search}%");
                      });
            }
            
            if ($startDate) {
                $query->whereDate('purchase_date', '>=', $startDate);
            }
            
            if ($endDate) {
                $query->whereDate('purchase_date', '<=', $endDate);
            }
            
            $purchases = $query->orderBy('purchase_date', 'desc')
                ->orderBy('id', 'desc')
                ->paginate($perPage);
            
            return response()->json([
                'success' => true,
                'data' => $purchases->items(),
                'pagination' => [
                    'total' => $purchases->total(),
                    'per_page' => $purchases->perPage(),
                    'current_page' => $purchases->currentPage(),
                    'last_page' => $purchases->lastPage()
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب المشتريات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }

    /** تقرير المشتريات المفصل (من جدول المشتريات) بنفس هيكل categories/purchases-detailed-report */
    public function purchasesReport(Request $request)
    {
        try {
            $period = $request->get('period', 'daily');
            $startDate = null;
            $endDate = null;
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
                    if ($request->start_date && $request->end_date) {
                        $startDate = \Carbon\Carbon::parse($request->start_date)->startOfDay();
                        $endDate = \Carbon\Carbon::parse($request->end_date)->endOfDay();
                    } else {
                        $startDate = now()->startOfDay();
                        $endDate = now()->endOfDay();
                    }
                    break;
                default:
                    $startDate = now()->startOfDay();
                    $endDate = now()->endOfDay();
            }

            $query = Purchase::with(['items'])->whereBetween('purchase_date', [$startDate, $endDate]);
            if ($request->category_id) {
                $query->where('category_id', $request->category_id);
            }
            $purchases = $query->orderBy('purchase_date', 'desc')->get();

            $totalAmount = $purchases->sum('total_amount');
            $totalItems = $purchases->sum(fn ($p) => $p->items->sum('quantity'));
            $days = $startDate->diffInDays($endDate) + 1;

            $purchasesData = $purchases->map(function ($purchase) {
                $items = $purchase->items->map(function ($item) {
                    return [
                        'category_id' => null,
                        'category_name' => $item->product_name,
                        'quantity' => $item->quantity,
                        'cost_price' => $item->unit_price,
                        'total_cost' => (float) $item->total_price,
                    ];
                })->toArray();
                return [
                    'id' => $purchase->id,
                    'transaction_number' => $purchase->invoice_number,
                    'date' => $purchase->purchase_date->format('Y-m-d'),
                    'time' => $purchase->created_at->format('H:i:s'),
                    'datetime' => $purchase->created_at->format('Y-m-d H:i:s'),
                    'description' => 'فاتورة شراء ' . $purchase->invoice_number,
                    'amount' => (float) $purchase->total_amount,
                    'payment_method' => $purchase->payment_method ?? 'cash',
                    'items_count' => $purchase->items->count(),
                    'items' => $items,
                ];
            })->toArray();

            $categoryStats = [];
            foreach ($purchases as $purchase) {
                foreach ($purchase->items as $item) {
                    $key = $item->product_name ?: 'أصناف أخرى';
                    if (!isset($categoryStats[$key])) {
                        $categoryStats[$key] = ['category_name' => $key, 'total_quantity' => 0, 'total_cost' => 0, 'purchases_count' => 0];
                    }
                    $categoryStats[$key]['total_quantity'] += $item->quantity;
                    $categoryStats[$key]['total_cost'] += (float) $item->total_price;
                    $categoryStats[$key]['purchases_count']++;
                }
            }
            $topCategories = collect($categoryStats)->sortByDesc('total_cost')->values()->take(10)->toArray();

            return response()->json([
                'success' => true,
                'data' => [
                    'stats' => [
                        'period' => ['type' => $period, 'start_date' => $startDate->format('Y-m-d'), 'end_date' => $endDate->format('Y-m-d'), 'days' => $days],
                        'summary' => [
                            'total_purchases' => $purchases->count(),
                            'total_amount' => $totalAmount,
                            'total_items' => (int) $totalItems,
                            'average_purchase' => $purchases->count() > 0 ? round($totalAmount / $purchases->count(), 2) : 0,
                        ],
                    ],
                    'purchases' => $purchasesData,
                    'analysis' => ['top_categories' => $topCategories],
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في تقرير المشتريات',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    // 2. إنشاء عملية شراء جديدة
public function store(Request $request)
{
    try {
        // ✅ لا تطلب remaining_amount من المستخدم، احسبه تلقائياً
        $request->validate([
            'invoice_number' => 'required|string|unique:purchases',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.product_name' => 'required|string',
            'items.*.quantity' => ['required', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0.1'],
            'items.*.unit_price' => ['required', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
            'items.*.total_price' => ['required', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
            'total_amount' => ['required', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
            'paid_amount' => ['required', 'numeric', 'regex:/^\d+(\.\d)?$/', 'min:0'],
            'status' => 'required|in:pending,completed,cancelled,partially_paid', // ⭐ أضف partially_paid
            'purchase_date' => 'required|date',
            'notes' => 'nullable|string',
            'payment_method' => 'required|in:cash,app,credit,bank_transfer,check',
            'treasury_note' => 'nullable|string',
        ]);

        DB::beginTransaction();

        // حساب المبالغ تلقائياً
        $remainingAmount = $request->total_amount - $request->paid_amount;
        $status = $request->status;
        
        // تحديد الحالة التلقائية إذا لم يتم تحديدها
        if (!$status) {
            if ($request->paid_amount == 0) {
                $status = 'pending';
            } elseif ($request->paid_amount < $request->total_amount) {
                $status = 'partially_paid';
            } else {
                $status = 'completed';
            }
        }

        // 1. إنشاء الفاتورة
        $purchase = Purchase::create([
            'invoice_number' => $request->invoice_number,
            'total_amount' => $request->total_amount,
            'grand_total' => $request->total_amount, // ⭐ إذا كنت لا تستخدم discount/tax
            'paid_amount' => $request->paid_amount,
            'remaining_amount' => $remainingAmount, // ⭐ تمت إضافته
            'due_amount' => $remainingAmount, // ⭐ للتوافق مع الحقل الموجود
            'status' => $status,
            'purchase_date' => $request->purchase_date,
            'notes' => $request->notes ?? '',
            'payment_method' => $request->payment_method,
            'user_id' => auth()->id() ?? 1,
            'created_by' => auth()->id() ?? 1,
            'category_id' => $request->category_id ?? 1,
        ]);

        // 2. إضافة العناصر (نفس الكود)
        foreach ($request->items as $item) {
            $qty = (float) ($item['quantity'] ?? 0);
            $unitPrice = (float) ($item['unit_price'] ?? 0);
            $totalPrice = (float) ($item['total_price'] ?? 0);
            PurchaseItem::create([
                'purchase_id' => $purchase->id,
                'product_id' => $item['product_id'],
                'product_name' => $item['product_name'],
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'total_price' => $totalPrice,
                'subtotal' => $totalPrice,
                'discount' => 0,
                'tax' => 0,
            ]);

            // زيادة المخزون وتحديث سعر التكلفة/الشراء لآخر شراء
            $product = Product::find($item['product_id']);
            if ($product) {
                $product->increment('stock', $qty);
                $product->update([
                    'purchase_price' => $unitPrice,
                    'cost_price' => $unitPrice,
                ]);
            }
        }

        // 3. خصم من الخزنة (نفس الكود)
        if ($request->status === 'completed' && $request->paid_amount > 0) {
            $treasury = Treasury::first();
            if ($treasury) {
                if ($treasury->balance < $request->paid_amount) {
                    throw new \Exception('رصيد الخزنة غير كافي');
                }
                
                $treasury->balance -= $request->paid_amount;
                $treasury->save();
                
                TreasuryTransaction::create([
                    'treasury_id' => $treasury->id,
                    'type' => 'expense',
                    'amount' => $request->paid_amount,
                    'description' => $request->treasury_note ?? "دفع فاتورة شراء #{$request->invoice_number}",
    'category' => 'purchase_expense', // ← غير من purchases إلى purchase_expense
                    'purchase_id' => $purchase->id,
                    'reference_type' => 'purchase',
                    'reference_id' => $purchase->id,
                    'created_by' => auth()->id() ?? 1,
    'transaction_date' => now()->toDateString(), // ⭐ تاريخ فقط
                ]);
            }
        }

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة المشتريات بنجاح',
            'data' => $purchase->load('items'),
        ], 201);

    } catch (\Exception $e) {
        DB::rollBack();
        return response()->json([
            'success' => false,
            'message' => 'فشل في إضافة المشتريات: ' . $e->getMessage(),
        ], 500);
    }
}
    



public function getSalesStatistics(Request $request)
{
    Log::info('🟢 === بدء دالة getSalesStatistics ===', [
        'request_params' => $request->all(),
        'user_id' => auth()->id() ?? 'guest',
        'timestamp' => now()
    ]);

    try {
        $period = $request->get('period', 'today');
        Log::info('📊 الفترة المحددة:', ['period' => $period]);
        
        // جلب التواريخ الأساسية فقط
        $today = now()->toDateString();
        $weekStart = now()->startOfWeek()->toDateString();
        $monthStart = now()->startOfMonth()->toDateString();
        
        Log::info('📅 التواريخ المطلوبة:', [
            'today' => $today,
            'week_start' => $weekStart,
            'month_start' => $monthStart
        ]);
        
        // استعلام المشتريات حسب الفترة
        $query = Purchase::where('status', 'completed');
        Log::info('✅ تم إنشاء الاستعلام الأساسي - المشتريات المكتملة');
        
        switch ($period) {
            case 'today':
                $query->whereDate('purchase_date', $today);
                Log::info('📅 فلترة: اليوم فقط', ['date' => $today]);
                break;
            case 'week':
                $query->whereDate('purchase_date', '>=', $weekStart)
                      ->whereDate('purchase_date', '<=', $today);
                Log::info('📅 فلترة: هذا الأسبوع', [
                    'from' => $weekStart,
                    'to' => $today
                ]);
                break;
            case 'month':
                $query->whereDate('purchase_date', '>=', $monthStart)
                      ->whereDate('purchase_date', '<=', $today);
                Log::info('📅 فلترة: هذا الشهر', [
                    'from' => $monthStart,
                    'to' => $today
                ]);
                break;
            // تم حذف حالة year
        }
        
        Log::info('🔍 جلب البيانات من قاعدة البيانات...');
        $purchases = $query->get();
        Log::info('✅ تم جلب المشتريات', [
            'count' => $purchases->count(),
            'purchase_ids' => $purchases->pluck('id')->toArray()
        ]);
        
        // حساب الإحصائيات
        $totalPurchases = $purchases->count();
        $totalAmount = $purchases->sum('total_amount');
        $totalPaid = $purchases->sum('paid_amount');
        $totalDue = $purchases->sum('due_amount');
        
        Log::info('🧮 الإحصائيات الأساسية:', [
            'total_purchases' => $totalPurchases,
            'total_amount' => $totalAmount,
            'total_paid' => $totalPaid,
            'total_due' => $totalDue
        ]);
        
        // حساب عدد المنتجات المباعة
        $totalItems = 0;
        $productsSold = [];
        
        Log::info('📦 بدء حساب المنتجات المباعة...');
        
        if ($purchases->count() > 0) {
            foreach ($purchases as $purchase) {
                Log::debug('🛒 فاتورة:', [
                    'purchase_id' => $purchase->id,
                    'items_count' => $purchases->items->count()
                ]);
                
                foreach ($purchase->items as $item) {
                    $totalItems += $item->quantity;
                    
                    if (!isset($productsSold[$item->product_id])) {
                        $productsSold[$item->product_id] = [
                            'name' => $item->product_name,
                            'quantity' => 0,
                            'total' => 0
                        ];
                    }
                    
                    $productsSold[$item->product_id]['quantity'] += $item->quantity;
                    $productsSold[$item->product_id]['total'] += $item->total_price;
                    
                    Log::debug('📝 منتج:', [
                        'product_id' => $item->product_id,
                        'product_name' => $item->product_name,
                        'quantity' => $item->quantity,
                        'price' => $item->total_price
                    ]);
                }
            }
        } else {
            Log::warning('⚠️ لا توجد مشتريات مكتملة في الفترة المحددة');
        }
        
        Log::info('✅ المنتجات المباعة:', [
            'total_items' => $totalItems,
            'unique_products' => count($productsSold)
        ]);
        
        // ترتيب المنتجات حسب الكمية
        usort($productsSold, function($a, $b) {
            return $b['quantity'] - $a['quantity'];
        });
        
        Log::info('🏆 ترتيب المنتجات حسب الكمية:', [
            'top_products' => array_slice($productsSold, 0, 5)
        ]);
        
        // جلب المشتريات حسب اليوم (بدون السنة)
        $purchasesByDay = $this->getPurchasesByDay($period);
        Log::info('📊 المشتريات حسب اليوم:', [
            'days_count' => count($purchasesByDay)
        ]);
        
        $response = [
            'success' => true,
            'data' => [
                'period' => $period,
                'dates' => [
                    'start' => match($period) {
                        'today' => $today,
                        'week' => $weekStart,
                        'month' => $monthStart,
                        default => $today
                    },
                    'end' => $today
                ],
                'statistics' => [
                    'total_purchases' => $totalPurchases,
                    'total_amount' => $totalAmount,
                    'total_paid' => $totalPaid,
                    'total_due' => $totalDue,
                    'total_items' => $totalItems,
                    'average_purchase' => $totalPurchases > 0 ? $totalAmount / $totalPurchases : 0,
                    'payment_ratio' => $totalAmount > 0 ? ($totalPaid / $totalAmount) * 100 : 0,
                ],
                'top_products' => array_slice($productsSold, 0, 5),
                'purchases_by_day' => $purchasesByDay,
            ]
        ];
        
        Log::info('✅ === نهاية دالة getSalesStatistics - نجاح ===', [
            'response_summary' => [
                'period' => $period,
                'total_purchases' => $totalPurchases,
                'total_amount' => $totalAmount
            ]
        ]);
        
        return response()->json($response);
        
    } catch (\Exception $e) {
        Log::error('💥 === خطأ في getSalesStatistics ===', [
            'error_message' => $e->getMessage(),
            'error_file' => $e->getFile(),
            'error_line' => $e->getLine(),
            'error_trace' => $e->getTraceAsString(),
            'request_params' => $request->all()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب الإحصائيات',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}

// دالة مساعدة مع logs
private function getPurchasesByDay($period = 'month')
{
    Log::info('📅 بدء دالة getPurchasesByDay', ['period' => $period]);
    
    $days = [];
    
    switch ($period) {
        case 'today':
            $days[] = now()->toDateString();
            break;
        case 'week':
            for ($i = 0; $i < 7; $i++) {
                $days[] = now()->subDays($i)->toDateString();
            }
            break;
        case 'month':
            $daysInMonth = now()->daysInMonth;
            for ($i = 1; $i <= $daysInMonth; $i++) {
                $days[] = now()->startOfMonth()->addDays($i - 1)->toDateString();
            }
            break;
    }
    
    Log::info('📅 الأيام المراد تحليلها:', [
        'period' => $period,
        'days_count' => count($days),
        'first_day' => $days[0] ?? 'none',
        'last_day' => $days[count($days)-1] ?? 'none'
    ]);
    
    $purchasesByDay = [];
    
    foreach ($days as $day) {
        $total = Purchase::where('status', 'completed')
            ->whereDate('purchase_date', $day)
            ->sum('total_amount');
            
        $count = Purchase::where('status', 'completed')
            ->whereDate('purchase_date', $day)
            ->count();
            
        $purchasesByDay[] = [
            'date' => $day,
            'total_amount' => $total,
            'count' => $count,
            'day_name' => \Carbon\Carbon::parse($day)->translatedFormat('l')
        ];
        
        Log::debug('📊 يوم:', [
            'date' => $day,
            'total_amount' => $total,
            'count' => $count
        ]);
    }
    
    Log::info('✅ انتهت دالة getPurchasesByDay', [
        'days_analyzed' => count($purchasesByDay)
    ]);
    
    return $purchasesByDay;
}


  // 4. حذف جميع المشتريات
   public function destroyAll(Request $request)
{
    $userId = auth()->id() ?? 'system';
    $requestId = uniqid('purge_', true);
    
    Log::channel('purchases')->info('🔴 بدء عملية حذف جميع المشتريات', [
        'request_id' => $requestId,
        'user_id' => $userId,
        'ip' => $request->ip(),
        'user_agent' => $request->userAgent(),
        'timestamp' => now()->toDateTimeString()
    ]);

    try {
        DB::beginTransaction();
        
        // جلب جميع المشتريات بدون supplier
        $purchases = Purchase::with(['items'])->get(); // اشيل 'supplier' من هنا
        $totalPurchases = $purchases->count();
        $totalItems = 0;
        $totalPaidAmount = 0;
        $affectedProducts = [];
        $affectedTreasuries = [];
        
        Log::channel('purchases')->info('📊 إحصائيات المشتريات قبل الحذف', [
            'request_id' => $requestId,
            'total_purchases' => $totalPurchases,
            'purchase_ids' => $purchases->pluck('id')->toArray(),
            'timestamp' => now()->toDateTimeString()
        ]);

        // معالجة كل فاتورة للتراجع عن المخزون والتحويلات
        foreach ($purchases as $purchase) {
            // اشيل supplier من هنا أيضاً
            Log::channel('purchases')->debug('🔄 معالجة فاتورة الشراء', [
                'request_id' => $requestId,
                'purchase_id' => $purchase->id,
                'invoice_number' => $purchase->invoice_number,
                'total_amount' => $purchase->total_amount,
                'paid_amount' => $purchase->paid_amount,
                'items_count' => $purchase->items->count()
            ]);

            // 1. تراجع عن زيادة المخزون لكل منتج
            foreach ($purchase->items as $item) {
                $product = Product::find($item->product_id);
                if ($product) {
                    $oldStock = $product->stock;
                    $product->decrement('stock', $item->quantity);
                    $newStock = $product->fresh()->stock;
                    $totalItems++;
                    
                    $affectedProducts[$product->id] = [
                        'name' => $product->name,
                        'old_stock' => $oldStock,
                        'quantity_removed' => $item->quantity,
                        'new_stock' => $newStock
                    ];
                    
                    Log::channel('purchases')->debug('📦 تراجع مخزون المنتج', [
                        'request_id' => $requestId,
                        'purchase_id' => $purchase->id,
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'old_stock' => $oldStock,
                        'quantity' => $item->quantity,
                        'new_stock' => $newStock,
                        'item_id' => $item->id
                    ]);
                } else {
                    Log::warning('⚠️ المنتج غير موجود', [
                        'request_id' => $requestId,
                        'purchase_id' => $purchase->id,
                        'item_id' => $item->id,
                        'product_id' => $item->product_id
                    ]);
                }
            }

            // 2. تراجع عن تحويلات الخزنة
            if ($purchase->paid_amount > 0) {
                $totalPaidAmount += $purchase->paid_amount;
                
                // حذف تحويلات الخزنة المرتبطة
                $deletedTransactions = TreasuryTransaction::where('purchase_id', $purchase->id)
                    ->orWhere(function($q) use ($purchase) {
                        $q->where('reference_type', 'purchase')
                          ->where('reference_id', $purchase->id);
                    })
                    ->delete();

                // إرجاع المبلغ للخزنة
                $treasury = Treasury::first();
                if ($treasury) {
                    $oldBalance = $treasury->balance;
                    $treasury->balance += $purchase->paid_amount;
                    $treasury->save();
                    $newBalance = $treasury->fresh()->balance;
                    
                    $affectedTreasuries[$treasury->id] = [
                        'name' => $treasury->name,
                        'old_balance' => $oldBalance,
                        'amount_added' => $purchase->paid_amount,
                        'new_balance' => $newBalance
                    ];
                    
                    Log::channel('purchases')->debug('🏦 تحديث رصيد الخزنة', [
                        'request_id' => $requestId,
                        'purchase_id' => $purchase->id,
                        'treasury_id' => $treasury->id,
                        'treasury_name' => $treasury->name,
                        'old_balance' => $oldBalance,
                        'added_amount' => $purchase->paid_amount,
                        'new_balance' => $newBalance,
                        'deleted_transactions' => $deletedTransactions
                    ]);
                } else {
                    Log::error('🚨 الخزنة غير موجودة', [
                        'request_id' => $requestId,
                        'purchase_id' => $purchase->id,
                        'paid_amount' => $purchase->paid_amount
                    ]);
                }
            }

            // 3. حذف عناصر الفاتورة
            $deletedItems = $purchase->items()->delete();
            Log::channel('purchases')->debug('🗑️ حذف عناصر الفاتورة', [
                'request_id' => $requestId,
                'purchase_id' => $purchase->id,
                'deleted_items' => $deletedItems
            ]);
        }

        // 4. حذف جميع المشتريات
        $deletedCount = Purchase::count();
        Purchase::query()->delete();
        
        Log::channel('purchases')->info('✅ تم حذف جميع المشتريات بنجاح', [
            'request_id' => $requestId,
            'user_id' => $userId,
            'total_purchases_deleted' => $deletedCount,
            'total_items_processed' => $totalItems,
            'total_paid_amount_reverted' => $totalPaidAmount,
            'affected_products_count' => count($affectedProducts),
            'affected_treasuries_count' => count($affectedTreasuries),
            'execution_time' => microtime(true) - LARAVEL_START . ' seconds',
            'timestamp' => now()->toDateTimeString()
        ]);

        // تسجيل عملية الحذف الكاملة في ملف منفصل للتدقيق
        Log::channel('audit')->critical('🔴 AUDIT: حذف جميع المشتريات', [
            'request_id' => $requestId,
            'user_id' => $userId,
            'user_ip' => $request->ip(),
            'action' => 'purge_all_purchases',
            'deleted_count' => $deletedCount,
            'total_amount_reverted' => $totalPaidAmount,
            'timestamp' => now()->toDateTimeString(),
        ]);

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => "تم حذف جميع المشتريات بنجاح ($deletedCount فاتورة)",
            'deleted_count' => $deletedCount,
            'data' => [
                'total_items' => $totalItems,
                'total_paid_amount_reverted' => $totalPaidAmount,
                'affected_products_count' => count($affectedProducts),
                'request_id' => $requestId
            ]
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        
        Log::channel('purchases')->error('💥 فشل في حذف المشتريات', [
            'request_id' => $requestId,
            'user_id' => $userId,
            'error_message' => $e->getMessage(),
            'error_file' => $e->getFile(),
            'error_line' => $e->getLine(),
            'error_trace' => $e->getTraceAsString(),
            'timestamp' => now()->toDateTimeString()
        ]);
        
        Log::channel('audit')->error('🔴 AUDIT: فشل حذف المشتريات', [
            'request_id' => $requestId,
            'user_id' => $userId,
            'error' => $e->getMessage(),
            'timestamp' => now()->toDateTimeString()
        ]);

        return response()->json([
            'success' => false,
            'message' => 'فشل في حذف المشتريات: ' . $e->getMessage(),
            'request_id' => $requestId
        ], 500);
    }
}




   public function destroy($id)
    {
        $userId = auth()->id() ?? 'system';
        $requestId = uniqid('delete_purchase_', true);
        
        Log::channel('purchases')->info('🗑️ بدء عملية حذف فاتورة شراء', [
            'request_id' => $requestId,
            'user_id' => $userId,
            'purchase_id' => $id,
            'timestamp' => now()->toDateTimeString()
        ]);

        try {
            DB::beginTransaction();
            
            // جلب الفاتورة مع العناصر
            $purchase = Purchase::with(['items'])->find($id);
            
            if (!$purchase) {
                Log::warning('⚠️ فاتورة الشراء غير موجودة', [
                    'request_id' => $requestId,
                    'purchase_id' => $id
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'فاتورة الشراء غير موجودة'
                ], 404);
            }
            
            Log::channel('purchases')->info('🔍 تفاصيل الفاتورة المراد حذفها', [
                'request_id' => $requestId,
                'purchase_id' => $purchase->id,
                'invoice_number' => $purchase->invoice_number,
                'total_amount' => $purchase->total_amount,
                'paid_amount' => $purchase->paid_amount,
                'items_count' => $purchase->items->count()
            ]);

            // 1. تراجع عن زيادة المخزون لكل منتج
            foreach ($purchase->items as $item) {
                $product = Product::find($item->product_id);
                if ($product) {
                    $oldStock = $product->stock;
                    $product->decrement('stock', $item->quantity);
                    $newStock = $product->fresh()->stock;
                    
                    Log::channel('purchases')->debug('📦 تراجع مخزون المنتج', [
                        'request_id' => $requestId,
                        'purchase_id' => $purchase->id,
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'old_stock' => $oldStock,
                        'quantity' => $item->quantity,
                        'new_stock' => $newStock,
                        'item_id' => $item->id
                    ]);
                } else {
                    Log::warning('⚠️ المنتج غير موجود', [
                        'request_id' => $requestId,
                        'purchase_id' => $purchase->id,
                        'item_id' => $item->id,
                        'product_id' => $item->product_id
                    ]);
                }
            }

            // 2. تراجع عن تحويلات الخزنة إذا كان هناك مبلغ مدفوع
            if ($purchase->paid_amount > 0) {
                // حذف تحويلات الخزنة المرتبطة
                $deletedTransactions = TreasuryTransaction::where('purchase_id', $purchase->id)
                    ->orWhere(function($q) use ($purchase) {
                        $q->where('reference_type', 'purchase')
                          ->where('reference_id', $purchase->id);
                    })
                    ->delete();

                // إرجاع المبلغ للخزنة
                $treasury = Treasury::first();
                if ($treasury) {
                    $oldBalance = $treasury->balance;
                    $treasury->balance += $purchase->paid_amount;
                    $treasury->save();
                    $newBalance = $treasury->fresh()->balance;
                    
                    Log::channel('purchases')->debug('🏦 تحديث رصيد الخزنة', [
                        'request_id' => $requestId,
                        'purchase_id' => $purchase->id,
                        'treasury_id' => $treasury->id,
                        'treasury_name' => $treasury->name,
                        'old_balance' => $oldBalance,
                        'added_amount' => $purchase->paid_amount,
                        'new_balance' => $newBalance,
                        'deleted_transactions' => $deletedTransactions
                    ]);
                }
            }

            // 3. حذف عناصر الفاتورة
            $deletedItems = $purchase->items()->delete();
            
            Log::channel('purchases')->debug('🗑️ حذف عناصر الفاتورة', [
                'request_id' => $requestId,
                'purchase_id' => $purchase->id,
                'deleted_items' => $deletedItems
            ]);

            // 4. حذف الفاتورة نفسها
            $invoiceNumber = $purchase->invoice_number;
            $purchase->delete();
            
            Log::channel('purchases')->info('✅ تم حذف فاتورة الشراء بنجاح', [
                'request_id' => $requestId,
                'user_id' => $userId,
                'purchase_id' => $id,
                'invoice_number' => $invoiceNumber,
                'total_amount' => $purchase->total_amount,
                'paid_amount' => $purchase->paid_amount,
                'items_count' => $deletedItems,
                'timestamp' => now()->toDateTimeString()
            ]);

            // تسجيل في ملف التدقيق
            Log::channel('audit')->warning('🟡 AUDIT: حذف فاتورة شراء', [
                'request_id' => $requestId,
                'user_id' => $userId,
                'action' => 'delete_purchase',
                'purchase_id' => $id,
                'invoice_number' => $invoiceNumber,
                'total_amount' => $purchase->total_amount,
                'timestamp' => now()->toDateTimeString()
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "تم حذف فاتورة الشراء $invoiceNumber بنجاح",
                'data' => [
                    'invoice_number' => $invoiceNumber,
                    'deleted_items' => $deletedItems,
                    'request_id' => $requestId
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::channel('purchases')->error('💥 فشل في حذف فاتورة الشراء', [
                'request_id' => $requestId,
                'user_id' => $userId,
                'purchase_id' => $id,
                'error_message' => $e->getMessage(),
                'error_file' => $e->getFile(),
                'error_line' => $e->getLine(),
                'timestamp' => now()->toDateTimeString()
            ]);
            
            Log::channel('audit')->error('🔴 AUDIT: فشل حذف فاتورة شراء', [
                'request_id' => $requestId,
                'user_id' => $userId,
                'error' => $e->getMessage(),
                'timestamp' => now()->toDateTimeString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'فشل في حذف فاتورة الشراء: ' . $e->getMessage(),
                'request_id' => $requestId
            ], 500);
        }
    }
    


    // 3. عرض تفاصيل عملية شراء محددة
    public function show($id)
    {
        try {
            $purchase = Purchase::with([
                'category:id,name',
                'items.product:id,name,unit,sku,barcode',
                'createdBy:id,name'
            ])->find($id);
            
            if (!$purchase) {
                return response()->json([
                    'success' => false,
                    'message' => 'فاتورة الشراء غير موجودة'
                ], 404);
            }
            
            return response()->json([
                'success' => true,
                'data' => $purchase
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب البيانات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }
}