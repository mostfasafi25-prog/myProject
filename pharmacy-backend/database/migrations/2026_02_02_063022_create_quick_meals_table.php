<?php

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
        Schema::create('quick_meals', function (Blueprint $table) {
            $table->id();
            $table->string('meal_name');
            $table->json('ingredients'); // لتخزين المكونات كـ JSON
            $table->decimal('total_cost', 10, 2)->default(0);
            $table->integer('prepared_by')->nullable();
            $table->timestamps();
            
            // إضافة فهرس للبحث السريع
            $table->index('meal_name');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quick_meals');
    }
};