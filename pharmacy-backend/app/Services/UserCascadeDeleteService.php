<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Purchase;
use App\Models\TreasuryTransaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * حذف مستخدم من لوحة المنصة / API مع تفريغ المراجع التي قد تعيق الحذف أو تترك معرفات يتيمة.
 */
class UserCascadeDeleteService
{
    public function deleteWithRelatedCleanup(User $user): void
    {
        $id = (int) $user->id;

        DB::transaction(function () use ($user, $id) {
            $user->tokens()->delete();

            if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'created_by')) {
                Order::withoutGlobalScopes()->where('created_by', $id)->update(['created_by' => null]);
            }

            if (Schema::hasTable('purchases') && Schema::hasColumn('purchases', 'created_by')) {
                Purchase::withoutGlobalScopes()
                    ->withTrashed()
                    ->where('created_by', $id)
                    ->update(['created_by' => null]);
            }

            if (Schema::hasTable('treasury_transactions') && Schema::hasColumn('treasury_transactions', 'created_by')) {
                TreasuryTransaction::withoutGlobalScopes()->where('created_by', $id)->update(['created_by' => null]);
            }

            if (Schema::hasTable('inventory_logs') && Schema::hasColumn('inventory_logs', 'user_id')) {
                DB::table('inventory_logs')->where('user_id', $id)->update(['user_id' => null]);
            }

            $user->delete();
        });
    }
}
