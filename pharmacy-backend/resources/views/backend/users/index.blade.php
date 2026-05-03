@extends('layouts.backend')

@section('title', 'المستخدمون')

@section('content')
    <div class="vstack">
        <div class="page-head">
            <h1>المستخدمون</h1>
            @if(!empty($backendScoped))
                <p class="lead">حسابات <strong>{{ $backendScopePharmacy->name ?? '' }}</strong> فقط — لا يظهر أي مستخدم مرتبط بصيدلية أخرى. الحذف هنا يزيل الحساب ويربّط المراجع كما في وضع عرض كل الصيدليات.</p>
            @else
                <p class="lead">إدارة الحسابات في كل الصيدليات. عند الحذف يُزال الحساب مع رموز الدخول (Sanctum) وتُفرَّغ حقول المُنشئ المرتبطة به في الطلبات والمشتريات وحركات الخزنة وسجل المخزون حيث يوجد عمود لذلك.</p>
            @endif
        </div>

        <div class="form-card form-card--wide">
            <form method="get" action="{{ route('backend.users.index') }}" class="toolbar-row">
                <div style="min-width:11rem;flex:1">
                    <label for="search">بحث اسم المستخدم</label>
                    <input type="text" name="search" id="search" value="{{ request('search') }}" placeholder="…">
                </div>
                <div style="min-width:9rem">
                    <label for="role">الدور</label>
                    <select name="role" id="role">
                        <option value="">الكل</option>
                        @foreach((!empty($backendScoped) ? ['admin','cashier'] : ['admin','super_admin','cashier']) as $r)
                            <option value="{{ $r }}" @selected(request('role') === $r)>{{ $r }}</option>
                        @endforeach
                    </select>
                </div>
                @if(empty($backendScoped))
                    <div style="min-width:13rem;flex:1.2">
                        <label for="pharmacy_id">الصيدلية</label>
                        <select name="pharmacy_id" id="pharmacy_id">
                            <option value="">الكل</option>
                            <option value="-1" @selected(request('pharmacy_id') === '-1')>بدون صيدلية (سوبر أدمن)</option>
                            @foreach($pharmacies as $p)
                                <option value="{{ $p->id }}" @selected((string)request('pharmacy_id') === (string)$p->id)>{{ $p->name }} (#{{ $p->id }})</option>
                            @endforeach
                        </select>
                    </div>
                @endif
                <div class="btn-group">
                    <button type="submit" class="btn btn-primary">تصفية</button>
                    <a href="{{ route('backend.users.index') }}" class="btn">مسح</a>
                </div>
            </form>
        </div>

        <div class="toolbar-row">
            @if(empty($backendScoped))
                <a href="{{ route('backend.tenants.create') }}" class="btn btn-primary">صيدلية + أدمن جديد</a>
            @endif
            <a href="{{ route('backend.users.create') }}" class="btn">إضافة مستخدم</a>
        </div>

        <div class="table-wrap">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>اسم المستخدم</th>
                        <th>الدور</th>
                        @if(empty($backendScoped))
                            <th>الصيدلية</th>
                        @endif
                        <th>الموافقة</th>
                        <th>نشط</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($users as $u)
                        <tr>
                            <td class="num">{{ $u->id }}</td>
                            <td><strong>{{ $u->username }}</strong></td>
                            <td>
                                @if($u->role === 'super_admin')
                                    <span class="badge badge-super">{{ $u->role }}</span>
                                @elseif(in_array($u->role, ['admin'], true))
                                    <span class="badge badge-admin">{{ $u->role }}</span>
                                @else
                                    <span class="badge badge-cashier">{{ $u->role }}</span>
                                @endif
                            </td>
                            @if(empty($backendScoped))
                                <td>
                                    @if($u->pharmacy_id)
                                        {{ $u->pharmacy->name ?? ('#'.$u->pharmacy_id) }}
                                    @else
                                        <span class="muted">—</span>
                                    @endif
                                </td>
                            @endif
                            <td>{{ $u->approval_status }}</td>
                            <td>{{ $u->is_active ? 'نعم' : 'لا' }}</td>
                            <td class="link-row">
                                <a href="{{ route('backend.users.edit', $u->id) }}">تعديل</a>
                                @if($u->role !== 'super_admin')
                                    <form action="{{ route('backend.users.destroy', $u->id) }}" method="post" style="display:inline;margin-inline-start:0.5rem" onsubmit="return confirm('حذف المستخدم {{ $u->username }} نهائياً؟\n\nسيتم حذف الحساب وروابط الدخول، وتفريغ حقل المُنشئ في السجلات المرتبطة (دون حذف الفواتير أو المشتريات أنفسها).\n\nإن كان هذا آخر مدير للصيدلية فلن يبقى من يديرها من التطبيق حتى تُنشئ مديراً جديداً.');">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="btn btn-danger btn-sm">حذف</button>
                                    </form>
                                @else
                                    <span class="muted" style="margin-inline-start:0.5rem;font-size:0.85rem">حساب المنصة</span>
                                @endif
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="{{ !empty($backendScoped) ? 6 : 7 }}" class="muted" style="padding:1.25rem">لا مستخدمين مطابقين.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        <div class="pagination">
            {{ $users->links() }}
        </div>
    </div>
@endsection
