<?php

namespace App\Http\Controllers;

use App\Models\SystemNotification;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class SystemNotificationController extends Controller
{
    /**
     * إشعارات يستطيع الممثل رؤيتها (قبل تصفية المحذوف للمستخدم).
     */
    private function recipientScopeQuery(string $username, string $role): Builder
    {
        return SystemNotification::query()
            ->where(function ($q) use ($username, $role) {
                $q->where('recipients_type', 'all');
                if (in_array($role, ['admin', 'super_admin'], true)) {
                    $q->orWhere('recipients_type', 'admin_only');
                }
                if ($username !== '') {
                    $q->orWhere(function ($sub) use ($username) {
                        $sub->where('recipients_type', 'users')
                            ->whereJsonContains('recipient_usernames', $username);
                    });
                }
            });
    }

    private function notDeletedByUserScope(Builder $query, string $username): Builder
    {
        if ($username === '') {
            return $query;
        }

        return $query->where(function ($q) use ($username) {
            $q->whereNull('deleted_by')->orWhereJsonDoesntContain('deleted_by', $username);
        });
    }

    /**
     * مدير الصيدلية (role admin): يرى فقط إنهاء الدوام وإشعارات المبرمج.
     */
    private function scopePharmacyAdminAllowedTypes(Builder $query, string $role): Builder
    {
        if ($role !== 'admin') {
            return $query;
        }

        return $query->where(function ($q) {
            $q->whereIn('type', ['cashier_shift_end', 'shift_end'])
                ->orWhere('meta->from_programmer', true);
        });
    }

    public function index(Request $request)
    {
        if (!Schema::hasTable('system_notifications')) {
            return response()->json(['success' => true, 'data' => []]);
        }

        [$username, $role] = $this->resolveActor($request);

        $query = $this->recipientScopeQuery($username, $role);
        $this->notDeletedByUserScope($query, $username);
        $this->scopePharmacyAdminAllowedTypes($query, $role);

        // الكاشير: لا يصلهم إلا إشعار يدوي من الإدارة/المالك أو التشجيع الأسبوعي التلقائي
        if (in_array($role, ['cashier', 'super_cashier'], true)) {
            $query->where(function ($q) {
                $q->where('type', 'cashier_weekly_morale')
                    ->orWhere(function ($sub) {
                        $sub->whereIn('type', ['manual', 'owner_broadcast'])
                            ->where('from_management', true);
                    });
            });
        }

        $rows = $query
            ->latest('id')
            ->limit(150)
            ->get()
            ->map(function (SystemNotification $n) use ($username) {
                $readBy = is_array($n->read_by) ? $n->read_by : [];
                $deletedBy = is_array($n->deleted_by) ? $n->deleted_by : [];
                $meta = is_array($n->meta) ? $n->meta : [];
                return [
                    'id' => $n->id,
                    'type' => $n->type,
                    'prefCategory' => $n->pref_category,
                    'title' => $n->title,
                    'message' => $n->message,
                    'details' => $n->details,
                    'fromManagement' => (bool) $n->from_management,
                    'managementLabel' => $n->management_label,
                    'recipients' => $n->recipients_type === 'users' ? ($n->recipient_usernames ?? []) : $n->recipients_type,
                    'readBy' => $readBy,
                    'deletedBy' => $deletedBy,
                    'read' => $username !== '' ? in_array($username, $readBy, true) : false,
                    'createdAt' => optional($n->created_at)->toIso8601String(),
                    'meta' => $meta,
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }
    public function store(Request $request)
    {
        $actor = $request->user();
        $role = $actor?->role ?? '';
        $type = (string) $request->input('type', '');
        if (in_array($role, ['cashier', 'super_cashier'], true)) {
            if (!in_array($type, ['cashier_shift_end'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'غير مصرح بإرسال هذا النوع من الإشعارات',
                ], 403);
            }
        } elseif (!in_array($role, ['admin', 'super_admin'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'غير مصرح بإرسال إشعارات النظام',
            ], 403);
        }

        if (!Schema::hasTable('system_notifications')) {
            return response()->json([
                'success' => false,
                'message' => 'جدول الإشعارات غير موجود'
            ], 500);
        }
    
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'details' => 'nullable|string',
            'from_management' => 'boolean',
            'management_label' => 'nullable|string',
            'recipients_type' => 'required|in:all,admin_only,users',
            'recipient_usernames' => 'array|nullable',
            'type' => 'nullable|string',
            'pref_category' => 'nullable|string',
            'meta' => 'nullable|array',
        ]);
    
        $user = $request->user();
        $username = $user?->username ?? 'admin';

        $meta = isset($validated['meta']) && is_array($validated['meta']) ? $validated['meta'] : [];
        // لا يضع «من المبرمج» إلا سوبر أدمن (أو عبر لوحة المالك التي تدمج الحقل قبل الاستدعاء)
        if (($user?->role ?? '') !== 'super_admin') {
            unset($meta['from_programmer']);
        }
    
        $notification = SystemNotification::create([
            'title' => $validated['title'],
            'message' => $validated['message'],
            'details' => $validated['details'] ?? null,
            'from_management' => $validated['from_management'] ?? true,
            'management_label' => $validated['management_label'] ?? 'إدارة النظام',
            'recipients_type' => $validated['recipients_type'],
            'recipient_usernames' => $validated['recipients_type'] === 'users' ? ($validated['recipient_usernames'] ?? []) : [],
            'type' => $validated['type'] ?? 'manual',
            'pref_category' => $validated['pref_category'] ?? 'management_manual',
            'meta' => $meta !== [] ? $meta : null,
            'created_by' => $username,
            'read_by' => [],
            'deleted_by' => [],
        ]);
    
        return response()->json([
            'success' => true,
            'data' => $notification,
            'message' => 'تم إرسال الإشعار بنجاح'
        ], 201);
    }
    public function markRead(Request $request, int $id)
    {
        if (!Schema::hasTable('system_notifications')) {
            return response()->json(['success' => true]);
        }

        $notification = SystemNotification::findOrFail($id);
        [$username] = $this->resolveActor($request);
        if ($username === '') {
            return response()->json(['success' => true]);
        }

        $readBy = is_array($notification->read_by) ? $notification->read_by : [];
        if (!in_array($username, $readBy, true)) {
            $readBy[] = $username;
            $notification->read_by = array_values(array_unique($readBy));
            $notification->save();
        }

        return response()->json(['success' => true]);
    }

    public function markReadAll(Request $request)
    {
        if (!Schema::hasTable('system_notifications')) {
            return response()->json(['success' => true]);
        }

        [$username] = $this->resolveActor($request);
        if ($username === '') {
            return response()->json(['success' => true]);
        }

        SystemNotification::query()
            ->where(function ($q) use ($username) {
                $q->whereNull('read_by')->orWhereJsonDoesntContain('read_by', $username);
            })
            ->chunkById(100, function ($chunk) use ($username) {
                foreach ($chunk as $notification) {
                    $readBy = is_array($notification->read_by) ? $notification->read_by : [];
                    if (!in_array($username, $readBy, true)) {
                        $readBy[] = $username;
                        $notification->read_by = array_values(array_unique($readBy));
                        $notification->save();
                    }
                }
            });

        return response()->json(['success' => true]);
    }

    public function markDeleted(Request $request, int $id)
    {
        if (!Schema::hasTable('system_notifications')) {
            return response()->json(['success' => true]);
        }

        $notification = SystemNotification::findOrFail($id);
        [$username] = $this->resolveActor($request);
        if ($username === '') {
            return response()->json(['success' => true]);
        }

        $deletedBy = is_array($notification->deleted_by) ? $notification->deleted_by : [];
        if (!in_array($username, $deletedBy, true)) {
            $deletedBy[] = $username;
            $notification->deleted_by = array_values(array_unique($deletedBy));
            $notification->save();
        }

        return response()->json(['success' => true]);
    }

    public function markDeletedAll(Request $request)
    {
        if (!Schema::hasTable('system_notifications')) {
            return response()->json(['success' => true]);
        }

        [$username, $role] = $this->resolveActor($request);
        if ($username === '') {
            return response()->json([
                'success' => false,
                'message' => 'تعذر تحديد المستخدم. أعد تسجيل الدخول.',
            ], 422);
        }

        $query = $this->recipientScopeQuery($username, $role);
        $this->notDeletedByUserScope($query, $username);
        $this->scopePharmacyAdminAllowedTypes($query, $role);

        $query->chunkById(100, function ($chunk) use ($username) {
            foreach ($chunk as $notification) {
                $deletedBy = is_array($notification->deleted_by) ? $notification->deleted_by : [];
                if (!in_array($username, $deletedBy, true)) {
                    $deletedBy[] = $username;
                    $notification->deleted_by = array_values(array_unique($deletedBy));
                    $notification->save();
                }
            }
        }, 'id');

        return response()->json(['success' => true]);
    }

    /**
     * يدعم المستخدم من التوكن أو fallback من الفرونت عبر query/body.
     *
     * @return array{0:string,1:string}
     */
    private function resolveActor(Request $request): array
    {
        $user = $request->user();
        if ($user) {
            return [
                trim((string) ($user->username ?? '')),
                trim((string) ($user->role ?? '')),
            ];
        }

        $username = trim((string) $request->input('username', $request->query('username', '')));
        $role = trim((string) $request->input('role', $request->query('role', '')));

        return [$username, $role];
    }
}
