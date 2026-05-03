@extends('layouts.backend')

@section('title', 'تعديل '.$planSectionTitle)

@push('styles')
<style>
    .plan-feature-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
        gap: 0.85rem;
        margin-top: 0.5rem;
    }
    .plan-feature-item {
        display: flex;
        gap: 0.65rem;
        align-items: flex-start;
        padding: 0.75rem 0.85rem;
        background: rgba(0, 0, 0, 0.14);
        border: 1px solid var(--border);
        border-radius: 10px;
        margin: 0;
        cursor: pointer;
    }
    .plan-feature-item:hover { border-color: rgba(45, 212, 191, 0.25); }
    .plan-feature-item input { margin-top: 0.2rem; flex-shrink: 0; }
    .plan-feature-item__body { min-width: 0; }
    .plan-feature-item__title {
        display: block;
        font-weight: 700;
        color: var(--text);
        font-size: 0.95rem;
        line-height: 1.35;
    }
    .plan-feature-item__desc {
        display: block;
        margin-top: 0.35rem;
        font-size: 0.82rem;
        color: var(--muted);
        line-height: 1.55;
    }
    .plan-feature-item__key {
        display: block;
        margin-top: 0.4rem;
        font-size: 0.72rem;
        color: var(--muted);
        opacity: 0.9;
    }
    .plan-feature-item__key code { font-size: 0.85em; }
    .plan-currency-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
        gap: 0.85rem;
        margin-top: 0.35rem;
    }
</style>
@endpush

@section('content')
    @php
        $sectionTitles = [
            'free' => 'الباقة المجانية',
            'monthly' => 'الباقة الشهرية',
            'lifetime' => 'باقة الشراء الكامل',
        ];
    @endphp
    <div class="vstack">
        <div class="page-head">
            <h1>تعديل {{ $sectionTitles[$onlyPlan] ?? $onlyPlan }}</h1>
            <p class="lead">ما تُحفظ هنا يخص هذه الباقة فقط. حالة «انتهت التجربة» تبقى من النظام ولا تُعدَّل من هذه الصفحة.</p>
        </div>
        <p class="muted" style="margin:0">
            <a href="{{ route('backend.plans.reference') }}">← الباقات والأسعار</a>
        </p>

        <form method="post" action="{{ route('backend.plans.definitions.update') }}" class="vstack" style="gap:1.5rem">
            @csrf
            @method('PUT')
            <input type="hidden" name="only_plan" value="{{ $onlyPlan }}">

            @if($onlyPlan === 'free')
                <div class="form-card form-card--wide" id="plan-settings-global">
                    <h2 class="page-section-title" style="margin-top:0">إعداد عام</h2>
                    <label for="free_trial_days">أيام التجربة للباقة المجانية (subscription_plan = free)</label>
                    <input type="number" name="free_trial_days" id="free_trial_days" min="1" max="730" required
                           value="{{ old('free_trial_days', $freeTrialDays) }}">
                    @error('free_trial_days')<div class="errors">{{ $message }}</div>@enderror
                    <p class="muted" style="margin:0.5rem 0 0;font-size:0.9rem">يؤثر على الصيدليات الجديدة وحساب انتهاء التجربة عند عدم وجود تاريخ انتهاء مخصص.</p>
                </div>
            @else
                <div class="form-card form-card--wide muted" style="font-size:0.92rem;line-height:1.55">
                    أيام التجربة المجانية تُعدّل من صفحة
                    <a href="{{ route('backend.plans.single.edit', 'free') }}">تعديل الباقة المجانية</a>.
                </div>
            @endif

            @foreach(\App\Services\PharmacyPlanService::PLANS as $loopPk)
                @continue($onlyPlan !== $loopPk)
                @php
                    $d = $plansData[$loopPk] ?? [];
                @endphp
                <div class="form-card form-card--wide" id="plan-{{ $loopPk }}">
                    <h2 class="page-section-title" style="margin-top:0">{{ $sectionTitles[$loopPk] ?? $loopPk }} <span class="badge">{{ $loopPk }}</span></h2>

                    <label for="plans_{{ $loopPk }}_label">الاسم الظاهر</label>
                    <input type="text" name="plans[{{ $loopPk }}][label]" id="plans_{{ $loopPk }}_label" required maxlength="191"
                           value="{{ old("plans.$loopPk.label", $d['label'] ?? '') }}">
                    @error("plans.$loopPk.label")<div class="errors">{{ $message }}</div>@enderror

                    <label for="plans_{{ $loopPk }}_tagline">وصف قصير (سطر تعريفي)</label>
                    <input type="text" name="plans[{{ $loopPk }}][tagline]" id="plans_{{ $loopPk }}_tagline" maxlength="2000"
                           value="{{ old("plans.$loopPk.tagline", $d['tagline'] ?? '') }}">
                    @error("plans.$loopPk.tagline")<div class="errors">{{ $message }}</div>@enderror

                    <label for="plans_{{ $loopPk }}_terms">شروط وأحكام (نص يظهر في صفحة الباقات)</label>
                    <textarea name="plans[{{ $loopPk }}][terms]" id="plans_{{ $loopPk }}_terms" rows="5" placeholder="اختياري — يمكن تركها فارغة">{{ old("plans.$loopPk.terms", $d['terms'] ?? '') }}</textarea>
                    @error("plans.$loopPk.terms")<div class="errors">{{ $message }}</div>@enderror

                    <label for="plans_{{ $loopPk }}_highlights">نقاط بارزة (سطر لكل نقطة)</label>
                    <textarea name="plans[{{ $loopPk }}][highlights]" id="plans_{{ $loopPk }}_highlights" rows="5">{{ old("plans.$loopPk.highlights", isset($d['highlights']) ? implode("\n", $d['highlights']) : '') }}</textarea>
                    @error("plans.$loopPk.highlights")<div class="errors">{{ $message }}</div>@enderror

                    <p class="page-section-title" style="margin-top:1rem;font-size:1rem">حدود التشغيل</p>
                    <p class="muted" style="margin:0 0 0.5rem;font-size:0.88rem">اترك الحقل فارغاً لعدم فرض حد (غير محدود) حيث يسمح النظام بذلك.</p>
                    <div class="toolbar-row" style="align-items:flex-end">
                        <div style="flex:1;min-width:8rem">
                            <label for="plans_{{ $loopPk }}_lp">أقصى أصناف</label>
                            <input type="number" name="plans[{{ $loopPk }}][limits][products]" id="plans_{{ $loopPk }}_lp" min="0"
                                   value="{{ old("plans.$loopPk.limits.products", $d['limits']['products'] ?? '') }}" placeholder="فارغ = لا نهائي">
                            @error("plans.$loopPk.limits.products")<div class="errors">{{ $message }}</div>@enderror
                        </div>
                        <div style="flex:1;min-width:8rem">
                            <label for="plans_{{ $loopPk }}_lc">أقصى كاشير</label>
                            <input type="number" name="plans[{{ $loopPk }}][limits][cashiers]" id="plans_{{ $loopPk }}_lc" min="0"
                                   value="{{ old("plans.$loopPk.limits.cashiers", $d['limits']['cashiers'] ?? '') }}" placeholder="0 يعني بدون كاشير">
                            @error("plans.$loopPk.limits.cashiers")<div class="errors">{{ $message }}</div>@enderror
                        </div>
                    </div>
                    <p class="muted" style="margin:0.75rem 0 0;font-size:0.88rem;line-height:1.6">
                        حساب <strong>المدير (أدمن)</strong> واحد فقط لكل صيدلية (لا يُضبط هنا). <strong>أقصى كاشير:</strong> عدد حسابات الكاشير/سوبر كاشير الإضافية. 0 = لا كاشير منفصل. فارغ = بلا حد.
                    </p>

                    <p class="page-section-title" style="margin-top:1rem;font-size:1rem">مزايا الباقة</p>
                    <p class="muted" style="margin:0 0 0.35rem;font-size:0.88rem;line-height:1.6">
                        كل خيار يحدد ما إذا كانت هذه الميزة <strong>مسموحة لهذه الباقة</strong> عندما يقرأ التطبيق إعدادات الصيدلية.
                        المفتاح الإنجليزي ثابت في البرمجة؛ الوصف العربي للفهم فقط.
                    </p>
                    <div class="plan-feature-grid">
                        @foreach($featureKeys as $fk)
                            @php
                                $fh = config('plans.feature_help_ar.'.$fk, []);
                            @endphp
                            <label class="plan-feature-item check">
                                <input type="checkbox" name="plans[{{ $loopPk }}][features][{{ $fk }}]" value="1"
                                       @checked(old("plans.$loopPk.features.$fk", $d['features'][$fk] ?? false))>
                                <span class="plan-feature-item__body">
                                    <span class="plan-feature-item__title">{{ $fh['label'] ?? $fk }}</span>
                                    @if(!empty($fh['description']))
                                        <span class="plan-feature-item__desc">{{ $fh['description'] }}</span>
                                    @endif
                                    <span class="plan-feature-item__key">المفتاح في النظام: <code>{{ $fk }}</code></span>
                                </span>
                            </label>
                        @endforeach
                    </div>
                    @foreach($featureKeys as $fk)
                        @error("plans.$loopPk.features.$fk")<div class="errors">{{ $message }}</div>@enderror
                    @endforeach

                    @if($loopPk !== 'free')
                        <p class="page-section-title" style="margin-top:1rem;font-size:1rem">السعر الظاهر (فوترة)</p>
                        @if($loopPk === 'monthly')
                            @php
                                $bill = is_array($d['billing'] ?? null) ? $d['billing'] : [];
                                $byRaw = is_array($bill['by_currency'] ?? null) ? $bill['by_currency'] : [];
                                $byStored = [];
                                foreach ($byRaw as $ck => $cv) {
                                    $byStored[strtoupper((string) $ck)] = is_array($cv) ? $cv : [];
                                }
                                $monthlyCurrencyLabels = [
                                    'ILS' => 'شيكل — ILS',
                                    'USD' => 'دولار — USD',
                                    'EGP' => 'جنيه — EGP',
                                    'AED' => 'درهم — AED',
                                ];
                            @endphp
                            <p class="muted" style="margin:0 0 0.65rem;font-size:0.88rem;line-height:1.65">
                                <strong>الباقة الشهرية:</strong> يُعرض للصيدلية السعر حسب <strong>رمز عملتها</strong>. اترك أي حقل فارغاً فيستخدم النظام الإعداد الاحتياطي من ملف الإعدادات أو المبلغ الأساسي أدناه إن وُجد.
                            </p>
                            <p class="muted" style="margin:0 0 0.85rem;font-size:0.85rem;line-height:1.55">
                                لتجاوز السعر لصيدلية واحدة: من «الصيدليات» افتح الصيدلية ثم صفحة الباقة — الحقل «المبلغ الشهري المخصص» يتقدَّم على الأسعار المعروضة هنا.
                            </p>
                            <div style="max-width:14rem;margin-bottom:1rem">
                                <label for="plans_monthly_bamt_legacy">المبلغ الأساسي (احتياطي، بدون ربط عملة)</label>
                                <input type="number" name="plans[monthly][billing][amount]" id="plans_monthly_bamt_legacy" step="0.01" min="0"
                                       value="{{ old('plans.monthly.billing.amount', $bill['amount'] ?? '') }}" placeholder="اختياري">
                                @error('plans.monthly.billing.amount')<div class="errors">{{ $message }}</div>@enderror
                            </div>
                            <p class="muted" style="margin:0 0 0.5rem;font-size:0.88rem;font-weight:700">سعر شهري حسب العملة</p>
                            <div class="plan-currency-grid">
                                @foreach(\App\Services\PharmacyPlanService::monthlyBillingCurrencyCodes() as $curCode)
                                    @php
                                        $curAmt = old(
                                            "plans.monthly.billing.by_currency.$curCode.amount",
                                            $byStored[$curCode]['amount'] ?? ''
                                        );
                                    @endphp
                                    <div>
                                        <label for="plans_monthly_bc_{{ $curCode }}">{{ $monthlyCurrencyLabels[$curCode] ?? $curCode }}</label>
                                        <input type="number" name="plans[monthly][billing][by_currency][{{ $curCode }}][amount]" id="plans_monthly_bc_{{ $curCode }}"
                                               step="0.01" min="0" value="{{ $curAmt !== '' && $curAmt !== null ? $curAmt : '' }}" placeholder="فارغ = احتياطي">
                                        @error("plans.monthly.billing.by_currency.$curCode.amount")<div class="errors">{{ $message }}</div>@enderror
                                    </div>
                                @endforeach
                            </div>
                        @else
                            <p class="muted" style="margin:0 0 0.65rem;font-size:0.88rem;line-height:1.65">
                                <strong>مبلغ الشراء الكامل فقط:</strong> العملة المعروضة تتبع عملة الصيدلية عند العرض في التطبيق.
                            </p>
                            <div style="max-width:14rem">
                                <label for="plans_{{ $loopPk }}_bamt">المبلغ</label>
                                <input type="number" name="plans[{{ $loopPk }}][billing][amount]" id="plans_{{ $loopPk }}_bamt" step="0.01" min="0" required
                                       value="{{ old("plans.$loopPk.billing.amount", $d['billing']['amount'] ?? 0) }}">
                                @error("plans.$loopPk.billing.amount")<div class="errors">{{ $message }}</div>@enderror
                            </div>
                        @endif
                    @endif
                </div>
            @endforeach

            <div class="btn-group">
                <button type="submit" class="btn btn-primary">حفظ {{ $sectionTitles[$onlyPlan] ?? $onlyPlan }}</button>
                <a href="{{ route('backend.plans.reference') }}" class="btn">الباقات والأسعار</a>
            </div>
        </form>
    </div>
@endsection
