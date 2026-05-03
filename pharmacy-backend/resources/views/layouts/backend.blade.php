<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'لوحة الخلفية') — صيدلية</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-deep: #0b1020;
            --bg: #111827;
            --surface: #1a2332;
            --surface-hover: #222d3f;
            --border: #2d3a50;
            --accent: #2dd4bf;
            --accent-dim: rgba(45, 212, 191, 0.14);
            --accent-strong: #5eead4;
            --text: #f3f4f6;
            --muted: #9ca3af;
            --danger: #f87171;
            --ok: #34d399;
            --sidebar-w: 18rem;
            --radius: 12px;
            --shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
            --space-section: 1.75rem;
            --card-gap: 1.25rem;
        }
        html { font-size: 16px; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: 'Tajawal', system-ui, sans-serif;
            background: var(--bg-deep);
            color: var(--text);
            line-height: 1.65;
            min-height: 100vh;
            font-size: 1rem;
            -webkit-font-smoothing: antialiased;
        }
        body.backend-app {
            background: linear-gradient(165deg, var(--bg-deep) 0%, #0f172a 45%, #111827 100%);
        }
        a { color: var(--accent-strong); text-underline-offset: 3px; }
        .app-shell {
            display: flex;
            align-items: flex-start;
            min-height: 100vh;
        }
        .sidebar {
            width: var(--sidebar-w);
            flex-shrink: 0;
            background: var(--surface);
            border-inline-end: 1px solid var(--border);
            padding: 0;
            display: flex;
            flex-direction: column;
            position: fixed;
            inset-inline-start: 0;
            top: 0;
            bottom: 0;
            max-height: 100vh;
            min-height: 100vh;
            overflow: hidden;
            z-index: 40;
            box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12) inset;
        }
        .sidebar-scroll {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 1.1rem 0 0.5rem;
            min-height: 0;
            scrollbar-width: thin;
            scrollbar-color: var(--border) transparent;
        }
        .sidebar-scroll::-webkit-scrollbar { width: 6px; }
        .sidebar-scroll::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 6px;
        }
        .sidebar-section { margin-top: 0.85rem; }
        .sidebar-section:first-child { margin-top: 0; }
        .sidebar-section-title {
            font-size: 0.68rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            color: var(--muted);
            padding: 0.35rem 1.1rem 0.45rem;
            opacity: 0.9;
        }
        .sidebar-brand {
            padding: 0 1.1rem 1rem;
            border-bottom: 1px solid var(--border);
            margin-bottom: 0.35rem;
        }
        .sidebar-brand .logo {
            font-weight: 700;
            font-size: 1.125rem;
            color: var(--text);
            letter-spacing: -0.02em;
            line-height: 1.35;
        }
        .sidebar-brand .sub {
            font-size: 0.9rem;
            color: var(--muted);
            margin-top: 0.25rem;
            line-height: 1.45;
        }
        .sidebar-nav {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
            padding: 0 0.65rem 0.85rem;
        }
        .sidebar-nav a {
            display: flex;
            align-items: center;
            gap: 0.55rem;
            padding: 0.62rem 0.85rem;
            border-radius: 10px;
            color: var(--muted);
            text-decoration: none;
            font-size: 1rem;
            font-weight: 500;
            line-height: 1.4;
            transition: background 0.15s, color 0.15s;
        }
        .sidebar-nav a:hover {
            background: var(--surface-hover);
            color: var(--text);
        }
        .sidebar-nav a.active {
            background: var(--accent-dim);
            color: var(--accent-strong);
            font-weight: 700;
            border-inline-start: 3px solid var(--accent-strong);
            padding-inline-start: calc(0.85rem - 3px);
        }
        .sidebar-nav a.cta.active {
            border-inline-start-color: var(--accent-strong);
        }
        .sidebar-nav a.cta {
            background: linear-gradient(135deg, rgba(45, 212, 191, 0.22), rgba(45, 212, 191, 0.08));
            color: var(--accent-strong);
            border: 1px solid rgba(45, 212, 191, 0.35);
            margin-top: 0.35rem;
        }
        .sidebar-nav a.cta:hover {
            background: linear-gradient(135deg, rgba(45, 212, 191, 0.3), rgba(45, 212, 191, 0.12));
        }
        .sidebar-group {
            margin-bottom: 0.15rem;
        }
        .sidebar-group summary.sidebar-group-summary {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.55rem 0.75rem;
            margin: 0 0.45rem;
            border-radius: 10px;
            font-size: 0.98rem;
            font-weight: 600;
            color: var(--text);
            list-style: none;
            cursor: pointer;
            user-select: none;
            transition: background 0.15s, color 0.15s;
            line-height: 1.4;
        }
        .sidebar-group summary.sidebar-group-summary::-webkit-details-marker { display: none; }
        .sidebar-group summary.sidebar-group-summary::before {
            content: '';
            display: block;
            width: 0.28rem;
            height: 0.28rem;
            border: solid var(--muted);
            border-width: 0 2px 2px 0;
            transform: rotate(-45deg);
            transition: transform 0.2s ease;
            flex-shrink: 0;
            opacity: 0.85;
        }
        .sidebar-group[open] summary.sidebar-group-summary::before {
            transform: rotate(45deg);
            margin-top: 0.1rem;
        }
        .sidebar-group summary.sidebar-group-summary:hover {
            background: var(--surface-hover);
            color: var(--text);
        }
        .sidebar-group[open] summary.sidebar-group-summary {
            color: var(--text);
        }
        .sidebar-group-body {
            display: flex;
            flex-direction: column;
            gap: 0.2rem;
            padding: 0.35rem 0.5rem 0.65rem 0.6rem;
            margin-top: 0.1rem;
        }
        .sidebar-nav .sidebar-group-body a {
            padding-inline-start: 1.15rem;
            font-size: 0.98rem;
        }
        .sidebar-footer {
            flex-shrink: 0;
            padding: 0.75rem 1rem 1rem;
            margin-top: auto;
            border-top: 1px solid var(--border);
            background: linear-gradient(180deg, transparent, rgba(0,0,0,0.15));
        }
        .app-main {
            flex: 1;
            min-width: 0;
            width: 100%;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            margin-inline-start: var(--sidebar-w);
        }
        .top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 0.85rem 1.5rem;
            background: rgba(17, 24, 39, 0.72);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 30;
        }
        .top-bar .hint {
            font-size: 0.95rem;
            color: var(--muted);
            line-height: 1.5;
        }
        .content-area {
            padding: 1.5rem clamp(1rem, 2.5vw, 2rem) 3rem;
            width: 100%;
            max-width: none;
            margin: 0;
            font-size: 1rem;
            box-sizing: border-box;
        }
        .vstack {
            display: flex;
            flex-direction: column;
            gap: var(--space-section);
            width: 100%;
        }
        .card-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
            gap: var(--card-gap);
            width: 100%;
            align-content: start;
        }
        .card-grid > * {
            min-width: 0;
            width: 100%;
        }
        .tile-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 1.25rem 1.35rem;
            transition: border-color 0.15s, box-shadow 0.15s;
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        .tile-card:hover {
            border-color: rgba(45, 212, 191, 0.28);
            box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
        }
        .tile-card h2 { margin: 0.35rem 0 0; font-size: 1.12rem; font-weight: 700; }
        .tile-card .tagline { margin: 0.4rem 0 0; font-size: 0.92rem; color: var(--muted); line-height: 1.5; }
        .tile-card .tile-foot {
            margin-top: auto;
            padding-top: 0.9rem;
            border-top: 1px solid var(--border);
            font-size: 0.9rem;
            color: var(--muted);
        }
        .page-section-title {
            font-size: 1.15rem;
            font-weight: 700;
            margin: 0 0 0.65rem;
            color: var(--text);
        }
        .page-section-title.spaced { margin-top: 0.25rem; }
        .toolbar-row {
            display: flex;
            flex-wrap: wrap;
            gap: 0.65rem;
            align-items: center;
        }
        form.toolbar-row {
            align-items: flex-end;
            gap: 1rem;
        }
        .content-narrow {
            max-width: 440px;
            margin-inline: auto;
            width: 100%;
        }
        .guest-wrap {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            background: linear-gradient(165deg, var(--bg-deep) 0%, #0f172a 50%, #111827 100%);
        }
        .auth-card {
            width: 100%;
            max-width: 400px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 1.75rem 1.5rem 2rem;
            box-shadow: var(--shadow);
        }
        .page-head {
            margin-bottom: 0.25rem;
        }
        .page-head h1 {
            margin: 0 0 0.45rem;
            font-size: 1.65rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            line-height: 1.3;
        }
        .page-head .lead {
            margin: 0;
            color: var(--muted);
            font-size: 1.02rem;
            max-width: 48rem;
            line-height: 1.65;
        }
        .flash {
            padding: 0.75rem 1rem;
            border-radius: 10px;
            margin-bottom: 1rem;
            font-size: 0.92rem;
            border: 1px solid transparent;
        }
        .flash.ok { background: rgba(52, 211, 153, 0.12); color: #6ee7b7; border-color: rgba(52, 211, 153, 0.25); }
        .flash.err { background: rgba(248, 113, 113, 0.12); color: #fecaca; border-color: rgba(248, 113, 113, 0.25); }
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr));
            gap: var(--card-gap);
            width: 100%;
            align-content: start;
        }
        .stat-grid > * {
            min-width: 0;
            width: 100%;
        }
        .stat-box {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 1.15rem 1.2rem;
            transition: border-color 0.15s, box-shadow 0.15s;
            height: 100%;
            box-sizing: border-box;
        }
        .stat-box:hover { border-color: rgba(45, 212, 191, 0.28); box-shadow: 0 6px 22px rgba(0, 0, 0, 0.14); }
        .stat-box .n { font-size: 1.5rem; font-weight: 700; color: var(--accent-strong); font-variant-numeric: tabular-nums; line-height: 1.2; }
        .stat-box .l { font-size: 0.9rem; color: var(--muted); margin-top: 0.35rem; line-height: 1.4; }
        .num { font-variant-numeric: tabular-nums; }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.35rem;
            padding: 0.52rem 1.05rem;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: var(--surface);
            color: var(--text);
            font-family: inherit;
            font-size: 0.95rem;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            line-height: 1.35;
        }
        .btn:hover { background: var(--surface-hover); }
        .btn-primary {
            background: var(--accent-dim);
            border-color: rgba(45, 212, 191, 0.45);
            color: var(--accent-strong);
        }
        .btn-primary:hover { background: rgba(45, 212, 191, 0.22); }
        .btn-danger { border-color: rgba(248, 113, 113, 0.5); color: var(--danger); background: rgba(248, 113, 113, 0.08); }
        .btn-sm { padding: 0.28rem 0.65rem; font-size: 0.8rem; }
        .btn-group { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
        label { display: block; margin: 0.85rem 0 0.35rem; color: var(--muted); font-size: 0.92rem; font-weight: 500; }
        input[type=text], input[type=password], input[type=number], select, textarea {
            width: 100%;
            max-width: 100%;
            padding: 0.55rem 0.75rem;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: #0d1321;
            color: var(--text);
            font-family: inherit;
            font-size: 0.95rem;
        }
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: rgba(45, 212, 191, 0.55);
            box-shadow: 0 0 0 3px var(--accent-dim);
        }
        .form-card {
            max-width: 520px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 1.35rem 1.4rem 1.5rem;
        }
        .form-card--wide {
            max-width: none;
            width: 100%;
        }
        .form-card--narrow {
            max-width: 640px;
        }
        .alert-card-warn {
            border: 1px solid #c0392b;
            background: rgba(192, 57, 43, 0.08);
            border-radius: var(--radius);
            padding: 1.1rem 1.2rem;
            font-size: 0.95rem;
            line-height: 1.55;
        }
        .check { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.85rem; }
        .check input { width: auto; }
        .errors { color: var(--danger); font-size: 0.88rem; margin: 0.35rem 0 0; }
        .table-wrap {
            overflow-x: auto;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: var(--surface);
        }
        table.data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.92rem;
        }
        .data-table th, .data-table td {
            text-align: right;
            padding: 0.65rem 0.85rem;
            border-bottom: 1px solid var(--border);
        }
        .data-table tbody tr:last-child td { border-bottom: none; }
        .data-table tbody tr:hover td { background: rgba(255,255,255,0.02); }
        .data-table th {
            color: var(--muted);
            font-weight: 600;
            font-size: 0.86rem;
            background: rgba(0,0,0,0.2);
        }
        .muted { color: var(--muted); font-size: 0.92rem; }
        .badge {
            display: inline-block;
            padding: 0.18rem 0.55rem;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
            background: rgba(255,255,255,0.06);
            color: var(--muted);
        }
        .badge-admin { background: rgba(45, 212, 191, 0.15); color: var(--accent-strong); }
        .badge-cashier { background: rgba(96, 165, 250, 0.15); color: #93c5fd; }
        .badge-super { background: rgba(251, 191, 36, 0.15); color: #fcd34d; }
        .pagination { margin-top: 1.1rem; display: flex; gap: 0.45rem; flex-wrap: wrap; list-style: none; padding: 0; }
        .pagination li { display: inline-flex; }
        .pagination a, .pagination span {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.35rem 0.7rem;
            border-radius: 8px;
            border: 1px solid var(--border);
            text-decoration: none;
            color: var(--text);
            background: var(--surface);
            font-size: 0.85rem;
        }
        .pagination li.disabled span {
            opacity: 0.45;
            cursor: not-allowed;
        }
        .pagination li.active span {
            border-color: var(--accent);
            color: var(--accent-strong);
            font-weight: 700;
        }
        .pagination span[aria-current="page"] { border-color: var(--accent); color: var(--accent-strong); }
        .link-row a { text-decoration: none; font-weight: 500; }
        .link-row a:hover { text-decoration: underline; }
        code { font-size: 0.85em; background: rgba(0,0,0,0.35); padding: 0.12rem 0.35rem; border-radius: 4px; }
        @@media (max-width: 860px) {
            .app-shell { flex-direction: column; align-items: stretch; }
            .sidebar {
                width: 100%;
                position: relative;
                inset-inline-start: auto;
                top: auto;
                bottom: auto;
                max-height: none;
                min-height: 0;
                box-shadow: none;
                border-inline-end: none;
                border-bottom: 1px solid var(--border);
            }
            .app-main { margin-inline-start: 0; }
            .sidebar-scroll {
                max-height: min(70vh, 28rem);
                padding-top: 0.75rem;
            }
            .sidebar-nav {
                flex-direction: column;
                flex-wrap: nowrap;
                gap: 0.2rem;
            }
            .sidebar-nav a { justify-content: flex-start; font-size: 0.98rem; }
            .sidebar-group summary.sidebar-group-summary { font-size: 0.95rem; }
            .sidebar-section { width: 100%; margin-top: 0.65rem; }
            .sidebar-section-title { padding-inline: 0.85rem; }
            .sidebar-footer { padding: 0.65rem 1rem; }
        }
    </style>
    @stack('styles')
</head>
<body class="backend-app">
    <div class="app-shell">
        <aside class="sidebar">
            @php
                $navActive = [
                    'dashboard' => request()->routeIs('backend.dashboard'),
                    'pharmacyShow' => request()->routeIs('backend.pharmacies.show'),
                    'pharmacyPlan' => request()->routeIs('backend.pharmacies.plan.*'),
                    'notificationsSend' => request()->routeIs('backend.notifications.send*'),
                    'usersList' => request()->routeIs('backend.users.index', 'backend.users.edit'),
                    'usersCreate' => request()->routeIs('backend.users.create'),
                    'plansRef' => request()->routeIs('backend.plans.reference', 'backend.plans.single.edit'),
                    'tenants' => request()->routeIs('backend.tenants.*'),
                ];
            @endphp
            @if(session('backend_web_ok') && !empty($backendScoped ?? null) && !empty($backendScopePharmacy ?? null))
                    <div class="sidebar-scroll">
                        <div class="sidebar-brand">
                            <div class="logo">صيدلية واحدة</div>
                            <div class="sub"><strong style="color:var(--text)">{{ $backendScopePharmacy->name }}</strong></div>
                        </div>
                        <nav class="sidebar-nav" aria-label="قائمة الصيدلية المعزولة">
                            <details class="sidebar-group" open>
                                <summary class="sidebar-group-summary">الصيدلية</summary>
                                <div class="sidebar-group-body">
                                    <a href="{{ route('backend.pharmacies.show', $backendScopePharmacy) }}" @class(['active' => $navActive['pharmacyShow']]) @if($navActive['pharmacyShow']) aria-current="page" @endif>ملخص الصيدلية</a>
                                    <a href="{{ route('backend.pharmacies.plan.edit', $backendScopePharmacy) }}" @class(['active' => $navActive['pharmacyPlan']]) @if($navActive['pharmacyPlan']) aria-current="page" @endif>باقة الاشتراك</a>
                                    <a href="{{ route('backend.notifications.send') }}" @class(['active' => $navActive['notificationsSend']]) @if($navActive['notificationsSend']) aria-current="page" @endif>إرسال إشعار</a>
                                </div>
                            </details>
                            <details class="sidebar-group" open>
                                <summary class="sidebar-group-summary">المستخدمون</summary>
                                <div class="sidebar-group-body">
                                    <a href="{{ route('backend.users.index') }}" @class(['active' => $navActive['usersList']]) @if($navActive['usersList']) aria-current="page" @endif>قائمة المستخدمين</a>
                                    <a href="{{ route('backend.users.create') }}" @class(['active' => $navActive['usersCreate']]) @if($navActive['usersCreate']) aria-current="page" @endif>إضافة مستخدم</a>
                                </div>
                            </details>
                        </nav>
                    </div>
                    <div class="sidebar-footer">
                        <form action="{{ route('backend.scope.clear') }}" method="post" style="margin:0 0 0.5rem">
                            @csrf
                            <button type="submit" class="btn btn-primary" style="width:100%">عرض كل الصيدليات</button>
                        </form>
                        <form action="{{ route('backend.logout') }}" method="post" style="margin:0">
                            @csrf
                            <button type="submit" class="btn" style="width:100%">تسجيل خروج لوحة الويب</button>
                        </form>
                    </div>
                @else
                    <div class="sidebar-scroll">
                        <div class="sidebar-brand">
                            <div class="logo">لوحة إدارة النظام</div>
                            <div class="sub">صيدليات · مستخدمون · ويب آمن</div>
                        </div>
                        <nav class="sidebar-nav" aria-label="القائمة الرئيسية">
                            <details class="sidebar-group" open>
                                <summary class="sidebar-group-summary">عام</summary>
                                <div class="sidebar-group-body">
                                    <a href="{{ route('backend.dashboard') }}" @class(['active' => $navActive['dashboard']]) @if($navActive['dashboard']) aria-current="page" @endif>لوحة التحكم</a>
                                    <a href="{{ route('backend.notifications.send') }}" @class(['active' => $navActive['notificationsSend']]) @if($navActive['notificationsSend']) aria-current="page" @endif>إرسال إشعار</a>
                                </div>
                            </details>
                            <details class="sidebar-group" open>
                                <summary class="sidebar-group-summary">الباقات والصيدليات</summary>
                                <div class="sidebar-group-body">
                                    <a href="{{ route('backend.plans.reference') }}" @class(['active' => $navActive['plansRef']]) @if($navActive['plansRef']) aria-current="page" @endif>الباقات والأسعار</a>
                                    <a href="{{ route('backend.tenants.create') }}" @class(['cta', 'active' => $navActive['tenants']]) @if($navActive['tenants']) aria-current="page" @endif>صيدلية + أدمن جديد</a>
                                </div>
                            </details>
                            <details class="sidebar-group" open>
                                <summary class="sidebar-group-summary">المستخدمون</summary>
                                <div class="sidebar-group-body">
                                    <a href="{{ route('backend.users.index') }}" @class(['active' => $navActive['usersList']]) @if($navActive['usersList']) aria-current="page" @endif>كل المستخدمين</a>
                                    <a href="{{ route('backend.users.create') }}" @class(['active' => $navActive['usersCreate']]) @if($navActive['usersCreate']) aria-current="page" @endif>إضافة مستخدم</a>
                                </div>
                            </details>
                        </nav>
                    </div>
                    <div class="sidebar-footer">
                        @if(session('backend_web_ok'))
                            <form action="{{ route('backend.logout') }}" method="post" style="margin:0">
                                @csrf
                                <button type="submit" class="btn" style="width:100%">تسجيل خروج لوحة الويب</button>
                            </form>
                        @else
                            <a href="{{ route('backend.login') }}" class="btn btn-primary" style="width:100%;box-sizing:border-box;text-align:center;text-decoration:none">دخول لوحة الويب</a>
                        @endif
                    </div>
                @endif
        </aside>
        <div class="app-main">
            <header class="top-bar">
                @if(session('backend_web_ok'))
                    @if(!empty($backendScoped ?? null) && ($backendScopePharmacy ?? null))
                        <span class="hint"><strong>{{ $backendScopePharmacy->name ?? '' }}</strong></span>
                    @else
                        <span class="hint">مسار محمي بكلمة مرور من <code>.env</code> — منفصل عن حسابات API</span>
                    @endif
                @else
                    <span class="hint">واجهة عامة — استخدم «دخول لوحة الويب» في الشريط الجانبي لإدارة الصيدليات والمستخدمين.</span>
                @endif
            </header>
            <div class="content-area">
                @if(session('ok'))
                    <div class="flash ok">{{ session('ok') }}</div>
                @endif
                @if(session('error'))
                    <div class="flash err">{{ session('error') }}</div>
                @endif
                @yield('content')
            </div>
        </div>
    </div>
</body>
</html>
