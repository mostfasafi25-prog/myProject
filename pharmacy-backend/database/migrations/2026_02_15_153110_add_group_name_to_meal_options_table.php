<?php
// database/migrations/2024_02_15_xxxxxx_add_group_name_to_meal_options_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('meal_options', function (Blueprint $table) {
            // إضافة العمود group_name إذا لم يكن موجوداً
            if (!Schema::hasColumn('meal_options', 'group_name')) {
                $table->string('group_name')->nullable()->after('additional_cost');
            }
            
            // تأكد من وجود الأعمدة الأخرى
            if (!Schema::hasColumn('meal_options', 'additional_cost')) {
                $table->decimal('additional_cost', 10, 2)->default(0)->after('price');
            }
            
            if (!Schema::hasColumn('meal_options', 'sort_order')) {
                $table->integer('sort_order')->default(0)->after('group_name');
            }
            
            if (!Schema::hasColumn('meal_options', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('sort_order');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('meal_options', function (Blueprint $table) {
            $table->dropColumn(['group_name', 'additional_cost', 'sort_order', 'is_active']);
        });
    }
};