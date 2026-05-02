<?php

namespace App\Console;

use App\Models\SystemNotification;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use Illuminate\Support\Facades\Schema;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     *
     * @param  \Illuminate\Console\Scheduling\Schedule  $schedule
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {
        $tz = config('app.timezone');

        // إشعار تشجيع أسبوعي للكاشيرين (يظهر مع إشعارات المدير اليدوية فقط في واجهة الكاشير)
        $schedule->call(function () {
            if (!Schema::hasTable('system_notifications')) {
                return;
            }
            SystemNotification::create([
                'type' => 'cashier_weekly_morale',
                'pref_category' => 'management_manual',
                'title' => 'تشجيع أسبوعي للفريق',
                'message' => 'يعطيك العافية وجهد مبارك — شكراً لالتزامك وجهدك مع الصيدلية هذا الأسبوع.',
                'details' => "رسالة أسبوعية من النظام.\nنتمنى لك أسبوعاً موفقاً في الخدمة.",
                'from_management' => true,
                'management_label' => 'إدارة الصيدلية',
                'recipients_type' => 'all',
                'recipient_usernames' => [],
                'created_by' => 'system',
                'read_by' => [],
                'deleted_by' => [],
            ]);
        })->weekly()->fridays()->at('15:00')->timezone($tz);
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
