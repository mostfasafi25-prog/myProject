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

        $monthlyDays = [];
        for ($d = 0; $d < 12; $d++) {
            $day = Carbon::now()->startOfMonth()->addDays($d);
            if ($day->month !== Carbon::now()->month) {
                break;
            }
            $ds = $day->toDateString();
            $monthlyDays[] = [
                'date' => $ds,
                'label' => $day->format('j'),
                'sales' => (float) Order::whereDate('created_at', $ds)->sum('total'),
                'count' => Order::whereDate('created_at', $ds)->count(),
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
