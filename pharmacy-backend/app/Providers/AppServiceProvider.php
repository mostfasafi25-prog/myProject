<?php

namespace App\Providers;

use App\Models\CashierShiftClose;
use App\Models\Order;
use App\Models\Purchase;
use App\Observers\ReportRetentionObserver;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        //
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        // قوالب الترقيم الافتراضية في Laravel 9+ مبنية على Tailwind ولا تتلاءم مع ثيم لوحة /backend الداكن
        // (تنسيقات .pagination في layouts.backend). نستخدم القالب الكلاسيكي <ul class="pagination">.
        Paginator::defaultView('pagination::default');
        Paginator::defaultSimpleView('pagination::simple-default');

        $observer = ReportRetentionObserver::class;
        Order::observe($observer);
        Purchase::observe($observer);
        CashierShiftClose::observe($observer);
    }
}
