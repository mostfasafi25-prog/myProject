<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SystemDashboardController extends Controller
{
    public function index()
    {
        $dbOk = false;
        $dbError = null;
        $stats = null;

        try {
            DB::connection()->getPdo();
            $dbOk = true;
        } catch (\Throwable $e) {
            $dbError = config('app.debug') ? $e->getMessage() : 'تعذر الاتصال بقاعدة البيانات';
        }

        if ($dbOk) {
            $tz = config('app.timezone');
            $nowLocal = Carbon::now($tz);
            $todayStartUtc = $nowLocal->copy()->startOfDay()->utc();
            $todayEndUtc = $nowLocal->copy()->endOfDay()->utc();

            $stats = [
                'products' => Product::count(),
                'products_active' => Product::where('is_active', true)->count(),
                'users' => User::count(),
                'orders_total' => Order::count(),
                'orders_today' => Order::whereBetween('created_at', [$todayStartUtc, $todayEndUtc])->count(),
                'sales_today' => (float) Order::whereBetween('created_at', [$todayStartUtc, $todayEndUtc])->sum('total'),
                'suppliers' => Supplier::count(),
                'categories' => Category::count(),
                'server_time' => $nowLocal->format('Y-m-d H:i'),
            ];
        }

        return view('system-dashboard', [
            'dbOk' => $dbOk,
            'dbError' => $dbError,
            'stats' => $stats,
            'appName' => config('app.name'),
            'appEnv' => config('app.env'),
            'timezone' => config('app.timezone'),
            'laravelVersion' => \Illuminate\Foundation\Application::VERSION,
            'phpVersion' => PHP_VERSION,
        ]);
    }
}
