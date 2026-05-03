<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Customer;
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
use App\Models\CustomerCreditMovement;
use App\Models\SystemNotification;
use App\Models\SystemSetting;
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

        // ——— التحقق من الحسابات: مجموع الأسطر = المجموع الفرعي، والإجمالي = بعد الخصم (بدون ضريبة) ———
        $computedSubtotal = 0.0;
        foreach ($request->items as $item) {
            $computedSubtotal += (float) ($item['quantity'] ?? 0) * (float) ($item['price'] ?? 0);
        }
        $computedSubtotal = round($computedSubtotal, 2);
        $clientSubtotal = round((float) $request->subtotal, 2);
        if (abs($computedSubtotal - $clientSubtotal) > 0.05) {
            return response()->json([
                'success' => false,
                'message' => 'المجموع الفرعي لا يطابق بنود الفاتورة. أعد تحميل الصفحة وحاول مجدداً.',
                'error_code' => 'SUBTOTAL_MISMATCH',
                'data' => [
                    'computed_subtotal' => $computedSubtotal,
                    'client_subtotal' => $clientSubtotal,
                ],
            ], 422);
        }

        $discountVal = round((float) ($request->discount ?? 0), 2);
        $preTaxTotal = round($computedSubtotal - $discountVal, 2);
        if ($preTaxTotal < -0.02) {
            return response()->json([
                'success' => false,
                'message' => 'قيمة الخصم أكبر من مجموع البنود.',
            ], 422);
        }

        $taxVal = 0.0;
        $computedTotal = round($preTaxTotal, 2);
        $clientTotal = round((float) $request->total, 2);
        if (abs($computedTotal - $clientTotal) > 0.05) {
            return response()->json([
                'success' => false,
                'message' => 'إجمالي الفاتورة غير متسق مع المجموع الفرعي بعد الخصم.',
                'error_code' => 'TOTAL_MISMATCH',
                'data' => [
                    'computed_total' => $computedTotal,
                    'client_total' => $clientTotal,
                ],
            ], 422);
        }

        $totalAmount = $computedTotal;

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

        $pmNorm = strtolower((string) ($request->payment_method ?? 'cash'));
        if ($pmNorm !== 'credit' && (float) $request->paid_amount > $totalAmount + 0.02) {
            return response()->json([
                'success' => false,
                'message' => 'المبلغ المدفوع أكبر من إجمالي الفاتورة.',
            ], 422);
        }

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
                $fifoLayersSnapshot = $fifoCost['layers'] ?? [];
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
                    'unit_profit' => $unitProfit,
                    'fifo_layers' => $fifoLayersSnapshot,
                ];
            }

            // تعديل الربح الإجمالي ليعكس خصم الفاتورة (قبل الضريبة) — متوافق مع واجهة الكاشير
            $profitScale = $computedSubtotal > 0.00001
                ? max(0.0, min(1.0, $preTaxTotal / $computedSubtotal))
                : 1.0;
            $totalProfit = round($totalProfit * $profitScale, 2);

            // 2. إنشاء رقم الطلب
            $orderCount = Order::whereDate('created_at', today())->count();
            $orderNumber = 'ORD-' . date('Ymd') . '-' . str_pad($orderCount + 1, 4, '0', STR_PAD_LEFT);

            // 3. حساب المبلغ المستحق والحالة ($totalAmount مُتحقَّق مسبقاً من بنود الفاتورة)
            // ✅ معالجة خاصة للبيع الآجل
            if ($request->payment_method === 'credit') {
                $paidAmount = 0;
                $dueAmount = $totalAmount;
                $status = 'pending';
            } else {
                $paidAmount = (float) $request->paid_amount;
                $dueAmount = max(0, round($totalAmount - $paidAmount, 2));

                $status = 'pending';
                if ($paidAmount + 0.005 >= $totalAmount) {
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
                'subtotal' => $computedSubtotal,
                'discount' => $discountVal,
                'tax' => $taxVal,
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
                $scaledItemProfit = round((float) ($productInfo['item_profit'] ?? 0) * $profitScale, 2);
                $scaledUnitProfit = $quantity > 0.00001 ? round($scaledItemProfit / $quantity, 4) : 0.0;

                // إنشاء عنصر الطلب
                $orderItemPayload = [
                    'order_id' => $order->id,
                    'item_id' => $product->id,
                    'item_type' => Product::class,
                    'item_name' => $productInfo['line_name'] ?? $product->name,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'unit_cost' => $productInfo['unit_cost'],
                    'unit_profit' => $scaledUnitProfit,
                    'item_profit' => $scaledItemProfit,
                    'discount' => 0,
                    'total_price' => $quantity * $unitPrice,
                ];
                if (Schema::hasColumn('order_items', 'fifo_cost_layers')) {
                    $orderItemPayload['fifo_cost_layers'] = $productInfo['fifo_layers'] ?? [];
                }
                if (Schema::hasColumn('order_items', 'inventory_pieces_sold')) {
                    $orderItemPayload['inventory_pieces_sold'] = $stockDeductQty;
                }
                if (Schema::hasColumn('order_items', 'sale_quantity_returned')) {
                    $orderItemPayload['sale_quantity_returned'] = 0;
                }
                OrderItem::create($orderItemPayload);

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
                $saleActor = $request->user();
                $isCashierActor = $saleActor && (string) ($saleActor->role ?? '') === 'cashier';
                $allowCashierSaleNotify = $this->adminPrefCashierSaleNotificationsEnabled((int) $order->pharmacy_id);
                $shouldNotifySale = (!$isCashierActor || $allowCashierSaleNotify) && Schema::hasTable('system_notifications');
                if ($shouldNotifySale) {
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

/**
 * تقرير المبيعات المفصل (يومي، أسبوعي، شهري)
 */

    /**
     * ✅ تحديث الخزنة: الكاش والتطبيق (والمختلط) يزيدان الرصيد ويُسجَّلان بـ payment_method المناسب.
     */
    private function updateTreasury($order, $paidAmount, $profit, $paymentMethod, $type = 'product', $cashAmount = null, $appAmount = null)
    {
        $paidAmount = (float) $paidAmount;
        $profit = (float) $profit;
        $paymentMethod = strtolower((string) $paymentMethod);

        $treasury = Treasury::getActive();

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

    public function updateCreditCustomer(Request $request, $customerId)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:120',
            'phone' => 'nullable|string|max:30',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'بيانات غير صالحة',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $customer = Customer::find((int) $customerId);
            if (!$customer) {
                return response()->json([
                    'success' => false,
                    'message' => 'الزبون غير موجود',
                ], 404);
            }

            $customer->name = trim((string) $request->input('name'));
            $customer->phone = trim((string) $request->input('phone', '')) ?: '—';
            $customer->save();

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث بيانات زبون الآجل',
                'data' => [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'phone' => $customer->phone,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('updateCreditCustomer error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'تعذر تحديث بيانات الزبون',
            ], 500);
        }
    }

    public function applyCreditPayment(Request $request, $customerId)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'note' => 'nullable|string|max:300',
            'payment_method' => 'nullable|in:cash,app,mixed',
            'cash_amount' => 'nullable|numeric|min:0',
            'app_amount' => 'nullable|numeric|min:0',
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'بيانات غير صالحة',
                'errors' => $validator->errors(),
            ], 422);
        }
    
        try {
            $amount = round((float) $request->amount, 2);
            $pm = strtolower((string) $request->input('payment_method', 'cash'));
            if (! in_array($pm, ['cash', 'app', 'mixed'], true)) {
                $pm = 'cash';
            }
            $cashAmount = round((float) ($request->input('cash_amount') ?? 0), 2);
            $appAmount = round((float) ($request->input('app_amount') ?? 0), 2);

            if ($pm === 'cash') {
                $cashAmount = $amount;
                $appAmount = 0.0;
            } elseif ($pm === 'app') {
                $appAmount = $amount;
                $cashAmount = 0.0;
            } else {
                if ($cashAmount <= 0.0001 || $appAmount <= 0.0001) {
                    return response()->json([
                        'success' => false,
                        'message' => 'في الدفع المختلط يجب إدخال مبلغ كاش ومبلغ تطبيق',
                    ], 422);
                }
                if (abs($cashAmount + $appAmount - $amount) > 0.01) {
                    return response()->json([
                        'success' => false,
                        'message' => 'مجموع الكاش والتطبيق يجب أن يساوي مبلغ التسديد',
                    ], 422);
                }
            }

            if (abs(($cashAmount + $appAmount) - $amount) > 0.01) {
                return response()->json([
                    'success' => false,
                    'message' => 'مبالغ الكاش/التطبيق لا تطابق المبلغ الإجمالي',
                ], 422);
            }

            DB::beginTransaction();
            
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
                
                $pay = round(min($remaining, $due), 2);
                $order->paid_amount = round(((float) $order->paid_amount) + $pay, 2);
                $order->due_amount = round($due - $pay, 2);
                
                // ✅ استخدام دالة normalizeOrderStatusForStorage
                $newStatus = $order->due_amount <= 0.00001 ? 'paid' : 'partially_paid';
                $order->status = $this->normalizeOrderStatusForStorage($newStatus);
                
                $order->save();
                
                $remaining -= $pay;
                $affected++;
            }

            $unappliedCredit = round(max(0, $remaining), 2);
            $applied = round($amount - $unappliedCredit, 2);

            // ✅ 3. حركة رصيد واحدة بمقدار المبلغ المستلم بالكامل (يغطي التسديد + أي رصيد دائن)
            if ($this->canUseCreditMovementsTable() && $amount > 0.00001) {
                CustomerCreditMovement::create([
                    'customer_id' => (int) $customerId,
                    'customer_name' => Customer::find($customerId)?->name,
                    'movement_type' => 'debt_payment',
                    'delta_amount' => -$amount,
                    'reference_order_id' => null,
                    'payment_method' => $pm === 'mixed' ? 'mixed' : $pm,
                    'cashier_id' => auth()->id() ?? 1,
                    'cashier_name' => auth()->user()?->username ?? auth()->user()?->name ?? 'system',
                    'note' => $request->input('note', 'تسديد دين زبون'),
                    'occurred_at' => now(),
                ]);
            }

            // ✅ 4. إيداع المبلغ في الخزنة حسب الكاش/التطبيق
            if ($amount > 0.00001) {
                $treasury = Treasury::getActive();
                if ($treasury) {
                    $c = round($cashAmount, 2);
                    $a = round($appAmount, 2);
                    if (abs($c + $a - $amount) > 0.05) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => 'تعارض في توزيع الكاش والتطبيق',
                        ], 422);
                    }
                    $treasury->applyLiquidityDelta($c, $a);
                    $treasury->total_income = round((float) ($treasury->total_income ?? 0) + $amount, 2);
                    $treasury->save();

                    $noteBase = $request->input('note', 'تسديد دين زبون');
                    foreach (
                        [
                            ['amt' => $c, 'method' => 'cash', 'suffix' => ' — كاش'],
                            ['amt' => $a, 'method' => 'app', 'suffix' => ' — تطبيق'],
                        ] as $leg
                    ) {
                        if ($leg['amt'] > 0.00001 && class_exists(TreasuryTransaction::class)) {
                            TreasuryTransaction::create([
                                'treasury_id' => $treasury->id,
                                'type' => 'income',
                                'amount' => $leg['amt'],
                                'description' => $noteBase . $leg['suffix'],
                                'category' => 'other_income',
                                'payment_method' => $leg['method'],
                                'transaction_date' => now(),
                                'created_by' => auth()->id() ?? 1,
                            ]);
                        }
                    }
                }
            }

            DB::commit();

            $affectedOrdersMessage = $unappliedCredit > 0.00001
                ? " — المتبقي {$unappliedCredit} شيكل سُجّل كرصيد دائن للزبون"
                : '';
            
            return response()->json([
                'success' => true,
                'message' => 'تم تسجيل التسديد بنجاح' . $affectedOrdersMessage,
                'data' => [
                    'paid_applied' => $applied,
                    'unapplied' => $unappliedCredit,
                    'affected_orders' => $affected,
                    'available_credit_remaining' => $unappliedCredit,
                    'payment_method' => $pm,
                    'cash_amount' => round($cashAmount, 2),
                    'app_amount' => round($appAmount, 2),
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

        // ===== 2.6. جلب عمليات الجرد المنفذة من الكاشير (من staff_activities) =====
        if (Schema::hasTable('staff_activities')) {
            $stocktakeQuery = StaffActivity::query()
                ->where('action_type', 'stocktake_apply')
                ->whereBetween('created_at', [$today, $tomorrow])
                ->orderBy('created_at', 'desc');
            $stocktakeRows = $stocktakeQuery->get();

            foreach ($stocktakeRows as $row) {
                $meta = is_array($row->meta) ? $row->meta : (json_decode((string) $row->meta, true) ?: []);
                if ($mineOnly && $authUser) {
                    $rowUserId = (int) ($row->user_id ?? 0);
                    $rowUsername = trim((string) ($row->username ?? ''));
                    $metaUserId = (int) ($meta['cashier_user_id'] ?? 0);
                    $metaUsername = trim((string) ($meta['cashier_username'] ?? ''));
                    $sameActor =
                        ($rowUserId > 0 && $rowUserId === (int) $authUser->id) ||
                        ($metaUserId > 0 && $metaUserId === (int) $authUser->id) ||
                        ($rowUsername !== '' && strcasecmp($rowUsername, (string) $authUser->username) === 0) ||
                        ($metaUsername !== '' && strcasecmp($metaUsername, (string) $authUser->username) === 0);
                    if (!$sameActor) {
                        continue;
                    }
                }
                $itemsCount = (int) ($meta['items_count'] ?? (is_array($meta['items'] ?? null) ? count($meta['items']) : 0));
                $transactions->push([
                    'id' => 'stocktake_' . $row->id,
                    'transaction_id' => $row->id,
                    'type' => 'stocktake',
                    'type_label' => 'جرد مخزون',
                    'reference_number' => 'STK-' . $row->id,
                    'customer_id' => null,
                    'customer_name' => (string) ($meta['stocktake_title'] ?? 'جرد مخزون'),
                    'payment_method' => null,
                    'total_amount' => 0,
                    'paid_amount' => 0,
                    'due_amount' => 0,
                    'cashier_name' => $row->username ?? '—',
                    'status' => 'completed',
                    'items_count' => $itemsCount,
                    'occurred_at' => optional($row->created_at)->toISOString(),
                    'icon' => 'fact_check',
                    'color' => 'warning',
                    'note' => $row->description ?: 'تطبيق جرد مخزون',
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

            $order = Order::with('items')->find($id);

            if (!$order) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'الطلب غير موجود'
                ], 404);
            }

            if (in_array($order->status, ['cancelled', 'returned'], true)) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'الطلب مُلغى أو مُرجع مسبقاً',
                ], 422);
            }

            foreach ($request->items as $itemReq) {
                $orderItem = OrderItem::whereKey($itemReq['order_item_id'])->lockForUpdate()->first();
                if (!$orderItem || (int) $orderItem->order_id !== (int) $order->id) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'بند غير صالح في الطلب',
                    ], 422);
                }
                $reqQty = (float) ($itemReq['quantity'] ?? 0);
                $origQty = (float) ($orderItem->quantity ?? 0);
                $alreadyReturned = Schema::hasColumn('order_items', 'sale_quantity_returned')
                    ? (float) ($orderItem->sale_quantity_returned ?? 0)
                    : 0.0;
                $maxReturn = $origQty - $alreadyReturned;
                if ($reqQty > $maxReturn + 0.0001) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'كمية الإرجاع أكبر من المتبقي للبند: ' . ($orderItem->item_name ?? ''),
                    ], 422);
                }
            }

            foreach ($request->items as $itemReq) {
                $orderItem = OrderItem::whereKey($itemReq['order_item_id'])->lockForUpdate()->first();
                $productId = $orderItem->product_id ?? $orderItem->item_id;
                $product = Product::whereKey($productId)->lockForUpdate()->first();
                if (!$product) {
                    continue;
                }
                $this->applyOrderItemSaleReturn($orderItem, $product, (float) ($itemReq['quantity'] ?? 0));
            }

            $refundAmt = round((float) $request->refund_amount, 2);
            if ($refundAmt > 0) {
                $treasury = Treasury::lockActiveForUpdate();
                if ($treasury) {
                    [$rCash, $rApp] = $this->treasuryRefundChannelsForOrder($order, $refundAmt);
                    $treasury->applyLiquidityDelta(-$rCash, -$rApp);
                    $treasury->total_expenses += $refundAmt;
                    $paid = (float) $order->paid_amount;
                    if ($paid > 0.0001 && isset($treasury->total_profit, $order->total_profit)) {
                        $treasury->total_profit = max(
                            0,
                            ((float) ($treasury->total_profit ?? 0)) - ((float) $order->total_profit * ($refundAmt / $paid))
                        );
                    }
                    $treasury->save();
                }
            }

            if (Schema::hasColumn('orders', 'refunded_amount')) {
                $order->refunded_amount = round(((float) ($order->refunded_amount ?? 0)) + $refundAmt, 2);
            }

            $order->refresh()->load('items');
            $allReturned = true;
            if (Schema::hasColumn('order_items', 'sale_quantity_returned')) {
                foreach ($order->items as $oi) {
                    $orig = (float) ($oi->quantity ?? 0);
                    $ret = (float) ($oi->sale_quantity_returned ?? 0);
                    if ($ret + 0.0001 < $orig) {
                        $allReturned = false;
                        break;
                    }
                }
            }
            if ($allReturned) {
                $order->status = 'cancelled';
            }
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
            ->withCount('items')
             ->orderBy('created_at', 'desc');
         if ($mineOnly && $authUser) {
             $ordersQuery->where('created_by', $authUser->id);
         }
         $orders = $ordersQuery->get();
         
         foreach ($orders as $order) {
            $statusKey = strtolower((string) ($order->status ?? ''));
            $isReturnedSale = in_array($statusKey, ['cancelled', 'returned'], true);
             $transactions->push([
                 'id' => 'order_' . $order->id,
                 'transaction_id' => $order->id,
                 'type' => 'sale',
                'type_label' => $isReturnedSale ? 'مرجع مبيعات' : 'فاتورة بيع',
                 'reference_number' => $order->order_number,
                 'customer_id' => $order->customer_id,
                 'customer_name' => $order->customer?->name ?? $this->extractMetaFromNotes($order->notes)['customer_name'] ?? 'زبون عابر',
                 'payment_method' => $order->payment_method,
                 'total_amount' => (float) $order->total,
                 'paid_amount' => (float) $order->paid_amount,
                 'due_amount' => (float) $order->due_amount,
                 'cashier_name' => $order->createdBy?->username ?? $this->extractMetaFromNotes($order->notes)['cashier_name'] ?? '—',
                 'status' => $order->status,
                'items_count' => (int) ($order->items_count ?? 0),
                 'occurred_at' => $order->created_at->toISOString(),
                 'icon' => 'receipt',
                'color' => $isReturnedSale ? 'error' : 'primary',
                'note' => $order->notes ?? null,
             ]);
         }
         
         // ===== 1.5. جلب مشتريات الموردين (من purchases) =====
         if (Schema::hasTable('purchases')) {
            $purchasesQuery = Purchase::whereBetween('created_at', [$today, $tomorrow])
                ->with(['supplier', 'createdBy'])
                ->withCount('items')
                 ->orderBy('created_at', 'desc');
             if ($mineOnly && $authUser && Schema::hasColumn('purchases', 'created_by')) {
                 $purchasesQuery->where('created_by', $authUser->id);
             }
             $purchases = $purchasesQuery->get();
 
             foreach ($purchases as $purchase) {
                 $totalAmount = (float) ($purchase->total_amount ?? 0);
                 $paidAmount = (float) ($purchase->paid_amount ?? 0);
                 $remainingAmount = (float) ($purchase->remaining_amount ?? max(0, $totalAmount - $paidAmount));
                $statusKey = strtolower((string) ($purchase->status ?? ''));
                $isReturnedPurchase = $statusKey === 'returned';
                 $transactions->push([
                     'id' => 'purchase_' . $purchase->id,
                     'transaction_id' => $purchase->id,
                     'type' => 'purchase',
                    'type_label' => $isReturnedPurchase ? 'مرجع مشتريات' : 'فاتورة شراء',
                     'reference_number' => $purchase->invoice_number ?? ('PO-' . $purchase->id),
                     'customer_id' => $purchase->supplier_id,
                     'customer_name' => $purchase->supplier?->name ?? 'مورد',
                     'payment_method' => $purchase->payment_method ?? 'cash',
                     'total_amount' => -abs($totalAmount),
                     'paid_amount' => $paidAmount,
                     'due_amount' => max(0, $remainingAmount),
                     'cashier_name' => $purchase->createdBy?->username ?? '—',
                     'status' => $purchase->status ?? 'completed',
                    'items_count' => (int) ($purchase->items_count ?? 0),
                     'occurred_at' => optional($purchase->created_at)->toISOString(),
                     'icon' => 'local_shipping',
                    'color' => $isReturnedPurchase ? 'error' : 'warning'
                 ]);
             }
         }
 
        
         // ===== 2. جلب حركات الجرد (من staff_activities) =====
if (Schema::hasTable('staff_activities')) {
    $stocktakeQuery = StaffActivity::query()
        ->where('action_type', 'stocktake_apply')
        ->whereBetween('created_at', [$today, $tomorrow])
        ->orderBy('created_at', 'desc');
    
    if ($mineOnly && $authUser) {
        $stocktakeQuery->where(function ($q) use ($authUser) {
            $q->where('user_id', $authUser->id)
              ->orWhere('username', $authUser->username);
        });
    }
    
    $stocktakes = $stocktakeQuery->get();
    
    foreach ($stocktakes as $stocktake) {
        $meta = is_array($stocktake->meta) ? $stocktake->meta : (json_decode((string) $stocktake->meta, true) ?: []);
        $items = $meta['items'] ?? [];
        $itemsCount = count($items);
        
        // حساب الفرق الإجمالي للجرد
        $totalDifference = 0;
        $detailedItems = [];
        
        foreach ($items as $item) {
            $diff = (float) ($item['difference'] ?? 0);
            $totalDifference += $diff;
            
            // ✅ تجهيز تفاصيل كل صنف للعرض
            $detailedItems[] = [
                'product_id' => $item['product_id'] ?? null,
                'product_name' => $item['product_name'] ?? 'منتج غير معروف',
                'before_qty' => (float) ($item['before_qty'] ?? 0),
                'after_qty' => (float) ($item['after_qty'] ?? 0),
                'difference' => $diff,
                'difference_display' => ($diff >= 0 ? '+' : '') . number_format($diff, 2),
                'barcode' => $item['barcode'] ?? null,
            ];
        }
        
        $transactions->push([
            'id' => 'stocktake_' . $stocktake->id,
            'transaction_id' => $stocktake->id,
            'type' => 'stocktake',
            'type_label' => 'جرد مخزون',
            'reference_number' => 'STK-' . $stocktake->id,
            'customer_id' => null,
            'customer_name' => (string) ($meta['stocktake_title'] ?? 'جرد مخزون'),
            'payment_method' => null,
            'total_amount' => $totalDifference,
            'paid_amount' => 0,
            'due_amount' => 0,
            'cashier_name' => $stocktake->username ?? '—',
            'status' => 'completed',
            'items_count' => $itemsCount,
            'occurred_at' => optional($stocktake->created_at)->toISOString(),
            'icon' => 'inventory',
            'color' => 'warning',
            'note' => $stocktake->description ?: 'تطبيق جرد مخزون',
            // ✅ إضافة التفاصيل الكاملة هنا
            'detailed_data' => [
                'items' => $detailedItems,
                'items_count' => $itemsCount,
                'total_difference' => $totalDifference,
                'total_difference_display' => ($totalDifference >= 0 ? '+' : '') . number_format($totalDifference, 2),
                'stocktake_title' => $meta['stocktake_title'] ?? 'جرد مخزون',
                'stocktake_session_id' => $meta['stocktake_session_id'] ?? null,
                'description' => $stocktake->description,
            ]
        ]);
    }
}
 
         // ===== 3. جلب حركات الخزنة النقدية (Treasury transactions) =====
         if (Schema::hasTable('treasury_transactions')) {
             $treasuryTransQuery = TreasuryTransaction::whereBetween('transaction_date', [$today, $tomorrow])
                 ->whereIn('type', ['expense', 'income'])
                 ->whereNotIn('category', ['sales_income', 'meal_income', 'purchases', 'purchase_expense'])
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
 
         // ===== 4. جلب حركات تسديد الديون (من customer_credit_movements) =====
         if (Schema::hasTable('customer_credit_movements')) {
             $paymentsQuery = CustomerCreditMovement::whereBetween('occurred_at', [$today, $tomorrow])
                 ->where('movement_type', 'debt_payment')
                 ->where(function ($q) {
                     $q->whereNull('note')->orWhere('note', 'not like', '%مورد%');
                 })
                 ->where(function ($q) {
                     $q->whereNull('customer_name')->orWhere('customer_name', 'not like', '%مورد%');
                 })
                 ->orderBy('occurred_at', 'desc');
             if ($mineOnly && $authUser) {
                 $paymentsQuery->where('cashier_name', $authUser->username);
             }
             $payments = $paymentsQuery->get();
             
             foreach ($payments as $payment) {
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
 
         // ===== 5. جلب تسديدات ديون الموردين (من staff_activities) =====
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
                 if ($paidAmount <= 0) continue;
 
                 $transactions->push([
                     'id' => 'supplier_payment_' . $payment->id,
                     'transaction_id' => $payment->id,
                     'type' => 'debt_payment',
                     'type_label' => 'تسديد دين مورد',
                     'reference_number' => 'SUP-PAY-' . $payment->id,
                     'customer_id' => $meta['supplier_id'] ?? null,
                     'customer_name' => (string) ($meta['supplier_name'] ?? 'مورد'),
                     'payment_method' => (string) ($meta['payment_method'] ?? 'cash'),
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
 
         // ===== 6. إزالة تكرار تسديد الدين بين المصادر المختلفة =====
         $dedupedTransactions = collect();
         $seenPaymentKeys = [];
         foreach ($transactions as $tx) {
             $type = strtolower((string) ($tx['type'] ?? ''));
             if ($type !== 'debt_payment') {
                 $dedupedTransactions->push($tx);
                 continue;
             }
 
             $occurredAt = (string) ($tx['occurred_at'] ?? '');
             $minuteBucket = $occurredAt !== '' ? substr($occurredAt, 0, 16) : '';
             $amount = round((float) ($tx['total_amount'] ?? 0), 2);
             $cashier = strtolower(trim((string) ($tx['cashier_name'] ?? '')));
             $method = strtolower(trim((string) ($tx['payment_method'] ?? '')));
             $key = implode('|', [$amount, $minuteBucket, $cashier, $method]);
 
             if (!array_key_exists($key, $seenPaymentKeys)) {
                 $seenPaymentKeys[$key] = $dedupedTransactions->count();
                 $dedupedTransactions->push($tx);
                 continue;
             }
 
             $existingIndex = $seenPaymentKeys[$key];
             $existing = $dedupedTransactions->get($existingIndex);
             $isCurrentSupplier = str_contains((string) ($tx['type_label'] ?? ''), 'مورد');
             $isExistingSupplier = str_contains((string) ($existing['type_label'] ?? ''), 'مورد');
             if ($isCurrentSupplier && !$isExistingSupplier) {
                 $dedupedTransactions->put($existingIndex, $tx);
             }
         }
 
         // ===== 7. ترتيب حسب التاريخ (الأحدث أولاً) =====
         $sortedTransactions = $dedupedTransactions->sortByDesc('occurred_at')->values();
         
         // ===== 8. إحصائيات اليوم =====
         $stats = [
             'total_sales' => $orders->sum('total'),
             'total_paid' => $orders->sum('paid_amount'),
             'total_debt_paid' => $sortedTransactions->where('type', 'debt_payment')->sum('total_amount'),
             'total_purchases' => abs($sortedTransactions->where('type', 'purchase')->sum('total_amount')),
             'total_expenses' => abs($sortedTransactions->where('type', 'expense')->sum('total_amount')),
             'total_income' => $sortedTransactions->where('type', 'income')->sum('total_amount'),
             'total_orders' => $orders->count(),
             'total_payments' => $sortedTransactions->where('type', 'debt_payment')->count(),
             'total_stocktakes' => $sortedTransactions->where('type', 'stocktake')->count(),
             'net_cash_flow' => $orders->sum('total') - abs($sortedTransactions->where('type', 'purchase')->sum('total_amount')),
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
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'الطلب غير موجود'
                ], 404);
            }

            if (in_array($order->status, ['cancelled', 'returned'], true)) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'الطلب مُلغى أو مُرجع مسبقاً'
                ], 422);
            }

            $order->loadMissing('items');
            foreach ($order->items as $item) {
                $productId = $item->product_id ?? $item->item_id;
                $product = Product::whereKey($productId)->lockForUpdate()->first();
                if (!$product) {
                    continue;
                }
                $origQty = (float) ($item->quantity ?? 0);
                $alreadyReturned = Schema::hasColumn('order_items', 'sale_quantity_returned')
                    ? (float) ($item->sale_quantity_returned ?? 0)
                    : 0.0;
                $remainingSale = max(0.0, $origQty - $alreadyReturned);
                if ($remainingSale <= 0.00001) {
                    continue;
                }
                $this->applyOrderItemSaleReturn($item, $product, $remainingSale);
            }

            $previouslyRefunded = Schema::hasColumn('orders', 'refunded_amount')
                ? (float) ($order->refunded_amount ?? 0)
                : 0.0;
            $paidOrder = (float) $order->paid_amount;
            $refundAmount = max(0.0, round($paidOrder - $previouslyRefunded, 2));

            $treasury = null;
            if ($refundAmount > 0.00001) {
                $treasury = Treasury::lockActiveForUpdate();
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
                if ($paidOrder > 0.0001 && isset($treasury->total_profit, $order->total_profit)) {
                    $treasury->total_profit = max(
                        0,
                        ((float) ($treasury->total_profit ?? 0)) - ((float) $order->total_profit * ($refundAmount / $paidOrder))
                    );
                }
                $treasury->save();
            }

            if (Schema::hasColumn('orders', 'refunded_amount')) {
                $order->refunded_amount = round($previouslyRefunded + $refundAmount, 2);
            }

            $order->status = 'cancelled';
            $order->notes = $this->appendReasonKeepMeta($order->notes, (string) ($request->reason ?? 'بدون سبب'));
            $order->save();
    
            DB::commit();

            $treasuryBalance = $treasury
                ? (float) ($treasury->balance ?? 0)
                : (float) (Treasury::getActive()->balance ?? 0);

            return response()->json([
                'success' => true,
                'message' => $refundAmount > 0.00001
                    ? 'تم إرجاع الطلب واسترداد المبلغ بنجاح'
                    : 'تم إرجاع الأصناف للمخزون (لا مبلغ مسترد للفاتورة)',
                'data' => [
                    'order' => $order,
                    'refund_amount' => $refundAmount,
                    'treasury_balance' => $treasuryBalance,
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
     * @return array{total_cost: float, consumed_qty: float, layers: array<int, array<string, mixed>>}
     */
    private function consumePurchaseLayersForSale(Product $product, float $quantityInPieces): array
    {
        $required = max(0.0, (float) $quantityInPieces);
        $layerDetails = [];

        if ($required <= 0.00001) {
            return ['total_cost' => 0.0, 'consumed_qty' => 0.0, 'layers' => []];
        }

        if (!Schema::hasColumn('purchase_items', 'remaining_quantity')) {
            $fallbackPerPiece = max(0.0, (float) $product->costPricePerInventoryPiece());
            $layerDetails[] = [
                'source' => 'fallback_no_fifo_column',
                'quantity_pieces' => round($required, 4),
                'unit_cost_per_piece' => round($fallbackPerPiece, 6),
                'line_cost' => round($required * $fallbackPerPiece, 4),
            ];

            return [
                'total_cost' => round($required * $fallbackPerPiece, 6),
                'consumed_qty' => round($required, 6),
                'layers' => $layerDetails,
            ];
        }

        $layers = PurchaseItem::query()
            ->where('product_id', $product->id)
            ->where('remaining_quantity', '>', 0)
            ->orderBy('id', 'asc')
            ->lockForUpdate()
            ->with(['purchase' => function ($q) {
                $q->select('id', 'invoice_number', 'purchase_date');
            }])
            ->get();

        $remainingNeed = $required;
        $totalCost = 0.0;
        $consumed = 0.0;

        foreach ($layers as $layer) {
            if ($remainingNeed <= 0.00001) {
                break;
            }
            $available = max(0.0, (float) $layer->remaining_quantity);
            if ($available <= 0.00001) {
                continue;
            }
            $take = min($available, $remainingNeed);
            $costPerPiece = max(0.0, (float) $layer->unit_price);
            $lineCost = $take * $costPerPiece;
            $totalCost += $lineCost;
            $consumed += $take;
            $remainingNeed -= $take;

            $layer->remaining_quantity = max(0.0, $available - $take);
            $layer->save();

            $p = $layer->purchase;
            $layerDetails[] = [
                'source' => 'purchase_fifo',
                'purchase_item_id' => (int) $layer->id,
                'purchase_id' => (int) $layer->purchase_id,
                'invoice_number' => $p?->invoice_number,
                'purchase_date' => $p && $p->purchase_date ? $p->purchase_date->format('Y-m-d') : null,
                'quantity_pieces' => round($take, 4),
                'unit_cost_per_piece' => round($costPerPiece, 6),
                'line_cost' => round($lineCost, 4),
            ];
        }

        if ($remainingNeed > 0.00001) {
            $fallbackPerPiece = max(0.0, (float) $product->costPricePerInventoryPiece());
            $fbCost = $remainingNeed * $fallbackPerPiece;
            $totalCost += $fbCost;
            $consumed += $remainingNeed;
            $layerDetails[] = [
                'source' => 'fallback_insufficient_layers',
                'quantity_pieces' => round($remainingNeed, 4),
                'unit_cost_per_piece' => round($fallbackPerPiece, 6),
                'line_cost' => round($fbCost, 4),
            ];
        }

        return [
            'total_cost' => round($totalCost, 6),
            'consumed_qty' => round($consumed, 6),
            'layers' => $layerDetails,
        ];
    }

    /**
     * عدد القطع (وحدة المخزون) التي خُصمت عند البيع لهذا السطر.
     */
    private function orderItemInventoryPiecesSold(OrderItem $item): float
    {
        if (Schema::hasColumn('order_items', 'inventory_pieces_sold') && $item->inventory_pieces_sold !== null) {
            return max(0.0, (float) $item->inventory_pieces_sold);
        }
        $layers = $item->fifo_cost_layers;
        if (is_array($layers)) {
            $sum = 0.0;
            foreach ($layers as $layer) {
                $sum += (float) ($layer['quantity_pieces'] ?? 0);
            }
            if ($sum > 0.00001) {
                return $sum;
            }
        }

        return max(0.0, (float) ($item->quantity ?? 0));
    }

    /**
     * إعادة كمية إلى طبقات شراء FIFO (عكس الاستهلاك عند البيع).
     */
    private function restoreFifoPurchaseLayersForSaleReturn(OrderItem $orderItem, float $fraction): void
    {
        $fraction = max(0.0, min(1.0, $fraction));
        if ($fraction <= 0.00001) {
            return;
        }
        if (!Schema::hasColumn('purchase_items', 'remaining_quantity')) {
            return;
        }
        $layers = $orderItem->fifo_cost_layers;
        if (!is_array($layers)) {
            return;
        }
        foreach ($layers as $layer) {
            if (($layer['source'] ?? '') !== 'purchase_fifo') {
                continue;
            }
            $pid = $layer['purchase_item_id'] ?? null;
            if (!$pid) {
                continue;
            }
            $qty = (float) ($layer['quantity_pieces'] ?? 0);
            if ($qty <= 0.00001) {
                continue;
            }
            $restore = round($qty * $fraction, 4);
            if ($restore <= 0.00001) {
                continue;
            }
            $pi = PurchaseItem::whereKey($pid)->lockForUpdate()->first();
            if ($pi) {
                $pi->remaining_quantity = (float) ($pi->remaining_quantity ?? 0) + $restore;
                $pi->save();
            }
        }
    }

    /**
     * إرجاع جزء من سطر البيع: زيادة مخزون القطع + عكس FIFO بنفس نسبة وحدات البيع.
     *
     * @return array{delta_sale_units: float, pieces_restored: float}
     */
    private function applyOrderItemSaleReturn(OrderItem $orderItem, Product $product, float $requestedSaleUnits): array
    {
        $origQty = max(0.0, (float) ($orderItem->quantity ?? 0));
        if ($origQty <= 0.00001) {
            return ['delta_sale_units' => 0.0, 'pieces_restored' => 0.0];
        }
        $alreadyReturned = 0.0;
        if (Schema::hasColumn('order_items', 'sale_quantity_returned')) {
            $alreadyReturned = max(0.0, (float) ($orderItem->sale_quantity_returned ?? 0));
        }
        $remainingSale = max(0.0, $origQty - $alreadyReturned);
        if ($remainingSale <= 0.00001) {
            return ['delta_sale_units' => 0.0, 'pieces_restored' => 0.0];
        }
        $delta = min($requestedSaleUnits, $remainingSale);
        if ($delta <= 0.00001) {
            return ['delta_sale_units' => 0.0, 'pieces_restored' => 0.0];
        }
        $fraction = $delta / $origQty;
        $piecesSold = $this->orderItemInventoryPiecesSold($orderItem);
        $piecesToRestore = round($piecesSold * $fraction, 4);

        $product->stock = (float) $product->stock + $piecesToRestore;
        $product->save();

        $this->restoreFifoPurchaseLayersForSaleReturn($orderItem, $fraction);

        if (Schema::hasColumn('order_items', 'sale_quantity_returned')) {
            $orderItem->sale_quantity_returned = $alreadyReturned + $delta;
            $orderItem->save();
        }

        return ['delta_sale_units' => $delta, 'pieces_restored' => $piecesToRestore];
    }

    /**
     * تفضيل المدير «إشعار عند كل بيع من الكاشير» — notificationPrefs.admin.saleComplete في client_preferences.
     */
    private function adminPrefCashierSaleNotificationsEnabled(int $pharmacyId): bool
    {
        if (!Schema::hasTable('system_settings')) {
            return false;
        }
        $row = SystemSetting::query()->where('pharmacy_id', $pharmacyId)->where('key', 'client_preferences')->first();
        $prefs = is_array($row?->value_json) ? $row->value_json : [];
        $v = $prefs['notificationPrefs']['admin']['saleComplete'] ?? false;

        return $v === true || $v === 1 || $v === '1' || $v === 'true';
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