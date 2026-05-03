<?php

namespace App\Observers;

use App\Models\CashierShiftClose;
use App\Models\Order;
use App\Models\Purchase;
use App\Services\PlanReportRetentionService;

class ReportRetentionObserver
{
    public function __construct(
        private PlanReportRetentionService $retention
    ) {}

    public function created(Order|Purchase|CashierShiftClose $model): void
    {
        $pid = $model->getAttribute('pharmacy_id');
        if ($pid !== null && $pid !== '') {
            $this->retention->enforceForPharmacy((int) $pid);
        }
    }
}
