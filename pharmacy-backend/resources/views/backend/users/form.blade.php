@extends('layouts.backend')

@section('title', $mode === 'create' ? 'مستخدم جديد' : 'تعديل مستخدم')

@section('content')
    <div class="vstack">
    <div class="page-head">
        <h1>{{ $mode === 'create' ? 'إضافة مستخدم' : 'تعديل مستخدم #'.$user->id }}</h1>
        @if(!empty($backendScoped))
            <p class="lead">المستخدم يُربط تلقائياً بـ <strong>{{ $backendScopePharmacy->name ?? '' }}</strong> فقط. لا يمكن اختيار صيدلية أخرى أو دور سوبر أدمن.</p>
        @else
            <p class="lead">
                من هنا تُضبط حسابات <strong>الصيدليات</strong> فقط (أدمن / كاشير). حساب <strong>سوبر أدمن المنصة</strong> (المبرمج) لا يُنشأ ولا يُغيّر دوره من هذه الصفحة — يمكنك تعديل اسمه وكلمة مروره فقط عند فتح تعديله من لوحة التحكم.
            </p>
        @endif
    </div>

    <div class="form-card form-card--narrow">
    <form method="post" action="{{ $mode === 'create' ? route('backend.users.store') : route('backend.users.update', $user->id) }}">
        @csrf
        @if($mode === 'edit')
            @method('PUT')
        @endif

        <label for="username">اسم المستخدم</label>
        <input type="text" name="username" id="username" required value="{{ old('username', $user->username) }}">
        @error('username')<div class="errors">{{ $message }}</div>@enderror

        <label for="password">كلمة المرور {{ $mode === 'edit' ? '(اتركها فارغة إن لم تتغير)' : '' }}</label>
        <input type="password" name="password" id="password" {{ $mode === 'create' ? 'required' : '' }} autocomplete="new-password">
        @error('password')<div class="errors">{{ $message }}</div>@enderror

        @if($mode === 'edit' && ($user->role ?? '') === 'super_admin')
            <label>الدور</label>
            <input type="hidden" name="role" id="role" value="super_admin">
            <p class="muted" style="margin:0;padding:0.5rem 0.65rem;background:rgba(45,212,191,0.08);border:1px solid rgba(45,212,191,0.22);border-radius:10px;line-height:1.55">
                <strong>super_admin</strong> — ثابت. يمكنك تغيير اسم الدخول وكلمة المرور فقط؛ لإضافة سوبر أدمن آخر استخدم قاعدة البيانات أو سكربت ترحيل (لا يُعرض هنا).
            </p>
        @else
            @php($roleOptions = $allowedRoles ?? ['admin', 'cashier'])
            <label for="role">الدور</label>
            <select name="role" id="role" required>
                @foreach($roleOptions as $r)
                    <option value="{{ $r }}" @selected(old('role', $user->role) === $r)>{{ $r }}</option>
                @endforeach
            </select>
            @if(count($roleOptions) === 1 && ($roleOptions[0] ?? '') === 'cashier')
                <p class="muted" style="margin:0.4rem 0 0;font-size:0.88rem;line-height:1.5">هذه الصيدلية لديها بالفعل <strong>مدير (أدمن) واحد</strong>. يمكن إضافة <strong>كاشير</strong> فقط.</p>
            @endif
        @endif
        @error('role')<div class="errors">{{ $message }}</div>@enderror

        @php
            $pharmacyDefault = old('pharmacy_id', $user->pharmacy_id ?? request('pharmacy_id') ?? ($backendScopeId ?? null));
        @endphp
        <div id="pharmacy-wrap">
            @if($mode === 'edit' && ($user->role ?? '') === 'super_admin')
                <label>الصيدلية</label>
                <p class="muted" style="margin:0;padding:0.5rem 0">بدون صيدلية — حساب المنصة (يرى كل الصيدليات عبر الـ API).</p>
            @elseif(!empty($backendScoped) && $backendScopePharmacy)
                <label>الصيدلية</label>
                <input type="hidden" name="pharmacy_id" value="{{ $backendScopePharmacy->id }}">
                <p class="muted" style="margin:0;padding:0.5rem 0">{{ $backendScopePharmacy->name }} <span class="muted">(#{{ $backendScopePharmacy->id }})</span></p>
            @else
                <label for="pharmacy_id">الصيدلية</label>
                <select name="pharmacy_id" id="pharmacy_id">
                    <option value="">— اختر —</option>
                    @foreach($pharmacies as $p)
                        <option value="{{ $p->id }}" @selected((string) $pharmacyDefault === (string) $p->id)>{{ $p->name }} (#{{ $p->id }})</option>
                    @endforeach
                </select>
            @endif
        </div>
        @error('pharmacy_id')<div class="errors">{{ $message }}</div>@enderror

        <label for="approval_status">حالة الموافقة</label>
        <select name="approval_status" id="approval_status" required>
            @foreach(['approved','pending'] as $s)
                <option value="{{ $s }}" @selected(old('approval_status', $user->approval_status ?? 'approved') === $s)>{{ $s }}</option>
            @endforeach
        </select>
        @error('approval_status')<div class="errors">{{ $message }}</div>@enderror

        <div class="check">
            <input type="hidden" name="is_active" value="0">
            <input type="checkbox" name="is_active" id="is_active" value="1" @checked(old('is_active', $user->is_active ?? true))>
            <label for="is_active" style="margin:0">حساب نشط</label>
        </div>
        @error('is_active')<div class="errors">{{ $message }}</div>@enderror

        <label for="avatar_url">رابط الصورة (اختياري)</label>
        <textarea name="avatar_url" id="avatar_url" rows="2">{{ old('avatar_url', $user->avatar_url) }}</textarea>
        @error('avatar_url')<div class="errors">{{ $message }}</div>@enderror

        <div class="btn-group" style="margin-top:1.25rem">
            <button type="submit" class="btn btn-primary">{{ $mode === 'create' ? 'إنشاء' : 'حفظ' }}</button>
            <a href="{{ route('backend.users.index') }}" class="btn">رجوع</a>
        </div>
    </form>
    </div>
    </div>

    @push('styles')
    <style>#pharmacy-wrap.disabled { opacity: 0.45; pointer-events: none; }</style>
    @endpush
    @if(empty($backendScoped))
    <script>
        (function () {
            var role = document.getElementById('role');
            var wrap = document.getElementById('pharmacy-wrap');
            if (!role || !wrap) return;
            var sel = document.getElementById('pharmacy_id');
            function sync() {
                var sa = role.value === 'super_admin';
                wrap.classList.toggle('disabled', sa);
                if (sa && sel) sel.value = '';
            }
            role.addEventListener('change', sync);
            sync();
        })();
    </script>
    @endif
@endsection
