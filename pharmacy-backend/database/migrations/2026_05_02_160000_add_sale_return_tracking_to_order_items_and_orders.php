<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_items')) {
            Schema::table('order_items', function (Blueprint $table) {
                if (!Schema::hasColumn('order_items', 'inventory_pieces_sold')) {
                    $table->decimal('inventory_pieces_sold', 14, 4)->nullable()->after('quantity');
                }
                if (!Schema::hasColumn('order_items', 'sale_quantity_returned')) {
                    $table->decimal('sale_quantity_returned', 14, 4)->default(0)->after('inventory_pieces_sold');
                }
            });
        }

        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (!Schema::hasColumn('orders', 'refunded_amount')) {
                    $table->decimal('refunded_amount', 14, 2)->default(0)->after('paid_amount');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('order_items')) {
            Schema::table('order_items', function (Blueprint $table) {
                if (Schema::hasColumn('order_items', 'sale_quantity_returned')) {
                    $table->dropColumn('sale_quantity_returned');
                }
                if (Schema::hasColumn('order_items', 'inventory_pieces_sold')) {
                    $table->dropColumn('inventory_pieces_sold');
                }
            });
        }

        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (Schema::hasColumn('orders', 'refunded_amount')) {
                    $table->dropColumn('refunded_amount');
                }
            });
        }
    }
};
