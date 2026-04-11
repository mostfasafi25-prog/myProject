<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
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
        
        $users = $query->orderBy('created_at', 'desc')->get(['id', 'username', 'role', 'approval_status', 'is_active', 'created_at']);
        
        return response()->json([
            'success' => true,
            'data' => $users,
            'count' => $users->count()
        ]);
    }
    
    /**
     * إنشاء مستخدم جديد
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:50|unique:users,username',
            'password' => 'required|string|min:6',
            'role' => 'required|in:admin,cashier,super_cashier',
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
            $user = User::create([
                'username' => $request->username,
                'password' => Hash::make($request->password),
                'role' => $request->role,
                'approval_status' => $request->approval_status ?: 'approved',
                'is_active' => $request->boolean('is_active', true),
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'تم إنشاء المستخدم بنجاح',
                'data' => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'role' => $user->role,
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
        $user = User::find($id);
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'المستخدم غير موجود'
            ], 404);
        }
        
        $validator = Validator::make($request->all(), [
            'username' => 'sometimes|string|max:50|unique:users,username,' . $id,
            'role' => 'sometimes|in:admin,cashier,super_cashier',
            'password' => 'sometimes|string|min:4',
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
            if ($request->has('is_active') && !$request->boolean('is_active') && strtolower((string) $user->username) === 'admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن تعطيل حساب المدير الأساسي (admin)',
                ], 400);
            }

            $updateData = $request->only(['username', 'role', 'approval_status', 'is_active']);
            
            // إذا كان هناك كلمة مرور جديدة
            if ($request->has('password') && $request->filled('password')) {
                $updateData['password'] = Hash::make($request->password);
            }
            
            $user->update($updateData);

            if (array_key_exists('is_active', $updateData) && !$user->is_active) {
                $user->tokens()->delete();
            }
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث المستخدم بنجاح',
                'data' => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'role' => $user->role,
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
    public function destroy($id)
    {
        $user = User::find($id);
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'المستخدم غير موجود'
            ], 404);
        }
        
        // لا يمكن حذف المدير الرئيسي
        if ($user->role === 'admin' && User::where('role', 'admin')->count() <= 1) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن حذف المدير الوحيد في النظام'
            ], 400);
        }
        
        try {
            $user->delete();
            
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
            'admins_count' => User::where('role', 'admin')->count(),
            'managers_count' => User::where('role', 'manager')->count(),
            'users_count' => User::where('role', 'user')->count(),
        ];
        
        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }
}