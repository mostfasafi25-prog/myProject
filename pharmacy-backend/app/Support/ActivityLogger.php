<?php

namespace App\Support;

use App\Models\StaffActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class ActivityLogger
{
    /**
     * @param array<string,mixed> $payload
     */
    public static function log(Request $request, array $payload): void
    {
        try {
            if (!Schema::hasTable('staff_activities')) {
                return;
            }

            $user = $request->user();

            StaffActivity::create([
                'user_id' => $user?->id,
                'username' => $user?->username,
                'role' => $user?->role,
                'action_type' => (string) ($payload['action_type'] ?? 'unknown_action'),
                'entity_type' => isset($payload['entity_type']) ? (string) $payload['entity_type'] : null,
                'entity_id' => isset($payload['entity_id']) ? (string) $payload['entity_id'] : null,
                'description' => (string) ($payload['description'] ?? ''),
                'meta' => is_array($payload['meta'] ?? null) ? $payload['meta'] : null,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to write staff activity log', ['error' => $e->getMessage()]);
        }
    }
}
