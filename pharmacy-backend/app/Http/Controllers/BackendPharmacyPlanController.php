<?php

namespace App\Http\Controllers;

use App\Models\Pharmacy;
use App\Models\PharmacyMonthlyPaymentLog;
use App\Models\StaffActivity;
use App\Services\PharmacyPlanService;
use App\Support\BackendWebScope;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class BackendPharmacyPlanController extends Controller
{
    public function edit(Pharmacy $pharmacy, PharmacyPlanService $plans)
    {
        BackendWebScope::set((int) $pharmacy->id);
        $plans->syncMonthlySubscriptionLifecycle($pharmacy);
        $pharmacy->refresh();
        $definitions = [];
        foreach (PharmacyPlanService::PLANS as $pk) {
            $definitions[$pk] = $plans->definition($pk);
            if ($pk === 'monthly') {
                $definitions[$pk] = $plans->applyMonthlyDefinitionForPharmacy($definitions[$pk], $pharmacy);
            }
        }
        $snapshot = $plans->toApiArray($pharmacy);

        $paymentLogs = collect();
        if (Schema::hasTable('pharmacy_monthly_payment_logs')) {
            $paymentLogs = $pharmacy->monthlyPaymentLogs()->latest('id')->limit(100)->get();
        }

        return view('backend.pharmacy-plan', [
            'pharmacy' => $pharmacy,
            'definitions' => $definitions,
            'snapshot' => $snapshot,
            'paymentLogs' => $paymentLogs,
        ]);
    }

    public function update(Request $request, Pharmacy $pharmacy, PharmacyPlanService $plans)
    {
        BackendWebScope::set((int) $pharmacy->id);
        $rules = [
            'subscription_plan' => ['required', Rule::in(PharmacyPlanService::PLANS)],
            'subscription_status' => ['required', Rule::in(['active', 'past_due', 'cancelled'])],
            'subscription_notes' => ['nullable', 'string', 'max:5000'],
            'max_products_override' => ['nullable', 'integer', 'min:0', 'max:999999'],
        ];
        if (Schema::hasColumn('pharmacies', 'monthly_subscription_amount')) {
            $rules['monthly_subscription_amount'] = ['nullable', 'numeric', 'min:0', 'max:99999999.99'];
        }
        $data = $request->validate($rules);

        $before = $pharmacy->only([
            'subscription_plan',
            'subscription_status',
            'subscription_expires_at',
        ]);

        $status = (string) $data['subscription_status'];
        $wasMonthly = ($pharmacy->subscription_plan ?? '') === 'monthly';
        $willMonthly = ($data['subscription_plan'] ?? '') === 'monthly';

        if ($willMonthly && ! $wasMonthly && $status !== 'cancelled') {
            $status = 'active';
        }

        $pharmacy->subscription_plan = $data['subscription_plan'];
        $pharmacy->subscription_status = $status;
        $pharmacy->subscription_expires_at = $this->resolveSubscriptionExpiresAt(
            $pharmacy,
            $data['subscription_plan'],
            $status,
        );

        if ($willMonthly && $status !== 'cancelled' && $pharmacy->subscription_expires_at !== null) {
            $tz = (string) config('app.timezone', 'UTC');
            $exp = $pharmacy->subscription_expires_at;
            $expC = $exp instanceof Carbon ? $exp->copy()->timezone($tz) : Carbon::parse($exp)->timezone($tz);
            if ($expC->isFuture()) {
                $pharmacy->subscription_status = 'active';
            }
        }

        $pharmacy->subscription_notes = $data['subscription_notes'] ?? null;
        $pharmacy->max_products_override = $request->filled('max_products_override')
            ? (int) $data['max_products_override'] : null;
        if (Schema::hasColumn('pharmacies', 'monthly_subscription_amount')) {
            $pharmacy->monthly_subscription_amount = $request->filled('monthly_subscription_amount')
                ? round((float) $request->input('monthly_subscription_amount'), 2)
                : null;
        }
        $pharmacy->save();

        $afterSnap = $pharmacy->fresh()->only([
            'subscription_plan',
            'subscription_status',
            'subscription_expires_at',
        ]);
        $this->logActivity($pharmacy->id, $before, $afterSnap);

        $plans->notifyAdminsPlanUpdatedIfActivated($pharmacy->fresh(), $before);

        return redirect()
            ->route('backend.pharmacies.plan.edit', $pharmacy)
            ->with('ok', 'تم حفظ إعدادات الباقة لهذه الصيدلية.');
    }

    public function recordMonthlyPayment(Pharmacy $pharmacy, PharmacyPlanService $plans)
    {
        BackendWebScope::set((int) $pharmacy->id);

        if (($pharmacy->subscription_plan ?? '') !== 'monthly') {
            return redirect()
                ->route('backend.pharmacies.plan.edit', $pharmacy)
                ->with('error', 'تأكيد الدفع متاح عندما تكون الباقة الشهرية مفعّلة.');
        }

        $pharmacy->refresh();

        $before = $pharmacy->only([
            'subscription_plan',
            'subscription_status',
            'subscription_expires_at',
        ]);

        $previousExpiresAt = $pharmacy->subscription_expires_at;
        $previousStatus = $pharmacy->subscription_status;

        try {
            $plans->renewMonthlyAfterRecordedPayment($pharmacy);
        } catch (\InvalidArgumentException $e) {
            return redirect()
                ->route('backend.pharmacies.plan.edit', $pharmacy)
                ->with('error', $e->getMessage());
        }

        $pharmacy->refresh();

        $plans->notifyAdminsMonthlyRenewed($pharmacy);

        if (Schema::hasTable('pharmacy_monthly_payment_logs')) {
            PharmacyMonthlyPaymentLog::create([
                'pharmacy_id' => $pharmacy->id,
                'recorded_at' => Carbon::now(),
                'previous_expires_at' => $previousExpiresAt,
                'previous_status' => $previousStatus,
                'new_expires_at' => $pharmacy->subscription_expires_at,
            ]);
        }

        $this->logActivity($pharmacy->id, $before, $pharmacy->fresh()->only([
            'subscription_plan',
            'subscription_status',
            'subscription_expires_at',
        ]));

        return redirect()
            ->route('backend.pharmacies.plan.edit', $pharmacy)
            ->with(
                'ok',
                'تم تأكيد الدفعة: حالة الاشتراك أصبحت «نشط»، وتُحدَّث نهاية الفترة من دورة الاشتراك السابقة (وليس من تاريخ التأكيد).',
            );
    }

    private function logActivity(int $pharmacyId, array $before, array $after): void
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
                'action_type' => 'subscription_update_web',
                'entity_type' => 'pharmacy',
                'entity_id' => (string) $pharmacyId,
                'description' => 'تحديث باقة الاشتراك من لوحة الويب',
                'meta' => [
                    'source' => 'backend_web_panel',
                    'before' => $before,
                    'after' => $after,
                ],
            ]);
        } catch (\Throwable) {
        }
    }

    private function resolveSubscriptionExpiresAt(Pharmacy $pharmacy, string $newPlan, string $newStatus): ?Carbon
    {
        if ($newPlan !== 'monthly') {
            return null;
        }

        if ($newStatus !== 'active') {
            $keep = $pharmacy->subscription_expires_at;

            return $keep instanceof Carbon ? $keep->copy() : ($keep ? Carbon::parse($keep) : null);
        }

        $months = (int) config('plans.monthly_period_months', 1);
        $months = max(1, min(12, $months));
        $tz = (string) config('app.timezone', 'UTC');
        $now = Carbon::now($tz);

        $wasMonthly = ($pharmacy->subscription_plan ?? '') === 'monthly';
        $existing = $pharmacy->subscription_expires_at;
        if ($existing !== null && !($existing instanceof Carbon)) {
            $existing = Carbon::parse($existing)->timezone($tz);
        } elseif ($existing instanceof Carbon) {
            $existing = $existing->copy()->timezone($tz);
        }

        if (!$wasMonthly) {
            return $now->copy()->addMonths($months);
        }

        if ($existing instanceof Carbon && $existing->isFuture()) {
            return $existing;
        }

        return $now->copy()->addMonths($months);
    }
}
