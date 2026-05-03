<?php

namespace App\Http\Controllers;

use App\Models\PlanDefinition;
use App\Services\PharmacyPlanService;
use App\Support\BackendWebScope;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class BackendPlanDefinitionsController extends Controller
{
    /**
     * مسار قديم /plans/edit — يوجّه إلى بطاقات الباقات (لا قائمة منفصلة).
     */
    public function edit(): RedirectResponse
    {
        if (BackendWebScope::active()) {
            return redirect()
                ->route('backend.pharmacies.plan.edit', BackendWebScope::id())
                ->with('error', 'تعديل شروط الباقات العامة غير متاح أثناء عزل صيدلية واحدة.');
        }

        return redirect()->route('backend.plans.reference');
    }

    public function editSingle(string $plan, PharmacyPlanService $plans)
    {
        if (BackendWebScope::active()) {
            return redirect()
                ->route('backend.pharmacies.plan.edit', BackendWebScope::id())
                ->with('error', 'تعديل شروط الباقات العامة غير متاح أثناء عزل صيدلية واحدة.');
        }

        if (!in_array($plan, PharmacyPlanService::PLANS, true)) {
            abort(404);
        }

        $plansData = [];
        foreach (PharmacyPlanService::PLANS as $pk) {
            $plansData[$pk] = $plans->definition($pk);
        }
        $featureKeys = array_keys(config('plans.definitions.monthly.features', []));
        $freeTrialDays = $plans->freeTrialDaysConfig();
        $onlyPlan = $plan;
        $planSectionTitle = [
            'free' => 'الباقة المجانية',
            'monthly' => 'الباقة الشهرية',
            'lifetime' => 'باقة الشراء الكامل',
        ][$plan] ?? $plan;

        return view('backend.plans-edit', compact('plansData', 'featureKeys', 'freeTrialDays', 'onlyPlan', 'planSectionTitle'));
    }

    public function update(Request $request): RedirectResponse
    {
        if (BackendWebScope::active()) {
            return redirect()
                ->route('backend.pharmacies.plan.edit', BackendWebScope::id())
                ->with('error', 'تعديل شروط الباقات العامة غير متاح أثناء عزل صيدلية واحدة.');
        }

        $featureKeys = array_keys(config('plans.definitions.monthly.features', []));
        $onlyPlan = (string) $request->input('only_plan', '');
        if (! in_array($onlyPlan, PharmacyPlanService::PLANS, true)) {
            return redirect()
                ->route('backend.plans.reference')
                ->with('error', 'باقة غير صالحة — افتح الباقة من البطاقة ثم احفظ.');
        }

        return $this->updateSinglePlan($request, $onlyPlan, $featureKeys);
    }

    /**
     * @param  list<string>  $featureKeys
     */
    private function updateSinglePlan(Request $request, string $pk, array $featureKeys): RedirectResponse
    {
        $rules = [];
        if ($pk === 'free') {
            $rules['free_trial_days'] = ['required', 'integer', 'min:1', 'max:730'];
        }
        $rules["plans.{$pk}.label"] = ['required', 'string', 'max:191'];
        $rules["plans.{$pk}.tagline"] = ['nullable', 'string', 'max:2000'];
        $rules["plans.{$pk}.terms"] = ['nullable', 'string', 'max:50000'];
        $rules["plans.{$pk}.highlights"] = ['nullable', 'string'];
        $rules["plans.{$pk}.limits.products"] = ['nullable', 'integer', 'min:0'];
        $rules["plans.{$pk}.limits.cashiers"] = ['nullable', 'integer', 'min:0'];
        foreach ($featureKeys as $fk) {
            $rules["plans.{$pk}.features.{$fk}"] = ['nullable', 'boolean'];
        }
        if ($pk !== 'free') {
            if ($pk === 'monthly') {
                $rules['plans.monthly.billing.amount'] = ['nullable', 'numeric', 'min:0'];
                foreach (PharmacyPlanService::monthlyBillingCurrencyCodes() as $code) {
                    $rules["plans.monthly.billing.by_currency.$code.amount"] = ['nullable', 'numeric', 'min:0'];
                }
            } else {
                $rules["plans.{$pk}.billing.amount"] = ['required', 'numeric', 'min:0'];
            }
        }

        $request->validate($rules);

        if ($pk === 'free') {
            PlanDefinition::query()->updateOrCreate(
                ['plan_key' => PlanDefinition::GLOBAL_KEY],
                ['definition' => ['free_trial_days' => (int) $request->input('free_trial_days')]]
            );
        }

        $payload = $this->buildPlanPayload($request, $pk, $featureKeys);
        PlanDefinition::query()->updateOrCreate(
            ['plan_key' => $pk],
            ['definition' => $payload]
        );

        $labels = [
            'free' => 'الباقة المجانية',
            'monthly' => 'الباقة الشهرية',
            'lifetime' => 'باقة الشراء الكامل',
        ];

        return redirect()
            ->route('backend.plans.reference')
            ->with('ok', 'تم حفظ «'.($labels[$pk] ?? $pk).'» بنجاح.');
    }

    /**
     * @param  list<string>  $featureKeys
     * @return array<string, mixed>
     */
    private function buildPlanPayload(Request $request, string $pk, array $featureKeys): array
    {
        $highlightsRaw = (string) $request->input("plans.{$pk}.highlights", '');
        $lines = preg_split('/\r\n|\r|\n/', $highlightsRaw);
        $highlights = array_values(array_filter(array_map('trim', $lines), fn ($l) => $l !== ''));

        $features = [];
        foreach ($featureKeys as $fk) {
            $features[$fk] = $request->boolean("plans.{$pk}.features.{$fk}");
        }

        $limits = [
            'products' => $this->nullableInt($request->input("plans.{$pk}.limits.products")),
            'cashiers' => $this->nullableInt($request->input("plans.{$pk}.limits.cashiers")),
        ];

        $terms = $request->input("plans.{$pk}.terms");
        $terms = is_string($terms) && trim($terms) !== '' ? trim($terms) : null;

        $out = [
            'label' => (string) $request->input("plans.{$pk}.label"),
            'tagline' => (string) ($request->input("plans.{$pk}.tagline") ?? ''),
            'terms' => $terms,
            'highlights' => $highlights,
            'limits' => $limits,
            'features' => $features,
        ];

        if ($pk === 'free') {
            $out['billing'] = null;
        } elseif ($pk === 'monthly') {
            $byCurrency = [];
            foreach (PharmacyPlanService::monthlyBillingCurrencyCodes() as $code) {
                $raw = $request->input("plans.monthly.billing.by_currency.$code.amount");
                if ($raw !== null && $raw !== '' && is_numeric($raw) && (float) $raw > 0) {
                    $byCurrency[$code] = ['amount' => round((float) $raw, 2)];
                }
            }
            $legacyRaw = $request->input('plans.monthly.billing.amount');
            $legacyAmt = ($legacyRaw !== null && $legacyRaw !== '' && is_numeric($legacyRaw))
                ? round((float) $legacyRaw, 2)
                : 0.0;
            if ($legacyAmt <= 0 && isset($byCurrency['ILS']['amount'])) {
                $legacyAmt = (float) $byCurrency['ILS']['amount'];
            }

            $out['billing'] = [
                'amount' => $legacyAmt,
                'currency' => '',
                'currency_label' => '',
                'period' => 'month',
                'by_currency' => $byCurrency,
            ];
        } else {
            $out['billing'] = [
                'amount' => (float) $request->input("plans.{$pk}.billing.amount"),
                'currency' => '',
                'currency_label' => '',
                'period' => 'once',
            ];
        }

        $existing = PlanDefinition::query()->where('plan_key', $pk)->value('definition');

        $merged = is_array($existing) && $existing !== []
            ? array_replace_recursive($existing, $out)
            : $out;
        if ($pk === 'monthly' && isset($out['billing']) && is_array($out['billing'])) {
            $merged['billing'] = $out['billing'];
        }
        if (isset($merged['limits']) && is_array($merged['limits'])) {
            unset($merged['limits']['users']);
        }

        return $merged;
    }

    private function nullableInt(mixed $v): ?int
    {
        if ($v === null || $v === '') {
            return null;
        }

        return (int) $v;
    }
}
