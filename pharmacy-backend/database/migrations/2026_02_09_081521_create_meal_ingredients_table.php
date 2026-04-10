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
        Schema::create('meal_ingredients', function (Blueprint $table) {
            $table->id();
            
            // 1. العلاقة مع الوجبة الأم
            $table->foreignId('meal_id')
                  ->constrained('meals') // ربط بجدول meals
                  ->onDelete('cascade'); // إذا حذفت الوجبة، تحذف المكونات
            
            // 2. العلاقة مع القسم الفرعي (المكون)
            $table->foreignId('category_id')
                  ->constrained('categories') // ربط بجدول categories
                  ->onDelete('restrict'); // لا تحذف إذا كان مستخدماً
            
            // 3. معلومات الكمية
            $table->decimal('quantity', 10, 3)->default(1); // 10.123 مثلاً
            $table->string('unit', 50)->default('piece'); // وحدة القياس
            
            // 4. التكلفة
            $table->decimal('unit_cost', 12, 2)->nullable(); // سعر الوحدة
            $table->decimal('total_cost', 12, 2)->nullable(); // الكمية × السعر
            
            // 5. معلومات إضافية
            $table->text('notes')->nullable(); // ملاحظات
            $table->integer('sort_order')->default(0); // ترتيب الظهور
            
            // 6. التواريخ
            $table->timestamps();
            
            // 7. الفهارس
            $table->unique(['meal_id', 'category_id']); // منع التكرار
            $table->index(['meal_id']); // لتحسين البحث
            $table->index(['category_id']); // لتحسين البحث
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('meal_ingredients');
    }
};