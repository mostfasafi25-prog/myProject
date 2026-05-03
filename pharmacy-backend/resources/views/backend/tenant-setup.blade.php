@extends('layouts.backend')

@section('title', 'صيدلية وأدمن جديد')

@section('content')
    <div class="vstack">
        <div class="page-head">
            <h1>صيدلية جديدة + حساب أدمن</h1>
            <p class="lead">
                يُنشأ سجل صيدلية مستقل، خزنة ببيانات فارغة (مع رصيد نقدي اختياري)، وحساب <strong>admin</strong> معتمد وجاهز لتسجيل الدخول من التطبيق.
                لا تُنسخ أصناف أو طلبات من صيدلية أخرى.
            </p>
        </div>

        <div class="form-card form-card--narrow">
            <form method="post" action="{{ route('backend.tenants.store') }}">
                @csrf
                <label for="pharmacy_name">اسم الصيدلية</label>
                <input type="text" name="pharmacy_name" id="pharmacy_name" required value="{{ old('pharmacy_name') }}" placeholder="مثال: صيدلية النور" autocomplete="organization">
                @error('pharmacy_name')<div class="errors">{{ $message }}</div>@enderror

                <label for="currency">عملة الصيدلية المعروضة في النظام</label>
                <select name="currency" id="currency" required>
                    @php $oldCur = old('currency', 'ILS'); @endphp
                    <option value="ILS" @selected($oldCur === 'ILS')>شيكل (ILS)</option>
                    <option value="EGP" @selected($oldCur === 'EGP')>جنيه مصري (EGP)</option>
                    <option value="USD" @selected($oldCur === 'USD')>دولار (USD)</option>
                    <option value="AED" @selected($oldCur === 'AED')>درهم إماراتي (AED)</option>
                </select>
                @error('currency')<div class="errors">{{ $message }}</div>@enderror

                <label for="admin_username">اسم مستخدم الأدمن</label>
                <input type="text" name="admin_username" id="admin_username" required value="{{ old('admin_username') }}" placeholder="فريد على مستوى النظام" autocomplete="username">
                @error('admin_username')<div class="errors">{{ $message }}</div>@enderror

                <label for="admin_password">كلمة مرور الأدمن</label>
                <input type="password" name="admin_password" id="admin_password" required autocomplete="new-password" minlength="6">
                @error('admin_password')<div class="errors">{{ $message }}</div>@enderror

                <label for="initial_cash">رصيد نقدي ابتدائي في الخزنة (اختياري)</label>
                <input type="number" name="initial_cash" id="initial_cash" step="0.01" min="0" value="{{ old('initial_cash', '0') }}" placeholder="0">
                @error('initial_cash')<div class="errors">{{ $message }}</div>@enderror

                <div class="btn-group" style="margin-top:1.35rem">
                    <button type="submit" class="btn btn-primary">إنشاء الصيدلية والأدمن</button>
                    <a href="{{ route('backend.dashboard') }}" class="btn">رجوع للوحة</a>
                </div>
            </form>
        </div>
    </div>
@endsection
