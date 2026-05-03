<?php

namespace App\Services;

use App\Models\CashierShiftClose;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Pharmacy;
use App\Models\StaffActivity;
use App\Models\TreasuryTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PlanReportRetentionService
{
    public function __construct(
        private PharmacyPlanService $planService
    ) {}

    /**
     * حذف بيانات التقارير/السجلات الأقدم من نافذة الباقة (احتفاظ دوّار).
     */
    public function enforceForPharmacy(int $pharmacyId): void
    {
        $pharmacy = Pharmacy::query()->find($pharmacyId);
        if ($pharmacy === null) {
            return;
        }

        $cfg = $this->planService->reportsRetentionConfig($pharmacy);
        $months = $cfg['months'];
        if ($months === null || $months < 1) {
            return;
        }

        $cutoff = now()->subMonths($months)->startOfDay();

        if (Schema::hasTable('staff_activities')) {
            StaffActivity::withoutGlobalScopes()
                ->where('pharmacy_id', $pharmacyId)
                ->where('created_at', '<', $cutoff)
                ->delete();
        }

        if (Schema::hasTable('cashier_shift_closes')) {
            CashierShiftClose::withoutGlobalScopes()
                ->where('pharmacy_id', $pharmacyId)
                ->where('created_at', '<', $cutoff)
                ->delete();
        }

        if ($cfg['purge_orders'] && Schema::hasTable('orders')) {
            $this->purgeEligibleOrders($pharmacyId, $cutoff);
        }
    }

    public function enforceForAllPharmacies(): void
    {
        if (!Schema::hasTable('pharmacies')) {
            return;
        }
        Pharmacy::query()->orderBy('id')->each(function (Pharmacy $pharmacy) {
            $this->enforceForPharmacy((int) $pharmacy->id);
        });
    }

    private function purgeEligibleOrders(int $pharmacyId, \DateTimeInterface $cutoff): void
    {
        $creditTable = Schema::hasTable('customer_credit_movements');

        Order::withoutGlobalScopes()
            ->where('pharmacy_id', $pharmacyId)
            ->where('created_at', '<', $cutoff)
            ->where(function ($q) {
                $q->where('status', 'paid')->orWhere('status', 'cancelled');
            })
            ->when($creditTable, function ($q) use ($pharmacyId) {
                $q->whereRaw(
                    'NOT EXISTS (SELECT 1 FROM customer_credit_movements m WHERE m.reference_order_id = orders.id AND m.pharmacy_id = ?)',
                    [$pharmacyId]
                );
            })
            ->orderBy('id')
            ->chunkById(100, function ($orders) use ($pharmacyId) {
                $ids = $orders->pluck('id')->all();
                if ($ids === []) {
                    return;
                }
                DB::transaction(function () use ($ids, $pharmacyId) {
                    if (Schema::hasTable('treasury_transactions')) {
                        TreasuryTransaction::withoutGlobalScopes()
                            ->where('pharmacy_id', $pharmacyId)
                            ->whereIn('order_id', $ids)
                            ->update(['order_id' => null]);
                    }
                    if (Schema::hasTable('order_items')) {
                        OrderItem::withoutGlobalScopes()
                            ->where('pharmacy_id', $pharmacyId)
                            ->whereIn('order_id', $ids)
                            ->delete();
                    }
                    Order::withoutGlobalScopes()
                        ->where('pharmacy_id', $pharmacyId)
                        ->whereIn('id', $ids)
                        ->delete();
                });
            });
    }
}
