<?php

namespace App\Http\Controllers;

use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\PurchaseReturn;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\SystemNotification;
use App\Models\Treasury;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\TreasuryTransaction;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use App\Support\ActivityLogger;

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
            $supplierId = $request->get('supplier_id');
            $status = $request->get('status');
            
            $query = Purchase::with(['items', 'supplier', 'latestReturn.creator:id,username'])
                ->withSum([
                    'treasuryTransactions as return_refund_total' => function ($q) {
                        $q->where('type', 'income')->where('reference_type', 'purchase_return');
                    },
                    'treasuryTransactions as other_expenses_total' => function ($q) {
                        $q->where('type', 'expense')->where('category', 'other_expense');
                    },
                ], 'amount');
            
            if ($search) {
                $query->where('invoice_number', 'LIKE', "%{$search}%")
                  ->orWhereHas('supplier', function ($q) use ($search) {
                      $q->where('name', 'LIKE', "%{$search}%");
                  })
                  ->orWhereHas('treasuryTransactions', function ($q) use ($search) {
                      $q->where('type', 'expense')
                        ->where('category', 'other_expense')
                        ->where('description', 'LIKE', "%{$search}%");
                  })
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
            
            if ($supplierId !== null && $supplierId !== '') {
                // حماية ضد قيم مورد نصية/محلية (مثل SUP-123) حتى لا تسقط الاستعلامات
                if (ctype_digit((string) $supplierId) && Schema::hasColumn('purchases', 'supplier_id')) {
                    $query->where('supplier_id', (int) $supplierId);
                }
            }
            
            if ($status && in_array($status, ['pending', 'partially_paid', 'completed', 'returned'])) {
                $query->where('status', $status);
            }
            $purchaseKind = strtolower((string) $request->get('purchase_kind', ''));
            if ($purchaseKind === 'expenses_only') {
                $query->whereDoesntHave('items')
                    ->whereHas('treasuryTransactions', function ($q) {
                        $q->where('type', 'expense')->where('category', 'other_expense');
                    });
            } elseif ($purchaseKind === 'with_items') {
                $query->whereHas('items');
            } elseif ($purchaseKind === 'mixed') {
                $query->whereHas('items')
                    ->whereHas('treasuryTransactions', function ($q) {
                        $q->where('type', 'expense')->where('category', 'other_expense');
                    });
            }
            
            $purchases = $query->orderBy('purchase_date', 'desc')
                ->orderBy('id', 'desc')
                ->paginate($perPage);
            $purchaseIds = collect($purchases->items())->pluck('id')->filter()->values();
            $extraExpensesByPurchase = TreasuryTransaction::query()
                ->whereIn('purchase_id', $purchaseIds)
                ->where('type', 'expense')
                ->where('category', 'other_expense')
                ->orderBy('id')
                ->get(['purchase_id', 'description', 'amount', 'payment_method', 'transaction_date'])
                ->groupBy('purchase_id');
            
            $rows = collect($purchases->items())->map(function ($p) use ($extraExpensesByPurchase) {
                $latestReturn = $p->latestReturn;
                if ($latestReturn) {
                    $p->setAttribute('latest_return', [
                        'id' => $latestReturn->id,
                        'total_amount' => (float) ($latestReturn->total_amount ?? 0),
                        'return_date' => $latestReturn->return_date,
                        'reason' => $latestReturn->reason,
                        'is_full_return' => (bool) ($latestReturn->is_full_return ?? false),
                        'created_by' => [
                            'id' => $latestReturn->creator?->id,
                            'username' => $latestReturn->creator?->username,
                            'name' => null,
                        ],
                        'refund_to_treasury' => (float) ($p->return_refund_total ?? 0),
                        'was_paid_before_return' => ((float) ($p->return_refund_total ?? 0) > 0.00001),
                    ]);
                }
                $extraRows = collect($extraExpensesByPurchase->get($p->id, []))->map(function ($tx) {
                    $desc = (string) ($tx->description ?? '');
                    $title = $desc;
                    if (str_contains($desc, ':')) {
                        $parts = explode(':', $desc, 2);
                        $title = trim((string) ($parts[1] ?? $desc));
                    }
                    return [
                        'title' => $title ?: 'مصروف إضافي',
                        'amount' => (float) ($tx->amount ?? 0),
                        'payment_method' => $tx->payment_method ?: 'cash',
                        'date' => $tx->transaction_date,
                    ];
                })->values();
                $hasItems = (int) ($p->items?->count() ?? 0) > 0;
                $hasExtra = $extraRows->isNotEmpty();
                $purchaseKind = $hasItems && $hasExtra
                    ? 'mixed'
                    : ($hasItems ? 'with_items' : ($hasExtra ? 'expenses_only' : 'with_items'));
                $p->setAttribute('other_expenses', $extraRows->all());
                $p->setAttribute('other_expenses_total', (float) ($p->other_expenses_total ?? 0));
                $p->setAttribute('purchase_kind', $purchaseKind);
                return $p;
            })->values();

            return response()->json([
                'success' => true,
                'data' => $rows,
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
                $otherExpensesTotal = (float) TreasuryTransaction::query()
                    ->where('purchase_id', $purchase->id)
                    ->where('type', 'expense')
                    ->where('category', 'other_expense')
                    ->sum('amount');
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
                    'other_expenses_total' => $otherExpensesTotal,
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
        // ✅ تحديث validation ليدعم mixed payment
        $request->validate([
            'invoice_number' => 'required|string|unique:purchases',
            'items' => 'nullable|array',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.product_name' => 'required|string',
            'items.*.quantity' => ['required', 'numeric', 'regex:/^\d+(\.\d+)?$/', 'min:0.1'],
            'items.*.unit_price' => ['required', 'numeric', 'regex:/^-?\d+(\.\d+)?$/'],
            'items.*.total_price' => ['required', 'numeric', 'regex:/^-?\d+(\.\d+)?$/'],
            'total_amount' => ['required', 'numeric', 'regex:/^\d+(\.\d+)?$/', 'min:0'],
            'paid_amount' => ['required', 'numeric', 'regex:/^\d+(\.\d+)?$/', 'min:0'],
            'remaining_amount' => ['nullable', 'numeric', 'regex:/^\d+(\.\d+)?$/', 'min:0'],
            'supplier_id' => 'nullable|integer|exists:suppliers,id',
            'status' => 'required|in:pending,completed,cancelled,partially_paid',
            'purchase_date' => 'required|date',
            'notes' => 'nullable|string',
            'payment_method' => 'required|in:cash,app,credit,bank_transfer,check,mixed',
            'cash_amount' => ['nullable', 'numeric', 'regex:/^\d+(\.\d+)?$/', 'min:0'],
            'app_amount' => ['nullable', 'numeric', 'regex:/^\d+(\.\d+)?$/', 'min:0'],
            'treasury_note' => 'nullable|string',
            'other_expenses' => 'nullable|array',
            'other_expenses.*.title' => 'required_with:other_expenses|string|max:255',
            'other_expenses.*.payment_method' => 'required_with:other_expenses|in:cash,app',
            'other_expenses.*.amount' => ['required_with:other_expenses', 'numeric', 'regex:/^\d+(\.\d+)?$/', 'min:0.01'],
        ]);

        if ((float) $request->paid_amount > (float) $request->total_amount + 0.0001) {
            return response()->json([
                'success' => false,
                'message' => 'المبلغ المدفوع لا يمكن أن يكون أكبر من إجمالي الفاتورة'
            ], 422);
        }

        $paymentValidation = $this->validateAndNormalizePaymentBreakdown(
            strtolower((string) $request->payment_method),
            (float) $request->paid_amount,
            $request->input('cash_amount'),
            $request->input('app_amount')
        );
        if (!$paymentValidation['ok']) {
            return response()->json([
                'success' => false,
                'message' => $paymentValidation['message'],
            ], 422);
        }
        $normalizedCashAmount = (float) $paymentValidation['cash_amount'];
        $normalizedAppAmount = (float) $paymentValidation['app_amount'];
        $otherExpenses = collect($request->input('other_expenses', []))
            ->map(function ($row) {
                return [
                    'title' => trim((string) ($row['title'] ?? '')),
                    'payment_method' => strtolower((string) ($row['payment_method'] ?? 'cash')) === 'app' ? 'app' : 'cash',
                    'amount' => round((float) ($row['amount'] ?? 0), 2),
                ];
            })
            ->filter(fn ($row) => $row['title'] !== '' && $row['amount'] > 0.00001)
            ->values();
        $otherExpensesTotal = round((float) $otherExpenses->sum('amount'), 2);
        $itemsInput = collect($request->input('items', []))->values();
        if ($itemsInput->isEmpty() && $otherExpenses->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'يجب إضافة صنف واحد على الأقل أو مصروف إضافي واحد على الأقل',
            ], 422);
        }

        DB::beginTransaction();

        // حساب المبالغ
        $remainingAmount = $request->remaining_amount ?? ($request->total_amount - $request->paid_amount);
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
            'supplier_id' => $request->supplier_id,
            'total_amount' => $request->total_amount,
            'grand_total' => $request->total_amount,
            'paid_amount' => $request->paid_amount,
            'remaining_amount' => $remainingAmount,
            'due_amount' => $remainingAmount,
            'status' => $status,
            'purchase_date' => $request->purchase_date,
            'notes' => $request->notes ?? '',
            'payment_method' => $request->payment_method,
            'cash_amount' => $normalizedCashAmount,
            'app_amount' => $normalizedAppAmount,
            'user_id' => auth()->id() ?? 1,
            'created_by' => auth()->id() ?? 1,
            'category_id' => $request->category_id ?? 1,
        ]);

        // 2. إضافة العناصر (نفس الكود)
        foreach ($itemsInput as $item) {
            $qty = (float) ($item['quantity'] ?? 0);
            $unitPrice = (float) ($item['unit_price'] ?? 0);
            $totalPrice = (float) ($item['total_price'] ?? 0);
            $product = Product::find($item['product_id']);
            $purchaseUnit = $item['purchase_unit'] ?? $item['unit'] ?? ($product?->purchase_unit ?? null);
            $qtyInPieces = $this->convertQuantityToPieces($product, $qty, $purchaseUnit);
            $effectiveQty = max(0.0, $qtyInPieces);
            $effectiveUnitPrice = $effectiveQty > 0 ? ($totalPrice > 0 ? $totalPrice / $effectiveQty : $unitPrice) : $unitPrice;
            $lineSalePrice = isset($item['sale_price']) ? (float) $item['sale_price'] : (float) ($item['unit_price'] ?? 0);
            $saleUnit = $product?->sale_unit ?? $product?->unit ?? 'piece';
            $alignedSalePrice = $this->convertLineUnitPrice(
                $product,
                $lineSalePrice,
                $purchaseUnit,
                $saleUnit
            );

            $purchaseItemPayload = [
                'purchase_id' => $purchase->id,
                'product_id' => $item['product_id'],
                'product_name' => $item['product_name'],
                'quantity' => $effectiveQty,
                'unit_price' => $effectiveUnitPrice,
                'sale_price' => $alignedSalePrice > 0.00001 ? $alignedSalePrice : $lineSalePrice,
                'total_price' => $effectiveQty * $effectiveUnitPrice,
                'subtotal' => $effectiveQty * $effectiveUnitPrice,
                'discount' => 0,
                'tax' => 0,
            ];
            if (Schema::hasColumn('purchase_items', 'remaining_quantity')) {
                $purchaseItemPayload['remaining_quantity'] = $effectiveQty;
            }
            PurchaseItem::create($purchaseItemPayload);

            // زيادة المخزون وتحديث سعر التكلفة/الشراء لآخر شراء
            // effectiveUnitPrice = تكلفة القطعة بالمخزون (Inventory Piece).
            // يتم محاذاة التكلفة وسعر البيع مع sale_unit لنفس المنتج حتى تكون حسابات الربح دقيقة.
            if ($product) {
                $product->increment('stock', $effectiveQty);
                $product->refresh();
                $costPerPiece = $effectiveUnitPrice;
                $perSaleUnit = max(0.000001, $product->piecesPerSaleUnit());
                $alignedCost = round($costPerPiece * $perSaleUnit, 2);
                $salePrice = $alignedSalePrice > 0.00001
                    ? $alignedSalePrice
                    : ($lineSalePrice > 0.00001 ? $lineSalePrice : (float) $product->price);
                $profitAmount = $product->profit_amount;
                if ($salePrice > 0.00001) {
                    $profitAmount = round($salePrice - $alignedCost, 2);
                }
                $product->update([
                    'price' => $salePrice > 0.00001 ? $salePrice : $product->price,
                    'purchase_price' => $alignedCost,
                    'cost_price' => $alignedCost,
                    'profit_amount' => $profitAmount,
                ]);
                // بعد تحديث المنتج، أضف هذا الكود لحساب أسعار التجزئة تلقائياً
if ($product->allow_split_sales && $product->price > 0) {
    $divideInto = max(1, (int) ($product->divide_into ?? $product->strips_per_box ?? 1));
    $piecesCount = (int) ($product->pieces_count ?? 0);
    $allowSmall = (bool) ($product->allow_small_pieces ?? false);
    $fullUnitName = $product->full_unit_name ?? 'وحدة كاملة';
    $splitItemName = $product->split_item_name ?? 'حبة';
    
    // حساب سعر الجزء
    $partPrice = round($product->price / $divideInto, 2);
    
    // بناء خيارات التجزئة
    $options = [];
    
    // الوحدة الكاملة
    $options[] = [
        'id' => 'full',
        'label' => $fullUnitName,
        'price' => round($product->price, 2),
        'saleType' => 'box'
    ];
    
    // اسم الجزء (نصف، ثلث، ربع، إلخ)
    $partNames = [
        2 => 'نصف',
        3 => 'ثلث',
        4 => 'ربع',
        5 => 'خمس',
        6 => 'سدس',
    ];
    $partLabel = $partNames[$divideInto] ?? ('1/' . $divideInto);
    
    $options[] = [
        'id' => 'level1',
        'label' => $partLabel,
        'price' => $partPrice,
        'saleType' => 'strip'
    ];
    
    // إذا كان هناك قطع صغيرة
    if ($allowSmall && $piecesCount > 0 && $piecesCount % $divideInto === 0) {
        $partsPerSplit = max(1, (int) round($piecesCount / $divideInto));
        $childPrice = round($partPrice / $partsPerSplit, 2);
        $options[] = [
            'id' => 'level2',
            'label' => $splitItemName,
            'price' => $childPrice,
            'saleType' => 'pill'
        ];
        
        // حفظ سعر القطعة الصغيرة
        $product->custom_child_price = $childPrice;
    }
    
    // حفظ كل شيء
    $product->split_sale_options = $options;
    $product->split_sale_price = $partPrice;
    $product->save();
}
            }
        }

        // 3. محفظة المورد: رصيد سالب = دين نُسدّده بالمدفوع (كامل المبلغ من الخزنة)؛ رصيد موجب = دفعة مسبقة تُخصم من الخزنة
        $paidTotal = round((float) $request->paid_amount, 2);
        $treasuryDeduction = $paidTotal;
        $prepaidUsed = 0.0;
        $debtReduced = 0.0;
        $supplierBalanceDelta = null;
        $supplierWalletBefore = null;

        if ($request->supplier_id && $paidTotal > 0.00001) {
            $supplier = Supplier::lockForUpdate()->find($request->supplier_id);
            if ($supplier) {
                $supplierWalletBefore = round((float) $supplier->balance, 2);
                $bal = $supplierWalletBefore;

                if ($bal < -0.00001) {
                    $debtReduced = round(min($paidTotal, -$bal), 2);
                    $supplier->balance = round($bal + $paidTotal, 2);
                    $supplier->save();
                    $treasuryDeduction = $paidTotal;
                    $prepaidUsed = 0.0;
                } elseif ($bal > 0.00001) {
                    $prepaidUsed = min($paidTotal, $bal);
                    $supplier->balance = round($bal - $prepaidUsed, 2);
                    $supplier->save();
                    $treasuryDeduction = round($paidTotal - $prepaidUsed, 2);
                }

                $supplierBalanceDelta = round((float) $supplier->fresh()->balance - $supplierWalletBefore, 2);
            }
        }

        if (Schema::hasColumn('purchases', 'supplier_balance_delta')) {
            $purchase->supplier_balance_delta = $supplierBalanceDelta;
        }
        if (Schema::hasColumn('purchases', 'treasury_cash_debit')) {
            $purchase->treasury_cash_debit = round(max(0.0, $treasuryDeduction), 2);
        }
        if (Schema::hasColumn('purchases', 'supplier_balance_delta') || Schema::hasColumn('purchases', 'treasury_cash_debit')) {
            $purchase->save();
        }

        if ($treasuryDeduction > 0.00001 || $otherExpensesTotal > 0.00001) {
            $treasury = Treasury::first();
            if ($treasury) {
                $pm = strtolower((string) $request->payment_method);
                $tCash = 0.0;
                $tApp = 0.0;
                if ($pm === 'app') {
                    $tApp = round($treasuryDeduction, 2);
                } elseif ($pm === 'mixed') {
                    $c = $normalizedCashAmount;
                    $a = $normalizedAppAmount;
                    if ($paidTotal > 0.00001 && $c + $a > 0.00001 && abs($c + $a - $paidTotal) < 0.06) {
                        $tCash = round($treasuryDeduction * ($c / $paidTotal), 2);
                        $tApp = round($treasuryDeduction - $tCash, 2);
                    } else {
                        $tCash = round($treasuryDeduction, 2);
                    }
                } else {
                    $tCash = round($treasuryDeduction, 2);
                }

                $extraCash = round((float) $otherExpenses->where('payment_method', 'cash')->sum('amount'), 2);
                $extraApp = round((float) $otherExpenses->where('payment_method', 'app')->sum('amount'), 2);
                $requiredCash = round($tCash + $extraCash, 2);
                $requiredApp = round($tApp + $extraApp, 2);

                $availableCash = (float) ($treasury->balance_cash ?? 0);
                $availableApp = (float) ($treasury->balance_app ?? 0);
                if ($requiredCash > $availableCash + 0.0001) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'رصيد الكاش غير كافٍ لإتمام عملية الشراء مع المصاريف الأخرى',
                        'data' => [
                            'required_cash' => round($requiredCash, 2),
                            'available_cash' => round($availableCash, 2),
                        ],
                    ], 422);
                }
                if ($requiredApp > $availableApp + 0.0001) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'رصيد التطبيق غير كافٍ لإتمام عملية الشراء مع المصاريف الأخرى',
                        'data' => [
                            'required_app' => round($requiredApp, 2),
                            'available_app' => round($availableApp, 2),
                        ],
                    ], 422);
                }

                $treasury->applyLiquidityDelta(-$requiredCash, -$requiredApp);
                $treasury->total_expenses += round($requiredCash + $requiredApp, 2);
                $treasury->save();

                $baseNote = $request->treasury_note ?? "دفع فاتورة شراء #{$request->invoice_number}";
                if ($prepaidUsed > 0.00001) {
                    $baseNote .= ' — منها ' . number_format($prepaidUsed, 2) . ' من رصيد مسبق للمورد';
                }
                if ($debtReduced > 0.00001) {
                    $baseNote .= ' — منها ' . number_format($debtReduced, 2) . ' تسديد دين سابق للمورد';
                }

                foreach (
                    [
                        ['amt' => $tCash, 'method' => 'cash', 'suffix' => ' — كاش'],
                        ['amt' => $tApp, 'method' => 'app', 'suffix' => ' — تطبيق'],
                    ] as $part
                ) {
                    if ($part['amt'] > 0.00001) {
                        TreasuryTransaction::create([
                            'treasury_id' => $treasury->id,
                            'type' => 'expense',
                            'amount' => $part['amt'],
                            'description' => $baseNote . $part['suffix'],
                            'category' => 'purchase_expense',
                            'purchase_id' => $purchase->id,
                            'reference_type' => 'purchase',
                            'reference_id' => $purchase->id,
                            'created_by' => auth()->id() ?? 1,
                            'transaction_date' => now()->toDateString(),
                            'payment_method' => $part['method'],
                        ]);
                    }
                }
                foreach ($otherExpenses as $expense) {
                    TreasuryTransaction::create([
                        'treasury_id' => $treasury->id,
                        'type' => 'expense',
                        'amount' => (float) $expense['amount'],
                        'description' => "مصروف شراء إضافي #{$request->invoice_number}: {$expense['title']}",
                        'category' => 'other_expense',
                        'purchase_id' => $purchase->id,
                        'reference_type' => 'purchase',
                        'reference_id' => $purchase->id,
                        'created_by' => auth()->id() ?? 1,
                        'transaction_date' => now()->toDateString(),
                        'payment_method' => $expense['payment_method'],
                    ]);
                }
            }
        }

        try {
            if (Schema::hasTable('system_notifications')) {
                SystemNotification::create([
                    'type' => 'purchase',
                    'pref_category' => 'purchase',
                    'title' => 'تم تسجيل شراء جديد',
                    'message' => 'تم تسجيل فاتورة شراء ' . ($purchase->invoice_number ?? $purchase->id),
                    'details' => 'المورد: ' . ($purchase->supplier?->name ?? 'غير محدد') .
                        "\nالإجمالي: " . number_format((float) $purchase->total_amount, 2) .
                        "\nالمدفوع: " . number_format((float) $purchase->paid_amount, 2) .
                        "\nالمتبقي: " . number_format((float) $purchase->remaining_amount, 2),
                    'from_management' => true,
                    'management_label' => 'إدارة النظام',
                    'recipients_type' => 'admin_only',
                    'created_by' => auth()->id() ?: null,
                ]);
            }
        } catch (\Throwable $notificationError) {
            Log::warning('Failed to create purchase notification', [
                'purchase_id' => $purchase->id ?? null,
                'error' => $notificationError->getMessage(),
            ]);
        }

        ActivityLogger::log($request, [
            'action_type' => 'purchase_create',
            'entity_type' => 'purchase',
            'entity_id' => $purchase->id,
            'description' => "تسجيل فاتورة شراء {$purchase->invoice_number}",
            'meta' => [
                'total' => (float) $purchase->total_amount,
                'paid' => (float) $purchase->paid_amount,
                'remaining' => (float) $purchase->remaining_amount,
                'supplier_id' => $purchase->supplier_id,
                'items_count' => $itemsInput->count(),
                'total_quantity' => $itemsInput->sum(fn ($it) => (float) ($it['quantity'] ?? 0)),
                'other_expenses_total' => $otherExpensesTotal,
                'other_expenses' => $otherExpenses->values()->all(),
            ],
        ]);

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة المشتريات بنجاح',
            'data' => $purchase->load(['items', 'supplier']),
            'treasury_breakdown' => [
                'paid_total' => $paidTotal,
                'from_supplier_prepaid' => $prepaidUsed,
                'debt_reduced' => $debtReduced,
                'supplier_balance_delta' => $supplierBalanceDelta,
                'from_main_treasury' => max(0.0, $treasuryDeduction),
                'other_expenses_total' => $otherExpensesTotal,
            ],
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
                    'items_count' => $purchase->items->count()
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

            // 2. تراجع محفظة المورد والخزنة
            $treasuryRestore = $this->mainTreasuryDebitRemaining($purchase);
            $totalPaidAmount += $treasuryRestore;

            if ($purchase->supplier_id
                && Schema::hasColumn('purchases', 'supplier_balance_delta')
                && $purchase->supplier_balance_delta !== null
                && abs((float) $purchase->supplier_balance_delta) > 0.00001) {
                $sup = Supplier::lockForUpdate()->find($purchase->supplier_id);
                if ($sup) {
                    $sup->balance = round((float) $sup->balance - (float) $purchase->supplier_balance_delta, 2);
                    $sup->save();
                }
            }

            [$netCashRestore, $netAppRestore] = $this->purchaseTreasuryRestoreCashAppBeforeTransactionDelete($purchase, $treasuryRestore);

            $deletedTransactions = TreasuryTransaction::where('purchase_id', $purchase->id)
                ->orWhere(function ($q) use ($purchase) {
                    $q->where('reference_type', 'purchase')
                        ->where('reference_id', $purchase->id);
                })
                ->delete();

            $treasury = Treasury::first();
            if ($treasury && ($netCashRestore > 0.00001 || $netAppRestore > 0.00001)) {
                $oldBalance = $treasury->balance;
                $treasury->applyLiquidityDelta($netCashRestore, $netAppRestore);
                $treasury->save();
                $newBalance = $treasury->fresh()->balance;

                $affectedTreasuries[$treasury->id] = [
                    'name' => $treasury->name,
                    'old_balance' => $oldBalance,
                    'amount_added' => round($netCashRestore + $netAppRestore, 2),
                    'new_balance' => $newBalance,
                ];

                Log::channel('purchases')->debug('🏦 تحديث رصيد الخزنة', [
                    'request_id' => $requestId,
                    'purchase_id' => $purchase->id,
                    'treasury_id' => $treasury->id,
                    'treasury_name' => $treasury->name,
                    'old_balance' => $oldBalance,
                    'added_amount' => round($netCashRestore + $netAppRestore, 2),
                    'new_balance' => $newBalance,
                    'deleted_transactions' => $deletedTransactions,
                ]);
            } elseif (!$treasury && $treasuryRestore > 0.00001) {
                Log::error('🚨 الخزنة غير موجودة', [
                    'request_id' => $requestId,
                    'purchase_id' => $purchase->id,
                    'treasury_restore' => $treasuryRestore,
                ]);
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

            // 2. تراجع محفظة المورد ثم الخزنة (المبلغ الفعلي المخصوم من الخزنة وليس بالضرورة paid_amount)
            $treasuryRestore = $this->mainTreasuryDebitRemaining($purchase);

            if ($purchase->supplier_id
                && Schema::hasColumn('purchases', 'supplier_balance_delta')
                && $purchase->supplier_balance_delta !== null
                && abs((float) $purchase->supplier_balance_delta) > 0.00001) {
                $sup = Supplier::lockForUpdate()->find($purchase->supplier_id);
                if ($sup) {
                    $sup->balance = round((float) $sup->balance - (float) $purchase->supplier_balance_delta, 2);
                    $sup->save();
                }
            }

            [$netCashRestore, $netAppRestore] = $this->purchaseTreasuryRestoreCashAppBeforeTransactionDelete($purchase, $treasuryRestore);

            $deletedTransactions = TreasuryTransaction::where('purchase_id', $purchase->id)
                ->orWhere(function ($q) use ($purchase) {
                    $q->where('reference_type', 'purchase')
                        ->where('reference_id', $purchase->id);
                })
                ->delete();

            $treasury = Treasury::first();
            if ($treasury && ($netCashRestore > 0.00001 || $netAppRestore > 0.00001)) {
                $oldBalance = $treasury->balance;
                $treasury->applyLiquidityDelta($netCashRestore, $netAppRestore);
                $treasury->save();
                $newBalance = $treasury->fresh()->balance;

                Log::channel('purchases')->debug('🏦 تحديث رصيد الخزنة', [
                    'request_id' => $requestId,
                    'purchase_id' => $purchase->id,
                    'treasury_id' => $treasury->id,
                    'treasury_name' => $treasury->name,
                    'old_balance' => $oldBalance,
                    'added_amount' => round($netCashRestore + $netAppRestore, 2),
                    'new_balance' => $newBalance,
                    'deleted_transactions' => $deletedTransactions,
                ]);
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
                'supplier:id,name',
                'category:id,name',
                'items.product:id,name,unit,sku,barcode',
'createdBy:id,username',
                'latestReturn.creator:id,username',
            ])->withSum([
                'treasuryTransactions as return_refund_total' => function ($q) {
                    $q->where('type', 'income')->where('reference_type', 'purchase_return');
                },
                'treasuryTransactions as other_expenses_total' => function ($q) {
                    $q->where('type', 'expense')->where('category', 'other_expense');
                },
            ], 'amount')->find($id);
            
            if (!$purchase) {
                return response()->json([
                    'success' => false,
                    'message' => 'فاتورة الشراء غير موجودة'
                ], 404);
            }
            
            if ($purchase->latestReturn) {
                $lr = $purchase->latestReturn;
                $purchase->setAttribute('latest_return', [
                    'id' => $lr->id,
                    'total_amount' => (float) ($lr->total_amount ?? 0),
                    'return_date' => $lr->return_date,
                    'reason' => $lr->reason,
                    'is_full_return' => (bool) ($lr->is_full_return ?? false),
                    'created_by' => [
                        'id' => $lr->creator?->id,
                        'username' => $lr->creator?->username,
                        'name' => null,
                    ],
                    'refund_to_treasury' => (float) ($purchase->return_refund_total ?? 0),
                    'was_paid_before_return' => ((float) ($purchase->return_refund_total ?? 0) > 0.00001),
                ]);
            }
            $extraExpenses = TreasuryTransaction::query()
                ->where('purchase_id', $purchase->id)
                ->where('type', 'expense')
                ->where('category', 'other_expense')
                ->orderBy('id')
                ->get(['description', 'amount', 'payment_method', 'transaction_date'])
                ->map(function ($tx) {
                    $desc = (string) ($tx->description ?? '');
                    $title = $desc;
                    if (str_contains($desc, ':')) {
                        $parts = explode(':', $desc, 2);
                        $title = trim((string) ($parts[1] ?? $desc));
                    }
                    return [
                        'title' => $title ?: 'مصروف إضافي',
                        'amount' => (float) ($tx->amount ?? 0),
                        'payment_method' => $tx->payment_method ?: 'cash',
                        'date' => $tx->transaction_date,
                    ];
                })
                ->values();
            $purchase->setAttribute('other_expenses_total', (float) ($purchase->other_expenses_total ?? 0));
            $purchase->setAttribute('other_expenses', $extraExpenses);

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

    /**
     * Return specific items from a purchase
     */
    public function returnItems(Request $request, Purchase $purchase)
    {
        try {
            if (!Schema::hasTable('purchase_returns') || !Schema::hasColumn('purchase_items', 'returned_quantity')) {
                return response()->json([
                    'success' => false,
                    'message' => 'ميزة الإرجاع غير مفعلة بعد. يرجى تشغيل ترحيلات قاعدة البيانات (migrations) الخاصة بالإرجاع.'
                ], 422);
            }
    
            $validated = $request->validate([
                'items' => 'required|array|min:1',
                'items.*.purchase_item_id' => 'required|integer|exists:purchase_items,id',
                'items.*.quantity' => 'required|numeric|min:0.1',
                'reason' => 'nullable|string'
            ]);
    
            // Check if purchase is already returned
            if ($purchase->status === 'returned') {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن إرجاع أصناف من فاتورة تم إرجاعها بالكامل مسبقاً'
                ], 422);
            }
    
            DB::beginTransaction();
    
            $returnedTotal = 0;
            $returnedItems = [];
            $paidBeforeReturn = (float) $purchase->paid_amount;
            $cashPaidBeforeReturn = (float) ($purchase->cash_amount ?? 0);
            $appPaidBeforeReturn = (float) ($purchase->app_amount ?? 0);
    
            foreach ($validated['items'] as $item) {
                $purchaseItem = PurchaseItem::where('purchase_id', $purchase->id)
                    ->where('id', $item['purchase_item_id'])
                    ->first();
                
                if (!$purchaseItem || $purchaseItem->purchase_id !== $purchase->id) {
                    continue;
                }
    
                // Check if return quantity is valid
                $availableQty = $purchaseItem->quantity - ($purchaseItem->returned_quantity ?? 0);
                if ($item['quantity'] > $availableQty) {
                    return response()->json([
                        'success' => false,
                        'message' => "الكمية المطلوب إرجاعها للصنف {$purchaseItem->product_name} أكبر من المتاح"
                    ], 422);
                }
    
                // Update purchase item returned quantity
                $purchaseItem->returned_quantity = ($purchaseItem->returned_quantity ?? 0) + $item['quantity'];
                if (Schema::hasColumn('purchase_items', 'remaining_quantity')) {
                    $purchaseItem->remaining_quantity = max(
                        0,
                        (float) ($purchaseItem->remaining_quantity ?? ($purchaseItem->quantity - ($purchaseItem->returned_quantity ?? 0)))
                        - (float) $item['quantity']
                    );
                }
                $purchaseItem->save();
    
                // ✅ التعديل هنا: إزالة max(0, ...) للسماح بالمخزون السالب
                $product = Product::find($purchaseItem->product_id);
                if ($product) {
                    $oldStock = (float) $product->stock;
                    $newStock = $oldStock - (float) $item['quantity'];  // بدون max(0, ...)
                    $product->stock = $newStock;
                    $product->save();
                    
                    // تسجيل حركة المخزون للتدقيق (اختياري)
                    Log::channel('stock')->info('إرجاع منتج من فاتورة شراء', [
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'old_stock' => $oldStock,
                        'quantity_returned' => $item['quantity'],
                        'new_stock' => $newStock,
                        'purchase_id' => $purchase->id,
                        'purchase_item_id' => $purchaseItem->id,
                        'user_id' => auth()->id() ?? 1,
                        'timestamp' => now()->toDateTimeString()
                    ]);
                }
    
                // Calculate returned amount
                $returnedAmount = $item['quantity'] * $purchaseItem->unit_price;
                $returnedTotal += $returnedAmount;
    
                $returnedItems[] = [
                    'product_name' => $purchaseItem->product_name,
                    'quantity' => $item['quantity'],
                    'unit_price' => $purchaseItem->unit_price,
                    'total' => $returnedAmount
                ];
            }
    
            if ($returnedTotal <= 0 || count($returnedItems) === 0) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'لم يتم تحديد أصناف صالحة للإرجاع'
                ], 422);
            }
    
            // Create return record
            PurchaseReturn::create([
                'purchase_id' => $purchase->id,
                'supplier_id' => $purchase->supplier_id,
                'return_date' => now(),
                'total_amount' => $returnedTotal,
                'items' => $returnedItems,
                'reason' => $validated['reason'] ?? 'إرجاع أصناف',
                'created_by' => auth()->id() ?? 1
            ]);
    
            // Update purchase totals
            $newTotalAmount = max(0, (float) $purchase->total_amount - $returnedTotal);
            $newPaidAmount = min($paidBeforeReturn, $newTotalAmount);
            $refundAmount = max(0, $paidBeforeReturn - $newPaidAmount);
            $newRemainingAmount = max(0, $newTotalAmount - $newPaidAmount);
    
            // توزيع الاسترجاع على الكاش/التطبيق بنفس نسبة الدفع الأصلية
            $cashRefund = 0.0;
            if ($refundAmount > 0 && $paidBeforeReturn > 0) {
                $cashRefund = round($refundAmount * ($cashPaidBeforeReturn / $paidBeforeReturn), 2);
            }
            $cashRefund = min($cashRefund, $cashPaidBeforeReturn, $refundAmount);
            $appRefund = max(0, $refundAmount - $cashRefund);
            $newCashAmount = max(0, $cashPaidBeforeReturn - $cashRefund);
            $newAppAmount = max(0, $appPaidBeforeReturn - $appRefund);
    
            $treasuryRemaining = $this->mainTreasuryDebitRemaining($purchase);
            $treasuryCashRefund = 0.0;
            if ($refundAmount > 0.00001 && $paidBeforeReturn > 0.00001 && $treasuryRemaining > 0.00001) {
                $treasuryCashRefund = round($refundAmount * ($treasuryRemaining / $paidBeforeReturn), 2);
            }
            $treasuryCashRefund = max(0.0, min($treasuryCashRefund, $treasuryRemaining, $refundAmount));
    
            $purchase->total_amount = $newTotalAmount;
            $purchase->grand_total = $newTotalAmount;
            $purchase->paid_amount = $newPaidAmount;
            $purchase->remaining_amount = $newRemainingAmount;
            $purchase->due_amount = $newRemainingAmount;
            $purchase->cash_amount = $newCashAmount;
            $purchase->app_amount = $newAppAmount;
    
            if ($newTotalAmount <= 0.01) {
                $purchase->status = $this->supportsReturnedStatus() ? 'returned' : 'completed';
            } elseif ($newRemainingAmount <= 0.01) {
                $purchase->status = 'completed';
            } elseif ($newPaidAmount > 0.01) {
                $purchase->status = 'partially_paid';
            } else {
                $purchase->status = 'pending';
            }
    
            if (Schema::hasColumn('purchases', 'treasury_cash_debit')) {
                $purchase->treasury_cash_debit = max(0.0, round($treasuryRemaining - $treasuryCashRefund, 2));
            }
    
            $purchase->save();
    
            if ($treasuryCashRefund > 0.00001) {
                $treasury = Treasury::first();
                if ($treasury) {
                    $ratioBase = max(0.00001, $paidBeforeReturn);
                    $refundCash = round($treasuryCashRefund * ($cashPaidBeforeReturn / $ratioBase), 2);
                    $refundApp = round($treasuryCashRefund - $refundCash, 2);
                    $treasury->applyLiquidityDelta($refundCash, $refundApp);
                    $treasury->save();
    
                    foreach (
                        [
                            ['amt' => $refundCash, 'method' => 'cash', 'suffix' => ' — كاش'],
                            ['amt' => $refundApp, 'method' => 'app', 'suffix' => ' — تطبيق'],
                        ] as $leg
                    ) {
                        if ($leg['amt'] > 0.00001) {
                            TreasuryTransaction::create([
                                'treasury_id' => $treasury->id,
                                'type' => 'income',
                                'amount' => $leg['amt'],
                                'description' => "استرجاع إلى الخزنة (إرجاع أصناف): {$purchase->invoice_number}" . $leg['suffix'],
                                'category' => 'other_income',
                                'purchase_id' => $purchase->id,
                                'reference_type' => 'purchase_return',
                                'reference_id' => $purchase->id,
                                'payment_method' => $leg['method'],
                                'transaction_date' => now()->toDateString(),
                                'created_by' => auth()->id() ?? 1,
                            ]);
                        }
                    }
                }
            }
    
            DB::commit();
    
            return response()->json([
                'success' => true,
                'message' => 'تم إرجاع الأصناف بنجاح',
                'data' => [
                    'returned_total' => $returnedTotal,
                    'refund_amount' => $refundAmount,
                    'cash_refund' => $cashRefund,
                    'treasury_cash_refund' => $treasuryCashRefund,
                    'items' => $returnedItems,
                    'purchase_new_total' => $purchase->total_amount
                ]
            ]);
    
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في إرجاع الأصناف',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Full purchase return
     */
    public function fullReturn(Request $request, Purchase $purchase)
    {
        try {
            if (!Schema::hasTable('purchase_returns') || !Schema::hasColumn('purchase_items', 'returned_quantity')) {
                return response()->json([
                    'success' => false,
                    'message' => 'ميزة الإرجاع غير مفعلة بعد. يرجى تشغيل ترحيلات قاعدة البيانات (migrations) الخاصة بالإرجاع.'
                ], 422);
            }

            $validated = $request->validate([
                'reason' => 'nullable|string'
            ]);

            $purchase->loadMissing('items');

            // Check if already returned
            if ($purchase->status === 'returned') {
                return response()->json([
                    'success' => false,
                    'message' => 'هذه الفاتورة تم إرجاعها بالفعل'
                ], 422);
            }

            DB::beginTransaction();

            $treasuryRefund = $this->mainTreasuryDebitRemaining($purchase);
            $returnedTotal = (float) $purchase->total_amount;
            $returnedItems = [];
            $paidBeforeReturn = (float) $purchase->paid_amount;
            $cashPaidBeforeReturn = (float) ($purchase->cash_amount ?? 0);
            $supplierBalanceDeltaForReturn = Schema::hasColumn('purchases', 'supplier_balance_delta')
                ? $purchase->supplier_balance_delta
                : null;

            // Process all items
            foreach ($purchase->items as $item) {
                // Get remaining quantity to return
                $remainingQty = $item->quantity - ($item->returned_quantity ?? 0);
                
                if ($remainingQty > 0) {
                    // Update product stock
                    $product = Product::find($item->product_id);
                    if ($product) {
                        $product->stock = (float) $product->stock - (float) $remainingQty;
                        $product->save();
                    }

                    $returnedItems[] = [
                        'product_name' => $item->product_name,
                        'quantity' => $remainingQty,
                        'unit_price' => $item->unit_price,
                        'total' => $remainingQty * $item->unit_price
                    ];
                }

                // Mark all quantity as returned
                $item->returned_quantity = $item->quantity;
                if (Schema::hasColumn('purchase_items', 'remaining_quantity')) {
                    $item->remaining_quantity = 0;
                }
                $item->save();
            }

            if (count($returnedItems) === 0) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'لا توجد كميات متاحة لإرجاع هذه الفاتورة'
                ], 422);
            }

            // Create return record
            PurchaseReturn::create([
                'purchase_id' => $purchase->id,
                'supplier_id' => $purchase->supplier_id,
                'return_date' => now(),
                'total_amount' => $returnedTotal,
                'items' => $returnedItems,
                'reason' => $validated['reason'] ?? 'إرجاع فاتورة كاملة',
                'is_full_return' => true,
                'created_by' => auth()->id() ?? 1
            ]);

            // Update purchase status and amounts
            $purchase->status = $this->supportsReturnedStatus() ? 'returned' : 'completed';
            $purchase->total_amount = 0;
            $purchase->grand_total = 0;
            $purchase->paid_amount = 0;
            $purchase->remaining_amount = 0;
            $purchase->due_amount = 0;
            $purchase->cash_amount = 0;
            $purchase->app_amount = 0;
            if (Schema::hasColumn('purchases', 'treasury_cash_debit')) {
                $purchase->treasury_cash_debit = 0;
            }
            $purchase->save();

            if ($treasuryRefund > 0.00001) {
                $treasury = Treasury::first();
                if ($treasury) {
                    $ratioBase = max(0.00001, $paidBeforeReturn);
                    $refundCash = round($treasuryRefund * ($cashPaidBeforeReturn / $ratioBase), 2);
                    $refundApp = round($treasuryRefund - $refundCash, 2);
                    $treasury->applyLiquidityDelta($refundCash, $refundApp);
                    $treasury->save();

                    foreach (
                        [
                            ['amt' => $refundCash, 'method' => 'cash', 'suffix' => ' — كاش'],
                            ['amt' => $refundApp, 'method' => 'app', 'suffix' => ' — تطبيق'],
                        ] as $leg
                    ) {
                        if ($leg['amt'] > 0.00001) {
                            TreasuryTransaction::create([
                                'treasury_id' => $treasury->id,
                                'type' => 'income',
                                'amount' => $leg['amt'],
                                'description' => "استرجاع إلى الخزنة (إرجاع فاتورة كاملة): {$purchase->invoice_number}" . $leg['suffix'],
                                'category' => 'other_income',
                                'purchase_id' => $purchase->id,
                                'reference_type' => 'purchase_return',
                                'reference_id' => $purchase->id,
                                'payment_method' => $leg['method'],
                                'transaction_date' => now()->toDateString(),
                                'created_by' => auth()->id() ?? 1,
                            ]);
                        }
                    }
                }
            }

            if ($purchase->supplier_id
                && $supplierBalanceDeltaForReturn !== null
                && abs((float) $supplierBalanceDeltaForReturn) > 0.00001) {
                $sup = Supplier::lockForUpdate()->find($purchase->supplier_id);
                if ($sup) {
                    $sup->balance = round((float) $sup->balance - (float) $supplierBalanceDeltaForReturn, 2);
                    $sup->save();
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'تم إرجاع الفاتورة بالكامل بنجاح',
                'data' => [
                    'returned_total' => $returnedTotal,
                    'refund_amount' => $paidBeforeReturn,
                    'cash_refund' => $cashPaidBeforeReturn,
                    'treasury_cash_refund' => $treasuryRefund,
                    'purchase_id' => $purchase->id
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في إرجاع الفاتورة',
                'error' => env('APP_DEBUG') ? $e->getMessage() : null
            ], 500);
        }
    }

    private function supportsReturnedStatus(): bool
    {
        try {
            $row = DB::selectOne("SHOW COLUMNS FROM purchases LIKE 'status'");
            $type = (string) ($row->Type ?? $row->type ?? '');
            return str_contains($type, "'returned'");
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * قبل حذف معاملات فاتورة الشراء: توزيع المبلغ المسترجع على كاش/تطبيق.
     *
     * @return array{0: float, 1: float}
     */
    private function purchaseTreasuryRestoreCashAppBeforeTransactionDelete(Purchase $purchase, float $treasuryRestore): array
    {
        $netCashRestore = max(
            0.0,
            (float) TreasuryTransaction::where('purchase_id', $purchase->id)->where('type', 'expense')->where('payment_method', 'cash')->sum('amount')
            - (float) TreasuryTransaction::where('purchase_id', $purchase->id)->where('type', 'income')->where('payment_method', 'cash')->sum('amount')
        );
        $netAppRestore = max(
            0.0,
            (float) TreasuryTransaction::where('purchase_id', $purchase->id)->where('type', 'expense')->where('payment_method', 'app')->sum('amount')
            - (float) TreasuryTransaction::where('purchase_id', $purchase->id)->where('type', 'income')->where('payment_method', 'app')->sum('amount')
        );
        $sumNetRestore = round($netCashRestore + $netAppRestore, 2);
        if ($sumNetRestore < 0.00001 && $treasuryRestore > 0.00001) {
            $paid = max(0.00001, (float) $purchase->paid_amount);
            $c = (float) ($purchase->cash_amount ?? 0);
            $a = (float) ($purchase->app_amount ?? 0);
            if ($c + $a > 0.00001 && abs($c + $a - $paid) < 0.1) {
                $netCashRestore = round($treasuryRestore * ($c / $paid), 2);
                $netAppRestore = round($treasuryRestore - $netCashRestore, 2);
            } else {
                $pm = strtolower((string) ($purchase->payment_method ?? 'cash'));
                if ($pm === 'app') {
                    $netAppRestore = round($treasuryRestore, 2);
                    $netCashRestore = 0.0;
                } else {
                    $netCashRestore = round($treasuryRestore, 2);
                    $netAppRestore = 0.0;
                }
            }
        }

        return [$netCashRestore, $netAppRestore];
    }

    /**
     * ما زال يُستحق إرجاعه إلى الخزنة الرئيسية لهذه الفاتورة (بعد خصم إيرادات الإرجاع السابقة).
     */
    private function mainTreasuryDebitRemaining(Purchase $purchase): float
    {
        if (Schema::hasColumn('purchases', 'treasury_cash_debit') && $purchase->treasury_cash_debit !== null) {
            return max(0.0, round((float) $purchase->treasury_cash_debit, 2));
        }

        $debited = (float) TreasuryTransaction::where('purchase_id', $purchase->id)
            ->where('type', 'expense')
            ->sum('amount');
        $credited = (float) TreasuryTransaction::where('purchase_id', $purchase->id)
            ->where('type', 'income')
            ->sum('amount');

        return max(0.0, round($debited - $credited, 2));
    }

    private function convertQuantityToPieces(?Product $product, float $quantity, ?string $unit): float
    {
        $qty = max(0.0, (float) $quantity);
        if (!$product) {
            return $qty;
        }

        $normalizedUnit = strtolower((string) ($unit ?: $product->purchase_unit ?: $product->sale_unit ?: $product->unit ?: 'piece'));
        return $product->saleQuantityToInventoryPieces($qty, $normalizedUnit);
    }

    /**
     * تحويل سعر وحدة السطر من وحدة الإدخال إلى وحدة البيع المرجعية للصنف.
     */
    private function convertLineUnitPrice(?Product $product, float $price, ?string $fromUnit, ?string $toUnit): float
    {
        $raw = (float) $price;
        if (!$product || $raw <= 0.00001) {
            return round($raw, 2);
        }
        $from = strtolower((string) ($fromUnit ?: $product->purchase_unit ?: $product->sale_unit ?: $product->unit ?: 'piece'));
        $to = strtolower((string) ($toUnit ?: $product->sale_unit ?: $product->unit ?: $from));
        $fromPieces = max(0.000001, $product->saleQuantityToInventoryPieces(1.0, $from));
        $toPieces = max(0.000001, $product->saleQuantityToInventoryPieces(1.0, $to));
        $pricePerPiece = $raw / $fromPieces;
        return round($pricePerPiece * $toPieces, 2);
    }

    private function validateAndNormalizePaymentBreakdown(string $paymentMethod, float $paidAmount, $cashAmountInput, $appAmountInput): array
    {
        $paid = max(0.0, round((float) $paidAmount, 2));
        $cash = max(0.0, round((float) ($cashAmountInput ?? 0), 2));
        $app = max(0.0, round((float) ($appAmountInput ?? 0), 2));

        if ($paymentMethod === 'cash') {
            $cash = $paid;
            $app = 0.0;
            if ($paid > 0.0001 && $cash <= 0.0001) {
                return ['ok' => false, 'message' => 'طريقة الدفع كاش تتطلب مبلغ كاش أكبر من صفر'];
            }
        } elseif ($paymentMethod === 'app') {
            $app = $paid;
            $cash = 0.0;
            if ($paid > 0.0001 && $app <= 0.0001) {
                return ['ok' => false, 'message' => 'طريقة الدفع تطبيق تتطلب مبلغ تطبيق أكبر من صفر'];
            }
        } elseif ($paymentMethod === 'mixed') {
            if ($cash <= 0.0001 || $app <= 0.0001) {
                return ['ok' => false, 'message' => 'طريقة الدفع المختلط تتطلب إدخال مبلغ كاش ومبلغ تطبيق'];
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
            'cash_amount' => $cash,
            'app_amount' => $app,
            'message' => null,
        ];
    }
}