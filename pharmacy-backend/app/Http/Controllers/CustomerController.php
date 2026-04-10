<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        try {
            $query = Customer::query();

            if ($request->filled('department')) {
                $query->where('department', $request->department);
            }
            if ($request->filled('shift')) {
                $query->where('shift', $request->shift);
            }
            if (Schema::hasColumn('customers', 'role') && $request->filled('role')) {
                $query->where('role', $request->role);
            }
            if ($request->filled('search')) {
                $query->where('name', 'LIKE', '%' . $request->search . '%');
            }

            $sort = $request->get('sort_by');
            if ($sort === 'salary_asc') {
                $query->orderBy('salary', 'asc');
            } elseif ($sort === 'salary_desc') {
                $query->orderBy('salary', 'desc');
            } elseif ($sort === 'name_asc') {
                $query->orderBy('name', 'asc');
            } elseif ($sort === 'name_desc') {
                $query->orderBy('name', 'desc');
            } else {
                $query->orderBy('created_at', 'desc');
            }

            $people = $query->get();

            $departments = Customer::select('department')->distinct()->pluck('department')
                ->filter(fn($v) => $v !== null && $v !== '')->values();

            return response()->json([
                'success' => true,
                'data' => $people,
                'count' => $people->count(),
                'departments' => $departments,
                'shifts' => ['صباحي', 'مسائي'],
                'roles' => ['user', 'admin', 'supervisor'],
            ]);
        } catch (\Throwable $e) {
            Log::error('CustomerController@index', ['message' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'خطأ في جلب بيانات الموظفين',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    public function show($id)
    {
        $person = Customer::withCount('createdOrders')->find($id);
        if (!$person) {
            return $this->error('الشخص غير موجود', 404);
        }
        return response()->json([
            'success' => true,
            'data' => $person,
            'stats' => [
                'orders_count' => $person->created_orders_count,
                'salary' => $person->salary,
                'department' => $person->department,
                'shift' => $person->shift,
                'role' => $person->role,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $v = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'salary' => 'required|numeric|min:0',
            'department' => 'required|string|max:255',
            'shift' => 'required|in:صباحي,مسائي',
            'phone' => 'required|string|max:20',
            'role' => 'sometimes|in:user,admin,supervisor',
            'payment_type' => 'sometimes|in:daily,monthly',
            'daily_rate' => 'nullable|numeric|min:0',
        ]);

        if ($v->fails()) {
            return $this->validationError($v->errors());
        }

        $data = [
            'name' => $request->name,
            'salary' => $request->salary,
            'department' => $request->department,
            'shift' => $request->shift,
            'phone' => $request->phone,
            'role' => $request->role ?? 'user',
        ];
        $employee = Customer::create($data);

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الموظف بنجاح',
            'data' => $employee,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $person = Customer::find($id);
        if (!$person) {
            return $this->error('الشخص غير موجود', 404);
        }

        $v = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'salary' => 'sometimes|numeric|min:0',
            'department' => 'sometimes|string|max:255',
            'shift' => 'sometimes|in:صباحي,مسائي',
            'phone' => 'sometimes|string|max:20',
            'role' => 'sometimes|in:user,admin,supervisor',
            'payment_type' => 'sometimes|in:daily,monthly',
            'daily_rate' => 'nullable|numeric|min:0',
        ]);

        if ($v->fails()) {
            return $this->validationError($v->errors());
        }

        $person->update($request->only([
            'name', 'salary', 'department', 'shift', 'phone', 'role',
        ]));

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الموظف بنجاح',
            'data' => $person->fresh(),
        ]);
    }

    public function destroy($id)
    {
        $employee = Customer::find($id);
        if (!$employee) {
            return $this->error('الموظف غير موجود', 404);
        }
        $employee->delete();
        return response()->json(['success' => true, 'message' => 'تم حذف الموظف بنجاح']);
    }

    public function changeRole(Request $request, $id)
    {
        $person = Customer::find($id);
        if (!$person) {
            return $this->error('الشخص غير موجود', 404);
        }
        $v = Validator::make($request->all(), ['role' => 'required|in:user,admin,supervisor']);
        if ($v->fails()) {
            return $this->validationError($v->errors());
        }
        $person->update(['role' => $request->role]);
        return response()->json([
            'success' => true,
            'message' => 'تم تغيير دور الموظف بنجاح',
            'data' => $person->fresh(),
        ]);
    }

    public function stats()
    {
        $stats = [
            'total_employees' => Customer::count(),
            'total_admins' => Customer::where('role', 'admin')->count(),
            'total_supervisors' => Customer::where('role', 'supervisor')->count(),
            'total_users' => Customer::where('role', 'user')->count(),
            'total_salary' => Customer::sum('salary'),
            'average_salary' => Customer::avg('salary'),
            'departments_count' => Customer::select('department')->distinct()->count(),
            'departments' => Customer::select('department')
                ->selectRaw('COUNT(*) as count, SUM(salary) as total_salary')
                ->groupBy('department')
                ->get(),
            'roles_distribution' => Customer::select('role')
                ->selectRaw('COUNT(*) as count, AVG(salary) as average_salary')
                ->groupBy('role')
                ->get(),
        ];
        return response()->json(['success' => true, 'data' => $stats]);
    }
}
