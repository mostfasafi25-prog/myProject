<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Product;
use App\Models\Purchase;
use Illuminate\Http\Request;
use Carbon\Carbon;

class AdminDashboardController extends Controller
{
    /**
     * ملخص لوحة التحكم من قاعدة البيانات (طلبات + منتجات).
     * التواريخ والساعات تُحسب وفق config('app.timezone') وليس UTC الخام في SQL.
     */
    public function summary(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'super_admin', 'cashier'], true)) {
            return response()->json(['success' => false, 'message' => 'غير مصرح'], 403);
        }

        $tz = config('app.timezone');
        $nowLocal = Carbon::now($tz);

        $today = $nowLocal->toDateString();
        $purchaseDateExpr = 'DATE(COALESCE(purchase_date, created_at))';
        $monthStart = $nowLocal->copy()->startOfMonth()->toDateString();
        $monthEnd = $nowLocal->copy()->endOfMonth()->toDateString();
        $daysInMonth = $nowLocal->daysInMonth;
        $monthEndDate = $nowLocal->toDateString();

        $todayStartUtc = $nowLocal->copy()->startOfDay()->utc();
        $todayEndUtc = $nowLocal->copy()->endOfDay()->utc();
        $monthStartUtc = $nowLocal->copy()->startOfMonth()->startOfDay()->utc();
        $monthEndUtc = $nowLocal->copy()->endOfMonth()->endOfDay()->utc();
        $nowUtc = $nowLocal->copy()->utc();

        $weekStartLocal = $nowLocal->copy()->startOfDay()->subDays(6);
        $weekStartUtc = $weekStartLocal->copy()->utc();
        $weekEndUtc = $nowLocal->copy()->endOfDay()->utc();

        $weekStartDate = $weekStartLocal->toDateString();
        $weekEndDate = $nowLocal->toDateString();

        // ——— مبيعات الشهر: تجميع حسب يوم التقويم المحلي ———
        $ordersInMonth = Order::query()
            ->whereBetween('created_at', [$monthStartUtc, $monthEndUtc])
            ->get(['created_at', 'total']);
        $dailyAgg = [];
        $dailyCount = [];
        foreach ($ordersInMonth as $o) {
            $ds = $o->created_at->timezone($tz)->toDateString();
            $dailyAgg[$ds] = ($dailyAgg[$ds] ?? 0) + (float) $o->total;
            $dailyCount[$ds] = ($dailyCount[$ds] ?? 0) + 1;
        }

        $purchaseDailyMonth = Purchase::query()
            ->where('status', '!=', 'returned')
            ->whereRaw("{$purchaseDateExpr} BETWEEN ? AND ?", [$monthStart, $monthEnd])
            ->get(['purchase_date', 'created_at', 'total_amount']);
        $purchaseByBizDayMonth = [];
        foreach ($purchaseDailyMonth as $p) {
            $ds = $p->purchase_date
                ? $p->purchase_date->format('Y-m-d')
                : $p->created_at->timezone($tz)->format('Y-m-d');
            $purchaseByBizDayMonth[$ds] = ($purchaseByBizDayMonth[$ds] ?? 0) + (float) $p->total_amount;
        }

        $monthlyDays = [];
        for ($d = 1; $d <= $daysInMonth; $d++) {
            $day = $nowLocal->copy()->startOfMonth()->addDays($d - 1);
            $ds = $day->toDateString();
            $monthlyDays[] = [
                'date' => $ds,
                'label' => $day->format('j'),
                'sales' => (float) ($dailyAgg[$ds] ?? 0),
                'count' => (int) ($dailyCount[$ds] ?? 0),
                'purchases' => (float) ($purchaseByBizDayMonth[$ds] ?? 0),
            ];
        }

        $last7Days = [
            'orders_count' => Order::whereBetween('created_at', [$weekStartUtc, $weekEndUtc])->count(),
            'total_sales' => (float) Order::whereBetween('created_at', [$weekStartUtc, $weekEndUtc])->sum('total'),
            'total_profit' => (float) Order::whereBetween('created_at', [$weekStartUtc, $weekEndUtc])->sum('total_profit'),
        ];

        $purchasesTodayTotal = (float) Purchase::query()
            ->where('status', '!=', 'returned')
            ->whereRaw("{$purchaseDateExpr} = ?", [$today])
            ->sum('total_amount');
        $purchasesTodayCount = (int) Purchase::query()
            ->where('status', '!=', 'returned')
            ->whereRaw("{$purchaseDateExpr} = ?", [$today])
            ->count();

        $purchasesWeekTotal = (float) Purchase::query()
            ->where('status', '!=', 'returned')
            ->whereRaw("{$purchaseDateExpr} BETWEEN ? AND ?", [$weekStartDate, $weekEndDate])
            ->sum('total_amount');
        $purchasesWeekCount = (int) Purchase::query()
            ->where('status', '!=', 'returned')
            ->whereRaw("{$purchaseDateExpr} BETWEEN ? AND ?", [$weekStartDate, $weekEndDate])
            ->count();

        $purchasesMonthTotal = (float) Purchase::query()
            ->where('status', '!=', 'returned')
            ->whereRaw("{$purchaseDateExpr} BETWEEN ? AND ?", [$monthStart, $monthEndDate])
            ->sum('total_amount');
        $purchasesMonthCount = (int) Purchase::query()
            ->where('status', '!=', 'returned')
            ->whereRaw("{$purchaseDateExpr} BETWEEN ? AND ?", [$monthStart, $monthEndDate])
            ->count();

        // مخطط ساعات اليوم — الساعة والمجاميع حسب توقيت الصيدلية
        $currentHour = (int) $nowLocal->format('G');

        $salesHoursToday = [];
        $ordersToday = Order::query()
            ->whereBetween('created_at', [$todayStartUtc, $todayEndUtc])
            ->get(['created_at', 'total']);
        foreach ($ordersToday as $o) {
            $h = (int) $o->created_at->timezone($tz)->format('G');
            $salesHoursToday[$h] = ($salesHoursToday[$h] ?? 0) + (float) $o->total;
        }

        $purchaseHoursToday = [];
        $purchasesTodayRows = Purchase::query()
            ->where('status', '!=', 'returned')
            ->whereRaw("{$purchaseDateExpr} = ?", [$today])
            ->get(['created_at', 'total_amount']);
        foreach ($purchasesTodayRows as $p) {
            $h = (int) $p->created_at->timezone($tz)->format('G');
            $purchaseHoursToday[$h] = ($purchaseHoursToday[$h] ?? 0) + (float) $p->total_amount;
        }

        $chartTodayHours = [];
        for ($h = 0; $h <= $currentHour; $h++) {
            $chartTodayHours[] = [
                'label' => sprintf('%02d:00', $h),
                'sales' => (float) ($salesHoursToday[$h] ?? 0),
                'purchases' => (float) ($purchaseHoursToday[$h] ?? 0),
            ];
        }

        $salesByWeekDay = [];
        $ordersWeek = Order::query()
            ->whereBetween('created_at', [$weekStartUtc, $weekEndUtc])
            ->get(['created_at', 'total']);
        foreach ($ordersWeek as $o) {
            $d = $o->created_at->timezone($tz)->toDateString();
            $salesByWeekDay[$d] = ($salesByWeekDay[$d] ?? 0) + (float) $o->total;
        }

        $purchasesByWeekDay = [];
        $purchasesWeekRows = Purchase::query()
            ->where('status', '!=', 'returned')
            ->whereRaw("{$purchaseDateExpr} BETWEEN ? AND ?", [$weekStartDate, $weekEndDate])
            ->get(['purchase_date', 'created_at', 'total_amount']);
        foreach ($purchasesWeekRows as $p) {
            $d = $p->purchase_date
                ? $p->purchase_date->format('Y-m-d')
                : $p->created_at->timezone($tz)->format('Y-m-d');
            $purchasesByWeekDay[$d] = ($purchasesByWeekDay[$d] ?? 0) + (float) $p->total_amount;
        }

        $arabicWeekday = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        $chartWeekDays = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = $nowLocal->copy()->startOfDay()->subDays($i);
            $ds = $day->toDateString();
            $dow = (int) $day->format('w');
            $chartWeekDays[] = [
                'date' => $ds,
                'label' => $arabicWeekday[$dow] ?? $ds,
                'sales' => (float) ($salesByWeekDay[$ds] ?? 0),
                'purchases' => (float) ($purchasesByWeekDay[$ds] ?? 0),
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'timezone' => $tz,
                'today' => [
                    'orders_count' => Order::whereBetween('created_at', [$todayStartUtc, $todayEndUtc])->count(),
                    'total_sales' => (float) Order::whereBetween('created_at', [$todayStartUtc, $todayEndUtc])->sum('total'),
                    'total_profit' => (float) Order::whereBetween('created_at', [$todayStartUtc, $todayEndUtc])->sum('total_profit'),
                ],
                'this_month' => [
                    'orders_count' => Order::whereBetween('created_at', [$monthStartUtc, $nowUtc])->count(),
                    'total_sales' => (float) Order::whereBetween('created_at', [$monthStartUtc, $nowUtc])->sum('total'),
                    'total_profit' => (float) Order::whereBetween('created_at', [$monthStartUtc, $nowUtc])->sum('total_profit'),
                ],
                'last_7_days' => $last7Days,
                'purchases' => [
                    'today' => [
                        'total' => $purchasesTodayTotal,
                        'count' => $purchasesTodayCount,
                    ],
                    'week' => [
                        'total' => $purchasesWeekTotal,
                        'count' => $purchasesWeekCount,
                    ],
                    'month' => [
                        'total' => $purchasesMonthTotal,
                        'count' => $purchasesMonthCount,
                    ],
                ],
                'products_count' => Product::count(),
                'products_active' => Product::where('is_active', true)->count(),
                'monthly_days' => $monthlyDays,
                'chart_today_hours' => $chartTodayHours,
                'chart_week_days' => $chartWeekDays,
            ],
        ]);
    }
}
