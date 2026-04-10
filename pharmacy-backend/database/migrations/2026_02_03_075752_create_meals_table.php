<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meals', function (Blueprint $table) {
            $table->id();
            
            // 1. الأساسيات
            $table->string('name');
            $table->string('code')->unique()->nullable();
            $table->text('description')->nullable();
            
            // 2. العلاقة مع الأقسام الفرعية ⭐⭐ مهم
            $table->foreignId('category_id')->nullable()->constrained('categories')->onDelete('set null');
            
            // 3. الأسعار
            $table->decimal('cost_price', 12, 2)->default(0);
            $table->decimal('sale_price', 12, 2);
            $table->decimal('profit_margin', 8, 2)->nullable(); // ⭐ هذا العمود الناقص
            
            // 4. المخزون
            $table->integer('quantity')->default(0);
            $table->integer('min_quantity')->default(0);
            $table->integer('max_quantity')->default(100);
            $table->boolean('track_quantity')->default(true);
            
            // 5. معلومات إضافية
            $table->string('image')->nullable();
            $table->integer('preparation_time')->nullable();
            $table->boolean('is_available')->default(true);
            $table->decimal('calories', 8, 2)->nullable();
            
            // 6. الترتيب والعرض
            $table->integer('sort_order')->default(0);
            $table->boolean('is_featured')->default(false);
            $table->json('tags')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
           
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meals');
    }
};