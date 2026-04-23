<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'split_sale_price')) {
                $table->decimal('split_sale_price', 10, 2)
                      ->nullable()
                      ->after('price')
                      ->comment('سعر بيع وحدة التجزئة (مثلاً: سعر الحبة الواحدة)');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('split_sale_price');
        });
    }
};