<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'split_level1_name')) {
                $table->string('split_level1_name', 80)->nullable()->after('split_item_name');
            }
            if (!Schema::hasColumn('products', 'split_level2_name')) {
                $table->string('split_level2_name', 80)->nullable()->after('split_level1_name');
            }
            if (!Schema::hasColumn('products', 'custom_child_price')) {
                $table->decimal('custom_child_price', 10, 2)->nullable()->after('split_sale_price');
            }
        });
    }

    public function down()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['split_level1_name', 'split_level2_name', 'custom_child_price']);
        });
    }
};