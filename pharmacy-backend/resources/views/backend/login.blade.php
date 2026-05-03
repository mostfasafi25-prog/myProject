@extends('layouts.backend-guest')

@section('title', 'دخول لوحة الإدارة')

@section('content')
    <div class="page-head" style="margin-bottom:1.1rem">
        <h1>تسجيل الدخول</h1>
        <p class="lead">أدخل اسم المستخدم وكلمة المرور المعرفين في ملف البيئة للوحة الويب.</p>
    </div>

    @if(!empty($disabled))
        <div class="flash err">{{ $message }}</div>
    @else
        <form method="post" action="{{ route('backend.login') }}" autocomplete="on">
            @csrf
            @error('login')
                <div class="flash err" style="margin-bottom:0.85rem">{{ $message }}</div>
            @enderror
            <label for="username">اسم المستخدم</label>
            <input
                type="text"
                name="username"
                id="username"
                value="{{ old('username', '') }}"
                required
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
            >
            @error('username')
                <div class="errors">{{ $message }}</div>
            @enderror

            <label for="password">كلمة المرور</label>
            <input type="password" name="password" id="password" required autocomplete="current-password">
            @error('password')
                <div class="errors">{{ $message }}</div>
            @enderror

            <button type="submit" class="btn btn-primary">دخول</button>
        </form>
        <p class="muted">
            اضبط <code>BACKEND_WEB_USERNAME</code> و <code>BACKEND_WEB_PASSWORD</code> في <code>.env</code>
            ثم نفّذ <code>php artisan config:clear</code> إن لزم.
        </p>
    @endif
@endsection
