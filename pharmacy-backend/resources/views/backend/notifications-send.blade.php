@extends('layouts.backend')

@section('title', 'إرسال إشعار')

@section('content')
    @php
        $pharmacyAllToken = $pharmacyAllToken ?? 'all';
        $isBroadcastAll = !$scoped && $selectedPharmacyKey === $pharmacyAllToken;
    @endphp
    <div class="vstack">
        <div class="page-head">
            <h1>إرسال إشعار للتطبيق</h1>
            <p class="lead">
                يُنشئ إشعاراً في نظام الإشعارات داخل التطبيق. يمكن توجيهه إلى <strong>جميع المدراء فقط</strong>، أو <strong>جميع مستخدمي الصيدلية</strong> (مدراء وكاشير حسب قواعد العرض)، أو <strong>مدير واحد</strong>. من لوحة النظام يمكنك أيضاً الإرسال إلى <strong>كل الصيدليات دفعة واحدة</strong>.
            </p>
            @if(!empty($scoped) && !empty($backendScopePharmacy))
                <p class="muted" style="margin:0">الصيدلية الحالية: <strong>{{ $backendScopePharmacy->name }}</strong></p>
            @endif
        </div>

        <div class="form-card form-card--wide">
            @if($errors->any())
                <div class="flash err" style="margin-bottom:1rem">
                    <ul style="margin:0;padding-inline-start:1.2rem">
                        @foreach($errors->all() as $err)
                            <li>{{ $err }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif
            @if(empty($scoped))
                <form method="get" action="{{ route('backend.notifications.send') }}" class="toolbar-row" style="margin-bottom:1.25rem;padding-bottom:1.25rem;border-bottom:1px solid var(--border)">
                    <div style="min-width:14rem;flex:1.2">
                        <label for="prefetch_pharmacy">اختر الصيدلية أو «الكل»</label>
                        <select name="pharmacy_id" id="prefetch_pharmacy" onchange="this.form.submit()">
                            <option value="">— اختر —</option>
                            <option value="{{ $pharmacyAllToken }}" @selected($selectedPharmacyKey === $pharmacyAllToken)>جميع الصيدليات (مرة واحدة لكل صيدلية)</option>
                            @foreach($pharmacies as $p)
                                <option value="{{ $p->id }}" @selected((string)$selectedPharmacyKey === (string)$p->id)>{{ $p->name }} (#{{ $p->id }})</option>
                            @endforeach
                        </select>
                    </div>
                    <div style="align-self:flex-end">
                        <span class="muted" style="font-size:0.88rem">يُحدَّث النموذج تلقائياً عند الاختيار</span>
                    </div>
                </form>
            @endif

            @if($selectedPharmacyKey === null || ($selectedPharmacyKey !== $pharmacyAllToken && (int)$selectedPharmacyKey < 1))
                <p class="muted" style="margin:0">@if(!empty($scoped))تعذر تحديد الصيدلية. ارجع إلى لوحة التحكم.@else اختر صيدلية أو «جميع الصيدليات» أعلاه ليصبح النموذج متاحاً.@endif</p>
            @else
                @if($isBroadcastAll && !empty($broadcastStats))
                    <div class="muted" style="margin:0 0 1rem;padding:0.85rem 1rem;background:rgba(45,212,191,0.08);border:1px solid rgba(45,212,191,0.22);border-radius:10px;font-size:0.92rem;line-height:1.65">
                        <strong>معاينة الإرسال الشامل:</strong>
                        {{ $broadcastStats['pharmacies'] }} صيدلية —
                        {{ $broadcastStats['admins'] }} حساب مدير (أدمن / سوبر أدمن) عبر كل الصيدليات.
                        يُنشأ <strong>إشعار منفصل لكل صيدلية</strong> بنفس النص (يتماشى مع قاعدة البيانات).
                    </div>
                    @if($broadcastPreviewAdmins->isNotEmpty())
                        <details style="margin:0 0 1.25rem" class="muted">
                            <summary style="cursor:pointer;font-weight:600">عرض أول {{ $broadcastPreviewAdmins->count() }} مديراً (مرتبين حسب الصيدلية)</summary>
                            <div style="overflow-x:auto;margin-top:0.65rem">
                                <table class="data-table" style="width:100%;font-size:0.88rem">
                                    <thead>
                                        <tr>
                                            <th scope="col">صيدلية</th>
                                            <th scope="col">المستخدم</th>
                                            <th scope="col">الدور</th>
                                            <th scope="col">نشط</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @foreach($broadcastPreviewAdmins as $u)
                                            <tr>
                                                <td>{{ $u->pharmacy->name ?? ('#'.$u->pharmacy_id) }}</td>
                                                <td>{{ $u->username }}</td>
                                                <td>{{ $u->role }}</td>
                                                <td>{{ $u->is_active ? 'نعم' : 'لا' }}</td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    @endif
                @endif

                <form method="post" action="{{ route('backend.notifications.send.store') }}" class="vstack" style="gap:1rem">
                    @csrf
                    @if(empty($scoped))
                        <input type="hidden" name="pharmacy_id" value="{{ $selectedPharmacyKey }}">
                    @endif

                    <div>
                        <label for="title">عنوان الإشعار <span style="color:var(--danger)">*</span></label>
                        <input type="text" name="title" id="title" value="{{ old('title') }}" required maxlength="255" placeholder="مثال: تنبيه مهم">
                    </div>

                    <div>
                        <label for="message">نص الرسالة <span style="color:var(--danger)">*</span></label>
                        <textarea name="message" id="message" rows="5" required placeholder="النص الذي يظهر للمستخدمين">{{ old('message') }}</textarea>
                    </div>

                    <div>
                        <label for="details">تفاصيل إضافية (اختياري)</label>
                        <textarea name="details" id="details" rows="3" placeholder="يُعرض كتفاصيل إن وُجدت في الواجهة">{{ old('details') }}</textarea>
                    </div>

                    <div>
                        <label for="management_label">تسمية المرسل (اختياري)</label>
                        <input type="text" name="management_label" id="management_label" value="{{ old('management_label', 'لوحة إدارة النظام (ويب)') }}" maxlength="120">
                    </div>

                    <fieldset style="border:1px solid var(--border);border-radius:var(--radius);padding:1rem;margin:0">
                        <legend style="padding:0 0.5rem;font-weight:600;font-size:0.95rem">المستلمون</legend>
                        <div class="vstack" style="gap:0.65rem">
                            <label style="display:flex;align-items:flex-start;gap:0.5rem;cursor:pointer;font-weight:500">
                                <input type="radio" name="recipients_mode" value="all_admins" @checked(old('recipients_mode', 'all_admins') === 'all_admins') style="margin-top:0.35rem">
                                <span>
                                    <strong>جميع المدراء فقط</strong> (أدمن وسوبر أدمن {{ $isBroadcastAll ? 'في كل صيدلية على حدة' : 'لهذه الصيدلية' }} — لا يصل الكاشير)
                                </span>
                            </label>
                            <label style="display:flex;align-items:flex-start;gap:0.5rem;cursor:pointer;font-weight:500">
                                <input type="radio" name="recipients_mode" value="all_staff" @checked(old('recipients_mode') === 'all_staff') style="margin-top:0.35rem">
                                <span>
                                    <strong>جميع مستخدمي الصيدلية</strong> (حسب قواعد العرض في التطبيق: يشمل الكاشير للرسائل من الإدارة)
                                </span>
                            </label>
                            @if(!$isBroadcastAll)
                                <label style="display:flex;align-items:flex-start;gap:0.5rem;cursor:pointer;font-weight:500">
                                    <input type="radio" name="recipients_mode" value="one_admin" @checked(old('recipients_mode') === 'one_admin') style="margin-top:0.35rem">
                                    <span style="flex:1">
                                        مدير محدد (أدمن / سوبر أدمن لهذه الصيدلية فقط)
                                        <select name="target_user_id" id="target_user_id" style="margin-top:0.45rem;width:100%;max-width:22rem;display:block">
                                            <option value="">— اختر المستخدم —</option>
                                            @foreach($admins as $u)
                                                <option value="{{ $u->id }}" @selected((string)old('target_user_id') === (string)$u->id)>
                                                    {{ $u->username }}
                                                    <span class="muted">({{ $u->role }}{{ $u->is_active ? '' : ' · غير نشط' }})</span>
                                                </option>
                                            @endforeach
                                        </select>
                                        @if($admins->isEmpty())
                                            <span class="muted" style="font-size:0.88rem;display:block;margin-top:0.35rem">لا يوجد حساب أدمن مسجّل لهذه الصيدلية.</span>
                                        @endif
                                    </span>
                                </label>
                            @else
                                <p class="muted" style="margin:0;font-size:0.88rem;line-height:1.55">خيار «مدير محدد» غير متاح عند الإرسال لجميع الصيدليات؛ استخدم صيدلية واحدة من القائمة أعلاه إذا احتجته.</p>
                            @endif
                        </div>
                    </fieldset>

                    <div class="toolbar-row" style="margin-top:0.5rem">
                        <button type="submit" class="btn btn-primary">{{ $isBroadcastAll ? 'إرسال لجميع الصيدليات' : 'إرسال الإشعار' }}</button>
                        <a href="{{ !empty($scoped) && ($backendScopePharmacy ?? null) ? route('backend.pharmacies.show', $backendScopePharmacy) : route('backend.dashboard') }}" class="btn">إلغاء</a>
                    </div>
                </form>
            @endif
        </div>
    </div>
@endsection
