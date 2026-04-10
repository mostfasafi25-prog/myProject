<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // تحقق أولاً إذا كان الجدول موجوداً
        if (!Schema::hasTable('saved_meals')) {
            Schema::create('saved_meals', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('category')->nullable();
                $table->string('subcategory')->nullable();
                $table->json('ingredients')->nullable();
                $table->decimal('total_cost', 10, 2)->default(0);
                $table->decimal('sale_price', 10, 2)->default(0);
                $table->decimal('profit_margin', 5, 2)->default(0);
                $table->timestamps();
                $table->softDeletes(); // إذا أردت الحذف الناعم
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_meals');
    }
};