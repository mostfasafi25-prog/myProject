<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->index('name', 'products_name_idx');
            $table->index('category_id', 'products_category_id_idx');
            $table->index('reorder_point', 'products_reorder_point_idx');
            $table->index(['is_active', 'name'], 'products_is_active_name_idx');
        });

        Schema::table('category_product', function (Blueprint $table) {
            $table->index('product_id', 'category_product_product_id_idx');
            $table->index(['product_id', 'category_id'], 'category_product_product_category_idx');
        });
    }

    public function down(): void
    {
        Schema::table('category_product', function (Blueprint $table) {
            $table->dropIndex('category_product_product_id_idx');
            $table->dropIndex('category_product_product_category_idx');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_name_idx');
            $table->dropIndex('products_category_id_idx');
            $table->dropIndex('products_reorder_point_idx');
            $table->dropIndex('products_is_active_name_idx');
        });
    }
};
