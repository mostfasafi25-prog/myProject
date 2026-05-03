@extends('layouts.backend')

@section('title', 'لوحة التحكم')

@push('styles')
<style>
    .pharmacy-directory {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
        gap: 1.25rem;
        width: 100%;
    }
    .pharmacy-directory__card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 1.2rem 1.35rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .pharmacy-directory__card:hover {
        border-color: rgba(45, 212, 191, 0.28);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.16);
    }
    .pharmacy-directory__head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.75rem;
        padding-bottom: 0.9rem;
        border-bottom: 1px solid var(--border);
    }
    .pharmacy-directory__title {
        margin: 0;
        font-size: 1.12rem;
        font-weight: 800;
        line-height: 1.35;
        letter-spacing: -0.02em;
    }
    .pharmacy-directory__id {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--muted);
        margin-top: 0.25rem;
    }
    .pharmacy-directory__stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.55rem 0.65rem;
    }
    @@media (max-width: 400px) {
        .pharmacy-directory__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .pharmacy-directory__stat {
        text-align: center;
        padding: 0.55rem 0.4rem;
        background: rgba(0, 0, 0, 0.14);
        border-radius: 10px;
        border: 1px solid var(--border);
        min-width: 0;
    }
    .pharmacy-directory__stat .v {
        font-weight: 800;
        font-size: 1.02rem;
        color: var(--accent-strong);
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
    }
    .pharmacy-directory__stat .k {
        font-size: 0.7rem;
        color: var(--muted);
        margin-top: 0.28rem;
        line-height: 1.3;
    }
    .pharmacy-directory__actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.5rem;
        align-items: stretch;
        padding-top: 0.35rem;
        border-top: 1px solid var(--border);
        margin-top: 0.15rem;
    }
    .pharmacy-directory__actions .btn {
        font-size: 0.86rem;
        width: 100%;
        justify-content: center;
        box-sizing: border-box;
        text-align: center;
    }
    .pharmacy-directory__actions--danger {
        grid-column: 1 / -1;
        margin-top: 0.35rem;
        padding-top: 0.65rem;
        border-top: 1px dashed rgba(248, 113, 113, 0.35);
    }
    .pharmacy-directory__actions--danger form { margin: 0; }
    .pharmacy-directory__actions--danger .btn-danger {
        width: 100%;
        font-size: 0.86rem;
    }
    @@media (max-width: 420px) {
        .pharmacy-directory__actions {
            grid-template-columns: 1fr;
        }
    }
    .platform-accounts-wrap { overflow-x: auto; }
    .platform-accounts-table { min-width: 640px; }
    .platform-accounts-table th,
    .platform-accounts-table td { vertical-align: middle; }
    .platform-accounts__user { font-weight: 600; }
    .platform-accounts__actions { white-space: nowrap; }
</style>
@endpush

@section('content')
    <div class="vstack">
        <div class="page-head">
            <h1>لوحة التحكم</h1>
            <p class="lead">ملخص لكل صيدلية: الفريق، المخزون، المبيعات، والخزنة.</p>
        </div>

        <div class="toolbar-row">
            <a href="{{ route('backend.tenants.create') }}" class="btn btn-primary">+ صيدلية وأدمن جديد</a>
            <a href="{{ route('backend.users.index') }}" class="btn">كل المستخدمين</a>
        </div>

        <div class="stat-grid">
            <div class="stat-box">
                <div class="n num">{{ $pharmaciesCount }}</div>
                <div class="l">صيدليات مسجّلة</div>
            </div>
            <div class="stat-box">
                <div class="n num">{{ $tenantUsersCount }}</div>
                <div class="l">مستخدمون مرتبطون بصيدلية</div>
            </div>
        </div>

        <div>
            <h2 class="page-section-title">الصيدليات</h2>
            <p class="muted" style="margin:0 0 1rem;font-size:0.92rem;line-height:1.6">بطاقة لكل صيدلية — الأرقام منظمة في شبكة. لتغيير الاسم افتح التفاصيل ثم «اسم الصيدلية». <strong style="color:var(--danger)">حذف الصيدلية</strong> يزيل كل المستخدمين والبيانات المرتبطة بها نهائياً (لا يمكن التراجع).</p>
            <div class="pharmacy-directory">
            @forelse($rows as $row)
                @php $s = $row['stats']; $ph = $row['pharmacy']; $pl = $row['plan']; @endphp
                <article class="pharmacy-directory__card">
                    <div class="pharmacy-directory__head">
                        <div style="min-width:0">
                            <h3 class="pharmacy-directory__title">{{ $ph->name }}</h3>
                            <div class="pharmacy-directory__id">معرّف #{{ $ph->id }}</div>
                            <div style="margin-top:0.5rem">
                                <span class="badge {{ ($pl['plan'] ?? '') === 'lifetime' ? 'badge-super' : (($pl['plan'] ?? '') === 'monthly' ? 'badge-admin' : '') }}">{{ $pl['label'] ?? '—' }}</span>
                                @if(!empty($pl['is_downgraded']))
                                    <span class="muted" style="font-size:0.82rem;display:block;margin-top:0.35rem">يُطبَّق حالياً: {{ $pl['effective_label'] }}</span>
                                @endif
                            </div>
                        </div>
                    </div>
                    <div class="pharmacy-directory__stats" aria-label="إحصائيات مختصرة">
                        <div class="pharmacy-directory__stat">
                            <div class="v">{{ $s['admins_count'] }}</div>
                            <div class="k">مدراء</div>
                        </div>
                        <div class="pharmacy-directory__stat">
                            <div class="v">{{ $s['cashiers_count'] }}</div>
                            <div class="k">كاشير</div>
                        </div>
                        <div class="pharmacy-directory__stat">
                            <div class="v">{{ $s['products_count'] }}</div>
                            <div class="k">أصناف</div>
                        </div>
                        <div class="pharmacy-directory__stat">
                            <div class="v">{{ $s['products_active'] }}</div>
                            <div class="k">نشطة</div>
                        </div>
                        <div class="pharmacy-directory__stat">
                            <div class="v">{{ $s['categories_count'] }}</div>
                            <div class="k">أقسام</div>
                        </div>
                        <div class="pharmacy-directory__stat">
                            <div class="v">{{ $s['orders_count'] }}</div>
                            <div class="k">طلبات</div>
                        </div>
                        <div class="pharmacy-directory__stat">
                            <div class="v" style="font-size:0.95rem">{{ number_format($s['orders_sales_total'], 0) }}</div>
                            <div class="k">إجمالي مبيعات</div>
                        </div>
                        <div class="pharmacy-directory__stat">
                            <div class="v">{{ $s['customers_count'] }}</div>
                            <div class="k">زبائن</div>
                        </div>
                        <div class="pharmacy-directory__stat">
                            <div class="v">{{ $s['suppliers_count'] }}</div>
                            <div class="k">موردين</div>
                        </div>
                        <div class="pharmacy-directory__stat">
                            <div class="v">{{ $s['purchases_count'] }}</div>
                            <div class="k">مشتريات</div>
                        </div>
                        <div class="pharmacy-directory__stat">
                            <div class="v" style="font-size:0.95rem">{{ number_format($s['treasury_balance'], 2) }}</div>
                            <div class="k">خزنة</div>
                        </div>
                    </div>
                    <div class="pharmacy-directory__actions">
                        <a href="{{ route('backend.pharmacies.show', $ph->id) }}" class="btn btn-primary">تفاصيل الصيدلية</a>
                        <a href="{{ route('backend.pharmacies.plan.edit', $ph) }}" class="btn">الباقة</a>
                        <a href="{{ route('backend.users.index', ['pharmacy_id' => $ph->id]) }}" class="btn">المستخدمون</a>
                        @if($pharmaciesCount > 1)
                            @php
                                $destroyConfirm = 'حذف نهائي: الصيدلية «'.$ph->name.'» وجميع المستخدمين (أدمن وكاشير) والطلبات والمشتريات والأصناف والزبائن والموردين والخزنة والتقارير والإشعارات المرتبطة. لن يُمكن استرجاع البيانات. متابعة؟';
                            @endphp
                            <div class="pharmacy-directory__actions--danger">
                                <form method="post" action="{{ route('backend.pharmacies.destroy', $ph) }}"
                                      onsubmit="return confirm({{ json_encode($destroyConfirm) }});">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="btn btn-danger">حذف الصيدلية بالكامل</button>
                                </form>
                            </div>
                        @endif
                    </div>
                </article>
            @empty
                <p class="muted" style="padding:1.25rem;grid-column:1/-1">لا توجد صيدليات. ابدأ بـ «صيدلية وأدمن جديد».</p>
            @endforelse
            </div>
        </div>

        <div>
            <h2 class="page-section-title spaced">حسابات المنصة (سوبر أدمن)</h2>
            <p class="muted" style="margin:0 0 0.85rem;font-size:0.92rem;line-height:1.6">
                بدون <code>pharmacy_id</code> — يرون كل الصيدليات عبر الـ API. تعديل <strong>اسم الدخول</strong> و<strong>كلمة المرور</strong> من زر التعديل (اترك كلمة المرور فارغة إن لم تتغير).
            </p>
            @if($platformAdmins->isEmpty())
                <p class="muted" style="margin:0;padding:1rem 0">لا يوجد مستخدمون بلا صيدلية. حساب <strong>سوبر أدمن</strong> المنصة يُنشأ يدوياً (ترحيل/قاعدة بيانات) وليس من نموذج إضافة المستخدم هنا.</p>
            @else
                <div class="table-wrap platform-accounts-wrap">
                    <table class="data-table platform-accounts-table">
                        <thead>
                            <tr>
                                <th scope="col">#</th>
                                <th scope="col">اسم الدخول</th>
                                <th scope="col">الدور</th>
                                <th scope="col">الموافقة</th>
                                <th scope="col">نشط</th>
                                <th scope="col" class="platform-accounts__actions">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($platformAdmins as $u)
                                <tr>
                                    <td class="num">{{ $u->id }}</td>
                                    <td class="platform-accounts__user">{{ $u->username }}</td>
                                    <td><span class="badge badge-super">{{ $u->role }}</span></td>
                                    <td>{{ $u->approval_status }}</td>
                                    <td>{{ $u->is_active ? 'نعم' : 'لا' }}</td>
                                    <td class="platform-accounts__actions">
                                        <a href="{{ route('backend.users.edit', $u->id) }}" class="btn btn-primary btn-sm">اسم المستخدم وكلمة المرور</a>
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>
    </div>
@endsection
