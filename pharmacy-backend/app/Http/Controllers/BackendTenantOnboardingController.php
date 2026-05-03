<?php

namespace App\Http\Controllers;

use App\Models\Pharmacy;
use App\Models\StaffActivity;
use App\Models\Treasury;
use App\Models\User;
use App\Services\AdminWelcomeNotificationService;
use App\Services\PharmacyPlanService;
use Carbon\Carbon;
use Illuminate\Support\Facades\App;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use App\Support\BackendWebScope;

class BackendTenantOnboardingController extends Controller
{
    /** @var array<string, array{code:string,label:string}> */
    private const CURRENCY_PRESETS = [
        'ILS' => ['code' => 'ILS', 'label' => 'شيكل'],
        'EGP' => ['code' => 'EGP', 'label' => 'جنيه'],
        'USD' => ['code' => 'USD', 'label' => 'دولار'],
        'AED' => ['code' => 'AED', 'label' => 'درهم'],
    ];

    public function create()
    {
        if (BackendWebScope::active()) {
            return redirect()
                ->route('backend.pharmacies.show', BackendWebScope::id())
                ->with('error', 'لا يمكن إنشاء صيدلية جديدة أثناء عرض صيدلية واحدة. استخدم «عرض كل الصيدليات» أولاً.');
        }

        return view('backend.tenant-setup');
    }

    public function store(Request $request)
    {
        if (BackendWebScope::active()) {
            return redirect()
                ->route('backend.pharmacies.show', BackendWebScope::id())
                ->with('error', 'لا يمكن إنشاء صيدلية جديدة أثناء عرض صيدلية واحدة.');
        }

        $data = $request->validate([
            'pharmacy_name' => ['required', 'string', 'max:255'],
            'currency' => ['required', 'string', Rule::in(array_keys(self::CURRENCY_PRESETS))],
            'admin_username' => ['required', 'string', 'max:50', 'unique:users,username'],
            'admin_password' => ['required', 'string', 'min:6'],
            'initial_cash' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
        ]);

        $cur = self::CURRENCY_PRESETS[$data['currency']];

        $pharmacy = null;
        $user = null;

        DB::transaction(function () use ($data, $cur, &$pharmacy, &$user) {
            $planService = App::make(PharmacyPlanService::class);
            $pharmacyAttrs = [
                'name' => trim($data['pharmacy_name']),
                'free_trial_ends_at' => Carbon::now()->addDays($planService->freeTrialDaysConfig()),
            ];
            if (Schema::hasColumn('pharmacies', 'subscription_plan')) {
                $pharmacyAttrs['subscription_plan'] = 'free';
            }
            if (Schema::hasColumn('pharmacies', 'subscription_status')) {
                $pharmacyAttrs['subscription_status'] = 'active';
            }
            if (Schema::hasColumn('pharmacies', 'currency_code')) {
                $pharmacyAttrs['currency_code'] = $cur['code'];
            }
            if (Schema::hasColumn('pharmacies', 'currency_label')) {
                $pharmacyAttrs['currency_label'] = $cur['label'];
            }

            $pharmacy = Pharmacy::create($pharmacyAttrs);

            $cash = round((float) ($data['initial_cash'] ?? 0), 2);

            $treasuryRow = [
                'pharmacy_id' => $pharmacy->id,
                'balance' => $cash,
                'total_income' => 0,
                'total_expenses' => 0,
            ];
            if (Schema::hasColumn('treasury', 'balance_cash')) {
                $treasuryRow['balance_cash'] = $cash;
            }
            if (Schema::hasColumn('treasury', 'balance_app')) {
                $treasuryRow['balance_app'] = 0;
            }
            foreach (['total_profit', 'total_sales', 'total_sold_items'] as $col) {
                if (Schema::hasColumn('treasury', $col)) {
                    $treasuryRow[$col] = 0;
                }
            }
            Treasury::withoutGlobalScopes()->create($treasuryRow);

            $user = User::withoutGlobalScopes()->create([
                'username' => trim($data['admin_username']),
                'password' => Hash::make($data['admin_password']),
                'role' => 'admin',
                'pharmacy_id' => $pharmacy->id,
                'approval_status' => 'approved',
                'is_active' => true,
                'avatar_url' => null,
            ]);
        });

        $this->logWebActivity(
            (int) $pharmacy->id,
            'tenant_create_web',
            (string) $pharmacy->id,
            'إنشاء صيدلية جديدة وأدمن من لوحة الويب: '.$pharmacy->name.' / @'.$user->username
        );

        AdminWelcomeNotificationService::dispatchForUser($user);

        return redirect()
            ->route('backend.pharmacies.show', $pharmacy->id)
            ->with('ok', 'تم إنشاء الصيدلية «'.$pharmacy->name.'» وحساب الأدمن «'.$user->username.'». البيانات التشغيلية فارغة — جاهزة للاستخدام من التطبيق.');
    }

    private function logWebActivity(int $pharmacyId, string $action, string $entityId, string $description): void
    {
        try {
            if (!Schema::hasTable('staff_activities')) {
                return;
            }
            StaffActivity::withoutGlobalScopes()->create([
                'pharmacy_id' => $pharmacyId,
                'user_id' => null,
                'username' => 'backend_web',
                'role' => 'system',
                'action_type' => $action,
                'entity_type' => 'pharmacy',
                'entity_id' => $entityId,
                'description' => $description,
                'meta' => ['source' => 'backend_web_panel'],
            ]);
        } catch (\Throwable) {
        }
    }
}
