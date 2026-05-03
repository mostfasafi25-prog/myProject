<?php

namespace App\Http\Controllers;

use App\Models\Pharmacy;
use App\Models\StaffActivity;
use App\Models\User;
use App\Services\AdminWelcomeNotificationService;
use App\Services\UserCascadeDeleteService;
use App\Support\BackendWebScope;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class BackendUserManagerController extends Controller
{
    public function index(Request $request)
    {
        $scopeId = BackendWebScope::id();
        $q = User::withoutGlobalScopes()->with('pharmacy:id,name');

        if ($scopeId !== null && $scopeId > 0) {
            $q->where('pharmacy_id', $scopeId);
        }

        if ($request->filled('role')) {
            $role = (string) $request->role;
            if (!($scopeId && $role === 'super_admin')) {
                $q->where('role', $role);
            }
        }
        if ($request->filled('search')) {
            $s = trim((string) $request->search);
            $q->where('username', 'like', '%'.$s.'%');
        }
        if (!$scopeId && $request->filled('pharmacy_id')) {
            $pid = (int) $request->pharmacy_id;
            if ($pid === -1) {
                $q->whereNull('pharmacy_id');
            } elseif ($pid > 0) {
                $q->where('pharmacy_id', $pid);
            }
        }

        $users = $q->orderByDesc('id')->paginate(30)->withQueryString();
        $pharmacies = $scopeId
            ? Pharmacy::where('id', $scopeId)->orderBy('name')->get(['id', 'name'])
            : Pharmacy::orderBy('name')->get(['id', 'name']);

        return view('backend.users.index', compact('users', 'pharmacies'));
    }

    public function create(Request $request)
    {
        $scopeId = BackendWebScope::id();
        $pharmacies = $scopeId
            ? Pharmacy::where('id', $scopeId)->orderBy('name')->get(['id', 'name'])
            : Pharmacy::orderBy('name')->get(['id', 'name']);

        $prefPharmacyId = $scopeId ? (int) $scopeId : (int) $request->query('pharmacy_id', 0);
        $allowedRoles = $this->allowedTenantRolesForPharmacyForm($prefPharmacyId > 0 ? $prefPharmacyId : null, null);

        return view('backend.users.form', [
            'user' => new User,
            'pharmacies' => $pharmacies,
            'mode' => 'create',
            'allowedRoles' => $allowedRoles,
        ]);
    }

    public function store(Request $request)
    {
        $scopeId = BackendWebScope::id();
        $data = $this->validated($request);

        if ($scopeId && $data['role'] === 'super_admin') {
            return back()->withErrors(['role' => 'لا يمكن إنشاء سوبر أدمن من داخل عرض صيدلية واحدة.'])->withInput();
        }

        $pharmacyId = null;
        if ($data['role'] !== 'super_admin') {
            $pharmacyId = $scopeId ? (int) $scopeId : (int) $data['pharmacy_id'];
            if ($pharmacyId < 1) {
                return back()->withErrors(['pharmacy_id' => 'اختر صيدلية لهذا المستخدم.'])->withInput();
            }
        }

        if ($data['role'] === 'admin' && $pharmacyId && $this->pharmacyHasAdminOtherThan($pharmacyId, null)) {
            return back()->withErrors([
                'role' => 'كل صيدلية لها مدير (أدمن) واحد فقط. أضف كاشيراً أو عدّل المدير الحالي.',
            ])->withInput();
        }

        $user = User::withoutGlobalScopes()->create([
            'username' => $data['username'],
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            'pharmacy_id' => $pharmacyId,
            'approval_status' => $data['approval_status'],
            'is_active' => $data['is_active'],
            'avatar_url' => $data['avatar_url'] ?: null,
        ]);

        $this->logWebActivity($user->pharmacy_id, 'user_create_web', (string) $user->id, 'إنشاء مستخدم من لوحة الويب @'.$user->username);

        if ($data['role'] === 'admin' && $user->pharmacy_id) {
            AdminWelcomeNotificationService::dispatchForUser($user);
        }

        return redirect()->route('backend.users.index')->with('ok', 'تم إنشاء المستخدم #'.$user->id);
    }

    public function edit($user)
    {
        $row = User::withoutGlobalScopes()->findOrFail((int) $user);
        $this->assertUserInScope($row);
        $scopeId = BackendWebScope::id();
        $pharmacies = $scopeId
            ? Pharmacy::where('id', $scopeId)->orderBy('name')->get(['id', 'name'])
            : Pharmacy::orderBy('name')->get(['id', 'name']);

        $allowedRoles = $this->allowedTenantRolesForPharmacyForm(
            $row->pharmacy_id ? (int) $row->pharmacy_id : null,
            $row
        );

        return view('backend.users.form', [
            'user' => $row,
            'pharmacies' => $pharmacies,
            'mode' => 'edit',
            'allowedRoles' => $allowedRoles,
        ]);
    }

    public function update(Request $request, $user)
    {
        $row = User::withoutGlobalScopes()->findOrFail((int) $user);
        $this->assertUserInScope($row);
        if (!$request->filled('password')) {
            $request->request->remove('password');
        }
        $data = $this->validated($request, $row->id);

        $scopeId = BackendWebScope::id();
        if ($scopeId && $data['role'] === 'super_admin') {
            return back()->withErrors(['role' => 'لا يمكن جعل المستخدم سوبر أدمن من داخل عرض صيدلية واحدة.'])->withInput();
        }

        if ($row->role === 'super_admin') {
            $data['role'] = 'super_admin';
        }

        $pharmacyId = null;
        if ($data['role'] !== 'super_admin') {
            $pharmacyId = $scopeId ? $scopeId : (int) $data['pharmacy_id'];
            if ($pharmacyId < 1) {
                return back()->withErrors(['pharmacy_id' => 'اختر صيدلية لهذا المستخدم.'])->withInput();
            }
        }

        if ($data['role'] === 'admin' && $pharmacyId && $this->pharmacyHasAdminOtherThan($pharmacyId, $row->id)) {
            return back()->withErrors([
                'role' => 'كل صيدلية لها مدير (أدمن) واحد فقط. لا يمكن وجود أدمن ثانٍ لنفس الصيدلية.',
            ])->withInput();
        }

        if (!$request->boolean('is_active') && strtolower((string) $row->username) === 'admin') {
            return back()->withErrors(['is_active' => 'لا يمكن تعطيل المستخدم admin من هنا.'])->withInput();
        }

        $update = [
            'username' => $data['username'],
            'role' => $data['role'],
            'pharmacy_id' => $pharmacyId,
            'approval_status' => $data['approval_status'],
            'is_active' => $data['is_active'],
            'avatar_url' => $data['avatar_url'] ?: null,
        ];
        if (!empty($data['password'])) {
            $update['password'] = Hash::make($data['password']);
        }
        $row->update($update);

        if (!$row->is_active) {
            $row->tokens()->delete();
        }

        $this->logWebActivity($row->pharmacy_id, 'user_update_web', (string) $row->id, 'تحديث مستخدم من لوحة الويب @'.$row->username);

        return redirect()->route('backend.users.index')->with('ok', 'تم حفظ التعديلات.');
    }

    public function destroy($user, UserCascadeDeleteService $cascade)
    {
        $row = User::withoutGlobalScopes()->findOrFail((int) $user);
        $this->assertUserInScope($row);

        if ($row->role === 'super_admin') {
            return redirect()
                ->route('backend.users.index')
                ->with('error', 'لا يمكن حذف حساب سوبر أدمن المنصة من لوحة الويب.');
        }

        $uname = $row->username;
        $pid = $row->pharmacy_id;

        try {
            $cascade->deleteWithRelatedCleanup($row);
        } catch (\Throwable $e) {
            return redirect()
                ->route('backend.users.index')
                ->with('error', 'تعذر حذف المستخدم: '.$e->getMessage());
        }

        $this->logWebActivity($pid, 'user_delete_web', (string) $user, 'حذف مستخدم من لوحة الويب @'.$uname);

        return redirect()
            ->route('backend.users.index')
            ->with('ok', 'تم حذف المستخدم وتفريغ مراجعه (طلبات، مشتريات، خزنة، سجلات مخزون حيث ينطبق).');
    }

    /**
     * @return array{username:string,password:?string,role:string,pharmacy_id:?int,approval_status:string,is_active:bool,avatar_url:?string}
     */
    private function validated(Request $request, ?int $exceptUserId = null): array
    {
        $editing = $exceptUserId !== null
            ? User::withoutGlobalScopes()->find($exceptUserId)
            : null;
        $roleLockedSuper = $editing !== null && $editing->role === 'super_admin';
        $allowedRoles = $roleLockedSuper
            ? ['super_admin']
            : ['admin', 'cashier'];

        $rules = [
            'username' => [
                'required',
                'string',
                'max:50',
                Rule::unique('users', 'username')->ignore($exceptUserId),
            ],
            'role' => ['required', Rule::in($allowedRoles)],
            'pharmacy_id' => ['nullable', 'integer', 'exists:pharmacies,id'],
            'approval_status' => ['required', Rule::in(['approved', 'pending'])],
            'is_active' => ['sometimes', 'boolean'],
            'avatar_url' => ['nullable', 'string', 'max:200000'],
        ];
        $rules['password'] = $exceptUserId === null
            ? ['required', 'string', 'min:6']
            : ['sometimes', 'nullable', 'string', 'min:6'];

        $v = $request->validate($rules);

        return [
            'username' => trim((string) $v['username']),
            'password' => array_key_exists('password', $v) ? (string) $v['password'] : '',
            'role' => (string) $v['role'],
            'pharmacy_id' => isset($v['pharmacy_id']) ? (int) $v['pharmacy_id'] : 0,
            'approval_status' => (string) $v['approval_status'],
            'is_active' => $request->boolean('is_active', true),
            'avatar_url' => isset($v['avatar_url']) ? trim((string) $v['avatar_url']) : '',
        ];
    }

    private function logWebActivity(?int $pharmacyId, string $action, string $entityId, string $description): void
    {
        try {
            if (!Schema::hasTable('staff_activities')) {
                return;
            }
            StaffActivity::withoutGlobalScopes()->create([
                'pharmacy_id' => (int) ($pharmacyId ?? config('pharmacy.default_pharmacy_id', 1)),
                'user_id' => null,
                'username' => 'backend_web',
                'role' => 'system',
                'action_type' => $action,
                'entity_type' => 'user',
                'entity_id' => $entityId,
                'description' => $description,
                'meta' => ['source' => 'backend_web_panel'],
            ]);
        } catch (\Throwable) {
        }
    }

    private function assertUserInScope(User $row): void
    {
        $sid = BackendWebScope::id();
        if ($sid === null) {
            return;
        }
        if ((int) $row->pharmacy_id !== $sid) {
            abort(404);
        }
    }

    /**
     * أدوار تظهر في القائمة: مدير واحد (أدمن) لكل صيدلية؛ إن وُجد أدمن يبقى إضافة كاشير فقط ما لم يكن التعديل لنفس الأدمن.
     *
     * @return list<string>
     */
    private function allowedTenantRolesForPharmacyForm(?int $pharmacyId, ?User $editing): array
    {
        if ($editing !== null && $editing->role === 'super_admin') {
            return ['super_admin'];
        }
        if ($pharmacyId === null || $pharmacyId < 1) {
            return ['admin', 'cashier'];
        }
        if ($editing !== null && $editing->role === 'admin') {
            return ['admin', 'cashier'];
        }
        if ($this->pharmacyHasAdminOtherThan($pharmacyId, $editing?->id)) {
            return ['cashier'];
        }

        return ['admin', 'cashier'];
    }

    private function pharmacyHasAdminOtherThan(int $pharmacyId, ?int $exceptUserId): bool
    {
        $q = User::withoutGlobalScopes()
            ->where('pharmacy_id', $pharmacyId)
            ->where('role', 'admin');
        if ($exceptUserId !== null && $exceptUserId > 0) {
            $q->where('id', '!=', $exceptUserId);
        }

        return $q->exists();
    }
}
