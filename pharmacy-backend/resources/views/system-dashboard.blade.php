@extends('layouts.backend')

@section('title', 'لوحة النظام — '.$appName)

@push('styles')
    <style>
        .sys-status {
            display: inline-flex; align-items: center; gap: 0.45rem;
            padding: 0.45rem 0.9rem; border-radius: 10px; font-size: 0.95rem; font-weight: 600;
        }
        .sys-status.ok { background: rgba(52, 211, 153, 0.15); color: var(--ok); }
        .sys-status.bad { background: rgba(248, 113, 113, 0.15); color: var(--danger); }
        .sys-badges { display: flex; flex-wrap: wrap; gap: 0.55rem; margin-top: 1rem; }
        .sys-badges .badge { font-size: 0.88rem; padding: 0.32rem 0.8rem; }
        .sys-badges .badge strong { margin-inline-start: 0.35rem; }
        .sys-metric .label { font-size: 0.92rem; color: var(--muted); margin-bottom: 0.4rem; font-weight: 500; }
        .sys-metric .value { font-size: 1.55rem; font-weight: 700; color: var(--accent-strong); font-variant-numeric: tabular-nums; line-height: 1.2; }
        .sys-metric .sub { font-size: 0.88rem; color: var(--muted); margin-top: 0.35rem; }
        .sys-section { margin-top: 0.25rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
        .sys-section h2 { font-size: 1.12rem; margin: 0 0 0.85rem; font-weight: 700; }
        .sys-links { display: flex; flex-wrap: wrap; gap: 0.6rem; }
        .sys-links a {
            color: var(--accent-strong); text-decoration: none; padding: 0.48rem 1rem;
            background: var(--accent-dim); border: 1px solid rgba(45, 212, 191, 0.35);
            border-radius: 10px; font-size: 0.94rem; font-weight: 600;
        }
        .sys-links a:hover { background: rgba(45, 212, 191, 0.22); }
        .sys-err {
            background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.35);
            color: #fecaca; padding: 1rem 1.15rem; border-radius: var(--radius); margin-top: 0.75rem;
            font-size: 0.94rem; word-break: break-word;
        }
    </style>
@endpush

@section('content')
    <div class="vstack">
        <div class="page-head">
            <h1>لوحة نظام الصيدلية</h1>
            <p class="lead">نظرة على حالة الخادم والبيانات. واجهة الكاشير والأدمن عبر التطبيق (React) وواجهة الـ API.</p>
            <div class="sys-badges">
                <span class="badge">التطبيق<strong>{{ $appName }}</strong></span>
                <span class="badge">البيئة<strong>{{ $appEnv }}</strong></span>
                <span class="badge">المنطقة الزمنية<strong>{{ $timezone }}</strong></span>
                <span class="badge">Laravel<strong>{{ $laravelVersion }}</strong></span>
                <span class="badge">PHP<strong>{{ $phpVersion }}</strong></span>
            </div>
        </div>

        @if ($dbOk)
            <span class="sys-status ok">قاعدة البيانات: متصلة</span>
        @else
            <span class="sys-status bad">قاعدة البيانات: غير متصلة</span>
            @if ($dbError)
                <div class="sys-err">{{ $dbError }}</div>
            @endif
        @endif

        @if ($dbOk && $stats)
            <div class="card-grid">
                <div class="tile-card sys-metric">
                    <div class="label">المنتجات</div>
                    <div class="value">{{ number_format($stats['products']) }}</div>
                    <div class="sub">نشط: {{ number_format($stats['products_active']) }}</div>
                </div>
                <div class="tile-card sys-metric">
                    <div class="label">المستخدمون</div>
                    <div class="value">{{ number_format($stats['users']) }}</div>
                </div>
                <div class="tile-card sys-metric">
                    <div class="label">إجمالي الطلبات</div>
                    <div class="value">{{ number_format($stats['orders_total']) }}</div>
                </div>
                <div class="tile-card sys-metric">
                    <div class="label">طلبات اليوم</div>
                    <div class="value">{{ number_format($stats['orders_today']) }}</div>
                    <div class="sub">مبيعات اليوم: {{ number_format($stats['sales_today'], 2) }}</div>
                </div>
                <div class="tile-card sys-metric">
                    <div class="label">الموردون</div>
                    <div class="value">{{ number_format($stats['suppliers']) }}</div>
                </div>
                <div class="tile-card sys-metric">
                    <div class="label">التصنيفات</div>
                    <div class="value">{{ number_format($stats['categories']) }}</div>
                </div>
                <div class="tile-card sys-metric">
                    <div class="label">وقت الخادم (محلي)</div>
                    <div class="value" style="font-size:1.2rem">{{ $stats['server_time'] }}</div>
                </div>
            </div>
        @endif

        <section class="sys-section">
            <h2>روابط تقنية</h2>
            <div class="sys-links">
                <a href="{{ url('/api/health') }}">فحص الصحة JSON</a>
                <a href="{{ url('/api/login') }}">معلومات POST تسجيل الدخول (API)</a>
            </div>
        </section>

        <p class="muted" style="margin:0;font-size:0.95rem;max-width:52rem;line-height:1.65">
            للتحكم بالصيدليات والمستخدمين والباقات استخدم القائمة الجانبية. التحليلات التفصيلية عبر الـ API بعد المصادقة.
        </p>
    </div>
@endsection
