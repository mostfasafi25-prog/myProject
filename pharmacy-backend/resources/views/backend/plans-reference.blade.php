@extends('layouts.backend')

@section('title', 'مرجع الباقات')

@section('content')
    <style>
        .tile-card--link {
            display: flex;
            flex-direction: column;
            text-decoration: none;
            color: inherit;
            cursor: pointer;
            transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
        }
        .tile-card--link:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
        }
        .tile-card--link:focus-visible {
            outline: 2px solid var(--accent-strong, #6ea8fe);
            outline-offset: 2px;
        }
    </style>
    <div class="vstack">
        <div class="page-head">
            <h1>الباقات والأسعار</h1>
            <p class="lead">كل صيدلية لها <strong>مدير (أدمن) واحد فقط</strong> — لا يوجد حدّ اسمه «أقصى مستخدمين». ما يُضبط في الباقة هو <strong>عدد حسابات الكاشير الإضافية</strong> فقط: المجانية 0، الشهرية 1، الشراء الكامل بلا حد.</p>
            <p class="muted" style="margin:0.35rem 0 0;font-size:0.92rem">اضغط على بطاقة لفتح صفحة تعديل هذه الباقة فقط.</p>
        </div>

        <div class="card-grid">
            @foreach($definitions as $key => $def)
                <a href="{{ route('backend.plans.single.edit', $key) }}" class="tile-card tile-card--link">
                    <div style="margin-bottom:0.65rem">
                        <span class="badge {{ $key === 'lifetime' ? 'badge-super' : ($key === 'monthly' ? 'badge-admin' : '') }}">{{ $key }}</span>
                        <h2>{{ $def['label'] ?? $key }}</h2>
                        <p class="tagline">{{ $def['tagline'] ?? '' }}</p>
                    </div>
                    @if(!empty($def['billing']))
                        <p style="margin:0 0 0.75rem;font-weight:600;color:var(--accent-strong);font-size:1rem">
                            {{ number_format((float) ($def['billing']['amount'] ?? 0), 0) }}
                            @if(trim((string) ($def['billing']['currency_label'] ?? '')) !== '')
                                {{ $def['billing']['currency_label'] }}
                            @else
                                <span class="muted" style="font-weight:500">(عملة الصيدلية)</span>
                            @endif
                            @if(($def['billing']['period'] ?? '') === 'month')
                                <span class="muted" style="font-weight:400">/ شهر</span>
                            @elseif(($def['billing']['period'] ?? '') === 'once')
                                <span class="muted" style="font-weight:400">— مرة واحدة</span>
                            @endif
                        </p>
                    @else
                        <p class="muted" style="margin:0 0 0.75rem">بدون رسوم</p>
                    @endif
                    <ul class="muted" style="margin:0;padding:0 1.1rem 0 0;font-size:0.92rem;line-height:1.65;flex:1">
                        @foreach($def['highlights'] ?? [] as $h)
                            <li style="margin-bottom:0.35rem">{{ $h }}</li>
                        @endforeach
                    </ul>
                    @if(!empty($def['terms']))
                        <div class="muted" style="margin-top:0.85rem;padding:0.75rem 0.85rem;background:rgba(0,0,0,0.2);border-radius:10px;font-size:0.9rem;line-height:1.65;white-space:pre-wrap">{{ $def['terms'] }}</div>
                    @endif
                    <div class="tile-foot">
                        <strong style="color:var(--text)">حدود تقريبية:</strong>
                        أصناف
                        @if(($def['limits']['products'] ?? null) === null)
                            ∞
                        @else
                            {{ $def['limits']['products'] }}
                        @endif
                        · فريق العمل:
                        @php
                            $c = $def['limits']['cashiers'] ?? 0;
                        @endphp
                        @if(($def['limits']['cashiers'] ?? null) === null)
                            مدير + كاشير بلا حد
                        @elseif($c === 0)
                            مدير فقط (لا حساب كاشير منفصل)
                        @elseif($c === 1)
                            مدير + كاشير واحد
                        @else
                            مدير + حتى {{ $c }} كاشير
                        @endif
                        <br>
                        <strong style="color:var(--text)">احتفاظ التقارير:</strong>
                        @php
                            $rr = $def['reports_retention'] ?? [];
                        @endphp
                        @if(($rr['months'] ?? null) === null)
                            بلا حذف تلقائي حسب العمر
                        @else
                            آخر {{ $rr['months'] }} شهراً تقريباً
                            @if(!empty($rr['purge_orders']))
                                (يشمل فواتير مدفوعة/ملغاة بلا حركات دين مرتبطة)
                            @endif
                        @endif
                    </div>
                </a>
            @endforeach
        </div>
    </div>
@endsection
