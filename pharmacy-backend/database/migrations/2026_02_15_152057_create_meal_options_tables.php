<?php
// database/migrations/2024_01_01_000000_create_meal_options_tables.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // جدول مجموعات الخيارات
        Schema::create('meal_option_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // اسم المجموعة مثل "الأحجام", "الإضافات"
            $table->string('type')->default('single'); // single, multiple
            $table->boolean('is_required')->default(false);
            $table->integer('min_selections')->nullable();
            $table->integer('max_selections')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // جدول الخيارات
        Schema::create('meal_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_id')->constrained()->onDelete('cascade');
            $table->foreignId('meal_option_group_id')->nullable()->constrained()->onDelete('set null');
            $table->string('name'); // اسم الخيار مثل "صغير", "وسط", "كبير"
            $table->decimal('price', 10, 2)->default(0); // سعر الخيار
            $table->decimal('additional_cost', 10, 2)->default(0); // تكلفة إضافية على المكونات
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // جدول ربط الخيارات بالمكونات (اختياري - لتحديث المخزون)
        Schema::create('meal_option_ingredients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_option_id')->constrained()->onDelete('cascade');
            $table->foreignId('category_id')->constrained()->onDelete('cascade');
            $table->decimal('quantity_needed', 10, 3)->default(0);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('meal_option_ingredients');
        Schema::dropIfExists('meal_options');
        Schema::dropIfExists('meal_option_groups');
    }
};
