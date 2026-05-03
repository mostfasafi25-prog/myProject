<?php

namespace App\Console\Commands;

use App\Services\PlanReportRetentionService;
use Illuminate\Console\Command;

class PlanReportRetentionEnforceCommand extends Command
{
    protected $signature = 'plan-report-retention:enforce {pharmacy_id? : معرف صيدلية محدد، أو اتركه لجميع الصيدليات}';

    protected $description = 'تطبيق حدود احتفاظ بيانات التقارير حسب باقة كل صيدلية';

    public function handle(PlanReportRetentionService $retention): int
    {
        $arg = $this->argument('pharmacy_id');
        if ($arg !== null && $arg !== '') {
            $retention->enforceForPharmacy((int) $arg);
            $this->info('تم التنفيذ للصيدلية '.$arg);

            return self::SUCCESS;
        }

        $retention->enforceForAllPharmacies();
        $this->info('تم التنفيذ لجميع الصيدليات');

        return self::SUCCESS;
    }
}
