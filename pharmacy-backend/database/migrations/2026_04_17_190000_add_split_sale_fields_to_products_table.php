<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('products')) {
            return;
        }

        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'allow_split_sales')) {
                $table->boolean('allow_split_sales')->default(false)->after('unit');
            }
            if (!Schema::hasColumn('products', 'strip_unit_count')) {
                $table->decimal('strip_unit_count', 10, 3)->nullable()->after('allow_split_sales');
            }
            if (!Schema::hasColumn('products', 'split_item_name')) {
                $table->string('split_item_name', 50)->nullable()->after('strip_unit_count');
            }
            if (!Schema::hasColumn('products', 'split_sale_options')) {
                $table->json('split_sale_options')->nullable()->after('split_item_name');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('products')) {
            return;
        }

        Schema::table('products', function (Blueprint $table) {
            $drop = [];
            foreach (['allow_split_sales', 'strip_unit_count', 'split_item_name', 'split_sale_options'] as $col) {
                if (Schema::hasColumn('products', $col)) {
                    $drop[] = $col;
                }
            }
            if (!empty($drop)) {
                $table->dropColumn($drop);
            }
        });
    }
};
