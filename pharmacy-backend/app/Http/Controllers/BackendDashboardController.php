<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Pharmacy;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\Treasury;
use App\Models\User;
use App\Services\PharmacyPlanService;
use App\Support\BackendWebScope;

class BackendDashboardController extends Controller
{
    public function index(PharmacyPlanService $planService)
    {
        $scope = BackendWebScope::id();
        if ($scope !== null && $scope > 0) {
            if (Pharmacy::find($scope)) {
                return redirect()->route('backend.pharmacies.show', $scope);
            }
            BackendWebScope::clear();
        }

        $pharmacies = Pharmacy::orderBy('id')->get();
        $rows = [];
        foreach ($pharmacies as $p) {
            $rows[] = [
                'pharmacy' => $p,
                'stats' => $this->tenantStats((int) $p->id),
                'plan' => $planService->toApiArray($p),
            ];
        }

        $platformAdmins = User::withoutGlobalScopes()
            ->whereNull('pharmacy_id')
            ->orderBy('id')
            ->get(['id', 'username', 'role', 'is_active', 'approval_status', 'created_at']);

        $tenantUsersCount = User::withoutGlobalScopes()->whereNotNull('pharmacy_id')->count();

        return view('backend.dashboard', [
            'rows' => $rows,
            'platformAdmins' => $platformAdmins,
            'pharmaciesCount' => $pharmacies->count(),
            'tenantUsersCount' => $tenantUsersCount,
        ]);
    }

    public function pharmacyShow($pharmacy, PharmacyPlanService $planService)
    {
        $id = (int) $pharmacy;
        $p = Pharmacy::findOrFail($id);
        BackendWebScope::set($id);
        $stats = $this->tenantStats($id);
        $planSnapshot = $planService->toApiArray($p);

        $users = User::withoutGlobalScopes()
            ->where('pharmacy_id', $id)
            ->orderByRaw("CASE role WHEN 'admin' THEN 1 WHEN 'super_admin' THEN 2 WHEN 'cashier' THEN 3 ELSE 4 END")
            ->orderBy('username')
            ->get();

        $treasury = Treasury::withoutGlobalScopes()->where('pharmacy_id', $id)->first();

        $admins = $users->filter(fn ($u) => in_array($u->role, ['admin', 'super_admin'], true));
        $cashiers = $users->filter(fn ($u) => $u->role === 'cashier');

        return view('backend.pharmacy-show', [
            'p' => $p,
            'stats' => $stats,
            'admins' => $admins,
            'cashiers' => $cashiers,
            'treasury' => $treasury,
            'planSnapshot' => $planSnapshot,
        ]);
    }

    /**
     * @return array<string, float|int>
     */
    private function tenantStats(int $pharmacyId): array
    {
        $q = fn (string $model) => $model::withoutGlobalScopes()->where('pharmacy_id', $pharmacyId);

        return [
            'admins_count' => User::withoutGlobalScopes()
                ->where('pharmacy_id', $pharmacyId)
                ->whereIn('role', ['admin', 'super_admin'])
                ->count(),
            'cashiers_count' => User::withoutGlobalScopes()
                ->where('pharmacy_id', $pharmacyId)
                ->where('role', 'cashier')
                ->count(),
            'users_total' => User::withoutGlobalScopes()->where('pharmacy_id', $pharmacyId)->count(),
            'products_count' => $q(Product::class)->count(),
            'products_active' => $q(Product::class)->where('is_active', true)->count(),
            'categories_count' => $q(Category::class)->count(),
            'orders_count' => $q(Order::class)->count(),
            'orders_sales_total' => (float) $q(Order::class)->sum('total'),
            'customers_count' => $q(Customer::class)->count(),
            'suppliers_count' => $q(Supplier::class)->count(),
            'purchases_count' => $q(Purchase::class)->count(),
            'treasury_balance' => (float) (Treasury::withoutGlobalScopes()->where('pharmacy_id', $pharmacyId)->value('balance') ?? 0),
        ];
    }
}
