<?php

namespace App\Console\Commands;

use App\Models\Pharmacy;
use App\Services\PharmacyPlanService;
use Illuminate\Console\Command;

class SyncMonthlySubscriptionStates extends Command
{
    protected $signature = 'subscription:sync-monthly-states';

    protected $description = 'تحديث حالات الباقة الشهرية (متأخر / ملغى بعد مهلة السماح)';

    public function handle(PharmacyPlanService $plans): int
    {
        $n = 0;
        Pharmacy::query()
            ->where('subscription_plan', 'monthly')
            ->orderBy('id')
            ->each(function (Pharmacy $p) use ($plans, &$n) {
                if ($plans->syncMonthlySubscriptionLifecycle($p)) {
                    $n++;
                }
            });

        $this->info("تم تحديث {$n} صيدلية.");

        return self::SUCCESS;
    }
}
