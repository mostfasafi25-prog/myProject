<?php

namespace App\Http\Controllers;

use App\Models\SystemNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class SystemNotificationController extends Controller
{
    public function index(Request $request)
    {
        if (!Schema::hasTable('system_notifications')) {
            return response()->json(['success' => true, 'data' => []]);
        }

        [$username, $role] = $this->resolveActor($request);

        $query = SystemNotification::query()
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

        if ($username !== '') {
            $query->where(function ($q) use ($username) {
                $q->whereNull('deleted_by')->orWhereJsonDoesntContain('deleted_by', $username);
            });
        }

        $rows = $query
            ->latest('id')
            ->limit(150)
            ->get()
            ->map(function (SystemNotification $n) use ($username) {
                $readBy = is_array($n->read_by) ? $n->read_by : [];
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
                    'read' => $username !== '' ? in_array($username, $readBy, true) : false,
                    'createdAt' => optional($n->created_at)->toIso8601String(),
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
        ]);
    
        $user = $request->user();
        $username = $user?->username ?? 'admin';
    
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

        [$username] = $this->resolveActor($request);
        if ($username === '') {
            return response()->json(['success' => true]);
        }

        SystemNotification::query()
            ->where(function ($q) use ($username) {
                $q->whereNull('deleted_by')->orWhereJsonDoesntContain('deleted_by', $username);
            })
            ->chunkById(100, function ($chunk) use ($username) {
                foreach ($chunk as $notification) {
                    $deletedBy = is_array($notification->deleted_by) ? $notification->deleted_by : [];
                    if (!in_array($username, $deletedBy, true)) {
                        $deletedBy[] = $username;
                        $notification->deleted_by = array_values(array_unique($deletedBy));
                        $notification->save();
                    }
                }
            });

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
        $username = trim((string) ($user->username ?? $request->input('username', $request->query('username', ''))));
        $role = trim((string) ($user->role ?? $request->input('role', $request->query('role', ''))));
        return [$username, $role];
    }
}
