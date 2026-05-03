<?php

namespace App\Http\Controllers;

use App\Models\Pharmacy;
use App\Models\User;
use App\Services\AdminWelcomeNotificationService;
use App\Services\PharmacyPlanService;
use App\Services\UserCascadeDeleteService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Hash;
use App\Support\ActivityLogger;

class UserController extends Controller
{
    private function canManageAllUsers(Request $request): bool
    {
        return in_array($request->user()?->role, ['super_admin'], true);
    }

    private function canAccessUserRole(Request $request, ?string $role): bool
    {
        if ($this->canManageAllUsers($request)) return true;
        return $role === 'cashier';
    }
    /**
     * عرض جميع المستخدمين
     */
    public function index(Request $request)
    {
        $query = User::query();
        
        // فلترة حسب الدور
        if ($request->has('role')) {
            $query->where('role', $request->role);
        }
        
        // بحث باسم المستخدم
        if ($request->has('search')) {
            $search = $request->search;
            $query->where('username', 'LIKE', "%{$search}%");
        }
        
        $users = $query->orderBy('created_at', 'desc')->get(['id', 'username', 'role', 'avatar_url', 'approval_status', 'is_active', 'pharmacy_id', 'created_at']);
        
        return response()->json([
            'success' => true,
            'data' => $users,
            'count' => $users->count()
        ]);
    }
    
    private function canManageUser(Request $request, User $user): bool
{
    $actor = $request->user();
    
    if ($actor->role === 'super_admin') {
        return true;
    }
    
    if ($actor->role === 'admin') {
        // الأدمن العادي يقدر يدير الكاشير فقط
        return $user->role === 'cashier';
    }
    
    return false;
}
    /**
     * إنشاء مستخدم جديد
     */
    public function store(Request $request)
    {
        if (!in_array($request->user()?->role, ['admin', 'super_admin'], true)) {
            return response()->json(['success' => false, 'message' => 'غير مصرح'], 403);
        }
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:50|unique:users,username',
            'password' => 'required|string|min:6',
            'avatar_url' => 'nullable|string|max:200000',
            'role' => 'required|in:admin,super_admin,cashier',
            'approval_status' => 'nullable|in:approved,pending',
            'is_active' => 'nullable|boolean',
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            if (!$this->canAccessUserRole($request, (string) $request->role)) {
                return response()->json([
                    'success' => false,
                    'message' => 'يمكنك إنشاء حسابات الكاشير فقط',
                ], 403);
            }

            $actor = $request->user();
            $pharmacyId = $actor->pharmacy_id;
            if ($actor->role === 'super_admin') {
                if ($request->role === 'super_admin') {
                    $pharmacyId = null;
                } else {
                    $pharmacyId = (int) $request->input('pharmacy_id', 0);
                    if ($pharmacyId < 1) {
                        return response()->json([
                            'success' => false,
                            'message' => 'يجب تمرير pharmacy_id لربط المستخدم بصيدلية (أو أنشئ صيدلية عبر POST /api/pharmacies)',
                        ], 422);
                    }
                }
            } elseif (!$pharmacyId) {
                return response()->json([
                    'success' => false,
                    'message' => 'حساب الأدمن غير مرتبط بصيدلية',
                ], 422);
            }

            if ($pharmacyId && in_array($request->role, ['admin', 'cashier'], true)) {
                $pharmacy = Pharmacy::find((int) $pharmacyId);
                if ($pharmacy) {
                    $planService = app(PharmacyPlanService::class);
                    if ($request->role === 'cashier') {
                        $lim = $planService->limits($pharmacy);
                        if (($lim['cashiers'] ?? 0) === 0) {
                            return $planService->denyFreePlanCashierResponse();
                        }
                    }
                    if (!$planService->canAddUser($pharmacy, (string) $request->role)) {
                        $reason = match (true) {
                            $request->role === 'cashier' => 'cashiers',
                            $request->role === 'admin' => 'admin',
                            default => 'cashiers',
                        };

                        return $planService->denyUserLimitResponse($reason);
                    }
                }
            }

            $user = User::create([
                'username' => $request->username,
                'password' => Hash::make($request->password),
                'avatar_url' => $request->input('avatar_url'),
                'role' => $request->role,
                'approval_status' => $request->approval_status ?: 'approved',
                'is_active' => $request->boolean('is_active', true),
                'pharmacy_id' => $pharmacyId,
            ]);

            ActivityLogger::log($request, [
                'action_type' => 'user_create',
                'entity_type' => 'user',
                'entity_id' => $user->id,
                'description' => "إنشاء مستخدم جديد @{$user->username}",
                'meta' => ['role' => $user->role],
            ]);

            if ($user->role === 'admin' && $user->pharmacy_id) {
                AdminWelcomeNotificationService::dispatchForUser($user);
            }

            return response()->json([
                'success' => true,
                'message' => 'تم إنشاء المستخدم بنجاح',
                'data' => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'role' => $user->role,
                    'avatar_url' => $user->avatar_url,
                ]
            ], 201);
            
        } catch (\Exception $e) {
            Log::error('Create user error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء إنشاء المستخدم'
            ], 500);
        }
    }
    
    /**
     * تحديث مستخدم
     */
    public function update(Request $request, $id)
    {
        if (!in_array($request->user()?->role, ['admin', 'super_admin'], true)) {
            return response()->json(['success' => false, 'message' => 'غير مصرح'], 403);
        }
        if ($request->has('role')) {
            $newRole = $request->input('role');
            $actor = $request->user();
            
            if ($actor->role === 'admin' && $newRole !== 'cashier') {
                return response()->json([
                    'success' => false,
                    'message' => 'الأدمن العادي يمكنه تعيين أدوار الكاشير فقط'
                ], 403);
            }
        }
        $user = User::find($id);
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'المستخدم غير موجود'
            ], 404);
        }
        
        $validator = Validator::make($request->all(), [
            'username' => 'sometimes|string|max:50|unique:users,username,' . $id,
            'role' => 'sometimes|in:admin,super_admin,cashier',
            'password' => 'sometimes|string|min:4',
            'avatar_url' => 'nullable|string|max:200000',
            'approval_status' => 'sometimes|in:approved,pending',
            'is_active' => 'sometimes|boolean',
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            if (!$this->canAccessUserRole($request, (string) $user->role)) {
                return response()->json([
                    'success' => false,
                    'message' => 'يمكنك إدارة حسابات الكاشير فقط',
                ], 403);
            }
            if ($request->has('role') && !$this->canAccessUserRole($request, (string) $request->input('role'))) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكنك تعيين هذا الدور',
                ], 403);
            }
            if ($request->has('is_active') && !$request->boolean('is_active') && strtolower((string) $user->username) === 'admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن تعطيل حساب المدير الأساسي (admin)',
                ], 400);
            }

            if ($request->has('role') && $request->input('role') === 'admin' && $user->pharmacy_id) {
                $otherAdmins = User::withoutGlobalScopes()
                    ->where('pharmacy_id', $user->pharmacy_id)
                    ->where('role', 'admin')
                    ->where('id', '!=', $user->id)
                    ->count();
                if ($otherAdmins >= 1) {
                    return app(PharmacyPlanService::class)->denyUserLimitResponse('admin');
                }
            }

            $updateData = $request->only(['username', 'role', 'avatar_url', 'approval_status', 'is_active']);
            $beforeState = [
                'username' => $user->username,
                'role' => $user->role,
                'avatar_url' => $user->avatar_url,
                'approval_status' => $user->approval_status,
                'is_active' => (bool) ($user->is_active ?? true),
            ];
            
            // إذا كان هناك كلمة مرور جديدة
            if ($request->has('password') && $request->filled('password')) {
                $updateData['password'] = Hash::make($request->password);
            }
            
            $user->update($updateData);

            if (array_key_exists('is_active', $updateData) && !$user->is_active) {
                $user->tokens()->delete();
            }

            $afterState = [
                'username' => $user->username,
                'role' => $user->role,
                'avatar_url' => $user->avatar_url,
                'approval_status' => $user->approval_status,
                'is_active' => (bool) ($user->is_active ?? true),
            ];
            $changes = [];
            foreach ($beforeState as $field => $beforeValue) {
                if (!array_key_exists($field, $updateData)) {
                    continue;
                }
                $afterValue = $afterState[$field] ?? null;
                if ($beforeValue !== $afterValue) {
                    $changes[$field] = [
                        'before' => $beforeValue,
                        'after' => $afterValue,
                    ];
                }
            }
            if (array_key_exists('password', $updateData)) {
                $changes['password'] = [
                    'before' => '********',
                    'after' => 'تم التحديث',
                ];
            }

            ActivityLogger::log($request, [
                'action_type' => 'user_update',
                'entity_type' => 'user',
                'entity_id' => $user->id,
                'description' => "تحديث بيانات المستخدم @{$user->username}",
                'meta' => [
                    'updated_fields' => array_keys($updateData),
                    'changes' => $changes,
                    'target_user' => [
                        'id' => $user->id,
                        'username' => $user->username,
                    ],
                ],
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث المستخدم بنجاح',
                'data' => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'role' => $user->role,
                    'avatar_url' => $user->avatar_url,
                    'approval_status' => $user->approval_status,
                    'is_active' => (bool) ($user->is_active ?? true),
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('Update user error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تحديث المستخدم'
            ], 500);
        }
    }
    
    /**
     * حذف مستخدم
     */
    public function destroy($id, UserCascadeDeleteService $cascade)
    {
        $actor = request()->user();
        if (!in_array($actor?->role, ['admin', 'super_admin'], true)) {
            return response()->json(['success' => false, 'message' => 'غير مصرح'], 403);
        }
        $user = User::find($id);
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'المستخدم غير موجود'
            ], 404);
        }
        
        if (!$this->canAccessUserRole(request(), (string) $user->role)) {
            return response()->json([
                'success' => false,
                'message' => 'يمكنك حذف حسابات الكاشير فقط',
            ], 403);
        }

        if ($user->role === 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن حذف حساب سوبر أدمن.',
            ], 400);
        }

        // لا يمكن حذف آخر مدير ضمن نفس نطاق الصيدلية (أو آخر سوبر أدمن على مستوى المنصة)
        $privilegedQuery = User::withoutGlobalScopes();
        if ($user->pharmacy_id !== null) {
            $privilegedQuery->where('pharmacy_id', $user->pharmacy_id);
        } else {
            $privilegedQuery->whereNull('pharmacy_id')->where('role', 'super_admin');
        }
        $privilegedCount = (clone $privilegedQuery)->whereIn('role', ['admin', 'super_admin'])->count();
        if (in_array($user->role, ['admin', 'super_admin'], true) && $privilegedCount <= 1) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن حذف المدير الوحيد في النظام'
            ], 400);
        }
        
        try {
            $deletedUsername = $user->username;
            $deletedRole = $user->role;
            $cascade->deleteWithRelatedCleanup($user);

            ActivityLogger::log(request(), [
                'action_type' => 'user_delete',
                'entity_type' => 'user',
                'entity_id' => $id,
                'description' => "حذف المستخدم @{$deletedUsername}",
                'meta' => ['role' => $deletedRole],
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'تم حذف المستخدم بنجاح'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Delete user error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء حذف المستخدم'
            ], 500);
        }
    }
    
    /**
     * إحصائيات المستخدمين
     */
    public function stats()
    {
        $stats = [
            'total_users' => User::count(),
            'admins_count' => User::whereIn('role', ['admin', 'super_admin'])->count(),
            'managers_count' => User::where('role', 'manager')->count(),
            'users_count' => User::where('role', 'user')->count(),
        ];
        
        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }
}