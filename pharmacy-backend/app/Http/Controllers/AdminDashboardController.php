<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;
use Carbon\Carbon;

class AdminDashboardController extends Controller
{
    /**
     * ملخص لوحة التحكم من قاعدة البيانات (طلبات + منتجات).
     */
    public function summary(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'super_admin', 'super_cashier'], true)) {
            return response()->json(['success' => false, 'message' => 'غير مصرح'], 403);
        }

        $today = Carbon::today()->toDateString();
        $monthStart = Carbon::now()->startOfMonth()->toDateString();
        $monthEnd = Carbon::now()->endOfMonth()->toDateString();
        $daysInMonth = Carbon::now()->daysInMonth; // عدد أيام الشهر الحالي
        $monthlyDays = [];
        $dailyAgg = Order::query()
            ->whereBetween('created_at', [$monthStart . ' 00:00:00', $monthEnd . ' 23:59:59'])
            ->selectRaw('DATE(created_at) as day, COUNT(*) as cnt, COALESCE(SUM(total), 0) as sales')
            ->groupBy('day')
            ->pluck('sales', 'day');
        $dailyCount = Order::query()
            ->whereBetween('created_at', [$monthStart . ' 00:00:00', $monthEnd . ' 23:59:59'])
            ->selectRaw('DATE(created_at) as day, COUNT(*) as cnt')
            ->groupBy('day')
            ->pluck('cnt', 'day');
        
        for ($d = 1; $d <= $daysInMonth; $d++) {
            $day = Carbon::now()->startOfMonth()->addDays($d - 1);
            $ds = $day->toDateString();
            $monthlyDays[] = [
                'date' => $ds,
                'label' => $day->format('j'),
                'sales' => (float) ($dailyAgg[$ds] ?? 0),
                'count' => (int) ($dailyCount[$ds] ?? 0),
            ];
        }
      

        return response()->json([
            'success' => true,
            'data' => [
                'today' => [
                    'orders_count' => Order::whereDate('created_at', $today)->count(),
                    'total_sales' => (float) Order::whereDate('created_at', $today)->sum('total'),
                    'total_profit' => (float) Order::whereDate('created_at', $today)->sum('total_profit'),
                ],
                'this_month' => [
                    'orders_count' => Order::where('created_at', '>=', $monthStart)->count(),
                    'total_sales' => (float) Order::where('created_at', '>=', $monthStart)->sum('total'),
                    'total_profit' => (float) Order::where('created_at', '>=', $monthStart)->sum('total_profit'),
                ],
                'products_count' => Product::count(),
                'products_active' => Product::where('is_active', true)->count(),
                'monthly_days' => $monthlyDays,
            ],
        ]);
    }
}
