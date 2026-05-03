@extends('layouts.backend')

@section('title', 'باقة: '.$pharmacy->name)

@push('styles')
<style>
    .vstack.plan-page { --space-section: 1.85rem; }
    .plan-page__usage { margin: 0; width: 100%; }
    .plan-page__usage-title {
        margin: 0 0 0.9rem;
        font-size: 1.08rem;
        font-weight: 700;
        color: var(--text);
        letter-spacing: -0.01em;
    }
    .plan-stat-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.1rem;
        width: 100%;
    }
    @@media (max-width: 768px) {
        .plan-stat-grid { grid-template-columns: 1fr; }
    }
    @@media (min-width: 769px) and (max-width: 1024px) {
        .plan-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .plan-stat-card {
        background: linear-gradient(165deg, rgba(45, 212, 191, 0.09) 0%, var(--surface) 52%);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 1.35rem 1.45rem;
        min-height: 118px;
        box-sizing: border-box;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.14);
        border-top: 3px solid rgba(45, 212, 191, 0.5);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .plan-stat-card:hover {
        border-color: rgba(45, 212, 191, 0.32);
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.18);
    }
    .plan-stat-card .plan-stat-value {
        font-size: 1.68rem;
        font-weight: 800;
        color: var(--accent-strong);
        font-variant-numeric: tabular-nums;
        line-height: 1.15;
        letter-spacing: -0.02em;
    }
    .plan-stat-card .plan-stat-label {
        font-size: 0.93rem;
        color: var(--muted);
        margin-top: 0.5rem;
        line-height: 1.5;
    }
    .plan-page__limits-hint {
        margin: 0.65rem 0 0;
        font-size: 0.88rem;
        line-height: 1.55;
        padding: 0.65rem 0.85rem;
        border-radius: 10px;
        background: rgba(45, 212, 191, 0.06);
        border: 1px solid rgba(45, 212, 191, 0.14);
    }
    .plan-page .form-card {
        border-radius: 14px;
    }
</style>
@endpush

@section('content')
    <div class="vstack plan-page">
      

        <div class="page-head">
            <h1>باقة الاشتراك — {{ $pharmacy->name }}</h1>
            <p class="lead">المخزن: <code>{{ $snapshot['plan'] }}</code>
                @if(!empty($snapshot['is_downgraded']))
                    <span class="badge" style="margin-inline-start:0.35rem">يُطبَّق حالياً كـ {{ $snapshot['effective_label'] }} (انتهاء/إلغاء)</span>
                @endif
            </p>
        </div>

   
        <section class="plan-page__usage" aria-label="حدود الاستخدام">
            <h2 class="plan-page__usage-title">استخدام الحدود الحالية</h2>
            <div class="plan-stat-grid">
                <div class="plan-stat-card">
                    <div class="plan-stat-value num">{{ $snapshot['usage']['products'] ?? 0 }}@if(($snapshot['limits']['products'] ?? null) !== null)<span style="font-weight:700;opacity:0.85;font-size:0.92em"> / {{ $snapshot['limits']['products'] }}</span>@endif</div>
                    <div class="plan-stat-label">أصناف مستخدمة @if(($snapshot['limits']['products'] ?? null) !== null)(الحد الأقصى للباقة الفعلية)@endif</div>
                </div>
                <div class="plan-stat-card">
                    <div class="plan-stat-value num">{{ min(1, (int) ($snapshot['usage']['admins'] ?? 0)) }}<span style="font-weight:700;opacity:0.85;font-size:0.92em"> / 1</span></div>
                    <div class="plan-stat-label">مدير (أدمن)</div>
                </div>
                <div class="plan-stat-card">
                    <div class="plan-stat-value num">{{ $snapshot['usage']['cashiers'] ?? 0 }}@if(($snapshot['limits']['cashiers'] ?? null) !== null)<span style="font-weight:700;opacity:0.85;font-size:0.92em"> / {{ $snapshot['limits']['cashiers'] }}</span>@else<span style="font-weight:700;opacity:0.85;font-size:0.92em"> / ∞</span>@endif</div>
                    <div class="plan-stat-label">حسابات كاشير</div>
                </div>
            </div>
            @if(!empty($snapshot['is_downgraded']))
                <p class="plan-page__limits-hint muted" style="margin-top:0.85rem">
                    الحدود أعلاه تتبع <strong>الباقة الفعلية</strong> ({{ $snapshot['effective_label'] ?? '—' }})، وليس بالضرورة اسم الباقة المخزّن في الحقل أدناه. بعد تصحيح حالة الاشتراك أو الترقية سيُحدَّث العرض تلقائياً.
                </p>
            @endif
            @if(!is_null($pharmacy->max_products_override))
                <p class="plan-page__limits-hint muted" style="margin-top:0.65rem;border-color:rgba(251,191,36,0.25);background:rgba(251,191,36,0.07)">
                    <strong>تجاوز حد الأصناف مفعّل:</strong> {{ (int) $pharmacy->max_products_override }} صنفاً (يُطبَّق بدل حد الباقة الافتراضي). لإلغائه افرغ الحقل في النموذج واحفظ.
                </p>
            @endif
        </section>
        <p class="muted" style="margin:0;font-size:0.88rem;line-height:1.55">مدير واحد ثابت لكل صيدلية؛ حد «الكاشير» يخص الحسابات غير الأدمن.</p>

        @if(!empty($snapshot['must_subscribe']))
            <div class="form-card form-card--wide alert-card-warn">
                <strong>انتهت التجربة المجانية.</strong>
                التطبيق يمنع أي تعديل حتى تُفعَّل باقة مدفوعة — حدّث الباقة من النموذج أدناه ثم احفظ.
            </div>
        @elseif(($snapshot['plan'] ?? '') === 'free' && !empty($snapshot['trial']['ends_at']) && empty($snapshot['trial']['is_expired']))
            <p class="muted" style="margin:0">
                تنتهي التجربة المجانية في
                <strong>{{ \Illuminate\Support\Carbon::parse($snapshot['trial']['ends_at'])->timezone(config('app.timezone'))->format('Y-m-d H:i') }}</strong>.
            </p>
        @endif

        @if(($pharmacy->subscription_plan ?? '') === 'lifetime')
            <div class="form-card form-card--wide" style="padding:0.9rem 1.1rem;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.35);border-radius:12px;margin-bottom:0.5rem">
                <strong>باقة الشراء الكامل (دائمة)</strong>
                <span class="muted" style="display:block;margin-top:0.35rem;font-size:0.92rem;line-height:1.55">من لوحة المنصة يمكنك تغيير الباقة إلى أي خيار أدناه (بما فيها التخفيض إلى شهري أو مجاني) — استخدم ذلك فقط عند الحاجة التشغيلية؛ واجهة صيدلية العميل لا تسمح لهم بإلغاء الدائمة بأنفسهم.</span>
            </div>
        @endif

        <div class="form-card form-card--narrow">
            <form method="post" action="{{ route('backend.pharmacies.plan.update', $pharmacy) }}">
                @csrf
                @method('PUT')

                <label for="subscription_plan">الباقة</label>
                <select name="subscription_plan" id="subscription_plan" required>
                    @foreach(\App\Services\PharmacyPlanService::PLANS as $pk)
                        <option value="{{ $pk }}" @selected(old('subscription_plan', $pharmacy->subscription_plan ?? 'free') === $pk)>
                            {{ ($definitions[$pk]['label'] ?? $pk) }}
                            @if(!empty($definitions[$pk]['billing']))
                                —
                                {{ number_format($definitions[$pk]['billing']['amount'], 0) }}
                                {{ $definitions[$pk]['billing']['currency_label'] ?? '' }}
                            @endif
                        </option>
                    @endforeach
                </select>
                @error('subscription_plan')<div class="errors">{{ $message }}</div>@enderror

                <label for="subscription_status">حالة الاشتراك (للباقة الشهرية)</label>
                <p class="muted" style="margin:0.2rem 0 0.55rem;font-size:0.88rem;line-height:1.5">
                    عند <strong>تأكيد الدفعة</strong> (زر تجديد الشهري) أو عند الحفظ إذا أصبح <strong>تاريخ نهاية الفترة في المستقبل</strong>، تُضبَط الحالة تلقائياً على <strong>نشط</strong> — ما لم تختر صراحةً «ملغى».
                </p>
                <select name="subscription_status" id="subscription_status" required>
                    @foreach(['active' => 'نشط', 'past_due' => 'متأخر', 'cancelled' => 'ملغى'] as $val => $ar)
                        <option value="{{ $val }}" @selected(old('subscription_status', $pharmacy->subscription_status ?? 'active') === $val)>{{ $ar }}</option>
                    @endforeach
                </select>
                @error('subscription_status')<div class="errors">{{ $message }}</div>@enderror

         
           

                <div class="btn-group" style="margin-top:1.25rem">
                    <button type="submit" class="btn btn-primary">حفظ</button>
                    @if(empty($backendScoped))
                        <a href="{{ route('backend.plans.reference') }}" class="btn">مرجع الباقات</a>
                    @endif
                </div>
            </form>
        </div>

        @if(($pharmacy->subscription_plan ?? '') === 'monthly')
            <div class="form-card form-card--wide" style="margin-top:1.25rem;padding:1.15rem 1.25rem;background:rgba(21,101,192,0.07);border:1px solid rgba(21,101,192,0.22);border-radius:10px">
                <strong style="display:block;margin-bottom:0.5rem;font-size:1.05rem">تأكيد استلام الدفعة الشهرية</strong>
                <p class="muted" style="margin:0 0 1rem;font-size:0.92rem;line-height:1.65">
                    يمكنك التأكيد <strong>قبل</strong> موعد الاستحقاق (دفع مبكر): تُضاف دورة كاملة من <strong>نهاية الفترة الحالية</strong>، فيبقى الشهر الحالي <strong>غير متأخر</strong> لأن الفترة تُمدَّد من الدورة وليس من تاريخ الضغط.
                    إن كانت الحالة <strong>متأخرة</strong> أو <strong>ملغاة</strong> تُعاد إلى <strong>نشط</strong> مع التمديد نفسه.
                </p>
                <form method="post" action="{{ route('backend.pharmacies.plan.monthly_payment', $pharmacy) }}" style="margin:0">
                    @csrf
                    <button type="submit" class="btn btn-primary">تم الدفع — تجديد الاشتراك الشهري</button>
                </form>
            </div>
        @endif

        @if(isset($paymentLogs) && $paymentLogs->isNotEmpty())
            @php
                $tz = config('app.timezone');
            @endphp
            <div class="form-card form-card--wide" style="margin-top:1.5rem">
                <h2 class="page-section-title" style="margin-top:0">سجل تأكيدات الدفع الشهري</h2>
                <p class="muted" style="margin:0 0 1rem;font-size:0.9rem">تاريخ ووقت كل ضغطة «تم الدفع»، ونهاية الفترة قبل وبعد التجديد.</p>
                <div style="overflow-x:auto">
                    <table class="data-table" style="width:100%;font-size:0.9rem">
                        <thead>
                            <tr>
                                <th scope="col">#</th>
                                <th scope="col">تاريخ التسجيل</th>
                                <th scope="col">وقت التسجيل</th>
                                <th scope="col">الحالة قبل</th>
                                <th scope="col">نهاية الفترة قبل</th>
                                <th scope="col">نهاية الفترة بعد</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($paymentLogs as $log)
                                @php
                                    $rec = $log->recorded_at?->timezone($tz);
                                @endphp
                                <tr>
                                    <td>{{ $log->id }}</td>
                                    <td>{{ $rec ? $rec->format('Y-m-d') : '—' }}</td>
                                    <td>{{ $rec ? $rec->format('H:i:s') : '—' }}</td>
                                    <td>
                                        @switch($log->previous_status)
                                            @case('active') نشط @break
                                            @case('past_due') متأخر @break
                                            @case('cancelled') ملغى @break
                                            @default {{ $log->previous_status ?? '—' }}
                                        @endswitch
                                    </td>
                                    <td>{{ $log->previous_expires_at ? $log->previous_expires_at->timezone($tz)->format('Y-m-d H:i') : '—' }}</td>
                                    <td><strong>{{ $log->new_expires_at ? $log->new_expires_at->timezone($tz)->format('Y-m-d H:i') : '—' }}</strong></td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </div>
        @elseif(($pharmacy->subscription_plan ?? '') === 'monthly' && \Illuminate\Support\Facades\Schema::hasTable('pharmacy_monthly_payment_logs'))
            <p class="muted" style="margin-top:1.25rem">لا توجد تأكيدات دفع مسجّلة بعد لهذه الصيدلية.</p>
        @endif

    
    </div>
@endsection
