<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'دخول لوحة الإدارة') — {{ config('app.name', 'صيدلية') }}</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-deep: #0b1020;
            --surface: #1a2332;
            --border: #2d3a50;
            --accent: #2dd4bf;
            --accent-dim: rgba(45, 212, 191, 0.14);
            --accent-strong: #5eead4;
            --text: #f3f4f6;
            --muted: #9ca3af;
            --danger: #f87171;
            --ok: #34d399;
            --radius: 12px;
            --shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
        }
        * { box-sizing: border-box; }
        html { font-size: 16px; }
        body {
            margin: 0;
            font-family: 'Tajawal', system-ui, sans-serif;
            color: var(--text);
            line-height: 1.65;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
        }
        body.backend-guest {
            background: linear-gradient(165deg, var(--bg-deep) 0%, #0f172a 50%, #111827 100%);
        }
        a { color: var(--accent-strong); text-underline-offset: 3px; }
        .guest-wrap {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
        }
        .auth-card {
            width: 100%;
            max-width: 420px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 1.85rem 1.65rem 2rem;
            box-shadow: var(--shadow);
        }
        .auth-card .brand {
            text-align: center;
            margin-bottom: 1.35rem;
            padding-bottom: 1.15rem;
            border-bottom: 1px solid var(--border);
        }
        .auth-card .brand .logo {
            font-weight: 700;
            font-size: 1.2rem;
            letter-spacing: -0.02em;
            margin: 0;
        }
        .auth-card .brand .sub {
            margin: 0.35rem 0 0;
            font-size: 0.9rem;
            color: var(--muted);
        }
        .page-head h1 {
            margin: 0 0 0.4rem;
            font-size: 1.35rem;
            font-weight: 700;
            text-align: center;
        }
        .page-head .lead {
            margin: 0;
            color: var(--muted);
            font-size: 0.95rem;
            text-align: center;
            line-height: 1.55;
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
        label { display: block; margin: 1rem 0 0.35rem; color: var(--muted); font-size: 0.92rem; font-weight: 500; }
        .auth-card form label:first-of-type { margin-top: 0; }
        input[type=text], input[type=password] {
            width: 100%;
            padding: 0.62rem 0.85rem;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: #0d1321;
            color: var(--text);
            font-family: inherit;
            font-size: 1rem;
        }
        input:focus {
            outline: none;
            border-color: rgba(45, 212, 191, 0.55);
            box-shadow: 0 0 0 3px var(--accent-dim);
        }
        .errors { color: var(--danger); font-size: 0.88rem; margin: 0.35rem 0 0; }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.58rem 1.2rem;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: var(--surface);
            color: var(--text);
            font-family: inherit;
            font-size: 0.98rem;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            margin-top: 1.15rem;
        }
        .btn:hover { filter: brightness(1.08); }
        .btn-primary {
            background: var(--accent-dim);
            border-color: rgba(45, 212, 191, 0.45);
            color: var(--accent-strong);
        }
        .muted { color: var(--muted); font-size: 0.88rem; line-height: 1.55; margin-top: 1.25rem; text-align: center; }
        code { font-size: 0.85em; background: rgba(0,0,0,0.35); padding: 0.12rem 0.35rem; border-radius: 4px; }
    </style>
    @stack('styles')
</head>
<body class="backend-guest">
    <div class="guest-wrap">
        <div class="auth-card">
            <div class="brand">
                <p class="logo">لوحة إدارة النظام</p>
                <p class="sub">دخول محمي — منفصل عن حسابات تطبيق الصيدلية</p>
            </div>
            @if(session('ok'))
                <div class="flash ok">{{ session('ok') }}</div>
            @endif
            @if(session('error'))
                <div class="flash err">{{ session('error') }}</div>
            @endif
            @yield('content')
        </div>
    </div>
</body>
</html>
