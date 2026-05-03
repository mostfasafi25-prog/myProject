<?php

namespace App\Services;

use App\Models\Pharmacy;
use App\Models\PlanDefinition;
use App\Models\Product;
use App\Models\SystemNotification;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Schema;

class PharmacyPlanService
{
    public const PLANS = ['free', 'monthly', 'lifetime'];

    /** حالة محسوبة فقط — انتهت التجربة المجانية ويلزم الاشتراك */
    public const EFFECTIVE_TRIAL_EXPIRED = 'trial_expired';

    /**
     * عملات يُسمح بضبط سعر الباقة الشهرية لكل منها من لوحة التحكم (بالتوازي مع الإعدادات الاحتياطية في config).
     *
     * @return list<string>
     */
    public static function monthlyBillingCurrencyCodes(): array
    {
        return ['ILS', 'USD', 'EGP', 'AED'];
    }

    public function definition(string $planKey): array
    {
        if ($planKey === self::EFFECTIVE_TRIAL_EXPIRED) {
            return $this->definitionFromConfigOnly($planKey);
        }

        if (in_array($planKey, self::PLANS, true) && Schema::hasTable('plan_definitions')) {
            $row = PlanDefinition::query()->where('plan_key', $planKey)->first();
            if ($row !== null && is_array($row->definition) && $row->definition !== []) {
                return array_replace_recursive($this->definitionFromConfigOnly($planKey), $row->definition);
            }
        }

        return $this->definitionFromConfigOnly($planKey);
    }

    public function definitionFromConfigOnly(string $planKey): array
    {
        $defs = config('plans.definitions', []);

        return $defs[$planKey] ?? $defs['free'];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function referenceDefinitions(): array
    {
        $out = [];
        foreach (array_keys(config('plans.definitions', [])) as $k) {
            $out[$k] = $this->definition((string) $k);
        }

        return $out;
    }

    /**
     * تسمية عرض العملة من بيانات الصيدلية (أو اشتقاق من رمز ISO).
     */
    public function resolveCurrencyLabelForPharmacy(Pharmacy $pharmacy): string
    {
        $label = trim((string) ($pharmacy->currency_label ?? ''));
        if ($label !== '') {
            return $label;
        }
        $code = strtoupper(trim((string) ($pharmacy->currency_code ?? '')));

        return match ($code) {
            'ILS' => 'شيكل',
            'EGP' => 'جنيه',
            'USD' => 'دولار',
            'AED' => 'درهم',
            default => $code !== '' ? $code : 'شيكل',
        };
    }

    /**
     * فوترة الباقة الشهرية للعرض والتطبيق:
     * 1) سعر مخصص للصيدلية (monthly_subscription_amount)
     * 2) تعريف الباقة الشهرية من لوحة الويب / plan_definitions (ما يُعدَّل في «تعديل شروط الباقات»)
     * 3) جدول العملات في config (توافق مع إصدارات سابقة عند غياب فوترة في التعريف)
     *
     * @return array{amount: float, currency: string, currency_label: string, period: string}|null
     */
    public function resolveMonthlyBillingOverrideForPharmacy(?Pharmacy $pharmacy): ?array
    {
        if ($pharmacy === null) {
            return null;
        }

        $codeRaw = strtoupper(trim((string) ($pharmacy->currency_code ?? '')));
        $currencyIso = $codeRaw !== '' ? $codeRaw : 'ILS';
        $label = $this->resolveCurrencyLabelForPharmacy($pharmacy);

        if (Schema::hasColumn('pharmacies', 'monthly_subscription_amount')) {
            $custom = $pharmacy->monthly_subscription_amount;
            if ($custom !== null && (float) $custom > 0) {
                return [
                    'amount' => round((float) $custom, 2),
                    'currency' => $currencyIso,
                    'currency_label' => $label,
                    'period' => 'month',
                ];
            }
        }

        $monthlyDef = $this->definition('monthly');
        $defBilling = is_array($monthlyDef['billing'] ?? null) ? $monthlyDef['billing'] : null;
        $byCurrencyMap = (is_array($defBilling) && is_array($defBilling['by_currency'] ?? null))
            ? $defBilling['by_currency']
            : [];
        foreach ($byCurrencyMap as $storedCode => $spec) {
            if (strtoupper(trim((string) $storedCode)) !== $currencyIso) {
                continue;
            }
            $amt = is_array($spec) ? ($spec['amount'] ?? null) : null;
            if ($amt !== null && (float) $amt > 0) {
                return [
                    'amount' => round((float) $amt, 2),
                    'currency' => $currencyIso,
                    'currency_label' => $label,
                    'period' => 'month',
                ];
            }
        }

        if (is_array($defBilling) && isset($defBilling['amount']) && (float) $defBilling['amount'] > 0) {
            $defCur = trim((string) ($defBilling['currency'] ?? ''));
            $defLab = trim((string) ($defBilling['currency_label'] ?? ''));

            return [
                'amount' => round((float) $defBilling['amount'], 2),
                'currency' => $defCur !== '' ? $defCur : $currencyIso,
                'currency_label' => $defLab !== '' ? $defLab : $label,
                'period' => (string) ($defBilling['period'] ?? 'month'),
            ];
        }

        $byCur = config('plans.monthly_billing_by_pharmacy_currency', []);
        if ($codeRaw !== '' && is_array($byCur[$codeRaw] ?? null)) {
            /** @var array<string, mixed> $spec */
            $spec = $byCur[$codeRaw];
            $amount = (float) ($spec['amount'] ?? 0);
            $currency = (string) ($spec['currency'] ?? $codeRaw);
            $fallbackLabel = (string) ($spec['currency_label_fallback'] ?? $currency);
            $dispLabel = trim((string) ($pharmacy->currency_label ?? ''));
            if ($dispLabel === '') {
                $dispLabel = $fallbackLabel;
            }

            return [
                'amount' => $amount,
                'currency' => $currency,
                'currency_label' => $dispLabel,
                'period' => 'month',
            ];
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $monthlyDefinition
     * @return array<string, mixed>
     */
    public function applyMonthlyDefinitionForPharmacy(array $monthlyDefinition, ?Pharmacy $pharmacy): array
    {
        $billing = $this->resolveMonthlyBillingOverrideForPharmacy($pharmacy);
        if ($billing === null) {
            return $monthlyDefinition;
        }
        $monthlyDefinition['billing'] = $billing;
        $monthlyDefinition['tagline'] = $this->monthlyTaglineFromBilling($billing);

        return $monthlyDefinition;
    }

    private function standardArabicCurrencyLabel(string $code, string $fallback = ''): string
    {
        $c = strtoupper(trim($code));

        return match ($c) {
            'ILS' => 'شيكل',
            'EGP' => 'جنيه',
            'USD' => 'دولار',
            'AED' => 'درهم',
            default => $fallback !== '' ? $fallback : ($c !== '' ? $c : 'شيكل'),
        };
    }

    /**
     * تعديل صف باقة «شهري» في كتالوج الاشتراك حسب عملة الصيدلية (يدمج تعريف الباقة + by_currency من لوحة التحكم).
     *
     * @param  array{key?: string, tagline?: string, billing?: ?array<string, mixed>}  $catalogRow
     * @return array<string, mixed>
     */
    public function applyMonthlyBillingForPharmacyCurrency(array $catalogRow, ?Pharmacy $pharmacy): array
    {
        if (($catalogRow['key'] ?? '') !== 'monthly') {
            return $catalogRow;
        }

        $billing = $this->resolveMonthlyBillingOverrideForPharmacy($pharmacy);
        if ($billing !== null) {
            $catalogRow['billing'] = $billing;
            $catalogRow['tagline'] = $this->monthlyTaglineFromBilling($billing);
        }

        return $catalogRow;
    }

    /**
     * كتالوج الاشتراك: الشهري عبر applyMonthly؛ الشراء الكامل يعرض المبلغ مع عملة الصيدلية.
     *
     * @param  array<string, mixed>  $catalogRow
     * @return array<string, mixed>
     */
    public function applyCatalogRowBillingForPharmacy(array $catalogRow, ?Pharmacy $pharmacy): array
    {
        $row = $this->applyMonthlyBillingForPharmacyCurrency($catalogRow, $pharmacy);
        if ($pharmacy === null || ($row['key'] ?? '') !== 'lifetime') {
            return $row;
        }
        $billing = $row['billing'] ?? null;
        if (!is_array($billing) || !array_key_exists('amount', $billing)) {
            return $row;
        }
        $codeRaw = strtoupper(trim((string) ($pharmacy->currency_code ?? '')));
        $currencyIso = $codeRaw !== '' ? $codeRaw : 'ILS';
        $defCur = trim((string) ($billing['currency'] ?? ''));
        $defLab = trim((string) ($billing['currency_label'] ?? ''));
        $row['billing'] = array_merge($billing, [
            'amount' => round((float) $billing['amount'], 2),
            'currency' => $defCur !== '' ? $defCur : $currencyIso,
            'currency_label' => $defLab !== '' ? $defLab : $this->resolveCurrencyLabelForPharmacy($pharmacy),
            'period' => (string) ($billing['period'] ?? 'once'),
        ]);

        return $row;
    }

    /**
     * @param  array{amount?: float|int, currency_label?: string}  $billing
     */
    private function monthlyTaglineFromBilling(array $billing): string
    {
        $amount = (float) ($billing['amount'] ?? 0);
        $label = (string) ($billing['currency_label'] ?? '');
        $amtDisplay = abs($amount - round($amount)) < 0.000001
            ? (string) (int) round($amount)
            : rtrim(rtrim(number_format($amount, 2, '.', ''), '0'), '.');

        return "{$amtDisplay} {$label} شهرياً — المدير + كاشير واحد، حتى ١٠٠٠ صنف";
    }

    public function freeTrialDaysConfig(): int
    {
        if (!Schema::hasTable('plan_definitions')) {
            return (int) config('plans.free_trial_days', 14);
        }
        $row = PlanDefinition::query()->where('plan_key', PlanDefinition::GLOBAL_KEY)->first();
        if ($row !== null && is_array($row->definition) && isset($row->definition['free_trial_days'])) {
            return max(1, min(730, (int) $row->definition['free_trial_days']));
        }

        return (int) config('plans.free_trial_days', 14);
    }

    public function freeTrialEnd(Pharmacy $pharmacy): ?Carbon
    {
        if (($pharmacy->subscription_plan ?? 'free') !== 'free') {
            return null;
        }
        if ($pharmacy->free_trial_ends_at) {
            return $pharmacy->free_trial_ends_at instanceof Carbon
                ? $pharmacy->free_trial_ends_at
                : Carbon::parse($pharmacy->free_trial_ends_at);
        }
        $created = $pharmacy->created_at;
        if (!$created) {
            return null;
        }

        return $created->copy()->addDays($this->freeTrialDaysConfig());
    }

    public function isStoredFreeTrialExpired(Pharmacy $pharmacy): bool
    {
        if (($pharmacy->subscription_plan ?? 'free') !== 'free') {
            return false;
        }
        $end = $this->freeTrialEnd($pharmacy);
        if ($end === null) {
            return true;
        }

        return $end->isPast();
    }

    public function monthlyGraceDaysAfterDueConfig(): int
    {
        return max(0, min(30, (int) config('plans.monthly_grace_days_after_due', 3)));
    }

    /**
     * تحديث حالة الباقة الشهرية: بعد الاستحقاق → متأخر؛ بعد انتهاء مهلة السماح → ملغى (تقييد كمجاني).
     */
    public function syncMonthlySubscriptionLifecycle(Pharmacy $pharmacy): bool
    {
        if (($pharmacy->subscription_plan ?? '') !== 'monthly') {
            return false;
        }
        $exp = $pharmacy->subscription_expires_at;
        if ($exp === null) {
            return false;
        }
        $tz = (string) config('app.timezone', 'UTC');
        $expC = $exp instanceof Carbon ? $exp->copy()->timezone($tz) : Carbon::parse($exp)->timezone($tz);
        $now = Carbon::now($tz);
        if ($expC->gte($now)) {
            return false;
        }

        $graceDays = $this->monthlyGraceDaysAfterDueConfig();
        $graceEnd = $expC->copy()->addDays($graceDays);
        $st = $pharmacy->subscription_status ?? 'active';

        if ($now->gt($graceEnd)) {
            if ($st !== 'cancelled') {
                $pharmacy->subscription_status = 'cancelled';
                $pharmacy->save();

                return true;
            }

            return false;
        }

        if ($st === 'active') {
            $pharmacy->subscription_status = 'past_due';
            $pharmacy->save();

            return true;
        }

        return false;
    }

    /**
     * بعد تأكيد استلام الدفعة: إضافة دورة فوترة كاملة من نهاية الفترة المحفوظة (حتى قبل الاستحقاق = دفع مبكر)،
     * ثم تكرار الدورات إن بقيت نهاية الفترة في الماضي. لا يُحسب من تاريخ الضغط.
     */
    public function renewMonthlyAfterRecordedPayment(Pharmacy $pharmacy): void
    {
        if (($pharmacy->subscription_plan ?? '') !== 'monthly') {
            throw new \InvalidArgumentException('تأكيد الدفع متاح للباقة الشهرية فقط.');
        }

        $months = max(1, min(12, (int) config('plans.monthly_period_months', 1)));
        $tz = (string) config('app.timezone', 'UTC');
        $now = Carbon::now($tz);

        $anchor = $pharmacy->subscription_expires_at;
        if ($anchor === null) {
            $next = $now->copy()->addMonths($months);
        } else {
            $anchorC = $anchor instanceof Carbon ? $anchor->copy()->timezone($tz) : Carbon::parse($anchor)->timezone($tz);
            $next = $anchorC->copy()->addMonths($months);
            while ($next->lte($now)) {
                $next->addMonths($months);
            }
        }

        $pharmacy->update([
            'subscription_expires_at' => $next,
            'subscription_status' => 'active',
        ]);
    }

    /**
     * الباقة المطبّقة على الحدود.
     * الشهري: خلال مهلة السماح بعد الاستحقاق يبقى كامل المزايا؛ بعدها كمجاني.
     */
    public function effectivePlanKey(Pharmacy $pharmacy): string
    {
        $code = $pharmacy->subscription_plan ?? 'free';
        if (!in_array($code, self::PLANS, true)) {
            $code = 'free';
        }

        if ($code === 'free' && $this->isStoredFreeTrialExpired($pharmacy)) {
            return self::EFFECTIVE_TRIAL_EXPIRED;
        }

        if ($code === 'monthly') {
            $st = $pharmacy->subscription_status ?? 'active';
            if ($st === 'cancelled') {
                return 'free';
            }

            $exp = $pharmacy->subscription_expires_at;
            if ($exp === null) {
                return 'monthly';
            }

            $tz = (string) config('app.timezone', 'UTC');
            $expC = $exp instanceof Carbon ? $exp->copy()->timezone($tz) : Carbon::parse($exp)->timezone($tz);
            $now = Carbon::now($tz);

            if ($expC->gte($now)) {
                return 'monthly';
            }

            $graceEnd = $expC->copy()->addDays($this->monthlyGraceDaysAfterDueConfig());
            if ($now->lte($graceEnd)) {
                return 'monthly';
            }

            return 'free';
        }

        return $code;
    }

    /**
     * باقة «شهرية» في السجل لكن الفعّالة «مجانية» (ملغاة أو انتهت مهلة السماح) — لا يُعامل كاشتراك مدفوع ساري.
     */
    public function monthlyStoredButInactive(Pharmacy $pharmacy): bool
    {
        return ($pharmacy->subscription_plan ?? '') === 'monthly'
            && $this->effectivePlanKey($pharmacy) === 'free';
    }

    /** منع تعديلات API (إضافة/تعديل/حذف) مثل انتهاء التجربة أو توقف الشهري. */
    public function apiTenantWritesBlocked(Pharmacy $pharmacy): bool
    {
        return $this->effectivePlanKey($pharmacy) === self::EFFECTIVE_TRIAL_EXPIRED
            || $this->monthlyStoredButInactive($pharmacy);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function monthlyBillingStateForApi(Pharmacy $pharmacy): ?array
    {
        if (($pharmacy->subscription_plan ?? '') !== 'monthly') {
            return null;
        }

        $graceDays = $this->monthlyGraceDaysAfterDueConfig();
        $exp = $pharmacy->subscription_expires_at;
        if ($exp === null) {
            return [
                'period_ends_at' => null,
                'grace_ends_at' => null,
                'grace_days' => $graceDays,
                'is_overdue' => false,
                'is_within_grace' => false,
                'grace_passed' => false,
                'show_payment_urgent_notice' => false,
            ];
        }

        $tz = (string) config('app.timezone', 'UTC');
        $expC = $exp instanceof Carbon ? $exp->copy()->timezone($tz) : Carbon::parse($exp)->timezone($tz);
        $now = Carbon::now($tz);
        $graceEnd = $expC->copy()->addDays($graceDays);
        $isOverdue = $expC->lt($now);
        $isWithinGrace = $isOverdue && $now->lte($graceEnd);
        $gracePassed = $isOverdue && $now->gt($graceEnd);
        return [
            'period_ends_at' => $expC->toIso8601String(),
            'grace_ends_at' => $graceEnd->toIso8601String(),
            'grace_days' => $graceDays,
            'is_overdue' => $isOverdue,
            'is_within_grace' => $isWithinGrace,
            'grace_passed' => $gracePassed,
            'show_payment_urgent_notice' => $isWithinGrace,
            'show_suspended_notice' => $gracePassed,
        ];
    }

    public function limits(Pharmacy $pharmacy): array
    {
        $key = $this->effectivePlanKey($pharmacy);
        $raw = $this->definition($key)['limits'] ?? [];
        $limits = [
            'products' => $raw['products'] ?? null,
            'cashiers' => $raw['cashiers'] ?? null,
        ];
        if ($pharmacy->max_products_override !== null) {
            $limits['products'] = (int) $pharmacy->max_products_override;
        }

        return $limits;
    }

    public function features(Pharmacy $pharmacy): array
    {
        $key = $this->effectivePlanKey($pharmacy);

        return $this->definition($key)['features'] ?? [];
    }

    /**
     * @return array{months: ?int, purge_orders: bool}
     */
    public function reportsRetentionConfig(Pharmacy $pharmacy): array
    {
        $key = $this->effectivePlanKey($pharmacy);
        $raw = $this->definition($key)['reports_retention'] ?? [];
        $months = $raw['months'] ?? null;
        if ($months !== null) {
            $months = (int) $months;
            if ($months < 1) {
                $months = null;
            } else {
                $months = min(120, $months);
            }
        }

        return [
            'months' => $months,
            'purge_orders' => (bool) ($raw['purge_orders'] ?? false),
        ];
    }

    public function hasFeature(Pharmacy $pharmacy, string $feature): bool
    {
        return (bool) ($this->features($pharmacy)[$feature] ?? false);
    }

    public function canAddProduct(Pharmacy $pharmacy): bool
    {
        $max = $this->limits($pharmacy)['products'];
        if ($max === null) {
            return true;
        }
        $count = Product::withoutGlobalScopes()->where('pharmacy_id', $pharmacy->id)->count();

        return $count < $max;
    }

    public function canAddUser(Pharmacy $pharmacy, string $role): bool
    {
        $limits = $this->limits($pharmacy);
        $maxCashiers = $limits['cashiers'];

        if ($role === 'admin') {
            $admins = User::withoutGlobalScopes()
                ->where('pharmacy_id', $pharmacy->id)
                ->where('role', 'admin')
                ->count();

            return $admins < 1;
        }

        if ($role === 'cashier' && $maxCashiers === 0) {
            return false;
        }

        if ($role === 'cashier' && $maxCashiers !== null && $maxCashiers > 0) {
            $cashiers = User::withoutGlobalScopes()
                ->where('pharmacy_id', $pharmacy->id)
                ->where('role', 'cashier')
                ->count();
            if ($cashiers >= $maxCashiers) {
                return false;
            }
        }

        return true;
    }

    public function denyFreePlanCashierResponse(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'الباقة الحالية لا تسمح بإنشاء حساب كاشير منفصل. استخدم حساب الأدمن لشاشة البيع، أو رقّ الباقة لإضافة كاشيرين بصلاحيات منفصلة.',
            'code' => 'free_plan_no_cashier',
        ], 403);
    }

    public function denyProductLimitResponse(int $limit): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => "وصلت للحد الأقصى لعدد الأصناف في باقتك الحالية ({$limit}). رقّ باقتك من مدير النظام أو عبر الدعم.",
            'code' => 'plan_limit_products',
            'plan_limit' => ['products' => $limit],
        ], 403);
    }

    public function denyUserLimitResponse(string $reason = 'cashiers'): JsonResponse
    {
        $msg = match ($reason) {
            'cashiers' => 'وصلت للحد الأقصى لعدد حسابات الكاشير في باقتك. لزيادة العدد رقّ الباقة.',
            'admin' => 'يوجد بالفعل حساب مدير (أدمن) واحد لهذه الصيدلية. النظام يسمح بمدير واحد فقط؛ يمكنك إضافة كاشيرين حسب الباقة.',
            default => 'لا يمكن إضافة هذا المستخدم ضمن حدود الباقة.',
        };

        $suffix = $reason === 'admin' ? '' : ' رقّ باقتك من مدير النظام.';

        return response()->json([
            'success' => false,
            'message' => $msg.$suffix,
            'code' => 'plan_limit_'.$reason,
        ], 403);
    }

    public function denyFeatureResponse(string $feature): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'هذه الميزة غير متاحة في باقتك الحالية.',
            'code' => 'plan_feature_locked',
            'feature' => $feature,
        ], 403);
    }

    public function usage(Pharmacy $pharmacy): array
    {
        $pid = (int) $pharmacy->id;

        return [
            'products' => Product::withoutGlobalScopes()->where('pharmacy_id', $pid)->count(),
            'users' => User::withoutGlobalScopes()->where('pharmacy_id', $pid)->count(),
            'admins' => User::withoutGlobalScopes()
                ->where('pharmacy_id', $pid)
                ->where('role', 'admin')
                ->count(),
            'cashiers' => User::withoutGlobalScopes()
                ->where('pharmacy_id', $pid)
                ->where('role', 'cashier')
                ->count(),
        ];
    }

    public function toApiArray(Pharmacy $pharmacy): array
    {
        $stored = $pharmacy->subscription_plan ?? 'free';
        $effective = $this->effectivePlanKey($pharmacy);
        $defStored = $this->definition($stored);
        $defEffective = $effective === self::EFFECTIVE_TRIAL_EXPIRED
            ? $this->definition(self::EFFECTIVE_TRIAL_EXPIRED)
            : $this->definition($effective);

        $trialEnd = $stored === 'free' ? $this->freeTrialEnd($pharmacy) : null;

        // subscription_expires_at يخص الباقة الشهرية فقط؛ المجانية تُحدَّد بالتجربة، والشراء الكامل بلا انتهاء
        $expiresForApi = $stored === 'monthly'
            ? $pharmacy->subscription_expires_at?->toIso8601String()
            : null;

        return [
            'plan' => $stored,
            'effective_plan' => $effective,
            'status' => $pharmacy->subscription_status ?? 'active',
            'expires_at' => $expiresForApi,
            'label' => $defStored['label'] ?? $stored,
            'effective_label' => $defEffective['label'] ?? $effective,
            'is_downgraded' => $stored !== $effective,
            'limits' => $this->limits($pharmacy),
            'usage' => $this->usage($pharmacy),
            'features' => $this->features($pharmacy),
            'terms' => $defEffective['terms'] ?? null,
            'trial' => [
                'days' => $this->freeTrialDaysConfig(),
                'ends_at' => $trialEnd?->toIso8601String(),
                'is_expired' => $stored === 'free' && $this->isStoredFreeTrialExpired($pharmacy),
            ],
            'must_subscribe' => $effective === self::EFFECTIVE_TRIAL_EXPIRED,
            'writes_blocked' => $this->apiTenantWritesBlocked($pharmacy),
            'reports_retention' => $this->reportsRetentionConfig($pharmacy),
            'monthly_billing' => $this->monthlyBillingStateForApi($pharmacy),
        ];
    }

    /**
     * بعد تأكيد الدفعة الشهري من لوحة الويب — إشعار لمدير الصيدلية.
     */
    public function notifyAdminsMonthlyRenewed(Pharmacy $pharmacy): void
    {
        $planLabel = $this->definition('monthly')['label'] ?? 'تقسيط شهري';
        $tz = (string) config('app.timezone', 'UTC');
        $exp = $pharmacy->subscription_expires_at;
        $expLine = '';
        if ($exp !== null) {
            $expC = $exp instanceof Carbon ? $exp->copy()->timezone($tz) : Carbon::parse($exp)->timezone($tz);
            $expLine = 'نهاية الفترة بعد التجديد: '.$expC->format('Y-m-d H:i');
        }
        $this->createSubscriptionActivatedNotification(
            $pharmacy,
            'تم تجديد الاشتراك الشهري',
            'تم تأكيد الدفعة وتفعيل/تمديد باقة «'.$planLabel.'» لصيدلية «'.$pharmacy->name.'».',
            'monthly_renewed',
            $expLine !== '' ? $expLine : null,
        );
    }

    /**
     * عند حفظ الباقة من لوحة الويب: إشعار إن وُجد تفعيل فعلي (شراء كامل أو شهري نشط).
     *
     * @param  array{subscription_plan?:string,subscription_status?:string,subscription_expires_at?:mixed}  $before
     */
    public function notifyAdminsPlanUpdatedIfActivated(Pharmacy $pharmacy, array $before): void
    {
        $plan = (string) ($pharmacy->subscription_plan ?? '');
        $st = (string) ($pharmacy->subscription_status ?? 'active');
        $beforePlan = (string) ($before['subscription_plan'] ?? '');
        $beforeSt = (string) ($before['subscription_status'] ?? 'active');

        $tz = (string) config('app.timezone', 'UTC');
        $exp = $pharmacy->subscription_expires_at;
        $expFuture = false;
        $expLabel = '';
        if ($exp !== null) {
            $expC = $exp instanceof Carbon ? $exp->copy()->timezone($tz) : Carbon::parse($exp)->timezone($tz);
            $expFuture = $expC->isFuture();
            $expLabel = $expC->format('Y-m-d H:i');
        }

        $planLabel = match ($plan) {
            'lifetime' => $this->definition('lifetime')['label'] ?? 'شراء كامل',
            'monthly' => $this->definition('monthly')['label'] ?? 'تقسيط شهري',
            'free' => $this->definition('free')['label'] ?? 'مجاني',
            default => $plan,
        };

        if ($plan === 'lifetime' && $beforePlan !== 'lifetime') {
            $this->createSubscriptionActivatedNotification(
                $pharmacy,
                'تم تفعيل باقة الشراء الكامل',
                'تم تفعيل باقة «'.$planLabel.'» لصيدلية «'.$pharmacy->name.'».',
                'lifetime_activated',
                null,
            );

            return;
        }

        if ($plan === 'monthly' && $st === 'active' && $expFuture) {
            $details = 'نهاية الفترة: '.$expLabel;
            if ($beforePlan !== 'monthly') {
                $this->createSubscriptionActivatedNotification(
                    $pharmacy,
                    'تم تفعيل الاشتراك الشهري',
                    'تم تفعيل باقة «'.$planLabel.'» لصيدلية «'.$pharmacy->name.'».',
                    'monthly_activated',
                    $details,
                );

                return;
            }
            if ($beforeSt !== 'active') {
                $this->createSubscriptionActivatedNotification(
                    $pharmacy,
                    'تم تفعيل الاشتراك الشهري',
                    'أصبح اشتراك صيدلية «'.$pharmacy->name.'» نشطاً (باقة شهرية).',
                    'monthly_reactivated',
                    $details,
                );
            }
        }
    }

    private function createSubscriptionActivatedNotification(
        Pharmacy $pharmacy,
        string $title,
        string $message,
        string $metaEvent,
        ?string $details,
    ): void {
        if (! Schema::hasTable('system_notifications')) {
            return;
        }
        try {
            SystemNotification::create([
                'pharmacy_id' => $pharmacy->id,
                'type' => 'subscription_activated',
                'pref_category' => 'subscription',
                'title' => $title,
                'message' => $message,
                'details' => $details,
                'from_management' => true,
                'management_label' => 'لوحة تحكم الباقة',
                'recipients_type' => 'admin_only',
                'read_by' => [],
                'deleted_by' => [],
                'meta' => [
                    'event' => $metaEvent,
                    'pharmacy_id' => $pharmacy->id,
                    'plan' => $pharmacy->subscription_plan,
                ],
            ]);
        } catch (\Throwable) {
        }
    }
}
