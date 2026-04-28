<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\MealOrderItem;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Customer;
use App\Models\SavedMeal;
use App\Models\Meal;
use App\Models\Category;
use App\Models\User;
use App\Models\Treasury;
use App\Models\TreasuryTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;
use App\Models\MealIngredient;
use App\Models\MealProductIngredient;
use App\Models\CustomerCreditMovement;
use App\Models\SystemNotification;
use App\Models\StaffActivity;
use App\Support\ActivityLogger;

class OrderController extends Controller
{
    
    /**
     * بيع منتجات عادية
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'nullable|exists:customers,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable|integer|min:1',
            'items.*.name' => 'nullable|string|max:255',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.price' => 'required|numeric|min:0',
            'items.*.unit_cost' => 'nullable|numeric|min:0',
            'items.*.sale_type' => 'nullable|string|max:20',
            'items.*.saleType' => 'nullable|string|max:20',
            'items.*.discount' => 'nullable|numeric|min:0',
            'subtotal' => 'required|numeric|min:0',
            'total' => 'required|numeric|min:0',
            
            'payment_method' => 'required|in:cash,app,card,bank_transfer,mixed,credit', // ✅ أضف credit

'paid_amount' => 'required_if:payment_method,!=,credit|numeric|min:0',
            'cash_amount' => 'nullable|numeric|min:0',
            'app_amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:500',
            'discount' => 'nullable|numeric|min:0',
            'customer_name' => 'nullable|string|max:120',
            'cashier_name' => 'nullable|string|max:120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في البيانات المدخلة',
                'errors' => $validator->errors()
            ], 422);
        }

        $paymentValidation = $this->validateAndNormalizeSalePaymentBreakdown(
            strtolower((string) ($request->payment_method ?? 'cash')),
            (float) ($request->paid_amount ?? 0),
            $request->input('cash_amount'),
            $request->input('app_amount')
        );
        if (!$paymentValidation['ok']) {
            return response()->json([
                'success' => false,
                'message' => $paymentValidation['message'],
            ], 422);
        }
        $request->merge([
            'paid_amount' => $paymentValidation['paid_amount'],
            'cash_amount' => $paymentValidation['cash_amount'],
            'app_amount' => $paymentValidation['app_amount'],
        ]);

        try {
            DB::beginTransaction();

            // 1. التحقق من المخزون وحساب الأرباح
            $totalProfit = 0;
            $productsInfo = [];
            
            foreach ($request->items as $item) {
                $product = null;
                if (!empty($item['product_id'])) {
                    $product = Product::whereKey($item['product_id'])->lockForUpdate()->first();
                }
                if (!$product && !empty($item['name'])) {
                    $product = Product::where('name', $item['name'])->lockForUpdate()->first();
                }
                if (!$product) {
                    $fallbackName = !empty($item['name']) ? $item['name'] : ('POS Item ' . ($item['product_id'] ?? 'unknown'));
                    $product = Product::create([
                        'name' => $fallbackName,
                        'price' => $item['price'],
                        'purchase_price' => $item['price'],
                        'cost_price' => $item['price'],
                        'stock' => 0,
                        'is_active' => true,
                    ]);
                }
                
                if (!$product) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'المنتج غير موجود'
                    ], 404);
                }

                // يسمح بالبيع حتى عند نقص المخزون؛ سيظهر النقص بالسالب للمراجعة لاحقاً.
                
                $saleType = strtolower((string) (
                    $item['sale_type']
                    ?? $item['saleType']
                    ?? $product->sale_unit
                    ?? $product->unit
                    ?? 'piece'
                ));
                $requestedQty = (float) ($item['quantity'] ?? 0);
                $stockDeductQty = $product->saleQuantityToInventoryPieces($requestedQty, $saleType);

                $availableStock = (float) ($product->stock ?? 0);
                if ($stockDeductQty > $availableStock + 0.00001) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => "لا يمكن إتمام البيع: الكمية غير كافية للصنف {$product->name}. المتاح {$availableStock}",
                        'error_code' => 'INSUFFICIENT_STOCK',
                        'data' => [
                            'product_id' => $product->id,
                            'product_name' => $product->name,
                            'requested_quantity' => round($stockDeductQty, 4),
                            'available_quantity' => round($availableStock, 4),
                        ],
                    ], 422);
                }

                // تكلفة السطر من طبقات الشراء (FIFO) حتى لا تختلط الكميات القديمة مع الأسعار الجديدة.
                $fifoCost = $this->consumePurchaseLayersForSale($product, $stockDeductQty);
                $lineTotalCost = (float) ($fifoCost['total_cost'] ?? 0);
                $unitCost = $requestedQty > 0 ? ($lineTotalCost / $requestedQty) : 0.0;
                if ($unitCost <= 0.00001) {
                    $unitCost = $product->unitCostForSaleType($saleType);
                }
                if ($unitCost <= 0.00001 && isset($item['unit_cost']) && is_numeric($item['unit_cost'])) {
                    $unitCost = (float) $item['unit_cost'];
                }

                $unitProfit = (float) $item['price'] - $unitCost;
                $itemProfit = $unitProfit * $requestedQty;
                $totalProfit += $itemProfit;

                $productsInfo[] = [
                    'product' => $product,
                    'quantity' => $requestedQty,
                    'stock_deduct_quantity' => $stockDeductQty,
                    'sale_type' => $saleType,
                    'unit_price' => $item['price'],
                    'line_name' => !empty($item['name']) ? $item['name'] : $product->name,
                    'unit_cost' => $unitCost,
                    'line_total_cost' => $lineTotalCost,
                    'item_profit' => $itemProfit,
                    'unit_profit' => $unitProfit
                ];
            }

            // 2. إنشاء رقم الطلب
            $orderCount = Order::whereDate('created_at', today())->count();
            $orderNumber = 'ORD-' . date('Ymd') . '-' . str_pad($orderCount + 1, 4, '0', STR_PAD_LEFT);

            // 3. حساب المبلغ المستحق والحالة
          // 3. حساب المبلغ المستحق والحالة
$totalAmount = $request->total;

// ✅ معالجة خاصة للبيع الآجل
if ($request->payment_method === 'credit') {
    $paidAmount = 0;
    $dueAmount = $totalAmount;
    $status = 'pending';
} else {
    $paidAmount = $request->paid_amount;
    $dueAmount = max(0, $totalAmount - $paidAmount);
    
    $status = 'pending';
    if ($paidAmount >= $totalAmount) {
        $status = 'paid';
    } elseif ($paidAmount > 0) {
        $status = 'partially_paid';
    }
}
$status = $this->normalizeOrderStatusForStorage($status);

            // 4. إنشاء الطلب
            $resolvedCreatedBy = auth()->id();
            if (!$resolvedCreatedBy && $request->filled('cashier_name')) {
                $cashierLookup = trim((string) $request->input('cashier_name'));
                if ($cashierLookup !== '') {
                    $u = User::query()
                        ->where('username', $cashierLookup)
                        ->orWhere('name', $cashierLookup)
                        ->first();
                    if ($u) {
                        $resolvedCreatedBy = $u->id;
                    }
                }
            }
            if (!$resolvedCreatedBy) {
                $resolvedCreatedBy = 1;
            }

            $orderNotes = $this->buildOrderNotesWithMeta(
                (string) ($request->notes ?? ''),
                $request->input('customer_name'),
                $request->input('cashier_name')
            );

            $order = Order::create([
                'order_number' => $orderNumber,
                'customer_id' => $request->customer_id,
                'subtotal' => $request->subtotal,
                'discount' => $request->discount ?? 0,
                'total' => $totalAmount,
                'paid_amount' => $paidAmount,
                'due_amount' => $dueAmount,
'payment_method' => $this->normalizePaymentMethod($request->payment_method),
                'status' => $status,
                'notes' => $orderNotes,
                'created_by' => $resolvedCreatedBy,
                'total_profit' => $totalProfit, 
            ]);
            $this->recordCreditSaleMovement($order, $dueAmount, $request->input('customer_name'));

            // 5. إضافة العناصر وخصم المخزون
            foreach ($productsInfo as $productInfo) {
                $product = $productInfo['product'];
                $quantity = (float) ($productInfo['quantity'] ?? 0);
                $stockDeductQuantity = (float) ($productInfo['stock_deduct_quantity'] ?? $quantity);
                $unitPrice = (float) ($productInfo['unit_price'] ?? 0);
                
                // إنشاء عنصر الطلب
                OrderItem::create([
                    'order_id' => $order->id,
                    'item_id' => $product->id,
                    'item_type' => Product::class,
                    'item_name' => $productInfo['line_name'] ?? $product->name,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'unit_cost' => $productInfo['unit_cost'],
                    'unit_profit' => $productInfo['unit_profit'],
                    'item_profit' => $productInfo['item_profit'],
                    'discount' => 0,
                    'total_price' => $quantity * $unitPrice,
                ]);

                // خصم من المخزون
                $product->stock -= $stockDeductQuantity;
                $product->save();
            }

            // 6. تحديث الخزنة (كاش + تطبيق + مختلط)
            if ($paidAmount > 0) {
                $this->updateTreasury(
                    $order,
                    $paidAmount,
                    $totalProfit,
                    $request->payment_method,
                    'product',
                    $request->input('cash_amount'),
                    $request->input('app_amount')
                );
            }

            try {
                if (Schema::hasTable('system_notifications')) {
                    SystemNotification::create([
                        'type' => 'sale',
                        'pref_category' => 'sale',
                        'title' => 'تم تسجيل عملية بيع',
                        'message' => 'فاتورة ' . ($order->order_number ?? $order->id) . ' بقيمة ' . number_format((float) $order->total, 2),
                        'details' => 'المدفوع: ' . number_format((float) $order->paid_amount, 2) .
                            "\nالمتبقي: " . number_format((float) $order->due_amount, 2) .
                            "\nعدد الأصناف: " . count($request->items ?? []),
                        'from_management' => false,
                        'management_label' => null,
                        'recipients_type' => 'all',
                        'created_by' => auth()->id() ?: null,
                    ]);
                }
            } catch (\Throwable $notificationError) {
                Log::warning('Failed to create sale notification', [
                    'order_id' => $order->id ?? null,
                    'error' => $notificationError->getMessage(),
                ]);
            }

            ActivityLogger::log($request, [
                'action_type' => 'sale_create',
                'entity_type' => 'order',
                'entity_id' => $order->id,
                'description' => "تنفيذ عملية بيع {$order->order_number}",
                'meta' => [
                    'total' => (float) $order->total,
                    'total_profit' => (float) ($order->total_profit ?? 0),
                    'paid' => (float) $order->paid_amount,
                    'due' => (float) $order->due_amount,
                    'items_count' => count($request->items ?? []),
                    'total_quantity' => collect($request->items ?? [])->sum(fn ($it) => (float) ($it['quantity'] ?? 0)),
                ],
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'تم إتمام البيع بنجاح',
                'data' => [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'total' => $order->total,
                    'paid' => $order->paid_amount,
                    'due' => $order->due_amount,
                    'status' => $order->status,
                    'customer_name' => $this->extractMetaFromNotes($order->notes)['customer_name'] ?? null,
                    'cashier_name' => $this->extractMetaFromNotes($order->notes)['cashier_name'] ?? null,
                    'items_count' => count($request->items),
                    'total_profit' => $totalProfit,
                    'profit_percentage' => $totalAmount > 0 ? round(($totalProfit / $totalAmount) * 100, 2) : 0,
                ]
            ], 201);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Order store error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء إتمام البيع',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }


/**
 * تطبيع طريقة الدفع لتتوافق مع قيم ENUM في قاعدة البيانات
 */
private function normalizePaymentMethod($method)
{
    $method = strtolower(trim((string) $method));
    
    // قائمة القيم المسموحة في قاعدة البيانات حالياً
    $allowedValues = ['cash', 'app', 'card', 'bank_transfer', 'credit'];
    
    // إذا كانت القيمة مسموحة، أرجعها كما هي
    if (in_array($method, $allowedValues)) {
        return $method;
    }
    
    // إذا كانت 'mixed'، حولها إلى 'cash' (لأن cash_amount و app_amount مرسلة)
    if ($method === 'mixed') {
        return 'cash';
    }
    
    // أي قيمة أخرى، افتراضياً 'cash'
    return 'cash';
}

/**
 * تقرير تفصيلي للوجبات المباعة
 */
public function mealSalesReport(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'meal_id' => 'nullable|exists:meals,id',
            'category_id' => 'nullable|exists:categories,id',
            'type' => 'nullable|in:ready,ingredient_based,all',
            'limit' => 'nullable|integer|min:1|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $startDate = $request->get('start_date', now()->startOfMonth());
        $endDate = $request->get('end_date', now()->endOfMonth());
        $type = $request->get('type', 'all');
        $limit = $request->get('limit', 100);

        // ===== 1. الوجبات الجاهزة (READY-) =====
        $readyMealsQuery = MealOrderItem::whereHas('order', function ($query) use ($startDate, $endDate) {
            $query->where('order_number', 'LIKE', 'READY-%')
                  ->whereBetween('orders.created_at', [$startDate, $endDate]);
        })->with(['meal.category']);

        // ===== 2. الوجبات بالمكونات (MEAL-) =====
        $ingredientMealsQuery = MealOrderItem::whereHas('order', function ($query) use ($startDate, $endDate) {
            $query->where('order_number', 'LIKE', 'MEAL-%')
                  ->whereBetween('orders.created_at', [$startDate, $endDate]);
        })->with(['meal.category']);

        // فلترة حسب الوجبة
        if ($request->has('meal_id')) {
            $readyMealsQuery->where('meal_id', $request->meal_id);
            $ingredientMealsQuery->where('meal_id', $request->meal_id);
        }

        // فلترة حسب القسم
        if ($request->has('category_id')) {
            $readyMealsQuery->whereHas('meal', function ($q) use ($request) {
                $q->where('category_id', $request->category_id);
            });
            $ingredientMealsQuery->whereHas('meal', function ($q) use ($request) {
                $q->where('category_id', $request->category_id);
            });
        }

        // جلب البيانات حسب النوع
        $readyMeals = collect();
        $ingredientMeals = collect();

        if ($type === 'all' || $type === 'ready') {
            $readyMeals = $readyMealsQuery->orderBy('created_at', 'desc')
                                         ->limit($limit)
                                         ->get()
                                         ->map(function ($item) {
                                            return [
                                                'id' => $item->id,
                                                'order_id' => $item->order_id,
                                                'order_number' => $item->order->order_number ?? 'N/A',
                                                'meal_id' => $item->meal_id,
                                                'meal_name' => $item->meal_name,
                                                'category' => $item->meal->category->name ?? 'غير محدد',
                                                'quantity' => $item->quantity,
                                                'unit_price' => $item->unit_price,
                                                'unit_cost' => $item->unit_cost,
                                                'unit_profit' => $item->unit_profit,
                                                'total_price' => $item->total_price,
                                                'total_profit' => $item->total_profit,
                                                'sold_at' => $item->created_at->format('Y-m-d H:i'),
                                                'type' => 'ready',
                                            ];
                                         });
        }

        if ($type === 'all' || $type === 'ingredient_based') {
            $ingredientMeals = $ingredientMealsQuery->orderBy('created_at', 'desc')
                                                   ->limit($limit)
                                                   ->get()
                                                   ->map(function ($item) {
                                                      return [
                                                          'id' => $item->id,
                                                          'order_id' => $item->order_id,
                                                          'order_number' => $item->order->order_number ?? 'N/A',
                                                          'meal_id' => $item->meal_id,
                                                          'meal_name' => $item->meal_name,
                                                          'category' => $item->meal->category->name ?? 'غير محدد',
                                                          'quantity' => $item->quantity,
                                                          'unit_price' => $item->unit_price,
                                                          'unit_cost' => $item->unit_cost,
                                                          'unit_profit' => $item->unit_profit,
                                                          'total_price' => $item->total_price,
                                                          'total_profit' => $item->total_profit,
                                                          'sold_at' => $item->created_at->format('Y-m-d H:i'),
                                                          'type' => 'ingredient_based',
                                                      ];
                                                   });
        }

        // دمج النتائج
        $allSales = $readyMeals->concat($ingredientMeals)->sortByDesc('sold_at')->values();

        // ===== إحصائيات عامة =====
        $totalReadyMeals = $readyMeals->sum('quantity');
        $totalIngredientMeals = $ingredientMeals->sum('quantity');
        
        $totalReadyRevenue = $readyMeals->sum('total_price');
        $totalIngredientRevenue = $ingredientMeals->sum('total_price');
        
        $totalReadyProfit = $readyMeals->sum('total_profit');
        $totalIngredientProfit = $ingredientMeals->sum('total_profit');

        // ===== أفضل الوجبات مبيعاً =====
        $topSellingMeals = MealOrderItem::join('orders', 'meal_order_items.order_id', '=', 'orders.id')
            ->whereBetween('orders.created_at', [$startDate, $endDate])
            ->select([
                'meal_order_items.meal_id',
                'meal_order_items.meal_name',
                DB::raw('SUM(meal_order_items.quantity) as total_quantity_sold'),
                DB::raw('COUNT(DISTINCT meal_order_items.order_id) as total_orders'),
                DB::raw('SUM(meal_order_items.total_price) as total_revenue'),
                DB::raw('SUM(meal_order_items.total_profit) as total_profit'),
                DB::raw('AVG(meal_order_items.unit_price) as avg_price'),
                DB::raw('AVG(meal_order_items.unit_profit) as avg_profit')
            ])
            ->groupBy('meal_order_items.meal_id', 'meal_order_items.meal_name')
            ->orderBy('total_quantity_sold', 'desc')
            ->limit(10)
            ->get();

        // ===== المبيعات حسب اليوم =====
        $dailySales = MealOrderItem::join('orders', 'meal_order_items.order_id', '=', 'orders.id')
            ->whereBetween('orders.created_at', [$startDate, $endDate])
            ->select([
                DB::raw('DATE(orders.created_at) as date'),
                DB::raw('SUM(CASE WHEN orders.order_number LIKE "READY-%" THEN meal_order_items.quantity ELSE 0 END) as ready_meals_count'),
                DB::raw('SUM(CASE WHEN orders.order_number LIKE "MEAL-%" THEN meal_order_items.quantity ELSE 0 END) as ingredient_meals_count'),
                DB::raw('SUM(CASE WHEN orders.order_number LIKE "READY-%" THEN meal_order_items.total_price ELSE 0 END) as ready_revenue'),
                DB::raw('SUM(CASE WHEN orders.order_number LIKE "MEAL-%" THEN meal_order_items.total_price ELSE 0 END) as ingredient_revenue'),
                DB::raw('SUM(meal_order_items.total_price) as total_revenue'),
                DB::raw('SUM(meal_order_items.total_profit) as total_profit')
            ])
            ->groupBy('date')
            ->orderBy('date', 'desc')
            ->get();

        // ===== إحصائيات حسب القسم =====
        $categoryStats = MealOrderItem::join('orders', 'meal_order_items.order_id', '=', 'orders.id')
            ->join('meals', 'meal_order_items.meal_id', '=', 'meals.id')
            ->join('categories', 'meals.category_id', '=', 'categories.id')
            ->whereBetween('orders.created_at', [$startDate, $endDate])
            ->select([
                'categories.id as category_id',
                'categories.name as category_name',
                DB::raw('COUNT(DISTINCT meal_order_items.meal_id) as meals_count'),
                DB::raw('SUM(meal_order_items.quantity) as total_quantity_sold'),
                DB::raw('SUM(meal_order_items.total_price) as total_revenue'),
                DB::raw('SUM(meal_order_items.total_profit) as total_profit'),
                DB::raw('AVG(meal_order_items.unit_profit) as avg_profit_per_meal')
            ])
            ->groupBy('categories.id', 'categories.name')
            ->orderBy('total_quantity_sold', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'تم جلب تقرير المبيعات بنجاح',
            'data' => [
                'period' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'days' => now()->parse($startDate)->diffInDays(now()->parse($endDate)) + 1
                ],
                'summary' => [
                    'total_meals_sold' => $totalReadyMeals + $totalIngredientMeals,
                    'total_revenue' => $totalReadyRevenue + $totalIngredientRevenue,
                    'total_profit' => $totalReadyProfit + $totalIngredientProfit,
                    'profit_margin' => ($totalReadyRevenue + $totalIngredientRevenue) > 0 
                        ? round((($totalReadyProfit + $totalIngredientProfit) / ($totalReadyRevenue + $totalIngredientRevenue)) * 100, 2) 
                        : 0,
                    
                    'ready_meals' => [
                        'count' => $totalReadyMeals,
                        'revenue' => $totalReadyRevenue,
                        'profit' => $totalReadyProfit,
                        'percentage_of_total' => ($totalReadyMeals + $totalIngredientMeals) > 0 
                            ? round(($totalReadyMeals / ($totalReadyMeals + $totalIngredientMeals)) * 100, 2) 
                            : 0
                    ],
                    
                    'ingredient_meals' => [
                        'count' => $totalIngredientMeals,
                        'revenue' => $totalIngredientRevenue,
                        'profit' => $totalIngredientProfit,
                        'percentage_of_total' => ($totalReadyMeals + $totalIngredientMeals) > 0 
                            ? round(($totalIngredientMeals / ($totalReadyMeals + $totalIngredientMeals)) * 100, 2) 
                            : 0
                    ]
                ],
                'sales_details' => $allSales,
                'top_selling_meals' => $topSellingMeals,
                'daily_sales' => $dailySales,
                'category_stats' => $categoryStats,
                'filters_applied' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'meal_id' => $request->get('meal_id'),
                    'category_id' => $request->get('category_id'),
                    'type' => $type
                ]
            ]
        ]);

    } catch (\Exception $e) {
        Log::error('Meal sales report error: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب تقرير المبيعات',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}


/**
 * تقرير المبيعات المفصل (يومي، أسبوعي، شهري)
 */
public function salesDetailedReport(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'period' => 'required|in:daily,weekly,monthly,custom',
            'start_date' => 'required_if:period,custom|date',
            'end_date' => 'required_if:period,custom|date|after_or_equal:start_date',
            'type' => 'nullable|in:all,meal,product',
            'category_id' => 'nullable|exists:categories,id',
            'meal_id' => 'nullable|exists:meals,id',
            'product_id' => 'nullable|exists:products,id',
            'customer_id' => 'nullable|exists:customers,id',
            'employee_id' => 'nullable|exists:customers,id',
            'payment_method' => 'nullable|in:cash,app,card,bank_transfer,mixed',
            'status' => 'nullable|in:paid,partially_paid,pending,cancelled,returned'
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

        // بناء الاستعلام الأساسي للطلبات
        $ordersQuery = Order::with([
            'customer:id,name,phone',
            'createdBy:id,username'
        ])
        ->whereBetween('created_at', [$startDate, $endDate]);

        // تطبيق الفلاتر
        if ($request->type && $request->type !== 'all') {
            if ($request->type === 'meal') {
                $ordersQuery->where('order_number', 'LIKE', 'MEAL-%');
            } elseif ($request->type === 'product') {
                $ordersQuery->where('order_number', 'LIKE', 'ORD-%');
            }
        }

        if ($request->customer_id) {
            $ordersQuery->where('customer_id', $request->customer_id);
        }

        if ($request->employee_id) {
            $ordersQuery->where('created_by', $request->employee_id);
        }

        if ($request->payment_method) {
            $ordersQuery->where('payment_method', $request->payment_method);
        }

        if ($request->status) {
            $ordersQuery->where('status', $request->status);
        }

        // فلترة حسب المنتج/الوجبة (يتطلب join)
        if ($request->meal_id || $request->product_id || $request->category_id) {
            $ordersQuery->where(function($query) use ($request) {
                if ($request->meal_id) {
                    $query->whereHas('mealItems', function($q) use ($request) {
                        $q->where('meal_id', $request->meal_id);
                    });
                }
                
                if ($request->product_id) {
                    $query->whereHas('items', function($q) use ($request) {
                        $q->where('product_id', $request->product_id);
                    });
                }
                
                if ($request->category_id) {
                    $query->whereHas('mealItems.meal', function($q) use ($request) {
                        $q->where('category_id', $request->category_id);
                    })->orWhereHas('items.product', function($q) use ($request) {
                        $q->where('category_id', $request->category_id);
                    });
                }
            });
        }

        // جلب الطلبات
        $orders = $ordersQuery->orderBy('created_at', 'desc')->get();

        // تجهيز بيانات الطلبات التفصيلية
        $ordersData = [];
        $totalSales = 0;
        $totalProfit = 0;
        $totalCost = 0;
        $totalOrders = $orders->count();

        foreach ($orders as $order) {
            $orderItems = [];
            $orderTotal = $order->total;
            $orderProfit = $order->total_profit ?? 0;
            $orderCost = $orderTotal - $orderProfit; // سيُحدَّث لاحقاً من الأصناف إن وُجدت

            $totalSales += $orderTotal;
            $totalProfit += $orderProfit;

            // جلب عناصر الوجبات إذا كانت موجودة
            if (str_starts_with($order->order_number, 'MEAL-')) {
                $mealItems = MealOrderItem::where('order_id', $order->id)
                    ->with([
                        'meal.category',
                        'meal.productIngredients.product',
                        'selectedOptions'
                    ])
                    ->get();

                foreach ($mealItems as $item) {
                    $meal = $item->meal;
                    // مكونات من meal_ingredients (أقسام)
                    $ingredients = MealIngredient::where('meal_id', $item->meal_id)
                        ->with('category')
                        ->get();

                    $ingredientsList = [];
                    foreach ($ingredients as $ing) {
                        if ($ing->category) {
                            // إذا كانت تكلفة المكون صفراً، استخدم تكلفة القسم (المخزون)
                            $unitCost = (float) ($ing->unit_cost ?? 0);
                            if ($unitCost <= 0 && ($ing->category->cost_price ?? 0) > 0) {
                                $unitCost = (float) $ing->category->cost_price;
                            }
                            $qtyUsed = (float) $ing->quantity * $item->quantity;
                            $ingTotalCost = $qtyUsed * $unitCost;
                            $ingredientsList[] = [
                                'name' => $ing->category->name,
                                'quantity_used' => $qtyUsed,
                                'unit' => $ing->unit ?? 'قطعة',
                                'unit_cost' => $unitCost,
                                'total_cost' => $ingTotalCost
                            ];
                        }
                    }

                    // مكونات من أصناف المشتريات (وجبات من إنشاء من منتجات)
                    $productIngredients = $meal ? MealProductIngredient::where('meal_id', $meal->id)->with('product')->get() : collect();
                    foreach ($productIngredients as $pi) {
                        $qty = (float) $pi->quantity_used * $item->quantity;
                        $product = $pi->product;
                        $unitCost = $product ? (float) ($product->cost_price ?? $product->purchase_price ?? 0) : 0;
                        $ingredientsList[] = [
                            'name' => $product ? $product->name : 'صنف #' . $pi->product_id,
                            'quantity_used' => $qty,
                            'unit' => $product && $product->unit ? $product->unit : 'وحدة',
                            'unit_cost' => $unitCost,
                            'total_cost' => $qty * $unitCost
                        ];
                    }

                    // جلب الخيارات المختارة
                    $selectedOptions = [];
                    if ($item->selectedOptions) {
                        foreach ($item->selectedOptions as $option) {
                            $selectedOptions[] = [
                                'id' => $option->id,
                                'name' => $option->name,
                                'price' => $option->price,
                                'additional_cost' => $option->additional_cost ?? 0,
                                'group_name' => $option->group_name ?? 'أخرى'
                            ];
                        }
                    }

                    // كلف الصنف = مجموع تكلفة المكونات إن وُجد، وإلا من (البيع - الربح)
                    $itemsCostFromIngredients = array_sum(array_column($ingredientsList, 'total_cost'));
                    $itemTotalCost = $itemsCostFromIngredients > 0
                        ? $itemsCostFromIngredients
                        : ($item->total_price - $item->total_profit);

                    $orderItems[] = [
                        'type' => 'meal',
                        'id' => $item->meal_id,
                        'name' => $item->meal_name,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->unit_price,
                        'unit_cost' => $item->unit_cost,
                        'unit_profit' => $item->unit_profit,
                        'total_price' => $item->total_price,
                        'total_profit' => $item->total_profit,
                        'total_cost' => $itemTotalCost,
                        'category' => $item->meal->category->name ?? 'غير محدد',
                        'ingredients' => $ingredientsList,
                        'ingredients_count' => count($ingredientsList),
                        'options' => $selectedOptions, // ✅ إضافة الخيارات هنا
                        'has_options' => count($selectedOptions) > 0 // ✅ مؤشر إذا كان هناك خيارات
                    ];
                }
            } 
            // جلب عناصر المنتجات
            else {
                $productItems = OrderItem::where('order_id', $order->id)
                    ->with('product.category')
                    ->get();

                foreach ($productItems as $item) {
                    $orderItems[] = [
                        'type' => 'product',
                        'id' => $item->product_id,
                        'name' => $item->product_name,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->unit_price,
                        'unit_cost' => $item->unit_cost,
                        'unit_profit' => $item->unit_profit,
                        'total_price' => $item->total_price,
                        'total_profit' => $item->item_profit,
                        'total_cost' => $item->total_price - ($item->item_profit ?? 0),
                        'category' => $item->product->category->name ?? 'غير محدد',
                        'ingredients' => [],
                        'options' => [], // المنتجات العادية ليس لها خيارات
                        'has_options' => false
                    ];
                }
            }

            // إجمالي تكلفة الطلب = مجموع تكلفة الأصناف (ليتطابق مع كلف المكونات)
            $orderCost = array_sum(array_column($orderItems, 'total_cost'));
            $totalCost += $orderCost;

            // التحقق من وجود أي عنصر في الطلب يحتوي على خيارات
            $orderHasOptions = collect($orderItems)->contains(function($item) {
                return count($item['options']) > 0;
            });

            $ordersData[] = [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'date' => $order->created_at->format('Y-m-d'),
                'time' => $order->created_at->format('H:i:s'),
                'datetime' => $order->created_at->format('Y-m-d H:i:s'),
                'customer' => $order->customer ? $order->customer->name : 'زبون نقدي',
                'customer_phone' => $order->customer ? $order->customer->phone : null,
                'employee' => $order->createdBy ? $order->createdBy->name : 'غير معروف',
                'subtotal' => $order->subtotal,
                'discount' => $order->discount,
                'total' => $order->total,
                'paid' => $order->paid_amount,
                'due' => $order->due_amount,
                'payment_method' => $order->payment_method,
                'status' => $order->status,
                'total_cost' => $orderCost,
                'total_profit' => $orderProfit,
                'profit_margin' => $orderTotal > 0 ? round(($orderProfit / $orderTotal) * 100, 2) : 0,
                'items_count' => count($orderItems),
                'items' => $orderItems,
                'has_options' => $orderHasOptions, // ✅ إضافة مؤشر على مستوى الطلب
                'notes' => $order->notes
            ];
        }

        // ===== إحصائيات المبيعات =====
        $stats = [
            'period' => [
                'type' => $period,
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
                'days' => $startDate->diffInDays($endDate) + 1
            ],
            'summary' => [
                'total_orders' => $totalOrders,
                'total_sales' => $totalSales,
                'total_profit' => $totalProfit,
                'total_cost' => $totalCost,
                'average_order_value' => $totalOrders > 0 ? round($totalSales / $totalOrders, 2) : 0,
                'average_profit_per_order' => $totalOrders > 0 ? round($totalProfit / $totalOrders, 2) : 0,
                'profit_margin' => $totalSales > 0 ? round(($totalProfit / $totalSales) * 100, 2) : 0,
                'collection_rate' => $totalSales > 0 ? round((array_sum(array_column($ordersData, 'paid')) / $totalSales) * 100, 2) : 0,
                'pending_amount' => array_sum(array_column($ordersData, 'due'))
            ]
        ];

        // ===== تحليل حسب طريقة الدفع =====
        $paymentMethodStats = $orders->groupBy('payment_method')->map(function($group) {
            return [
                'count' => $group->count(),
                'total' => $group->sum('total'),
                'paid' => $group->sum('paid_amount'),
                'due' => $group->sum('due_amount'),
                'profit' => $group->sum('total_profit')
            ];
        });

        if (!$orders instanceof \Illuminate\Support\Collection) {
            $orders = collect($orders);
        }
        
        // ===== تحليل حسب الحالة =====
        $statusStats = $orders->groupBy('status')->map(function($group) {
            return [
                'count' => $group->count(),
                'total' => $group->sum('total'),
                'paid' => $group->sum('paid_amount'),
                'due' => $group->sum('due_amount'),
                'profit' => $group->sum('total_profit')
            ];
        });

        // ===== أفضل العملاء =====
        $topCustomers = $orders->groupBy('customer_id')
            ->map(function($group) {
                $customer = $group->first()->customer;
                return [
                    'customer_id' => $group->first()->customer_id,
                    'customer_name' => $customer ? $customer->name : 'زبون نقدي',
                    'orders_count' => $group->count(),
                    'total_spent' => $group->sum('total'),
                    'total_paid' => $group->sum('paid_amount'),
                    'total_due' => $group->sum('due_amount'),
                    'total_profit' => $group->sum('total_profit')
                ];
            })
            ->sortByDesc('total_spent')
            ->values()
            ->take(10);

        // ===== أفضل الموظفين =====
        $topEmployees = $orders->groupBy('created_by')
            ->map(function($group) {
                $employee = $group->first()->createdBy;
                return [
                    'employee_id' => $group->first()->created_by,
                    'employee_name' => $employee ? $employee->name : 'غير معروف',
                    'orders_count' => $group->count(),
                    'total_sales' => $group->sum('total'),
                    'total_profit' => $group->sum('total_profit'),
                    'average_sale' => round($group->sum('total') / $group->count(), 2)
                ];
            })
            ->sortByDesc('total_sales')
            ->values()
            ->take(10);

        // ===== أفضل المنتجات/الوجبات (مع الخيارات) =====
        $topItems = collect();

        // جمع الوجبات مع تضمين الخيارات
        $mealItems = MealOrderItem::whereHas('order', function($q) use ($startDate, $endDate) {
            $q->whereBetween('created_at', [$startDate, $endDate]);
        })
        ->with('selectedOptions') // ✅ جلب الخيارات
        ->select([
            'meal_id',
            'meal_name',
            DB::raw('SUM(quantity) as total_quantity'),
            DB::raw('SUM(total_price) as total_revenue'),
            DB::raw('SUM(total_profit) as total_profit'),
            DB::raw('COUNT(DISTINCT order_id) as orders_count')
        ])
        ->groupBy('meal_id', 'meal_name')
        ->get()
        ->map(function($item) {
            // ✅ التحقق مما إذا كان لهذه الوجبة خيارات في أي طلب
            $hasOptions = $item->selectedOptions && $item->selectedOptions->count() > 0;
            
            return [
                'type' => 'meal',
                'id' => $item->meal_id,
                'name' => $item->meal_name,
                'total_quantity' => $item->total_quantity,
                'total_revenue' => $item->total_revenue,
                'total_profit' => $item->total_profit,
                'orders_count' => $item->orders_count,
                'has_options' => $hasOptions // ✅ إضافة مؤشر
            ];
        });

        // جمع المنتجات
        $productItems = OrderItem::whereHas('order', function($q) use ($startDate, $endDate) {
            $q->whereBetween('created_at', [$startDate, $endDate]);
        })
        ->where('item_type', 'App\\Models\\Product')
        ->select([
            'item_id',
            'item_name as product_name',
            DB::raw('SUM(quantity) as total_quantity'),
            DB::raw('SUM(total_price) as total_revenue'),
            DB::raw('SUM(item_profit) as total_profit'),
            DB::raw('COUNT(DISTINCT order_id) as orders_count')
        ])
        ->groupBy('item_id', 'item_name')
        ->get()
        ->map(function($item) {
            return [
                'type' => 'product',
                'id' => $item->item_id,
                'name' => $item->product_name,
                'total_quantity' => $item->total_quantity,
                'total_revenue' => $item->total_revenue,
                'total_profit' => $item->total_profit,
                'orders_count' => $item->orders_count,
                'has_options' => false // المنتجات ليس لها خيارات
            ];
        });

        $topItems = $mealItems->concat($productItems)
            ->sortByDesc('total_revenue')
            ->values()
            ->take(20);

        return response()->json([
            'success' => true,
            'message' => 'تم جلب تقرير المبيعات بنجاح',
            'data' => [
                'filters' => $request->all(),
                'stats' => $stats,
                'orders' => $ordersData,
                'analysis' => [
                    'by_payment_method' => $paymentMethodStats,
                    'by_status' => $statusStats,
                    'top_customers' => $topCustomers,
                    'top_employees' => $topEmployees,
                    'top_items' => $topItems
                ],
                'charts' => [
                    'daily' => $this->getDailySalesChart($startDate, $endDate),
                    'hourly' => $this->getHourlySalesChart($startDate, $endDate)
                ]
            ]
        ]);

    } catch (\Exception $e) {
        Log::error('خطأ في تقرير المبيعات: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString()
        ]);

        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب تقرير المبيعات',
            'error' => config('app.debug') ? $e->getMessage() : null
        ], 500);
    }
}
/**
 * دالة مساعدة: المبيعات اليومية
 */
private function getDailySalesChart($startDate, $endDate)
{
    try {
        $dailySales = Order::whereBetween('created_at', [$startDate, $endDate])
            ->select([
                DB::raw('DATE(created_at) as date'),
                DB::raw('COUNT(*) as orders_count'),
                DB::raw('SUM(total) as total_sales'),
                DB::raw('SUM(total_profit) as total_profit')
            ])
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // التحقق من أن النتيجة Collection
        if (!$dailySales instanceof \Illuminate\Support\Collection) {
            $dailySales = collect($dailySales);
        }

        return [
            'labels' => $dailySales->pluck('date')->values()->toArray(),
            'datasets' => [
                [
                    'label' => 'عدد الطلبات',
                    'data' => $dailySales->pluck('orders_count')->values()->toArray()
                ],
                [
                    'label' => 'المبيعات',
                    'data' => $dailySales->pluck('total_sales')->values()->map(function($value) {
                        return (float) $value;
                    })->toArray()
                ],
                [
                    'label' => 'الأرباح',
                    'data' => $dailySales->pluck('total_profit')->values()->map(function($value) {
                        return (float) $value;
                    })->toArray()
                ]
            ]
        ];
    } catch (\Exception $e) {
        \Log::error('خطأ في getDailySalesChart: ' . $e->getMessage());
        
        // إرجاع بيانات افتراضية في حالة الخطأ
        return [
            'labels' => [],
            'datasets' => [
                ['label' => 'عدد الطلبات', 'data' => []],
                ['label' => 'المبيعات', 'data' => []],
                ['label' => 'الأرباح', 'data' => []]
            ]
        ];
    }
}

/**
 * دالة مساعدة: المبيعات حسب الساعة
 */
private function getHourlySalesChart($startDate, $endDate)
{
    try {
        $hourlySales = Order::whereBetween('created_at', [$startDate, $endDate])
            ->select([
                DB::raw('HOUR(created_at) as hour'),
                DB::raw('COUNT(*) as orders_count'),
                DB::raw('SUM(total) as total_sales')
            ])
            ->groupBy('hour')
            ->orderBy('hour')
            ->get();

        // التحقق من أن النتيجة Collection
        if (!$hourlySales instanceof \Illuminate\Support\Collection) {
            $hourlySales = collect($hourlySales);
        }

        $hours = range(0, 23);
        $salesData = array_fill(0, 24, 0);
        $ordersData = array_fill(0, 24, 0);

        foreach ($hourlySales as $sale) {
            if (isset($sale->hour) && is_numeric($sale->hour) && $sale->hour >= 0 && $sale->hour <= 23) {
                $salesData[(int)$sale->hour] = (float)($sale->total_sales ?? 0);
                $ordersData[(int)$sale->hour] = (int)($sale->orders_count ?? 0);
            }
        }

        return [
            'labels' => $hours,
            'datasets' => [
                [
                    'label' => 'المبيعات',
                    'data' => $salesData
                ],
                [
                    'label' => 'الطلبات',
                    'data' => $ordersData
                ]
            ]
        ];
    } catch (\Exception $e) {
        \Log::error('خطأ في getHourlySalesChart: ' . $e->getMessage());
        
        // إرجاع بيانات افتراضية في حالة الخطأ
        return [
            'labels' => range(0, 23),
            'datasets' => [
                ['label' => 'المبيعات', 'data' => array_fill(0, 24, 0)],
                ['label' => 'الطلبات', 'data' => array_fill(0, 24, 0)]
            ]
        ];
    }
}
/**
 * شراء أقسام فرعية (مشتريات)
 */
public function purchaseCategories(Request $request)
{
    // ✅ الأهم: استقبال البيانات بشكل صحيح
    $data = $request->json()->all();
    
    // إذا كانت البيانات فارغة، جرب request->all()
    if (empty($data)) {
        $data = $request->all();
    }

    // ✅ التحقق من البيانات
    $validator = Validator::make($data, [
        'items' => 'required|array|min:1',
        'items.*.category_id' => 'required|exists:categories,id',
        'items.*.quantity' => 'required|numeric|min:0.01',
        'items.*.cost_price' => 'required|numeric|min:0',
        'items.*.sale_price' => 'nullable|numeric|min:0',
        'items.*.profit_margin' => 'nullable|numeric|min:0',
        'payment_method' => 'required|in:cash,app,card,bank_transfer',
        'paid_amount' => 'required|numeric|min:0',
        'supplier_id' => 'nullable|exists:suppliers,id',
        'invoice_number' => 'nullable|string|max:100',
        'notes' => 'nullable|string|max:500',
        'purchase_date' => 'nullable|date'
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'خطأ في البيانات المدخلة',
            'errors' => $validator->errors(),
            'received_data' => $data // 👈 هذا سيساعد في التشخيص
        ], 422);
    }

    try {
        DB::beginTransaction();

        $totalAmount = 0;
        $purchasedItems = [];
        $purchaseDetails = [];

        // 1. التحقق من البيانات وحساب الإجماليات
        foreach ($data['items'] as $item) { // 👈 استخدم $data بدلاً من $request
            $category = Category::find($item['category_id']);
            
            if (!$category) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'القسم غير موجود: ' . $item['category_id']
                ], 404);
            }

            // التأكد أن القسم فرعي (لديه parent)
            if (!$category->parent_id) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن شراء قسم رئيسي، يرجى اختيار قسم فرعي: ' . $category->name
                ], 400);
            }

            $itemTotal = $item['cost_price'] * $item['quantity'];
            $totalAmount += $itemTotal;

            // حفظ بيانات قديمة للتقرير
            $oldQuantity = $category->quantity;
            $oldCostPrice = $category->cost_price;
            $oldSalePrice = $category->sale_price;

            $purchasedItems[] = [
                'category' => $category,
                'old_quantity' => $oldQuantity,
                'old_cost_price' => $oldCostPrice,
                'old_sale_price' => $oldSalePrice,
                'quantity' => $item['quantity'],
                'cost_price' => $item['cost_price'],
                'sale_price' => $item['sale_price'] ?? null,
                'profit_margin' => $item['profit_margin'] ?? null,
                'item_total' => $itemTotal
            ];
        }

        // 2. التحقق من رصيد الخزنة
        $treasury = Treasury::first();
        if (!$treasury) {
            $treasury = Treasury::create([
                'balance' => 0,
                'balance_cash' => 0,
                'balance_app' => 0,
                'total_income' => 0,
                'total_expenses' => 0,
                'total_profit' => 0,
            ]);
        }

        $paidAmount = $data['paid_amount']; // 👈 استخدم $data
        // السماح بخصم الخزنة حتى لو أصبح الرصيد سالباً (يُسجَّل في المعاملات)

        // 3. إنشاء رقم فاتورة الشراء
        $purchaseCount = DB::table('category_purchases')->count() + 1;
        $purchaseNumber = 'PUR-' . date('Ymd') . '-' . str_pad($purchaseCount, 4, '0', STR_PAD_LEFT);

        // 4. تحديث الأقسام (إضافة الكمية وتحديث الأسعار)
        foreach ($purchasedItems as $item) {
            $category = $item['category'];
            
            // إضافة الكمية (زيادة)
            $category->quantity += $item['quantity'];
            
            // تحديث سعر التكلفة (المتوسط المرجح)
            $totalCost = ($category->cost_price * ($category->quantity - $item['quantity'])) + ($item['cost_price'] * $item['quantity']);
            $category->cost_price = $totalCost / $category->quantity;
            
            // تحديث سعر البيع إذا تم توفيره
            if ($item['sale_price'] !== null) {
                $category->sale_price = $item['sale_price'];
                $category->auto_calculate = false;
            }
            
            // تحديث هامش الربح إذا تم توفيره
            if ($item['profit_margin'] !== null) {
                $category->profit_margin = $item['profit_margin'];
            }
            
            // إعادة حساب القيم
            $category->recalculateTotals();
            $category->save();
            
            // تجهيز تفاصيل الشراء
            $purchaseDetails[] = [
                'category_id' => $category->id,
                'category_name' => $category->name,
                'old_quantity' => $item['old_quantity'],
                'new_quantity' => $category->quantity,
                'quantity_added' => $item['quantity'],
                'old_cost_price' => $item['old_cost_price'],
                'new_cost_price' => $category->cost_price,
                'cost_price_paid' => $item['cost_price'],
                'old_sale_price' => $item['old_sale_price'],
                'new_sale_price' => $category->sale_price,
                'subtotal' => $item['item_total']
            ];
        }

        // 5. خصم المبلغ من الخزنة (كاش / تطبيق)
        $pmCat = strtolower((string) ($data['payment_method'] ?? 'cash'));
        $tCashCat = 0.0;
        $tAppCat = 0.0;
        if ($paidAmount > 0.00001) {
            if ($pmCat === 'app') {
                $tAppCat = round($paidAmount, 2);
            } elseif (in_array($pmCat, ['cash', 'card', 'bank_transfer'], true)) {
                $tCashCat = round($paidAmount, 2);
            } else {
                $tCashCat = round($paidAmount, 2);
            }
        }
        $treasury->applyLiquidityDelta(-$tCashCat, -$tAppCat);
        $treasury->total_expenses += $paidAmount;
        $treasury->save();

        // 6. تسجيل معاملة الخزنة
        TreasuryTransaction::create([
            'treasury_id' => $treasury->id,
            'type' => 'expense',
            'amount' => $paidAmount,
            'description' => 'شراء مخزون للأقسام - فاتورة: ' . $purchaseNumber,
            'category' => 'inventory_purchase',
            'payment_method' => $data['payment_method'], // 👈 استخدم $data
            'reference_id' => null,
            'reference_type' => 'CategoryPurchase',
            'transaction_date' => $data['purchase_date'] ?? now()->toDateString(),
            'created_by' => auth()->id() ?? 1,
            'notes' => $data['notes'] ?? null
        ]);

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => 'تم شراء الأقسام بنجاح',
            'data' => [
                'purchase_number' => $purchaseNumber,
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'due_amount' => $totalAmount - $paidAmount,
                'payment_method' => $data['payment_method'],
                'purchase_date' => $data['purchase_date'] ?? now()->format('Y-m-d'),
                'items_count' => count($purchasedItems),
                'treasury' => [
                    'new_balance' => $treasury->balance,
                    'amount_deducted' => $paidAmount
                ],
                'items' => $purchaseDetails
            ]
        ], 201);

    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Purchase categories error: ' . $e->getMessage(), [
            'request' => $data,
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء شراء الأقسام',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}


    public function categoryPurchasesReport(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'start_date' => 'nullable|date',
                'end_date' => 'nullable|date|after_or_equal:start_date',
                'category_id' => 'nullable|exists:categories,id'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $startDate = $request->get('start_date', now()->startOfMonth());
            $endDate = $request->get('end_date', now()->endOfMonth());

            // هنا يمكنك جلب تقرير المشتريات من جدول category_purchases إذا كان موجوداً
            // أو يمكنك تحليل حركات الخزنة

            $treasuryTransactions = TreasuryTransaction::where('type', 'expense')
                ->where('category', 'inventory_purchase')
                ->whereBetween('transaction_date', [$startDate, $endDate])
                ->when($request->category_id, function ($query) use ($request) {
                    return $query->where('reference_id', $request->category_id)
                                 ->where('reference_type', 'App\\Models\\Category');
                })
                ->orderBy('transaction_date', 'desc')
                ->get();

            $totalPurchases = $treasuryTransactions->sum('amount');
            $totalTransactions = $treasuryTransactions->count();

            return response()->json([
                'success' => true,
                'message' => 'تم جلب تقرير المشتريات بنجاح',
                'data' => [
                    'period' => [
                        'start_date' => $startDate,
                        'end_date' => $endDate
                    ],
                    'summary' => [
                        'total_purchases' => $totalPurchases,
                        'total_transactions' => $totalTransactions,
                        'average_purchase' => $totalTransactions > 0 ? $totalPurchases / $totalTransactions : 0
                    ],
                    'transactions' => $treasuryTransactions,
                    'filtered_by' => [
                        'category_id' => $request->category_id
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Category purchases report error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب تقرير المشتريات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }






public function sellReadyMeal(Request $request)
{
    $validator = Validator::make($request->json()->all(), [
        'items' => 'required|array|min:1',
        'items.*.meal_id' => 'required|exists:meals,id',
        'items.*.quantity' => 'required|numeric|min:0.01',
        'items.*.price' => 'nullable|numeric|min:0',
        'items.*.options' => 'nullable|array', // ✅ إضافة التحقق من الخيارات
        'items.*.options.*.id' => 'nullable|exists:meal_options,id',
        'items.*.options.*.name' => 'nullable|string',
        'items.*.options.*.price' => 'nullable|numeric|min:0',
        'paid_amount' => 'nullable|numeric|min:0',
        'customer_id' => 'nullable|exists:customers,id',
        'payment_method' => 'nullable|in:cash,app,card,bank_transfer,mixed',
        'cash_amount' => 'nullable|numeric|min:0',
        'app_amount' => 'nullable|numeric|min:0',
        'notes' => 'nullable|string'
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'errors' => $validator->errors()
        ], 422);
    }

    try {
        DB::beginTransaction();

        $totalAmount = 0;
        $totalProfit = 0;
        $totalCost = 0;
        $orderItems = [];
        $soldItemsCount = 0;

        foreach ($request->json('items') as $item) {
            $meal = Meal::find($item['meal_id']);
            
            if (!$meal) {
                continue;
            }
            
            // ✅ حساب سعر الوجبة مع الخيارات
            $basePrice = $meal->sale_price;
            $optionsTotal = 0;
            $selectedOptions = [];
            
            if (!empty($item['options'])) {
                foreach ($item['options'] as $optionData) {
                    $optionsTotal += $optionData['price'] ?? 0;
                    $selectedOptions[] = $optionData;
                }
            }
            
            // السعر النهائي = سعر الوجبة + مجموع أسعار الخيارات
            $finalUnitPrice = $basePrice + $optionsTotal;
            $price = $item['price'] ?? $finalUnitPrice; // استخدام السعر المرسل أو المحسوب
            
            $cost = $meal->cost_price ?? 0;
            
            $itemTotal = $price * $item['quantity'];
            $itemCost = $cost * $item['quantity'];
            $itemProfit = ($price - $cost) * $item['quantity'];
            
            $totalAmount += $itemTotal;
            $totalCost += $itemCost;
            $totalProfit += $itemProfit;
            $soldItemsCount += $item['quantity'];
            
            // تخزين بيانات كاملة للعنصر مع الخيارات
            $orderItems[] = [
                'meal_id' => $meal->id,
                'meal_name' => $meal->name,
                'meal_code' => $meal->code,
                'quantity' => $item['quantity'],
                'unit_price' => $price,
                'unit_cost' => $cost,
                'unit_profit' => $price - $cost,
                'total' => $itemTotal,
                'profit' => $itemProfit,
                'options' => $selectedOptions // ✅ حفظ الخيارات
            ];
        }

        if (empty($orderItems)) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'لا توجد وجبات صالحة للبيع'
            ], 400);
        }

        // إنشاء رقم الطلب
        $orderCount = \App\Models\Order::whereDate('created_at', today())->count();
        $orderNumber = 'MEAL-' . date('Ymd') . '-' . str_pad($orderCount + 1, 4, '0', STR_PAD_LEFT);

        // إنشاء الطلب
        $order = \App\Models\Order::create([
            'order_number' => $orderNumber,
            'customer_id' => $request->json('customer_id'),
            'subtotal' => $totalAmount,
            'total' => $totalAmount,
            'paid_amount' => $request->json('paid_amount') ?? $totalAmount,
            'due_amount' => max(0, $totalAmount - ($request->json('paid_amount') ?? $totalAmount)),
            'payment_method' => $request->json('payment_method') ?? 'cash',
            'status' => 'paid',
            'total_profit' => $totalProfit,
            'notes' => $request->json('notes') ?? 'بيع وجبات جاهزة',
            'created_by' => auth()->id() ?? 1
        ]);

        // ✅ إضافة عناصر الطلب مع الخيارات
        foreach ($orderItems as $item) {
            // إنشاء عنصر الوجبة
            $mealOrderItem = \App\Models\MealOrderItem::create([
                'order_id' => $order->id,
                'meal_id' => $item['meal_id'],
                'meal_name' => $item['meal_name'],
                'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'],
                'unit_cost' => $item['unit_cost'],
                'unit_profit' => $item['unit_profit'],
                'total_price' => $item['total'],
                'total_profit' => $item['profit'],
            ]);
            
            // ✅ حفظ الخيارات المختارة في جدول meal_order_item_options
            if (!empty($item['options'])) {
                foreach ($item['options'] as $optionData) {
                    \App\Models\MealOrderItemOption::create([
                        'meal_order_item_id' => $mealOrderItem->id,
                        'meal_option_id' => $optionData['id'] ?? null,
                        'name' => $optionData['name'],
                        'price' => $optionData['price'] ?? 0,
                        'additional_cost' => $optionData['price'] ?? 0,
                        'group_name' => $optionData['group_name'] ?? 'أخرى'
                    ]);
                }
            }
        }

        $paidAmount = $request->json('paid_amount') ?? $totalAmount;
        $treasury = null;

        if ($paidAmount > 0) {
            $treasury = $this->updateTreasury(
                $order,
                $paidAmount,
                $totalProfit,
                $order->payment_method ?? 'cash',
                'meal',
                $request->json('cash_amount'),
                $request->json('app_amount')
            );
        }

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => '✅ تم بيع ' . $soldItemsCount . ' وجبة بقيمة ' . number_format($totalAmount, 2) . ' شيكل',
            'data' => [
                'order' => [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'date' => $order->created_at->format('Y-m-d H:i'),
                ],
                'sales_summary' => [
                    'total_amount' => $totalAmount,
                    'total_paid' => $paidAmount,
                    'total_profit' => $totalProfit,
                    'total_cost' => $totalCost,
                    'items_sold' => $soldItemsCount,
                    'profit_margin' => $totalAmount > 0 ? round(($totalProfit / $totalAmount) * 100, 2) : 0
                ],
                'items' => $orderItems,
                'treasury_update' => [
                    'balance_added' => $paidAmount,
                    'profit_added' => $totalProfit,
                    'current_balance' => $treasury ? (float) $treasury->balance : (float) (Treasury::first()->balance ?? 0),
                ]
            ]
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Sell ready meal error: ' . $e->getMessage(), [
            'request' => $request->all(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ أثناء عملية البيع',
            'error' => config('app.debug') ? $e->getMessage() : null
        ], 500);
    }
}

    /**
     * ✅ بيع الوجبات (المحدث بالكامل)
     */
    public function sellMeal(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'items' => 'required|array|min:1',
                'items.*.meal_id' => 'required|exists:meals,id',
                'items.*.quantity' => 'required|numeric|min:0.01',
                'items.*.price' => 'nullable|numeric|min:0',
                'items.*.options' => 'nullable|array',
                'items.*.options.*.id' => 'nullable|exists:meal_options,id',
                'items.*.options.*.name' => 'nullable|string',
                'items.*.options.*.price' => 'nullable|numeric|min:0',
                'items.*.options.*.group_name' => 'nullable|string',
                'payment_method' => 'required|in:cash,app,card,bank_transfer,mixed',
                'paid_amount' => 'required|numeric|min:0',
                'cash_amount' => 'nullable|numeric|min:0',
                'app_amount' => 'nullable|numeric|min:0',
                'customer_id' => 'nullable|exists:customers,id',
                'notes' => 'nullable|string|max:500',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'خطأ في البيانات المدخلة',
                    'errors' => $validator->errors()
                ], 422);
            }

            DB::beginTransaction();

            // حساب الإجماليات والتحقق من المخزون
            $total = 0;
            $totalProfit = 0;
            $itemsData = [];
            $stockDeductions = [];
            
            foreach ($request->items as $item) {
                // ⭐ جلب الوجبة مع المكونات
                $meal = Meal::with('ingredients.category')->find($item['meal_id']);
                
                if (!$meal) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'الوجبة غير موجودة: ' . $item['meal_id']
                    ], 404);
                }

                // التحقق من وجود مكونات للوجبة
                if ($meal->ingredients->isEmpty()) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'الوجبة ' . $meal->name . ' لا تحتوي على مكونات'
                    ], 422);
                }

                // التحقق من توفر جميع المكونات بالمخزون
                $ingredientsCheck = $this->checkMealIngredients($meal, $item['quantity']);
                if (!$ingredientsCheck['available']) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'مخزون غير كافي للوجبة: ' . $meal->name,
                        'ingredients' => $ingredientsCheck['unavailable']
                    ], 400);
                }

                // ⭐ سعر البيع: من الطلب أو الوجبة + مجموع أسعار الخيارات
                $optionsTotal = 0;
                if (!empty($item['options'])) {
                    foreach ($item['options'] as $opt) {
                        $optionsTotal += $opt['price'] ?? 0;
                    }
                }
                $price = $item['price'] ?? ($meal->sale_price + $optionsTotal);
                $itemTotal = $price * $item['quantity'];
                $total += $itemTotal;
                
                // ⭐ حساب ربح الوجبة
                $profitPerMeal = $price - $meal->cost_price;
                $itemProfit = $profitPerMeal * $item['quantity'];
                $totalProfit += $itemProfit;
                
                // تخزين بيانات العنصر
                $itemsData[] = [
                    'meal' => $meal,
                    'quantity' => $item['quantity'],
                    'price' => $price,
                    'item_total' => $itemTotal,
                    'item_profit' => $itemProfit,
                    'profit_per_meal' => $profitPerMeal,
                    'options' => $item['options'] ?? [],
                ];
                
                // تسجيل المكونات التي سيتم خصمها
                $stockDeductions[] = [
                    'meal_name' => $meal->name,
                    'meal_id' => $meal->id,
                    'quantity' => $item['quantity'],
                    'ingredients' => $meal->ingredients->map(function($ingredient) use ($item) {
                        return [
                            'category_id' => $ingredient->category_id,
                            'category_name' => $ingredient->category->name ?? 'غير معروف',
                            'quantity_needed' => $ingredient->quantity * $item['quantity'],
                            'unit' => $ingredient->unit
                        ];
                    })
                ];
            }

            // إنشاء رقم الطلب
            $orderCount = Order::whereDate('created_at', today())->count();
            $orderNumber = 'MEAL-' . date('Ymd') . '-' . str_pad($orderCount + 1, 4, '0', STR_PAD_LEFT);

            // حساب المبلغ المستحق
            $paidAmount = $request->paid_amount;
            $dueAmount = max(0, $total - $paidAmount);
            $status = $paidAmount >= $total ? 'paid' : ($paidAmount > 0 ? 'partially_paid' : 'pending');
            $status = $this->normalizeOrderStatusForStorage($status);

            // ⭐ إنشاء الطلب الرئيسي
            $order = Order::create([
                'order_number' => $orderNumber,
                'customer_id' => $request->customer_id,
                'subtotal' => $total,
                'discount' => 0,
                'total' => $total,
                'paid_amount' => $paidAmount,
                'due_amount' => $dueAmount,
                'payment_method' => $request->payment_method,
                'status' => $status,
                'notes' => $request->notes ?? 'بيع وجبات',
                'created_by' => auth()->id() ?? 1,
                'total_profit' => $totalProfit, // ⭐ تخزين إجمالي الربح
            ]);
            $this->recordCreditSaleMovement($order, $dueAmount, null);

            // ⭐ خصم المكونات من المخزون (categories)
            $this->deductMealIngredients($itemsData, $order->id);

            // ⭐ إضافة عناصر الوجبات إلى جدول meal_order_items مع الخيارات
            foreach ($itemsData as $itemData) {
                $meal = $itemData['meal'];

                $mealOrderItem = MealOrderItem::create([
                    'order_id' => $order->id,
                    'meal_id' => $meal->id,
                    'meal_name' => $meal->name,
                    'quantity' => $itemData['quantity'],
                    'unit_price' => $itemData['price'],
                    'unit_cost' => $meal->cost_price,
                    'unit_profit' => $itemData['profit_per_meal'],
                    'total_price' => $itemData['item_total'],
                    'total_profit' => $itemData['item_profit'],
                ]);

                if (!empty($itemData['options'])) {
                    foreach ($itemData['options'] as $opt) {
                        \App\Models\MealOrderItemOption::create([
                            'meal_order_item_id' => $mealOrderItem->id,
                            'meal_option_id' => $opt['id'] ?? null,
                            'name' => $opt['name'] ?? '',
                            'price' => $opt['price'] ?? 0,
                            'additional_cost' => $opt['price'] ?? 0,
                            'group_name' => $opt['group_name'] ?? 'أخرى',
                        ]);
                    }
                }

                $meal->increment('used_count', $itemData['quantity']);
            }

            // ⭐ تحديث الخزنة
            if ($paidAmount > 0) {
                $this->updateTreasury(
                    $order,
                    $paidAmount,
                    $totalProfit,
                    $request->payment_method,
                    'meal',
                    $request->input('cash_amount'),
                    $request->input('app_amount')
                );
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'تم بيع الوجبات بنجاح',
                'data' => [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'total' => $total,
                    'paid' => $paidAmount,
                    'due' => $dueAmount,
                    'status' => $status,
                    'items_count' => count($itemsData),
                    'total_profit' => $totalProfit,
                    'profit_percentage' => $total > 0 ? round(($totalProfit / $total) * 100, 2) : 0,
                    'stock_deductions' => $stockDeductions,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Sell meal error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء بيع الوجبات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * ✅ دالة مساعدة: التحقق من توفر مكونات الوجبة
     */
    private function checkMealIngredients($meal, $quantity)
    {
        $available = true;
        $unavailable = [];
        
        foreach ($meal->ingredients as $ingredient) {
            $category = $ingredient->category;
            
            if (!$category) {
                $unavailable[] = [
                    'ingredient' => 'مكون غير معروف',
                    'required' => $ingredient->quantity * $quantity,
                    'available' => 0
                ];
                $available = false;
                continue;
            }
            
            $requiredQuantity = $ingredient->quantity * $quantity;
            
            if ($category->quantity < $requiredQuantity) {
                $available = false;
                $unavailable[] = [
                    'ingredient' => $category->name,
                    'required' => $requiredQuantity,
                    'available' => $category->quantity,
                    'unit' => $ingredient->unit
                ];
            }
        }
        
        return [
            'available' => $available,
            'unavailable' => $unavailable
        ];
    }

    /**
     * ✅ دالة مساعدة: خصم مكونات الوجبات من المخزون
     */
    private function deductMealIngredients($itemsData, $orderId)
    {
        foreach ($itemsData as $itemData) {
            $meal = $itemData['meal'];
            $quantity = $itemData['quantity'];
            
            foreach ($meal->ingredients as $ingredient) {
                $category = $ingredient->category;
                
                if (!$category) continue;
                
                $quantityToDeduct = $ingredient->quantity * $quantity;
                
                // خصم الكمية
                $oldQuantity = $category->quantity;
                $category->quantity = max(0, $category->quantity - $quantityToDeduct);
                $category->save();
                
                // تسجيل عملية الخصم (اختياري)
                Log::info('Ingredient deducted for order #' . $orderId, [
                    'category' => $category->name,
                    'deducted' => $quantityToDeduct,
                    'old_quantity' => $oldQuantity,
                    'new_quantity' => $category->quantity,
                    'meal' => $meal->name,
                    'order_id' => $orderId
                ]);
            }
        }
    }

    /**
     * ✅ تحديث الخزنة: الكاش والتطبيق (والمختلط) يزيدان الرصيد ويُسجَّلان بـ payment_method المناسب.
     */
    private function updateTreasury($order, $paidAmount, $profit, $paymentMethod, $type = 'product', $cashAmount = null, $appAmount = null)
    {
        $paidAmount = (float) $paidAmount;
        $profit = (float) $profit;
        $paymentMethod = strtolower((string) $paymentMethod);

        $treasury = Treasury::first();

        if (!$treasury) {
            $treasury = Treasury::create([
                'balance' => 0,
                'balance_cash' => 0,
                'balance_app' => 0,
                'total_income' => 0,
                'total_expenses' => 0,
                'total_profit' => 0,
            ]);
        }

        $cashPortion = 0.0;
        $appPortion = 0.0;

        if ($paidAmount > 0.00001) {
            if ($paymentMethod === 'app') {
                $appPortion = round($paidAmount, 2);
            } elseif ($paymentMethod === 'cash') {
                $cashPortion = round($paidAmount, 2);
            } elseif ($paymentMethod === 'mixed') {
                $c = $cashAmount !== null ? (float) $cashAmount : 0.0;
                $a = $appAmount !== null ? (float) $appAmount : 0.0;
                if ($c + $a > 0.00001 && abs(($c + $a) - $paidAmount) < 0.06) {
                    $cashPortion = round($c, 2);
                    $appPortion = round($a, 2);
                } else {
                    $cashPortion = round($paidAmount, 2);
                }
            } elseif (in_array($paymentMethod, ['card', 'bank_transfer'], true)) {
                $cashPortion = round($paidAmount, 2);
            } else {
                $cashPortion = round($paidAmount, 2);
            }
        }

        $liquidity = round($cashPortion + $appPortion, 2);
        if ($liquidity > 0.00001) {
            $treasury->applyLiquidityDelta($cashPortion, $appPortion);
            $treasury->total_income += $liquidity;
        }

        $treasury->total_profit += $profit;
        $treasury->save();

        if (!class_exists(TreasuryTransaction::class)) {
            return $treasury;
        }

        $profitLabelPm = 'cash';
        if ($appPortion > 0.00001 && $cashPortion > 0.00001) {
            $profitLabelPm = 'mixed';
        } elseif ($appPortion > 0.00001) {
            $profitLabelPm = 'app';
        } elseif (in_array($paymentMethod, ['card', 'bank_transfer'], true)) {
            $profitLabelPm = $paymentMethod;
        }

        if ($profit > 0.00001) {
            TreasuryTransaction::create([
                'treasury_id' => $treasury->id,
                'type' => 'income',
                'amount' => round($profit, 2),
                'description' => 'ربح من ' . ($type === 'meal' ? 'بيع وجبة' : 'طلب') . ' #' . $order->order_number,
                'category' => 'other_income',
                'order_id' => $order->id,
                'transaction_date' => now()->toDateString(),
                'created_by' => auth()->id() ?? 1,
                'payment_method' => $profitLabelPm,
            ]);
        }

        $labelBase = ($type === 'meal' ? 'وجبة' : 'طلب') . ' #' . $order->order_number;
        if ($cashPortion > 0.00001) {
            TreasuryTransaction::create([
                'treasury_id' => $treasury->id,
                'type' => 'income',
                'amount' => $cashPortion,
                'description' => 'مبيعات كاش — ' . $labelBase,
                'category' => 'sales_income',
                'order_id' => $order->id,
                'transaction_date' => now()->toDateString(),
                'created_by' => auth()->id() ?? 1,
                'payment_method' => 'cash',
            ]);
        }
        if ($appPortion > 0.00001) {
            TreasuryTransaction::create([
                'treasury_id' => $treasury->id,
                'type' => 'income',
                'amount' => $appPortion,
                'description' => 'مبيعات تطبيق — ' . $labelBase,
                'category' => 'sales_income',
                'order_id' => $order->id,
                'transaction_date' => now()->toDateString(),
                'created_by' => auth()->id() ?? 1,
                'payment_method' => 'app',
            ]);
        }

        return $treasury;
    }

    /**
     * ✅ تقرير أرباح شامل (منتجات + وجبات)
     */
    public function profitReport(Request $request)
    {
        try {
            $startDate = $request->get('start_date', now()->startOfMonth());
            $endDate = $request->get('end_date', now()->endOfMonth());
            
            // إحصائيات عامة
            $stats = Order::whereBetween('created_at', [$startDate, $endDate])
                ->select([
                    DB::raw('COUNT(*) as total_orders'),
                    DB::raw('SUM(total) as total_sales'),
                    DB::raw('SUM(total_profit) as total_profit'),
                    DB::raw('AVG(total_profit) as avg_profit_per_order'),
                    DB::raw('SUM(CASE WHEN order_number LIKE "MEAL-%" THEN total_profit ELSE 0 END) as meals_profit'),
                    DB::raw('SUM(CASE WHEN order_number LIKE "ORD-%" THEN total_profit ELSE 0 END) as products_profit'),
                ])->first();
            
            // أفضل المنتجات ربحية
            $topProfitableProducts = OrderItem::whereHas('order', function ($query) use ($startDate, $endDate) {
                    $query->whereBetween('created_at', [$startDate, $endDate]);
                })
                ->select([
                    'product_id',
                    'product_name',
                    DB::raw('SUM(quantity) as total_quantity_sold'),
                    DB::raw('SUM(item_profit) as total_profit'),
                    DB::raw('COUNT(*) as order_count')
                ])
                ->groupBy('product_id', 'product_name')
                ->orderBy('total_profit', 'desc')
                ->limit(10)
                ->get();
            
            // ⭐ أفضل الوجبات ربحية
            $topProfitableMeals = MealOrderItem::whereHas('order', function ($query) use ($startDate, $endDate) {
                    $query->whereBetween('created_at', [$startDate, $endDate]);
                })
                ->select([
                    'meal_id',
                    'meal_name',
                    DB::raw('SUM(quantity) as total_quantity_sold'),
                    DB::raw('SUM(total_profit) as total_profit'),
                    DB::raw('AVG(unit_profit) as avg_profit_per_meal'),
                    DB::raw('COUNT(*) as order_count')
                ])
                ->groupBy('meal_id', 'meal_name')
                ->orderBy('total_profit', 'desc')
                ->limit(10)
                ->get();
            
            // أرباح يومية
            $dailyProfits = Order::whereBetween('created_at', [$startDate, $endDate])
                ->select([
                    DB::raw('DATE(created_at) as date'),
                    DB::raw('COUNT(*) as orders_count'),
                    DB::raw('SUM(total) as daily_sales'),
                    DB::raw('SUM(total_profit) as daily_profit'),
                    DB::raw('SUM(CASE WHEN order_number LIKE "MEAL-%" THEN total ELSE 0 END) as meals_sales'),
                    DB::raw('SUM(CASE WHEN order_number LIKE "ORD-%" THEN total ELSE 0 END) as products_sales'),
                ])
                ->groupBy('date')
                ->orderBy('date')
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => [
                    'period' => [
                        'start_date' => $startDate,
                        'end_date' => $endDate
                    ],
                    'profit_stats' => [
                        'total_orders' => $stats->total_orders,
                        'total_sales' => $stats->total_sales,
                        'total_profit' => $stats->total_profit,
                        'avg_profit_per_order' => round($stats->avg_profit_per_order ?? 0, 2),
                        'meals_profit' => $stats->meals_profit ?? 0,
                        'products_profit' => $stats->products_profit ?? 0,
                        'meals_percentage' => $stats->total_profit > 0 ? 
                            round(($stats->meals_profit / $stats->total_profit) * 100, 2) : 0,
                        'products_percentage' => $stats->total_profit > 0 ? 
                            round(($stats->products_profit / $stats->total_profit) * 100, 2) : 0,
                    ],
                    'top_products' => $topProfitableProducts,
                    'top_meals' => $topProfitableMeals,
                    'daily_profits' => $dailyProfits,
                    'profit_margin' => [
                        'gross_margin' => $stats->total_sales > 0 ? 
                            round(($stats->total_profit / $stats->total_sales) * 100, 2) : 0,
                        'avg_profit_per_order' => round($stats->avg_profit_per_order ?? 0, 2)
                    ]
                ],
                'message' => 'تم جلب تقرير الأرباح بنجاح'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Profit report error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب تقرير الأرباح',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * ✅ إحصائيات الطلبات
     */
    public function stats()
    {
        $today = now()->format('Y-m-d');
        $weekStart = now()->startOfWeek()->format('Y-m-d');
        $monthStart = now()->startOfMonth()->format('Y-m-d');
        
        return response()->json([
            'success' => true,
            'data' => [
                'today' => [
                    'orders_count' => Order::whereDate('created_at', $today)->count(),
                    'total_sales' => Order::whereDate('created_at', $today)->sum('total'),
                    'total_profit' => Order::whereDate('created_at', $today)->sum('total_profit'),
                    'meals_count' => Order::whereDate('created_at', $today)
                        ->where('order_number', 'LIKE', 'MEAL-%')
                        ->count(),
                    'products_count' => Order::whereDate('created_at', $today)
                        ->where('order_number', 'LIKE', 'ORD-%')
                        ->count(),
                ],
                'this_week' => [
                    'orders_count' => Order::where('created_at', '>=', $weekStart)->count(),
                    'total_sales' => Order::where('created_at', '>=', $weekStart)->sum('total'),
                    'total_profit' => Order::where('created_at', '>=', $weekStart)->sum('total_profit'),
                ],
                'this_month' => [
                    'orders_count' => Order::where('created_at', '>=', $monthStart)->count(),
                    'total_sales' => Order::where('created_at', '>=', $monthStart)->sum('total'),
                    'total_profit' => Order::where('created_at', '>=', $monthStart)->sum('total_profit'),
                ],
                'all_time' => [
                    'total_orders' => Order::count(),
                    'total_revenue' => Order::sum('total'),
                    'total_profit' => Order::sum('total_profit'),
                    'total_pending' => Order::where('status', 'pending')->sum('due_amount')
                ]
            ]
        ]);
    }

    /**
     * عرض الطلبات
     */
    public function index(Request $request)
    {
        try {
            $perPage = $request->get('per_page', 15);
            $search = $request->get('search');
            $status = $request->get('status');
            $type = $request->get('type'); // meal, product, all
            $startDate = $request->get('start_date');
            $endDate = $request->get('end_date');
            
            $query = Order::with([
                'customer:id,name,phone',
                'createdBy:id,username',
'items:id,order_id,item_id as product_id,item_name as product_name,quantity,unit_price,unit_cost,total_price,item_profit',            ]);
            
            // البحث
            if ($search) {
                $query->where('order_number', 'LIKE', "%{$search}%");
            }
            
            // التصفية حسب الحالة
            if ($status) {
                $query->where('status', $status);
            }
            
            // التصفية حسب نوع الطلب
            if ($type && $type !== 'all') {
                if ($type === 'meal') {
                    $query->where('order_number', 'LIKE', 'MEAL-%');
                } elseif ($type === 'product') {
                    $query->where('order_number', 'LIKE', 'ORD-%');
                }
            }
            
            // التصفية حسب التاريخ
            if ($startDate) {
                $query->whereDate('created_at', '>=', $startDate);
            }
            if ($endDate) {
                $query->whereDate('created_at', '<=', $endDate);
            }
            
            $query->orderBy('created_at', 'desc');
            $orders = $query->paginate($perPage);
            
            $normalizedOrders = collect($orders->items())->map(function ($o) {
                $meta = $this->extractMetaFromNotes($o->notes);
                $fallbackCashier = $o->createdBy?->username ?: $o->createdBy?->name;
                return [
                    'id' => $o->id,
                    'order_number' => $o->order_number,
                    'customer_id' => $o->customer_id,
                    'customer' => $o->customer ? [
                        'id' => $o->customer->id,
                        'name' => $o->customer->name,
                        'phone' => $o->customer->phone,
                    ] : null,
                    'customer_name' => $o->customer?->name ?: ($meta['customer_name'] ?? null),
                    'created_by' => $o->created_by,
                    'created_by_name' => $meta['cashier_name'] ?? $fallbackCashier,
                    'payment_method' => $o->payment_method,
                    'status' => $o->status,
                    'subtotal' => $o->subtotal,
                    'discount' => $o->discount,
                    'total' => $o->total,
                    'paid_amount' => $o->paid_amount,
                    'due_amount' => $o->due_amount,
                    'notes' => $o->notes,
                    'total_profit' => $o->total_profit,
                    'created_at' => $o->created_at,
                    'updated_at' => $o->updated_at,
                    'items' => $o->items->map(function ($it) {
                        return [
                            'id' => $it->id,
                            'product_id' => $it->product_id,
                            'name' => $it->product_name,
                            'quantity' => $it->quantity,
                            'unit_price' => $it->unit_price,
                            'unit_cost' => $it->unit_cost,
                            'total_price' => $it->total_price,
                            'item_profit' => $it->item_profit,
                        ];
                    })->values(),
                ];
            })->values();

            return response()->json([
                'success' => true,
                'data' => [
                    'orders' => $normalizedOrders,
                    'pagination' => [
                        'total' => $orders->total(),
                        'per_page' => $orders->perPage(),
                        'current_page' => $orders->currentPage(),
                        'last_page' => $orders->lastPage(),
                    ],
                    'stats' => [
                        'total' => Order::count(),
                        'meals' => Order::where('order_number', 'LIKE', 'MEAL-%')->count(),
                        'products' => Order::where('order_number', 'LIKE', 'ORD-%')->count(),
                        'pending' => Order::where('status', 'pending')->count(),
                        'paid' => Order::where('status', 'paid')->count(),
                        'cancelled' => Order::where('status', 'cancelled')->count(),
                        'total_revenue' => Order::sum('total'),
                        'total_profit' => Order::sum('total_profit'),
                    ]
                ],
                'message' => 'تم جلب الطلبات بنجاح'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Orders index error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب الطلبات',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * عرض طلب محدد (يدعم المنتجات والوجبات)
     */
    public function show($id)
    {
        try {
            $order = Order::with([
                'customer:id,name,phone',
                'createdBy:id,username',
            ])->find($id);
            
            if (!$order) {
                return response()->json([
                    'success' => false,
                    'message' => 'الطلب غير موجود'
                ], 404);
            }
            
            // تحميل العناصر المناسبة حسب نوع الطلب
            if (str_starts_with($order->order_number, 'MEAL-')) {
                $order->load(['mealItems']);
            } else {
                $order->load(['items.product']);
            }
            
            $meta = $this->extractMetaFromNotes($order->notes);
            $order->setAttribute('customer_name', $order->customer?->name ?: ($meta['customer_name'] ?? null));
            $order->setAttribute('created_by_name', $meta['cashier_name'] ?? ($order->createdBy?->username ?: $order->createdBy?->name));
            
            // ✅ تحويل العناصر (items) إلى الشكل المطلوب للـ Frontend
            $formattedItems = [];
            
            if (str_starts_with($order->order_number, 'MEAL-')) {
                // للوجبات
                foreach ($order->mealItems as $item) {
                    $formattedItems[] = [
                        'id' => $item->id,
                        'name' => $item->meal_name,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->unit_price,
                        'total_price' => $item->total_price,
                        'profit' => $item->total_profit,
                    ];
                }
            } else {
                // للمنتجات العادية
                foreach ($order->items as $item) {
                    $formattedItems[] = [
                        'id' => $item->id,
                        'name' => $item->item_name,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->unit_price,
                        'total_price' => $item->total_price,
                        'profit' => $item->item_profit,
                    ];
                }
            }
            
            // ✅ بناء الـ response بشكل منظم
            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'created_at' => $order->created_at,
                    'customer_id' => $order->customer_id,
                    'customer_name' => $order->customer_name,
                    'created_by' => $order->created_by,
                    'created_by_name' => $order->created_by_name,
                    'payment_method' => $order->payment_method,
                    'status' => $order->status,
                    'subtotal' => $order->subtotal,
                    'discount' => $order->discount,
                    'total' => $order->total,
                    'paid_amount' => $order->paid_amount,
                    'due_amount' => $order->due_amount,
                    'total_profit' => $order->total_profit,
                    'notes' => $order->notes,
                    'items' => $formattedItems,
                ],
                'message' => 'تم جلب بيانات الطلب بنجاح'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Order show error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب بيانات الطلب',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }

    public function creditCustomersSummary()
    {
        try {
            $creditCustomers = Customer::query()
                ->select(['id', 'name', 'phone', 'credit_limit'])
                ->where('department', 'زبائن آجل')
                ->orderBy('name', 'asc')
                ->get();
            
            $result = [];
            
            foreach ($creditCustomers as $customer) {
                // ✅ جلب جميع حركات الزبون لحساب الرصيد الفعلي
                $movements = CustomerCreditMovement::where('customer_id', $customer->id)
                    ->orderBy('occurred_at', 'asc')
                    ->get();
                
                $balance = 0;
                foreach ($movements as $movement) {
                    $balance += (float) $movement->delta_amount;
                }
                
                // الرصيد الموجب = الزبون "عليه" (دين علينا تحصيله)
                // الرصيد السالب = الزبون "له" (رصيد دائن له عندنا)
                $totalDue = max(0, $balance);
                $availableCredit = max(0, -$balance);
                
                // ✅ جلب إجمالي المشتريات والمدفوعات من الفواتير
                $customerOrders = Order::where('customer_id', $customer->id)
                    ->whereNotIn('status', ['cancelled', 'returned'])
                    ->get();
                
                $totalSales = 0;
                $totalPaid = 0;
                
                foreach ($customerOrders as $order) {
                    $totalSales += (float) ($order->total ?? 0);
                    $totalPaid += (float) ($order->paid_amount ?? 0);
                }
                
                $result[] = [
                    'id' => $customer->id,
                    'customer_id' => $customer->id,
                    'name' => (string) ($customer->name ?? ''),
                    'phone' => (string) ($customer->phone ?? ''),
                    'credit_limit' => (float) ($customer->credit_limit ?? 0),
                    'notes' => '',
                    'total_sales' => round($totalSales, 2),
                    'total_paid' => round($totalPaid, 2),
                    // حقول موحدة ودلالتها ثابتة:
                    // - balance: موجب = عليه، سالب = له
                    // - total_due / debt_amount: عليه
                    // - available_credit / credit_amount: له
                    'total_due' => round($totalDue, 2),
                    'available_credit' => round($availableCredit, 2),
                    'balance' => round($balance, 2),
                    'debt_amount' => round($totalDue, 2),
                    'credit_amount' => round($availableCredit, 2),
                    'credit_limit_display' => ($customer->credit_limit ?? 0) > 0 
                        ? number_format($customer->credit_limit, 2) . ' ش'
                        : 'غير محدد',
                    'invoices_count' => $customerOrders->count(),
                    'last_order_at' => $customerOrders->isNotEmpty() 
                        ? $customerOrders->sortByDesc('created_at')->first()->created_at->toDateTimeString() 
                        : null,
                ];
            }
            
            $result = collect($result)->sortByDesc('total_due')->values();
            
            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
            
        } catch (\Throwable $e) {
            Log::error('creditCustomersSummary error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'تعذر جلب زبائن الآجل: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
 * تحديث سقف الآجل لزبون
 */
public function updateCreditLimit(Request $request, $customerId)
{
    $validator = Validator::make($request->all(), [
        'credit_limit' => 'required|numeric|min:0',
    ]);
    
    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'message' => 'بيانات غير صالحة',
            'errors' => $validator->errors()
        ], 422);
    }
    
    try {
        $customer = Customer::find($customerId);
        if (!$customer) {
            return response()->json([
                'success' => false,
                'message' => 'الزبون غير موجود'
            ], 404);
        }
        
        // ✅ التأكد من وجود عمود credit_limit في جدول customers
        if (!Schema::hasColumn('customers', 'credit_limit')) {
            return response()->json([
                'success' => false,
                'message' => 'عمود سقف الآجل غير موجود في قاعدة البيانات. يرجى تشغيل الترحيلات أولاً.'
            ], 500);
        }
        
        $customer->credit_limit = (float) $request->credit_limit;
        $customer->save();
        
        return response()->json([
            'success' => true,
            'message' => 'تم تحديث سقف الآجل بنجاح',
            'data' => [
                'customer_id' => $customer->id,
                'name' => $customer->name,
                'credit_limit' => (float) $customer->credit_limit
            ]
        ]);
        
    } catch (\Throwable $e) {
        Log::error('updateCreditLimit error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'تعذر تحديث سقف الآجل: ' . $e->getMessage()
        ], 500);
    }
}


    public function createCreditCustomer(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:120',
            'phone' => 'nullable|string|max:30',
            'credit_limit' => 'nullable|numeric|min:0', // ✅ أضف هذا
            'notes' => 'nullable|string|max:500', // ✅ أضف هذا
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'بيانات غير صالحة',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $name = trim((string) $request->input('name'));
            $phone = trim((string) $request->input('phone', ''));

            $existing = Customer::query()
                ->where('name', $name)
                ->when($phone !== '', fn($q) => $q->where('phone', $phone))
                ->first();

            if ($existing) {
                return response()->json([
                    'success' => true,
                    'message' => 'الزبون موجود مسبقاً',
                    'data' => [
                        'id' => $existing->id,
                        'name' => $existing->name,
                        'phone' => $existing->phone,
                    ],
                ]);
            }

            $customer = Customer::create([
                'name' => $name,
                'phone' => $phone !== '' ? $phone : '—',
                'credit_limit' => $request->credit_limit ?? 0, // ✅ حفظ السقف
                'notes' => $request->notes ?? '', // ✅ حفظ الملاحظات
                'department' => 'زبائن آجل',
                'shift' => 'صباحي',
                'salary' => 0,
                'total_purchases' => 0,
                'last_purchase_date' => null,
                'role' => 'user',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'تم إضافة زبون الآجل بنجاح',
                'data' => [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'phone' => $customer->phone,
                ],
            ], 201);
        } catch (\Throwable $e) {
            Log::error('createCreditCustomer error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'تعذر إضافة زبون الآجل',
            ], 500);
        }
    }

    public function applyCreditPayment(Request $request, $customerId)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'note' => 'nullable|string|max:300',
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'بيانات غير صالحة',
                'errors' => $validator->errors(),
            ], 422);
        }
    
        try {
            DB::beginTransaction();
            
            $amount = (float) $request->amount;
            $remaining = $amount;
            $affected = 0;
            
            // ✅ 1. جلب الفواتير المستحقة (التي عليها دين)
            $orders = Order::where('customer_id', (int) $customerId)
                ->where('due_amount', '>', 0)
                ->whereNotIn('status', ['cancelled', 'returned'])
                ->orderBy('created_at', 'asc')
                ->lockForUpdate()
                ->get();
            
            // ✅ 2. تسديد الفواتير المستحقة أولاً
            foreach ($orders as $order) {
                if ($remaining <= 0.00001) break;
                $due = (float) ($order->due_amount ?? 0);
                if ($due <= 0.00001) continue;
                
                $pay = min($remaining, $due);
                $order->paid_amount = round(((float) $order->paid_amount) + $pay, 2);
                $order->due_amount = round($due - $pay, 2);
                
                // ✅ استخدام دالة normalizeOrderStatusForStorage
                $newStatus = $order->due_amount <= 0.00001 ? 'paid' : 'partially_paid';
                $order->status = $this->normalizeOrderStatusForStorage($newStatus);
                
                $order->save();
                
                $remaining -= $pay;
                $affected++;
            }
            
            // ✅ 3. إذا بقي مبلغ زائد (دفع زيادة عن الدين)، سجلها كرصيد دائن (Available Credit)
            if ($remaining > 0.00001) {
                // ✅ تسجيل حركة إيجابية (رصيد دائن) - تستخدم لاحقاً للشراء
                CustomerCreditMovement::create([
                    'customer_id' => (int) $customerId,
                    'customer_name' => Customer::find($customerId)?->name,
                    'movement_type' => 'debt_payment',
                    'delta_amount' => -$remaining,  // ✅ سالب = رصيد دائن
                    'reference_order_id' => null,
                    'payment_method' => $request->input('payment_method', 'cash'),
                    'cashier_id' => auth()->id() ?? 1,
                    'cashier_name' => auth()->user()?->username ?? auth()->user()?->name ?? 'system',
                    'note' => $request->input('note', 'تسديد زيادة (رصيد دائن)'),
                    'occurred_at' => now(),
                ]);
                
                $affectedOrdersMessage = " + {$remaining} ش رصيد دائن متبقي";
            } else {
                $affectedOrdersMessage = "";
            }
            
            DB::commit();
            
            $applied = round($amount - $remaining, 2);
            
            return response()->json([
                'success' => true,
                'message' => 'تم تسجيل التسديد بنجاح' . $affectedOrdersMessage,
                'data' => [
                    'paid_applied' => $applied,
                    'unapplied' => round($remaining, 2),
                    'affected_orders' => $affected,
                    'available_credit_remaining' => round($remaining, 2),
                ],
            ]);
            
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('applyCreditPayment error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'تعذر تسجيل التسديد: ' . $e->getMessage(),
            ], 500);
        }
    }
/**
 * ✅ دالة جديدة: جلب حركات زبون الآجل من الفواتير (بدون الاعتماد على customer_credit_movements)
 */
/**
 * ✅ دالة جديدة: جلب حركات زبون الآجل من الفواتير مباشرة
 */
public function getCreditCustomerMovements($customerId)
{
    try {
        // جلب معلومات الزبون
        $customer = Customer::find($customerId);
        
        if (!$customer) {
            return response()->json([
                'success' => false,
                'message' => 'الزبون غير موجود'
            ], 404);
        }
        
        $movements = collect();
        
        // 1. حركات البيع الآجل (الفواتير)
        $creditOrders = Order::where('customer_id', $customerId)
            ->where('payment_method', 'credit')
            ->whereNotIn('status', ['cancelled', 'returned'])
            ->with('createdBy')
            ->orderBy('created_at', 'asc')
            ->get();
        
        foreach ($creditOrders as $order) {
            $movements->push([
                'id' => 'sale_' . $order->id,
                'type' => 'sale',
                'movement_type' => 'credit_sale',
                'delta_amount' => (float) $order->total,
                'balance_after' => 0,
                'reference_order_id' => $order->id,
                'order_number' => $order->order_number,
                'payment_method' => $order->payment_method,
                'cashier_name' => $order->createdBy?->username ?? '—',
                'note' => "فاتورة بيع آجل - {$order->order_number}",
                'occurred_at' => $order->created_at->toISOString(),
            ]);
        }
        
        // 2. حركات التسديد (من جدول customer_credit_movements إذا كان موجود)
        if (Schema::hasTable('customer_credit_movements')) {
            $payments = CustomerCreditMovement::where('customer_id', $customerId)
                ->where('movement_type', 'debt_payment')
                ->orderBy('occurred_at', 'asc')
                ->get();
            
            foreach ($payments as $payment) {
                $movements->push([
                    'id' => 'payment_' . $payment->id,
                    'type' => 'payment',
                    'movement_type' => 'debt_payment',
                    'delta_amount' => (float) $payment->delta_amount,
                    'balance_after' => 0,
                    'reference_order_id' => $payment->reference_order_id,
                    'order_number' => null,
                    'payment_method' => $payment->payment_method,
                    'cashier_name' => $payment->cashier_name,
                    'note' => $payment->note,
                    'occurred_at' => $payment->occurred_at->toISOString(),
                ]);
            }
        }

        // ===== 2.5. جلب تسديدات ديون الموردين (من staff_activities) =====
        if (Schema::hasTable('staff_activities')) {
            $supplierPaymentsQuery = StaffActivity::query()
                ->where('action_type', 'supplier_debt_payment')
                ->whereBetween('created_at', [$today, $tomorrow])
                ->orderBy('created_at', 'desc');
            if ($mineOnly && $authUser) {
                $supplierPaymentsQuery->where(function ($q) use ($authUser) {
                    $q->where('user_id', $authUser->id)
                      ->orWhere('username', $authUser->username);
                });
            }
            $supplierPayments = $supplierPaymentsQuery->get();

            foreach ($supplierPayments as $payment) {
                $meta = is_array($payment->meta) ? $payment->meta : (json_decode((string) $payment->meta, true) ?: []);
                $paidAmount = abs((float) ($meta['amount'] ?? $meta['amount_paid'] ?? 0));
                $supplierName = (string) ($meta['supplier_name'] ?? 'مورد');
                $paymentMethod = (string) ($meta['payment_method'] ?? 'cash');

                if ($paidAmount <= 0) {
                    continue;
                }

                $transactions->push([
                    'id' => 'supplier_payment_' . $payment->id,
                    'transaction_id' => $payment->id,
                    'type' => 'debt_payment',
                    'type_label' => 'تسديد دين مورد',
                    'reference_number' => 'SUP-PAY-' . $payment->id,
                    'customer_id' => $meta['supplier_id'] ?? null,
                    'customer_name' => $supplierName,
                    'payment_method' => $paymentMethod,
                    'total_amount' => $paidAmount,
                    'paid_amount' => $paidAmount,
                    'due_amount' => 0,
                    'cashier_name' => $payment->username ?? '—',
                    'status' => 'completed',
                    'items_count' => 0,
                    'occurred_at' => optional($payment->created_at)->toISOString(),
                    'icon' => 'payments',
                    'color' => 'success',
                    'note' => $payment->description ?: 'تسديد دين مورد',
                ]);
            }
        }
        
        // 3. الفواتير النقدية ذات الدفع الجزئي
        $partialOrders = Order::where('customer_id', $customerId)
            ->where('payment_method', 'cash')
            ->where('status', 'pending')  // partially_paid يتحول إلى pending
            ->where('due_amount', '>', 0)
            ->with('createdBy')
            ->orderBy('created_at', 'asc')
            ->get();
        
        foreach ($partialOrders as $order) {
            $movements->push([
                'id' => 'partial_' . $order->id,
                'type' => 'sale',
                'movement_type' => 'partial_payment_sale',
                'delta_amount' => (float) $order->due_amount,
                'balance_after' => 0,
                'reference_order_id' => $order->id,
                'order_number' => $order->order_number,
                'payment_method' => $order->payment_method,
                'cashier_name' => $order->createdBy?->username ?? '—',
                'note' => "فاتورة نقدية - متبقي {$order->due_amount} شيكل",
                'occurred_at' => $order->created_at->toISOString(),
            ]);
        }
        
        // حساب الرصيد التراكمي
        $sortedMovements = $movements->sortBy('occurred_at');
        $runningBalance = 0;
        $result = [];
        
        foreach ($sortedMovements as $movement) {
            $delta = (float) $movement['delta_amount'];
            $runningBalance += $delta;
            $movement['balance_after'] = round($runningBalance, 2);
            $result[] = $movement;
        }
        
        // ترتيب تنازلي (الأحدث أولاً)
        $result = collect($result)->sortByDesc('occurred_at')->values();
        
        return response()->json([
            'success' => true,
            'data' => $result,
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone ?? '',
                'current_balance' => round($runningBalance, 2),
                'total_debt' => round($creditOrders->sum('total'), 2),
                'total_paid' => round(abs($movements->where('type', 'payment')->sum('delta_amount')), 2),
            ]
        ]);
        
    } catch (\Exception $e) {
        Log::error('getCreditCustomerMovements error: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب حركات الزبون',
            'error' => config('app.debug') ? $e->getMessage() : null
        ], 500);
    }
}
    public function creditCustomerMovements($customerId)
    {
        try {
            $rowsAsc = collect();
            if ($this->canUseCreditMovementsTable()) {
                $query = CustomerCreditMovement::query();
                if (is_numeric($customerId)) {
                    $query->where('customer_id', (int) $customerId);
                } else {
                    $query->whereRaw('LOWER(customer_name) = ?', [mb_strtolower(trim((string) $customerId))]);
                }

                $rowsAsc = $query
                    ->orderBy('occurred_at', 'asc')
                    ->orderBy('id', 'asc')
                    ->get();
            }

            // fallback: إذا لا توجد حركات مسجلة، اعرض حركات الشراء الآجل من الفواتير
            if ($rowsAsc->isEmpty()) {
                $ordersQuery = Order::query()
                    ->with('createdBy:id,name,username')
                    ->whereIn('payment_method', ['credit', 'mixed'])
                    ->where('due_amount', '>', 0);
                if (is_numeric($customerId)) {
                    $ordersQuery->where('customer_id', (int) $customerId);
                } else {
                    $needle = mb_strtolower(trim((string) $customerId));
                    $ordersQuery->where(function ($q) use ($needle) {
                        $q->whereHas('customer', function ($sq) use ($needle) {
                            $sq->whereRaw('LOWER(name) = ?', [$needle]);
                        })->orWhereRaw('LOWER(notes) LIKE ?', ['%"customer_name":"' . $needle . '"%']);
                    });
                }
                $orderRows = $ordersQuery
                    ->orderBy('created_at', 'asc')
                    ->orderBy('id', 'asc')
                    ->get();
                $rowsAsc = $orderRows->map(function ($o) {
                    $cashier = $o->createdBy?->username ?: $o->createdBy?->name;
                    return (object) [
                        'id' => 'ord-' . $o->id,
                        'customer_id' => $o->customer_id,
                        'customer_name' => $o->customer_name,
                        'movement_type' => 'credit_sale',
                        'delta_amount' => (float) ($o->due_amount ?? 0),
                        'reference_order_id' => $o->id,
                        'payment_method' => $o->payment_method,
                        'cashier_id' => $o->created_by,
                        'cashier_name' => $cashier,
                        'note' => 'فاتورة ' . ($o->order_number ?: ('#' . $o->id)),
                        'occurred_at' => $o->created_at,
                        'created_at' => $o->created_at,
                    ];
                });
            }

            $running = 0.0;
            $withRunning = $rowsAsc->map(function ($m) use (&$running) {
                $delta = (float) $m->delta_amount;
                $running += $delta;
                return [
                    'id' => $m->id,
                    'customer_id' => $m->customer_id,
                    'customer_name' => $m->customer_name,
                    'movement_type' => $m->movement_type,
                    'delta_amount' => round($delta, 2),
                    'balance_after' => round($running, 2),
                    'reference_order_id' => $m->reference_order_id,
                    'payment_method' => $m->payment_method,
                    'cashier_id' => $m->cashier_id,
                    'cashier_name' => $m->cashier_name,
                    'note' => $m->note,
                    'occurred_at' => optional($m->occurred_at)->toDateTimeString(),
                    'created_at' => optional($m->created_at)->toDateTimeString(),
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $withRunning->sortByDesc('id')->values(),
            ]);
        } catch (\Throwable $e) {
            Log::error('creditCustomerMovements error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'تعذر جلب حركات زبون الآجل',
            ], 500);
        }
    }

    private function buildOrderNotesWithMeta(?string $notes, $customerName, $cashierName): string
    {
        $base = trim((string) ($notes ?? ''));
        $meta = [];
        $cn = trim((string) ($customerName ?? ''));
        $sn = trim((string) ($cashierName ?? ''));
        if ($cn !== '') $meta['customer_name'] = $cn;
        if ($sn !== '') $meta['cashier_name'] = $sn;
        if (empty($meta)) return $base;
        $metaLine = '__meta:' . json_encode($meta, JSON_UNESCAPED_UNICODE);
        if ($base === '') return $metaLine;
        return $base . "\n" . $metaLine;
    }

    private function extractMetaFromNotes(?string $notes): array
    {
        $raw = (string) ($notes ?? '');
        if ($raw === '') return [];
        $pos = strrpos($raw, '__meta:');
        if ($pos === false) return [];
        $json = trim(substr($raw, $pos + 7));
        if ($json === '') return [];
        $parsed = json_decode($json, true);
        return is_array($parsed) ? $parsed : [];
    }

    /**
     * استرجاع طلب (مرتجع)
     */
    public function returnOrder(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.order_item_id' => 'required|exists:order_items,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'reason' => 'required|string|max:500',
            'refund_amount' => 'required|numeric|min:0'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في البيانات المدخلة',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();
            
            $order = Order::find($id);
            
            if (!$order) {
                return response()->json([
                    'success' => false,
                    'message' => 'الطلب غير موجود'
                ], 404);
            }

            // إرجاع المنتجات للمخزون
            foreach ($request->items as $item) {
                $orderItem = OrderItem::find($item['order_item_id']);
                
                if ($orderItem && $orderItem->order_id == $order->id) {
                    $product = Product::find($orderItem->product_id);
                    if ($product) {
                        $product->stock += $item['quantity'];
                        $product->save();
                    }
                }
            }

            // خصم المبلغ من الخزنة (كاش / تطبيق حسب أصل البيع)
            if ($request->refund_amount > 0) {
                $treasury = Treasury::first();
                if ($treasury) {
                    [$rCash, $rApp] = $this->treasuryRefundChannelsForOrder($order, (float) $request->refund_amount);
                    $treasury->applyLiquidityDelta(-$rCash, -$rApp);
                    $treasury->total_expenses += $request->refund_amount;
                    $treasury->save();
                }
            }

            $order->status = 'cancelled';
            $order->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'تم استرجاع الطلب بنجاح',
                'data' => $order
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Return order error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء الاسترجاع',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }






    /**
 * جلب جميع حركات اليوم (فواتير البيع + تسديدات الديون)
 * لتظهر في جدول بيع اليوم للكاشير
 */




public function getTodayTransactions(Request $request)
{
    try {
        $today = now()->startOfDay();
        $tomorrow = now()->endOfDay();
        $mineOnly = $request->boolean('mine');
        $authUser = $request->user();
        
        $transactions = collect();
        
        // ===== 1. جلب فواتير البيع (من orders) =====
        $ordersQuery = Order::whereBetween('created_at', [$today, $tomorrow])
            ->with(['customer', 'createdBy'])
            ->orderBy('created_at', 'desc');
        if ($mineOnly && $authUser) {
            $ordersQuery->where('created_by', $authUser->id);
        }
        $orders = $ordersQuery->get();
        
        foreach ($orders as $order) {
            $transactions->push([
                'id' => 'order_' . $order->id,
                'transaction_id' => $order->id,
                'type' => 'sale',
                'type_label' => 'فاتورة بيع',
                'reference_number' => $order->order_number,
                'customer_id' => $order->customer_id,
                'customer_name' => $order->customer?->name ?? $this->extractMetaFromNotes($order->notes)['customer_name'] ?? 'زبون عابر',
                'payment_method' => $order->payment_method,
                'total_amount' => (float) $order->total,
                'paid_amount' => (float) $order->paid_amount,
                'due_amount' => (float) $order->due_amount,
                'cashier_name' => $order->createdBy?->username ?? $this->extractMetaFromNotes($order->notes)['cashier_name'] ?? '—',
                'status' => $order->status,
                'items_count' => $order->items->count(),
                'occurred_at' => $order->created_at->toISOString(),
                'icon' => 'receipt',
                'color' => 'primary'
            ]);
        }
        // ===== 1.5. جلب مشتريات الموردين (من purchases) =====
        if (Schema::hasTable('purchases')) {
            $purchasesQuery = Purchase::whereBetween('created_at', [$today, $tomorrow])
                ->with(['supplier', 'createdBy', 'items'])
                ->orderBy('created_at', 'desc');
            if ($mineOnly && $authUser && Schema::hasColumn('purchases', 'created_by')) {
                $purchasesQuery->where('created_by', $authUser->id);
            }
            $purchases = $purchasesQuery->get();

            foreach ($purchases as $purchase) {
                $totalAmount = (float) ($purchase->total_amount ?? 0);
                $paidAmount = (float) ($purchase->paid_amount ?? 0);
                $remainingAmount = (float) ($purchase->remaining_amount ?? max(0, $totalAmount - $paidAmount));
                $transactions->push([
                    'id' => 'purchase_' . $purchase->id,
                    'transaction_id' => $purchase->id,
                    'type' => 'purchase',
                    'type_label' => 'فاتورة شراء',
                    'reference_number' => $purchase->invoice_number ?? ('PO-' . $purchase->id),
                    'customer_id' => $purchase->supplier_id,
                    'customer_name' => $purchase->supplier?->name ?? 'مورد',
                    'payment_method' => $purchase->payment_method ?? 'cash',
                    'total_amount' => -abs($totalAmount), // سالب لأنه صرف/التزام شراء
                    'paid_amount' => $paidAmount,
                    'due_amount' => max(0, $remainingAmount),
                    'cashier_name' => $purchase->createdBy?->username ?? '—',
                    'status' => $purchase->status ?? 'completed',
                    'items_count' => $purchase->items->count(),
                    'occurred_at' => optional($purchase->created_at)->toISOString(),
                    'icon' => 'local_shipping',
                    'color' => 'warning'
                ]);
            }
        }

// ===== 4. جلب حركات الخزنة النقدية (Treasury transactions) =====
if (Schema::hasTable('treasury_transactions')) {
    $treasuryTransQuery = TreasuryTransaction::whereBetween('transaction_date', [$today, $tomorrow])
        ->whereIn('type', ['expense', 'income'])
        ->whereNotIn('category', ['sales_income', 'meal_income'])
        ->orderBy('transaction_date', 'desc');
    if ($mineOnly && $authUser && Schema::hasColumn('treasury_transactions', 'created_by')) {
        $treasuryTransQuery->where('created_by', $authUser->id);
    }
    $treasuryTrans = $treasuryTransQuery->get();
    
    foreach ($treasuryTrans as $tt) {
        $transactions->push([
            'id' => 'treasury_' . $tt->id,
            'type' => $tt->type === 'expense' ? 'expense' : 'income',
            'type_label' => $tt->type === 'expense' ? 'صرف نقدي' : 'إيداع نقدي',
            'reference_number' => 'حركة #' . $tt->id,
            'customer_name' => '—',
            'payment_method' => $tt->payment_method ?? 'cash',
            'total_amount' => $tt->type === 'expense' ? -(float) $tt->amount : (float) $tt->amount,
            'paid_amount' => (float) $tt->amount,
            'due_amount' => 0,
            'cashier_name' => optional($tt->createdBy)->username ?? '—',
            'status' => 'completed',
            'items_count' => 0,
            'occurred_at' => $tt->transaction_date->toISOString(),
            'icon' => $tt->type === 'expense' ? 'money_off' : 'attach_money',
            'color' => $tt->type === 'expense' ? 'error' : 'success',
            'note' => $tt->description
        ]);
    }
}
        // ===== 2. جلب حركات تسديد الديون (من customer_credit_movements) =====
        if (Schema::hasTable('customer_credit_movements')) {
            $paymentsQuery = CustomerCreditMovement::whereBetween('occurred_at', [$today, $tomorrow])
                ->where('movement_type', 'debt_payment')
                ->orderBy('occurred_at', 'desc');
            if ($mineOnly && $authUser) {
                $paymentsQuery->where('cashier_name', $authUser->username);
            }
            $payments = $paymentsQuery->get();
            
            foreach ($payments as $payment) {
                // delta_amount سالب = دفع دين (رصيد دائن)
                $paidAmount = abs((float) $payment->delta_amount);
                
                $transactions->push([
                    'id' => 'payment_' . $payment->id,
                    'transaction_id' => $payment->id,
                    'type' => 'debt_payment',
                    'type_label' => 'تسديد دين',
                    'reference_number' => 'تسديد #' . $payment->id,
                    'customer_id' => $payment->customer_id,
                    'customer_name' => $payment->customer_name ?? 'زبون آجل',
                    'payment_method' => $payment->payment_method ?? 'cash',
                    'total_amount' => $paidAmount,
                    'paid_amount' => $paidAmount,
                    'due_amount' => 0,
                    'cashier_name' => $payment->cashier_name ?? '—',
                    'status' => 'completed',
                    'items_count' => 0,
                    'occurred_at' => $payment->occurred_at->toISOString(),
                    'icon' => 'payments',
                    'color' => 'success',
                    'note' => $payment->note
                ]);
            }
        }
        
        // ===== 3. ترتيب حسب التاريخ (الأحدث أولاً) =====
        $sortedTransactions = $transactions->sortByDesc('occurred_at')->values();
        
        // ===== 4. إحصائيات اليوم =====
        $stats = [
            'total_sales' => $orders->sum('total'),
            'total_paid' => $orders->sum('paid_amount'),
            'total_debt_paid' => $transactions->where('type', 'debt_payment')->sum('total_amount'),
            'total_purchases' => abs($transactions->where('type', 'purchase')->sum('total_amount')),
            'total_expenses' => abs($transactions->where('type', 'expense')->sum('total_amount')),
            'total_income' => $transactions->where('type', 'income')->sum('total_amount'),
            'total_orders' => $orders->count(),
            'total_payments' => $transactions->where('type', 'debt_payment')->count(),
            'net_cash_flow' => $orders->sum('total') - abs($transactions->where('type', 'purchase')->sum('total_amount')),
        ];
        
        return response()->json([
            'success' => true,
            'data' => [
                'transactions' => $sortedTransactions,
                'stats' => $stats,
                'date' => now()->toDateString()
            ],
            'message' => 'تم جلب حركات اليوم بنجاح'
        ]);
        
    } catch (\Exception $e) {
        Log::error('getTodayTransactions error: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'حدث خطأ في جلب حركات اليوم',
            'error' => env('APP_DEBUG') ? $e->getMessage() : null
        ], 500);
    }
}



    /**
     * إرجاع الطلب بالكامل (مرتجع كامل - مناسب لطلبات الوجبات)
     * يخصم المبلغ من الخزنة ويضع الطلب كملغى/مرتجع
     */
    public function returnOrderFull(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'nullable|string|max:500',
        ]);
    
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في البيانات المدخلة',
                'errors' => $validator->errors()
            ], 422);
        }
    
        try {
            DB::beginTransaction();
    
            $order = Order::find($id);
    
            if (!$order) {
                return response()->json([
                    'success' => false,
                    'message' => 'الطلب غير موجود'
                ], 404);
            }
    
            if (in_array($order->status, ['cancelled', 'returned'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'الطلب مُلغى أو مُرجع مسبقاً'
                ], 422);
            }
    
            $refundAmount = (float) $order->paid_amount;
            if ($refundAmount <= 0) {
                $order->status = 'cancelled';  // ✅ تعديل هنا
                $order->notes = $this->appendReasonKeepMeta($order->notes, (string) ($request->reason ?? 'بدون سبب'));
                $order->save();
                DB::commit();
                return response()->json([
                    'success' => true,
                    'message' => 'تم إلغاء الطلب (لا يوجد مبلغ مسترد)',
                    'data' => $order
                ]);
            }
    
            $treasury = Treasury::first();
            if (!$treasury) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'لا توجد خزنة للخصم منها'
                ], 400);
            }
    
            [$rCash, $rApp] = $this->treasuryRefundChannelsForOrder($order, $refundAmount);
            $treasury->applyLiquidityDelta(-$rCash, -$rApp);
            $treasury->total_expenses += $refundAmount;
            if (isset($treasury->total_profit) && isset($order->total_profit) && $order->total_profit > 0) {
                $treasury->total_profit = max(0, ($treasury->total_profit ?? 0) - $order->total_profit);
            }
            $treasury->save();
    
            $order->status = 'cancelled';  // ✅ تعديل هنا
            $order->notes = $this->appendReasonKeepMeta($order->notes, (string) ($request->reason ?? 'بدون سبب'));
            $order->save();
    
            DB::commit();
    
            return response()->json([
                'success' => true,
                'message' => 'تم إرجاع الطلب واسترداد المبلغ بنجاح',
                'data' => [
                    'order' => $order,
                    'refund_amount' => $refundAmount,
                    'treasury_balance' => $treasury->balance,
                ]
            ]);
    
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Return order full error: ' . $e->getMessage());
    
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء الاسترجاع',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * تقسيم مبلغ الاسترداد إلى كاش وتطبيق بحسب طريقة الدفع أو سجلات مبيعات الطلب.
     *
     * @return array{0: float, 1: float} [cash, app]
     */
    private function treasuryRefundChannelsForOrder(Order $order, float $refundAmount): array
    {
        $refundAmount = round(max(0, $refundAmount), 2);
        if ($refundAmount <= 0.00001) {
            return [0.0, 0.0];
        }
        $pm = strtolower((string) ($order->payment_method ?? 'cash'));
        if ($pm === 'app') {
            return [0.0, $refundAmount];
        }
        if ($pm === 'cash' || in_array($pm, ['card', 'bank_transfer'], true)) {
            return [$refundAmount, 0.0];
        }
        if ($pm === 'mixed') {
            $rows = TreasuryTransaction::where('order_id', $order->id)
                ->where('category', 'sales_income')
                ->get(['payment_method', 'amount']);
            $c = (float) $rows->where('payment_method', 'cash')->sum('amount');
            $a = (float) $rows->where('payment_method', 'app')->sum('amount');
            $s = $c + $a;
            if ($s > 0.00001) {
                $rc = round($refundAmount * ($c / $s), 2);

                return [$rc, round($refundAmount - $rc, 2)];
            }
        }

        return [$refundAmount, 0.0];
    }

    private function convertSaleQuantityToPieces(Product $product, float $quantity, ?string $saleUnit): float
    {
        return $product->saleQuantityToInventoryPieces($quantity, $saleUnit);
    }

    private function validateAndNormalizeSalePaymentBreakdown(string $paymentMethod, float $paidAmount, $cashAmountInput, $appAmountInput): array
    {
        $method = strtolower($paymentMethod);
        $paid = max(0.0, round((float) $paidAmount, 2));
        $cash = max(0.0, round((float) ($cashAmountInput ?? 0), 2));
        $app = max(0.0, round((float) ($appAmountInput ?? 0), 2));

        if ($method === 'credit') {
            if ($paid > 0.0001 || $cash > 0.0001 || $app > 0.0001) {
                return ['ok' => false, 'message' => 'البيع الآجل يجب أن يكون بدون مبلغ مدفوع لحظة الفاتورة'];
            }
            return ['ok' => true, 'paid_amount' => 0.0, 'cash_amount' => 0.0, 'app_amount' => 0.0];
        }

        if ($method === 'cash') {
            $cash = $paid;
            $app = 0.0;
            if ($paid > 0.0001 && $cash <= 0.0001) {
                return ['ok' => false, 'message' => 'طريقة الدفع كاش تتطلب مبلغ كاش أكبر من صفر'];
            }
        } elseif ($method === 'app') {
            $app = $paid;
            $cash = 0.0;
            if ($paid > 0.0001 && $app <= 0.0001) {
                return ['ok' => false, 'message' => 'طريقة الدفع تطبيق تتطلب مبلغ تطبيق أكبر من صفر'];
            }
        } elseif ($method === 'mixed') {
            if ($cash <= 0.0001 || $app <= 0.0001) {
                return ['ok' => false, 'message' => 'طريقة الدفع المختلط تتطلب مبلغ كاش ومبلغ تطبيق'];
            }
            if (abs(($cash + $app) - $paid) > 0.01) {
                return ['ok' => false, 'message' => 'مجموع الكاش والتطبيق يجب أن يساوي المبلغ المدفوع'];
            }
        } else {
            $cash = $paid;
            $app = 0.0;
        }

        return [
            'ok' => true,
            'paid_amount' => $paid,
            'cash_amount' => $cash,
            'app_amount' => $app,
        ];
    }

    /**
     * سحب تكلفة البيع من طبقات الشراء (FIFO) بناءً على الكمية بالحبات.
     * هذا يضمن أن الكميات القديمة بسعر قديم لا تختلط مع المشتريات الجديدة.
     *
     * @return array{total_cost: float, consumed_qty: float}
     */
    private function consumePurchaseLayersForSale(Product $product, float $quantityInPieces): array
    {
        $required = max(0.0, (float) $quantityInPieces);
        if ($required <= 0.00001 || !Schema::hasColumn('purchase_items', 'remaining_quantity')) {
            return ['total_cost' => 0.0, 'consumed_qty' => 0.0];
        }

        $layers = PurchaseItem::query()
            ->where('product_id', $product->id)
            ->where('remaining_quantity', '>', 0)
            ->orderBy('id', 'asc')
            ->lockForUpdate()
            ->get();

        $remaining = $required;
        $totalCost = 0.0;
        $consumed = 0.0;

        foreach ($layers as $layer) {
            if ($remaining <= 0.00001) {
                break;
            }
            $available = max(0.0, (float) $layer->remaining_quantity);
            if ($available <= 0.00001) {
                continue;
            }
            $take = min($available, $remaining);
            $costPerPiece = max(0.0, (float) $layer->unit_price);
            $totalCost += $take * $costPerPiece;
            $consumed += $take;
            $remaining -= $take;

            $layer->remaining_quantity = max(0.0, $available - $take);
            $layer->save();
        }

        // في حال كانت البيانات التاريخية بلا طبقات كافية، نكمل بالتكلفة الافتراضية حتى لا يتعطل البيع.
        if ($remaining > 0.00001) {
            $fallbackPerPiece = max(0.0, (float) $product->costPricePerInventoryPiece());
            $totalCost += $remaining * $fallbackPerPiece;
            $consumed += $remaining;
        }

        return [
            'total_cost' => round($totalCost, 6),
            'consumed_qty' => round($consumed, 6),
        ];
    }

    private function appendReasonKeepMeta(?string $existingNotes, string $reason): string
    {
        $meta = $this->extractMetaFromNotes($existingNotes);
        $base = trim((string) $existingNotes);
        $pos = strrpos($base, '__meta:');
        if ($pos !== false) {
            $base = trim(substr($base, 0, $pos));
        }
        $withReason = trim($base . "\n" . 'مرتجع: ' . trim($reason));
        $customerName = $meta['customer_name'] ?? null;
        $cashierName = $meta['cashier_name'] ?? null;
        return $this->buildOrderNotesWithMeta($withReason, $customerName, $cashierName);
    }

    private function normalizeOrderStatusForStorage(string $status): string
    {
        // Some databases still have older ENUMs without partially_paid.
        // We gracefully downgrade to pending to avoid SQL truncation errors.
        if ($status === 'partially_paid') {
            return 'pending';
        }
        return $status;
    }

    private function recordCreditSaleMovement(Order $order, float $dueAmount, ?string $fallbackCustomerName = null): void
    {
        if (!$this->canUseCreditMovementsTable()) {
            return;
        }
        
        $due = round(max(0, $dueAmount), 2);
        if ($due <= 0.00001) {
            return;
        }
        
        $customerId = $order->customer_id;
        if (!$customerId) return;
        
        // ✅ 1. التحقق من وجود رصيد دائن (Available Credit) للزبون
        $movements = CustomerCreditMovement::where('customer_id', $customerId)
            ->orderBy('occurred_at', 'asc')
            ->get();
        
        $currentBalance = 0;
        foreach ($movements as $movement) {
            $currentBalance += (float) $movement->delta_amount;
        }
        
        $availableCredit = max(0, -$currentBalance);  // ✅ الرصيد الدائن (السالب يصبح موجب)
        
        $amountToAddAsDebt = $due;
        $usedCredit = 0;
        
        // ✅ 2. إذا كان هناك رصيد دائن، استخدمه أولاً
        if ($availableCredit > 0) {
            $usedCredit = min($availableCredit, $due);
            $amountToAddAsDebt = $due - $usedCredit;
            
            // ✅ سجل استخدام الرصيد الدائن
            if ($usedCredit > 0) {
                CustomerCreditMovement::create([
                    'customer_id' => $customerId,
                    'customer_name' => $order->customer?->name ?? $fallbackCustomerName,
                    'movement_type' => 'credit_usage',
                    'delta_amount' => $usedCredit,  // ✅ موجب = استخدام الرصيد الدائن
                    'reference_order_id' => $order->id,
                    'payment_method' => $order->payment_method,
                    'cashier_id' => $order->created_by,
                    'cashier_name' => $this->extractMetaFromNotes($order->notes)['cashier_name'] ?? null,
                    'note' => 'استخدام رصيد دائن من فاتورة #' . $order->order_number,
                    'occurred_at' => $order->created_at ?: now(),
                ]);
            }
        }
        
        // ✅ 3. سجل الدين الجديد (إذا بقي مبلغ)
        if ($amountToAddAsDebt > 0) {
            CustomerCreditMovement::create([
                'customer_id' => $customerId,
                'customer_name' => $order->customer?->name ?? $fallbackCustomerName,
                'movement_type' => 'credit_sale',
                'delta_amount' => $amountToAddAsDebt,  // ✅ موجب = دين جديد
                'reference_order_id' => $order->id,
                'payment_method' => $order->payment_method,
                'cashier_id' => $order->created_by,
                'cashier_name' => $this->extractMetaFromNotes($order->notes)['cashier_name'] ?? null,
                'note' => 'فاتورة بيع آجل #' . $order->order_number,
                'occurred_at' => $order->created_at ?: now(),
            ]);
        }
    }

    private function canUseCreditMovementsTable(): bool
    {
        try {
            return Schema::hasTable('customer_credit_movements');
        } catch (\Throwable $e) {
            Log::warning('credit movements table check failed: ' . $e->getMessage());
            return false;
        }
    }
}