<?php

namespace App\Http\Controllers;

use App\Models\StaffActivity;
use App\Models\Order;
use App\Models\Purchase;
use App\Models\Customer;
use App\Models\Supplier;
use App\Models\User;
use App\Models\TreasuryTransaction;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class StaffActivityController extends Controller
{
    /**
 * Store a newly created activity in storage.
 */
public function store(Request $request)
{
    try {
        $validated = $request->validate([
            'action_type' => 'required|string|max:255',
            'entity_type' => 'nullable|string|max:255',
            'entity_id' => 'nullable|integer',
            'description' => 'nullable|string',
            'meta' => 'nullable|array',
            'username' => 'nullable|string|max:255',
            'role' => 'nullable|string|max:255',
        ]);

        $actor = $request->user();
        $actorRole = (string) ($actor?->role ?? '');
        if ($actorRole === 'cashier'
            && (string) ($validated['action_type'] ?? '') !== 'cashier_shift_end') {
            return response()->json([
                'success' => false,
                'message' => 'غير مصرح بتسجيل هذا النشاط من حساب الكاشير',
            ], 403);
        }

        $activity = StaffActivity::create([
            'user_id' => $request->user()?->id,
            'username' => $validated['username'] ?? $request->user()?->username,
            'role' => $validated['role'] ?? $request->user()?->role,
            'action_type' => $validated['action_type'],
            'entity_type' => $validated['entity_type'],
            'entity_id' => $validated['entity_id'],
            'description' => $validated['description'] ?? $this->generateDescriptionFromMeta($validated),
            'meta' => $validated['meta'] ?? [],
        ]);
        
        return response()->json([
            'success' => true,
            'data' => $activity,
            'message' => 'تم تسجيل النشاط بنجاح'
        ], 201);
        
    } catch (\Illuminate\Validation\ValidationException $e) {
        return response()->json([
            'success' => false,
            'message' => 'بيانات غير صالحة',
            'errors' => $e->errors()
        ], 422);
    } catch (\Exception $e) {
        \Log::error('Failed to store staff activity: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'فشل تسجيل النشاط: ' . $e->getMessage()
        ], 500);
    }
}

/**
 * Generate description from meta data if not provided
 */
private function generateDescriptionFromMeta($data)
{
    $meta = $data['meta'] ?? [];
    $action = $data['action_type'];
    
    switch ($action) {
        case 'cashier_sale':
            return sprintf('تم بيع فاتورة بقيمة %s شيكل', $meta['total'] ?? 0);
        case 'purchase_created':
            return sprintf('تم تسجيل فاتورة شراء بقيمة %s شيكل', $meta['total'] ?? 0);
        case 'debt_customer_payment':
            return sprintf('تم تسديد مبلغ %s شيكل', $meta['amount'] ?? 0);
        default:
            return $data['description'] ?? $action;
    }
}
    public function index(Request $request)
    {
        if (!Schema::hasTable('staff_activities')) {
            return response()->json([
                'success' => true,
                'data' => [],
                'pagination' => [
                    'total' => 0,
                    'per_page' => 0,
                    'current_page' => 1,
                    'last_page' => 1,
                ],
            ]);
        }

        $perPage = max(5, min(100, (int) $request->get('per_page', 20)));
        $query = StaffActivity::query();

        // Apply filters
        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->get('user_id'));
        }
        if ($request->filled('action_type')) {
            $query->where('action_type', (string) $request->get('action_type'));
        }
        if ($request->filled('entity_type')) {
            $query->where('entity_type', (string) $request->get('entity_type'));
        }
        if ($request->filled('from_date')) {
            $query->whereDate('created_at', '>=', $request->get('from_date'));
        }
        if ($request->filled('to_date')) {
            $query->whereDate('created_at', '<=', $request->get('to_date'));
        }
        if ($request->filled('search')) {
            $q = trim((string) $request->get('search'));
            $query->where(function ($sub) use ($q) {
                $sub->where('description', 'like', "%{$q}%")
                    ->orWhere('username', 'like', "%{$q}%")
                    ->orWhere('entity_id', 'like', "%{$q}%")
                    ->orWhere('action_type', 'like', "%{$q}%");
            });
        }

        $summarySource = (clone $query)->orderByDesc('id')->limit(3000)->get();
        $summary = $this->buildSummary($summarySource);
        $rows = $query->orderByDesc('id')->paginate($perPage);
        
        // ✅ إضافة تفاصيل إضافية لكل نشاط من حقل meta أو من قاعدة البيانات
        $enrichedRows = $this->enrichActivitiesWithDetails($rows->items());

        return response()->json([
            'success' => true,
            'data' => $enrichedRows,
            'summary' => $summary,
            'filters' => [
                'action_types' => StaffActivity::query()->select('action_type')->distinct()->orderBy('action_type')->pluck('action_type')->values(),
                'entity_types' => StaffActivity::query()->select('entity_type')->whereNotNull('entity_type')->distinct()->orderBy('entity_type')->pluck('entity_type')->values(),
                'action_type_labels' => $this->buildActionTypeLabels(),
                'entity_type_labels' => $this->buildEntityTypeLabels(),
            ],
            'pagination' => [
                'total' => $rows->total(),
                'per_page' => $rows->perPage(),
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
            ],
        ]);
    }

    /**
     * إضافة تفاصيل غنية لكل نشاط
     */
    private function enrichActivitiesWithDetails($activities)
    {
        return array_map(function ($activity) {
            $enriched = $activity->toArray();

            $entityDetails = $this->fetchEntityDetails($activity);
            $metaDetails = !empty($activity->meta) && is_array($activity->meta) ? $activity->meta : null;

            // ندمج تفاصيل الكيان الفعلية مع meta حتى تبقى أرقام السجل وتظهر عناصر الفاتورة (items)
            $details = null;
            if (is_array($entityDetails) && is_array($metaDetails)) {
                $details = array_merge($entityDetails, $metaDetails);
                if (isset($entityDetails['items']) && is_array($entityDetails['items'])) {
                    $details['items'] = $entityDetails['items'];
                }
            } elseif (is_array($entityDetails)) {
                $details = $entityDetails;
            } elseif (is_array($metaDetails)) {
                $details = $metaDetails;
            }

            $display = $this->getDisplayMeta($activity);

            $enriched['detailed_data'] = $details;
            $enriched['display_title'] = $display['title'];
            $enriched['display_icon'] = $display['icon'];
            $enriched['display_color'] = $display['color'];
            $enriched['activity_kind_key'] = $display['kind_key'];
            $enriched['activity_kind_ar'] = $display['kind_ar'];
            $enriched['activity_summary'] = $activity->description ?: $display['title'];

            $enriched['amount'] = null;
            $enriched['profit'] = null;
            $enriched['quantity'] = null;
            if (is_array($details)) {
                if ((string) ($activity->action_type ?? '') === 'cashier_shift_end') {
                    $details = $this->appendShiftActionRowsFromBackend($activity, $details);
                }
                $enriched['amount'] = $details['total_amount'] ?? $details['total'] ?? $details['amount_paid'] ?? $details['amount'] ?? null;
                $enriched['profit'] = $details['total_profit'] ?? $details['profit'] ?? null;
                if (array_key_exists('total_quantity', $details)) {
                    $enriched['quantity'] = $details['total_quantity'];
                } elseif (array_key_exists('items_count', $details)) {
                    $enriched['quantity'] = $details['items_count'];
                }
            }

            return $enriched;
        }, $activities);
    }

    private function appendShiftActionRowsFromBackend($activity, array $details): array
    {
        try {
            $username = (string) ($activity->username ?? '');
            if ($username === '') {
                return $details;
            }

            $start = null;
            $end = null;
            if (!empty($details['shift_started_at'])) {
                $start = Carbon::parse((string) $details['shift_started_at']);
            }
            if (!empty($details['shift_ended_at'])) {
                $end = Carbon::parse((string) $details['shift_ended_at']);
            }
            if (!$end) {
                $end = Carbon::parse((string) ($activity->created_at ?? Carbon::now()->toIso8601String()));
            }
            if (!$start) {
                $start = (clone $end)->startOfDay();
            }

            $requiredActions = [
                'cashier_sale',
                'purchase_created',
                'product_created',
                'product_updated',
                'debt_customer_payment',
                'supplier_debt_payment',
                'category_created',
                'stocktake_apply',
                'stocktake_adjustment',
            ];

            $rows = StaffActivity::query()
                ->whereRaw('LOWER(username) = ?', [strtolower($username)])
                ->whereIn('action_type', $requiredActions)
                ->where('id', '!=', (int) ($activity->id ?? 0))
                ->whereBetween('created_at', [$start->toDateTimeString(), $end->toDateTimeString()])
                ->orderBy('created_at')
                ->get();

            $details['shift_action_rows'] = $rows->map(function ($row) {
                $meta = is_array($row->meta) ? $row->meta : [];
                $display = $this->getDisplayMeta($row);
                return [
                    'action_type' => (string) ($row->action_type ?? ''),
                    'action_label' => $display['kind_ar'] ?? $display['title'] ?? ((string) ($row->action_type ?? '')),
                    'created_at' => $row->created_at ? $row->created_at->toIso8601String() : null,
                    'amount' => (float) ($meta['total'] ?? $meta['total_amount'] ?? $meta['amount'] ?? 0),
                    'reference' => $meta['invoice_number'] ?? $meta['order_number'] ?? $meta['invoiceId'] ?? $meta['id'] ?? null,
                    'details' => $meta,
                ];
            })->values()->toArray();
            $details['shift_actions_count'] = count($details['shift_action_rows']);
        } catch (\Exception $e) {
            // keep original details if query fails
        }

        return $details;
    }

    private function buildSummary($activities): array
    {
        $summary = [
            'sold_quantity' => 0.0,
            'sold_amount' => 0.0,
            'profit_amount' => 0.0,
            'purchase_amount' => 0.0,
        ];

        foreach ($activities as $activity) {
            $meta = is_array($activity->meta) ? $activity->meta : [];
            $action = (string) ($activity->action_type ?? '');
            $entity = (string) ($activity->entity_type ?? '');

            if ($action === 'sale_create' || $entity === 'order') {
                $summary['sold_amount'] += (float) ($meta['total'] ?? 0);
                $summary['profit_amount'] += (float) ($meta['total_profit'] ?? 0);
                $summary['sold_quantity'] += (float) ($meta['total_quantity'] ?? $meta['items_count'] ?? 0);
            } elseif ($action === 'purchase_create' || $entity === 'purchase') {
                $summary['purchase_amount'] += (float) ($meta['total'] ?? 0);
            }
        }

        foreach ($summary as $key => $value) {
            $summary[$key] = round((float) $value, 2);
        }

        return $summary;
    }

    /**
     * @return array{title:string,icon:string,color:string,kind_key:string,kind_ar:string}
     */
    private function getDisplayMeta($activity): array
    {
        $action = (string) ($activity->action_type ?? '');
        $map = [
            'sale_create' => ['title' => 'عملية بيع', 'icon' => 'shopping_cart', 'color' => 'success', 'kind_key' => 'sale', 'kind_ar' => 'بيع'],
            'cashier_sale' => ['title' => 'عملية بيع', 'icon' => 'shopping_cart', 'color' => 'success', 'kind_key' => 'sale', 'kind_ar' => 'بيع'],
            'purchase_create' => ['title' => 'عملية شراء', 'icon' => 'local_shipping', 'color' => 'info', 'kind_key' => 'purchase', 'kind_ar' => 'شراء'],
            'purchase_created' => ['title' => 'عملية شراء', 'icon' => 'local_shipping', 'color' => 'info', 'kind_key' => 'purchase', 'kind_ar' => 'شراء'],
            'supplier_debt_payment' => ['title' => 'تسديد دين مورد', 'icon' => 'payments', 'color' => 'warning', 'kind_key' => 'debt_payment', 'kind_ar' => 'تسديد دين'],
            'debt_customer_payment' => ['title' => 'تسديد دين زبون', 'icon' => 'payments', 'color' => 'warning', 'kind_key' => 'debt_payment', 'kind_ar' => 'تسديد دين'],
            'product_create' => ['title' => 'إضافة صنف', 'icon' => 'add_circle', 'color' => 'success', 'kind_key' => 'product_create', 'kind_ar' => 'إضافة صنف'],
            'product_created' => ['title' => 'إضافة صنف', 'icon' => 'add_circle', 'color' => 'success', 'kind_key' => 'product_create', 'kind_ar' => 'إضافة صنف'],
            'product_update' => ['title' => 'تعديل صنف', 'icon' => 'edit', 'color' => 'primary', 'kind_key' => 'product_update', 'kind_ar' => 'تعديل صنف'],
            'product_updated' => ['title' => 'تعديل صنف', 'icon' => 'edit', 'color' => 'primary', 'kind_key' => 'product_update', 'kind_ar' => 'تعديل صنف'],
            'product_delete' => ['title' => 'حذف صنف', 'icon' => 'delete', 'color' => 'error', 'kind_key' => 'product_delete', 'kind_ar' => 'حذف صنف'],
            'product_deleted' => ['title' => 'حذف صنف', 'icon' => 'delete', 'color' => 'error', 'kind_key' => 'product_delete', 'kind_ar' => 'حذف صنف'],
            'category_create' => ['title' => 'إضافة قسم', 'icon' => 'add_circle', 'color' => 'success', 'kind_key' => 'category_create', 'kind_ar' => 'إضافة قسم'],
            'category_created' => ['title' => 'إضافة قسم', 'icon' => 'add_circle', 'color' => 'success', 'kind_key' => 'category_create', 'kind_ar' => 'إضافة قسم'],
            'category_update' => ['title' => 'تعديل قسم', 'icon' => 'edit', 'color' => 'primary', 'kind_key' => 'category_update', 'kind_ar' => 'تعديل قسم'],
            'category_updated' => ['title' => 'تعديل قسم', 'icon' => 'edit', 'color' => 'primary', 'kind_key' => 'category_update', 'kind_ar' => 'تعديل قسم'],
            'category_delete' => ['title' => 'حذف قسم', 'icon' => 'delete', 'color' => 'error', 'kind_key' => 'category_delete', 'kind_ar' => 'حذف قسم'],
            'category_deleted' => ['title' => 'حذف قسم', 'icon' => 'delete', 'color' => 'error', 'kind_key' => 'category_delete', 'kind_ar' => 'حذف قسم'],
            'user_create' => ['title' => 'إضافة مستخدم', 'icon' => 'person_add', 'color' => 'success', 'kind_key' => 'user_create', 'kind_ar' => 'إضافة مستخدم'],
            'user_created' => ['title' => 'إضافة مستخدم', 'icon' => 'person_add', 'color' => 'success', 'kind_key' => 'user_create', 'kind_ar' => 'إضافة مستخدم'],
            'user_update' => ['title' => 'تعديل مستخدم', 'icon' => 'manage_accounts', 'color' => 'primary', 'kind_key' => 'user_update', 'kind_ar' => 'تعديل مستخدم'],
            'user_updated' => ['title' => 'تعديل مستخدم', 'icon' => 'manage_accounts', 'color' => 'primary', 'kind_key' => 'user_update', 'kind_ar' => 'تعديل مستخدم'],
            'user_delete' => ['title' => 'حذف مستخدم', 'icon' => 'person_remove', 'color' => 'error', 'kind_key' => 'user_delete', 'kind_ar' => 'حذف مستخدم'],
            'user_deleted' => ['title' => 'حذف مستخدم', 'icon' => 'person_remove', 'color' => 'error', 'kind_key' => 'user_delete', 'kind_ar' => 'حذف مستخدم'],
            'treasury_manual_deposit' => ['title' => 'إيداع يدوي خزنة', 'icon' => 'account_balance_wallet', 'color' => 'success', 'kind_key' => 'treasury_deposit', 'kind_ar' => 'إيداع خزنة'],
            'treasury_manual_withdraw' => ['title' => 'سحب يدوي خزنة', 'icon' => 'money_off', 'color' => 'warning', 'kind_key' => 'treasury_withdraw', 'kind_ar' => 'سحب خزنة'],
            'stocktake_adjustment' => ['title' => 'تعديل مخزون عبر الجرد', 'icon' => 'fact_check', 'color' => 'warning', 'kind_key' => 'stocktake', 'kind_ar' => 'جرد مخزون'],
            'stocktake_apply' => ['title' => 'تطبيق جرد المخزون', 'icon' => 'fact_check', 'color' => 'warning', 'kind_key' => 'stocktake', 'kind_ar' => 'جرد مخزون'],
            'cashier_hold_save' => ['title' => 'حفظ سلة مؤقتة', 'icon' => 'save', 'color' => 'default', 'kind_key' => 'hold', 'kind_ar' => 'سلة معلّقة'],
            'cashier_hold_delete' => ['title' => 'حذف سلة مؤقتة', 'icon' => 'delete', 'color' => 'error', 'kind_key' => 'hold', 'kind_ar' => 'سلة معلّقة'],
            'cashier_shift_end' => ['title' => 'إنهاء دوام', 'icon' => 'schedule', 'color' => 'secondary', 'kind_key' => 'shift_end', 'kind_ar' => 'إنهاء دوام'],
        ];

        if (isset($map[$action])) {
            return $map[$action];
        }

        return [
            'title' => $this->getActivityTitle($activity),
            'icon' => $this->getActivityIcon($activity),
            'color' => $this->getActivityColor($activity),
            'kind_key' => 'other',
            'kind_ar' => 'أخرى',
        ];
    }

    private function buildActionTypeLabels(): array
    {
        $types = StaffActivity::query()
            ->select('action_type')
            ->distinct()
            ->orderBy('action_type')
            ->pluck('action_type')
            ->values()
            ->toArray();
        $labels = [];
        foreach ($types as $type) {
            $fake = (object) ['action_type' => $type, 'entity_type' => null];
            $labels[$type] = $this->getDisplayMeta($fake)['kind_ar'] ?? (string) $type;
        }
        return $labels;
    }

    private function buildEntityTypeLabels(): array
    {
        $map = [
            'order' => 'فاتورة بيع',
            'purchase' => 'فاتورة شراء',
            'product' => 'صنف',
            'supplier' => 'مورد',
            'credit_customer' => 'زبون آجل',
            'user' => 'مستخدم',
            'category' => 'قسم',
            'shift' => 'إنهاء دوام',
            'stocktake' => 'جرد مخزون',
            'debt_payment' => 'تسديد ديون',
            'treasury' => 'الخزنة',
            'draft' => 'سلة معلّقة',
            'system' => 'نظام',
        ];
        $types = StaffActivity::query()
            ->select('entity_type')
            ->whereNotNull('entity_type')
            ->distinct()
            ->orderBy('entity_type')
            ->pluck('entity_type')
            ->values()
            ->toArray();
        $labels = [];
        foreach ($types as $type) {
            $labels[$type] = $map[$type] ?? $type;
        }
        return $labels;
    }

    /**
     * جلب تفاصيل الكيان المرتبط من قاعدة البيانات
     */
    private function fetchEntityDetails($activity)
    {
        if (!$activity->entity_type || !$activity->entity_id) {
            return null;
        }
        
        switch ($activity->entity_type) {
            case 'order':
                return $this->getOrderDetails($activity->entity_id);
            case 'purchase':
                return $this->getPurchaseDetails($activity->entity_id);
            case 'supplier':
                return $this->getSupplierDetails($activity->entity_id);
            case 'product':
                return $this->getProductDetails($activity->entity_id);
            case 'credit_customer':
                return $this->getCreditCustomerDetails($activity->entity_id);
            case 'user':
                return $this->getUserDetails($activity->entity_id);
            default:
                return null;
        }
    }

    /**
     * جلب تفاصيل الطلب (فاتورة بيع)
     */
    private function getOrderDetails($orderId)
    {
        try {
            $order = Order::with(['items'])->find($orderId);
            if (!$order) return null;
            
            return [
                'type' => 'order',
                'order_number' => $order->order_number ?? $order->id,
                'invoice_number' => $order->invoice_number ?? $order->order_number,
                'total_amount' => (float) $order->total,
                'total_profit' => (float) ($order->total_profit ?? 0),
                'paid_amount' => (float) $order->paid_amount,
                'due_amount' => (float) $order->due_amount,
                'customer_name' => $order->customer_name,
                'payment_method' => $order->payment_method,
                'items_count' => $order->items->count(),
                'total_quantity' => (float) $order->items->sum('quantity'),
                'items' => $order->items->map(function($item) {
                    $qty = (float) ($item->quantity ?? 0);
                    $unitPrice = (float) ($item->unit_price ?? 0);
                    $unitCost = (float) ($item->unit_cost ?? 0);
                    $lineTotal = (float) ($item->total_price ?? ($qty * $unitPrice));
                    $lineProfit = (float) ($item->item_profit ?? ($lineTotal - ($qty * $unitCost)));
                    $unitProfit = $qty > 0 ? ($lineProfit / $qty) : (float) ($item->unit_profit ?? 0);
                    return [
                        'product_name' => $item->item_name ?? $item->name ?? ('#' . $item->id),
                        'quantity' => $qty,
                        'unit_price' => $unitPrice,
                        'unit_cost' => $unitCost,
                        'unit_profit' => $unitProfit,
                        'item_profit' => $lineProfit,
                        'sale_type' => $item->sale_type ?? null,
                        'total_price' => $lineTotal,
                    ];
                })->values()->toArray(),
                'created_at' => $order->created_at ? $order->created_at->toISOString() : null,
                'cashier_name' => $order->cashier_name,
                'discount' => (float) $order->discount,
                'subtotal' => (float) $order->subtotal
            ];
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * جلب تفاصيل عملية الشراء
     */
    private function getPurchaseDetails($purchaseId)
    {
        try {
            $purchase = Purchase::with(['items', 'supplier'])->find($purchaseId);
            if (!$purchase) return null;
            $otherExpenses = TreasuryTransaction::query()
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
                ->values()
                ->toArray();
            
            return [
                'type' => 'purchase',
                'invoice_number' => $purchase->invoice_number,
                'total_amount' => (float) $purchase->total_amount,
                'paid_amount' => (float) $purchase->paid_amount,
                'remaining_amount' => (float) $purchase->remaining_amount,
                'supplier_name' => $purchase->supplier->name ?? '—',
                'supplier_id' => $purchase->supplier_id,
                'purchase_date' => $purchase->purchase_date,
                'items_count' => $purchase->items->count(),
                'total_quantity' => (float) $purchase->items->sum('quantity'),
                'items' => $purchase->items->map(function($item) {
                    return [
                        'product_id' => $item->product_id,
                        'product_name' => $item->product_name,
                        'quantity' => (float) $item->quantity,
                        'unit_price' => (float) $item->unit_price,
                        'sale_price' => (float) ($item->sale_price ?? 0),
                        'purchase_unit' => $item->purchase_unit ?? null,
                        'remaining_quantity' => (float) ($item->remaining_quantity ?? $item->quantity ?? 0),
                        'returned_quantity' => (float) ($item->returned_quantity ?? 0),
                        'total_price' => (float) $item->total_price,
                    ];
                })->values()->toArray(),
                'payment_method' => $purchase->payment_method,
                'status' => $purchase->status,
                'other_expenses_total' => round(collect($otherExpenses)->sum('amount'), 2),
                'other_expenses' => $otherExpenses,
            ];
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * جلب تفاصيل المورد
     */
    private function getSupplierDetails($supplierId)
    {
        try {
            $supplier = Supplier::find($supplierId);
            if (!$supplier) return null;
            
            $totalPurchases = Purchase::where('supplier_id', $supplierId)->sum('total_amount');
            $totalPaid = Purchase::where('supplier_id', $supplierId)->sum('paid_amount');
            $remainingDebt = $totalPurchases - $totalPaid;
            
            return [
                'type' => 'supplier',
                'name' => $supplier->name,
                'phone' => $supplier->phone,
                'email' => $supplier->email,
                'address' => $supplier->address,
                'total_purchases' => (float) $totalPurchases,
                'remaining_debt' => (float) $remainingDebt,
                'created_at' => $supplier->created_at ? $supplier->created_at->toISOString() : null
            ];
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * جلب تفاصيل المنتج
     */
    private function getProductDetails($productId)
    {
        try {
            $product = Product::with('category')->find($productId);
            if (!$product) return null;
            
            return [
                'type' => 'product',
                'name' => $product->name,
                'barcode' => $product->barcode,
                'price' => (float) $product->price,
                'cost_price' => (float) $product->cost_price,
                'stock' => (float) $product->stock,
                'category_name' => $product->category->name ?? '—',
                'unit' => $product->unit,
                'allow_split_sales' => (bool) $product->allow_split_sales,
                'is_active' => (bool) $product->is_active,
                'created_at' => $product->created_at ? $product->created_at->toISOString() : null
            ];
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * جلب تفاصيل زبون الآجل
     */
    private function getCreditCustomerDetails($customerId)
    {
        try {
            $customer = Customer::find($customerId);
            if (!$customer) {
                return null;
            }

            return [
                'type' => 'credit_customer',
                'name' => $customer->name,
                'phone' => $customer->phone ?? '—',
                'balance' => (float) ($customer->current_balance ?? 0),
                'credit_limit' => (float) ($customer->credit_limit ?? 0),
                'created_at' => $customer->created_at ? $customer->created_at->toISOString() : null,
            ];
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * جلب تفاصيل المستخدم
     */
    private function getUserDetails($userId)
    {
        try {
            $user = User::find($userId);
            if (!$user) return null;
            
            return [
                'type' => 'user',
                'username' => $user->username,
                'role' => $user->role,
                'is_active' => (bool) $user->is_active,
                'created_at' => $user->created_at ? $user->created_at->toISOString() : null
            ];
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * الحصول على عنوان مناسب للنشاط
     */
    private function getActivityTitle($activity)
    {
        $action = $activity->action_type;
        
        $titles = [
            'cashier_sale' => '💰 فاتورة بيع',
            'purchase_created' => '📦 فاتورة شراء',
            'debt_customer_payment' => '💳 تسديد دين',
            'product_created' => '➕ إضافة منتج',
            'product_updated' => '✏️ تعديل منتج',
            'product_deleted' => '🗑️ حذف منتج',
            'supplier_created' => '➕ إضافة مورد',
            'supplier_updated' => '✏️ تعديل مورد',
            'supplier_deleted' => '🗑️ حذف مورد',
            'user_created' => '👤 إضافة مستخدم',
            'user_updated' => '✏️ تعديل مستخدم',
            'user_deleted' => '🗑️ حذف مستخدم',
            'order_returned' => '↩️ إرجاع فاتورة',
            'purchase_returned' => '↩️ إرجاع مشتريات',
            'cashier_hold_save' => '💾 حفظ سلة مؤقتة',
            'cashier_hold_delete' => '🗑️ حذف سلة مؤقتة',
        ];
        
        return $titles[$action] ?? ($activity->entity_type ? "📋 {$activity->action_type}" : '📋 نشاط');
    }

    /**
     * الحصول على أيقونة مناسبة للنشاط
     */
    private function getActivityIcon($activity)
    {
        $action = $activity->action_type;
        
        if (str_contains($action, 'sale')) return 'shopping_cart';
        if (str_contains($action, 'purchase')) return 'local_shipping';
        if (str_contains($action, 'payment')) return 'payments';
        if (str_contains($action, 'delete')) return 'delete';
        if (str_contains($action, 'return')) return 'assignment_return';
        if (str_contains($action, 'create')) return 'add_circle';
        if (str_contains($action, 'update')) return 'edit';
        if (str_contains($action, 'hold')) return 'save';
        
        return 'receipt';
    }

    /**
     * الحصول على لون مناسب للنشاط
     */
    private function getActivityColor($activity)
    {
        $action = $activity->action_type;
        
        if (str_contains($action, 'sale')) return 'success';
        if (str_contains($action, 'purchase')) return 'info';
        if (str_contains($action, 'payment')) return 'warning';
        if (str_contains($action, 'delete')) return 'error';
        if (str_contains($action, 'return')) return 'secondary';
        if (str_contains($action, 'create')) return 'success';
        if (str_contains($action, 'update')) return 'primary';
        if (str_contains($action, 'hold')) return 'default';
        
        return 'default';
    }
}