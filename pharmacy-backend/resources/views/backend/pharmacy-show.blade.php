@extends('layouts.backend')

@section('title', 'صيدلية: '.$p->name)

@section('content')
    <div class="vstack">
        @if(!empty($backendScoped))
            <div class="toolbar-row">
                <form action="{{ route('backend.scope.clear') }}" method="post" style="margin:0">
                    @csrf
                    <button type="submit" class="btn btn-primary">عرض كل الصيدليات</button>
                </form>
            </div>
        @else
            <p class="muted" style="margin:0"><a href="{{ route('backend.dashboard') }}">← لوحة التحكم</a></p>
        @endif

        <div class="page-head">
            <h1>{{ $p->name }} <span class="muted" style="font-weight:500;font-size:1.05rem">#{{ $p->id }}</span></h1>
            <p class="lead">ملخص تشغيلي: الباقة، الحدود، الفريق، والإحصائيات — <strong>تعديل الاسم المعروض في التطبيق</strong> موجود أسفل الصفحة في قسم اختياري.</p>
            @if(!empty($p->currency_code ?? null) || !empty($p->currency_label ?? null))
                <p class="muted" style="margin:0.35rem 0 0;font-size:0.95rem">
                    العملة في التطبيق: <strong>{{ $p->currency_label ?? '—' }}</strong>
                    @if(!empty($p->currency_code))
                        <span class="muted">({{ $p->currency_code }})</span>
                    @endif
                    — تُضبط عند إنشاء الصيدلية من «صيدلية + أدمن جديد».
                </p>
            @endif
        </div>

        <div class="form-card form-card--wide">
            <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.85rem">
                <div>
                    <strong>الباقة:</strong>
                    <span class="badge {{ ($planSnapshot['plan'] ?? '') === 'lifetime' ? 'badge-super' : (($planSnapshot['plan'] ?? '') === 'monthly' ? 'badge-admin' : '') }}">{{ $planSnapshot['label'] ?? '—' }}</span>
                    @if(!empty($planSnapshot['is_downgraded']))
                        <span class="muted" style="font-size:0.9rem">(تُطبَّق حدود: {{ $planSnapshot['effective_label'] }})</span>
                    @endif
                    @if(!empty($planSnapshot['expires_at']))
                        <div class="muted" style="font-size:0.88rem;margin-top:0.3rem">انتهاء: {{ $planSnapshot['expires_at'] }}</div>
                    @endif
                </div>
                <a href="{{ route('backend.pharmacies.plan.edit', $p) }}" class="btn btn-primary">تعديل الباقة</a>
            </div>
            <p class="muted" style="margin:0.85rem 0 0;font-size:0.92rem">
                أصناف {{ $planSnapshot['usage']['products'] ?? 0 }}
                @if(($planSnapshot['limits']['products'] ?? null) !== null)
                    / {{ $planSnapshot['limits']['products'] }}
                @endif
                · مدير {{ min(1, (int) ($planSnapshot['usage']['admins'] ?? 0)) }}/1
                · كاشير {{ $planSnapshot['usage']['cashiers'] ?? 0 }}
                @if(($planSnapshot['limits']['cashiers'] ?? null) !== null)
                    / {{ $planSnapshot['limits']['cashiers'] }}
                @else
                    / ∞
                @endif
            </p>
        </div>

        <div class="stat-grid">
            <div class="stat-box"><div class="n">{{ $stats['admins_count'] }}</div><div class="l">مدراء</div></div>
            <div class="stat-box"><div class="n">{{ $stats['cashiers_count'] }}</div><div class="l">كاشير</div></div>
            <div class="stat-box"><div class="n">{{ $stats['products_count'] }}</div><div class="l">أصناف</div></div>
            <div class="stat-box"><div class="n">{{ $stats['products_active'] }}</div><div class="l">أصناف نشطة</div></div>
            <div class="stat-box"><div class="n">{{ $stats['categories_count'] }}</div><div class="l">أقسام</div></div>
            <div class="stat-box"><div class="n">{{ $stats['orders_count'] }}</div><div class="l">طلبات</div></div>
            <div class="stat-box"><div class="n">{{ number_format($stats['orders_sales_total'], 2) }}</div><div class="l">إجمالي مبيعات</div></div>
            <div class="stat-box"><div class="n">{{ $stats['customers_count'] }}</div><div class="l">زبائن</div></div>
            <div class="stat-box"><div class="n">{{ $stats['suppliers_count'] }}</div><div class="l">موردين</div></div>
            <div class="stat-box"><div class="n">{{ $stats['purchases_count'] }}</div><div class="l">مشتريات</div></div>
            <div class="stat-box"><div class="n">{{ number_format($stats['treasury_balance'], 2) }}</div><div class="l">رصيد الخزنة</div></div>
        </div>

        @if($treasury)
            <p class="muted" style="font-size:0.9rem;margin:0">كاش: {{ number_format((float)($treasury->balance_cash ?? 0), 2) }} · تطبيق: {{ number_format((float)($treasury->balance_app ?? 0), 2) }}</p>
        @endif

        <div class="toolbar-row">
            <a href="{{ route('backend.users.index', ['pharmacy_id' => $p->id]) }}" class="btn btn-primary">مستخدمو هذه الصيدلية</a>
            <a href="{{ route('backend.users.create', ['pharmacy_id' => $p->id]) }}" class="btn">+ إضافة كاشير</a>
        </div>
        <p class="muted" style="margin:0.35rem 0 0;font-size:0.88rem;max-width:40rem">كل صيدلية لها <strong>مدير (أدمن) واحد</strong> فقط — يُنشأ عادة مع الصيدلية. من هنا يمكنك إضافة <strong>كاشير</strong> فقط حسب حد الباقة.</p>

        <div>
            <h2 class="page-section-title">المدراء</h2>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>اسم المستخدم</th>
                            <th>الدور</th>
                            <th>موافقة</th>
                            <th>نشط</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($admins as $u)
                            <tr>
                                <td>{{ $u->id }}</td>
                                <td>{{ $u->username }}</td>
                                <td><span class="badge badge-admin">{{ $u->role }}</span></td>
                                <td>{{ $u->approval_status }}</td>
                                <td>{{ $u->is_active ? 'نعم' : 'لا' }}</td>
                                <td><a href="{{ route('backend.users.edit', $u->id) }}">تعديل</a></td>
                            </tr>
                        @empty
                            <tr><td colspan="6" class="muted" style="padding:1rem">لا يوجد مدراء مسجّلون.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>

        <div>
            <h2 class="page-section-title">الكاشير</h2>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>اسم المستخدم</th>
                            <th>الدور</th>
                            <th>موافقة</th>
                            <th>نشط</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($cashiers as $u)
                            <tr>
                                <td>{{ $u->id }}</td>
                                <td>{{ $u->username }}</td>
                                <td><span class="badge badge-cashier">{{ $u->role }}</span></td>
                                <td>{{ $u->approval_status }}</td>
                                <td>{{ $u->is_active ? 'نعم' : 'لا' }}</td>
                                <td><a href="{{ route('backend.users.edit', $u->id) }}">تعديل</a></td>
                            </tr>
                        @empty
                            <tr><td colspan="6" class="muted" style="padding:1rem">لا يوجد كاشير لهذه الصيدلية.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>

        <details class="form-card form-card--wide" style="margin-top:var(--card-gap,1.25rem);border-style:dashed">
            <summary class="page-section-title" style="margin:0;cursor:pointer;list-style-position:outside">
                إعدادات العرض: الاسم في التطبيق فقط
            </summary>
            <p class="muted" style="margin:0.75rem 0 0.85rem;font-size:0.92rem;max-width:52rem">
                هذا الحقل يغيّر <strong>الاسم الظاهر للموظفين في الواجهة والطباعة</strong> فقط. لتغيير <strong>الباقة، تاريخ الانتهاء، أو حالة التأخر</strong> استخدم زر «تعديل الباقة» أعلاه — وليس هذا النموذج.
            </p>
            <form method="post" action="{{ route('backend.pharmacies.update', $p) }}" class="toolbar-row" style="align-items:flex-end;margin:0">
                @csrf
                @method('PUT')
                <div style="flex:1;min-width:220px;max-width:480px">
                    <label for="pharmacy_name" style="margin-top:0">الاسم المعروض في التطبيق</label>
                    <input type="text" name="name" id="pharmacy_name" required value="{{ old('name', $p->name) }}" maxlength="255" autocomplete="organization">
                    @error('name')<div class="errors">{{ $message }}</div>@enderror
                </div>
                <button type="submit" class="btn btn-primary">حفظ الاسم</button>
            </form>
        </details>
    </div>
@endsection
