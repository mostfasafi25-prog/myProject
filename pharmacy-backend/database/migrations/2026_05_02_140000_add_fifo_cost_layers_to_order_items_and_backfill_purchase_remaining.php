<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_items') && !Schema::hasColumn('order_items', 'fifo_cost_layers')) {
            Schema::table('order_items', function (Blueprint $table) {
                $table->json('fifo_cost_layers')->nullable()->after('item_profit');
            });
        }

        if (Schema::hasTable('purchase_items') && Schema::hasColumn('purchase_items', 'remaining_quantity')) {
            $hasReturned = Schema::hasColumn('purchase_items', 'returned_quantity');
            if ($hasReturned) {
                DB::table('purchase_items')
                    ->whereNull('remaining_quantity')
                    ->update([
                        'remaining_quantity' => DB::raw('GREATEST(0, CAST(quantity AS DECIMAL(14,4)) - COALESCE(CAST(returned_quantity AS DECIMAL(14,4)), 0))'),
                    ]);
            } else {
                DB::table('purchase_items')
                    ->whereNull('remaining_quantity')
                    ->update([
                        'remaining_quantity' => DB::raw('GREATEST(0, CAST(quantity AS DECIMAL(14,4)))'),
                    ]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'fifo_cost_layers')) {
            Schema::table('order_items', function (Blueprint $table) {
                $table->dropColumn('fifo_cost_layers');
            });
        }
    }
};
