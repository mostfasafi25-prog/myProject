<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            // تحقق إذا كان العمود غير موجود قبل إضافته
            if (!Schema::hasColumn('categories', 'cost_price')) {
                $table->decimal('cost_price', 10, 2)->default(0)->after('meta_data');
            }
            
            if (!Schema::hasColumn('categories', 'sale_price')) {
                $table->decimal('sale_price', 10, 2)->default(0)->after('cost_price');
            }
            
            if (!Schema::hasColumn('categories', 'quantity')) {
                $table->decimal('quantity', 10, 2)->default(0)->after('sale_price');
            }
            
            if (!Schema::hasColumn('categories', 'track_quantity')) {
                $table->boolean('track_quantity')->default(false)->after('quantity');
            }
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            // نحذف فقط الأعمدة الموجودة
            $columns = ['cost_price', 'sale_price', 'quantity', 'track_quantity'];
            foreach ($columns as $column) {
                if (Schema::hasColumn('categories', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};