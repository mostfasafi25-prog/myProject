<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique(); // ⭐ أضفت slug
            $table->text('description')->nullable();
            $table->enum('type', ['main', 'sub'])->default('main'); // ⭐ نوع القسم
            $table->string('icon')->default('category');
            $table->string('color')->nullable()->default('#6B7280'); // لون القسم
            $table->unsignedBigInteger('parent_id')->nullable(); // ⭐ غيرنا الاسم ليكون أوضح
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('show_in_menu')->default(true); // ⭐ لعرضه في القائمة
            
            // ⭐ حقل جديد لتحديد نوع الوحدة للأقسام الفرعية
            $table->enum('unit_type', ['kg', 'gram', 'quantity', 'liter', 'ml', 'piece', 'box', 'none'])
                  ->default('none')
                  ->nullable()
                  ->comment('نوع الوحدة: كيلو، غرام، كمية، لتر، ملليلتر، قطعة، صندوق، بدون وحدة');
            
            // ⭐ حقل إضافي إذا أردت دعم أكثر من وحدة في نفس القسم
            $table->json('available_units')->nullable()->comment('الوحدات المتاحة لهذا القسم بصيغة JSON');
            
            $table->json('meta_data')->nullable(); // ⭐ بيانات إضافية
            $table->timestamps();
            
            // Indexes
            $table->index(['type', 'is_active']);
            $table->index('slug');
            $table->index('sort_order');
            $table->index('unit_type'); // ⭐ إضافة index لحقل الوحدة
        });

        // Foreign key بعد إنشاء الجدول
        Schema::table('categories', function (Blueprint $table) {
            $table->foreign('parent_id')
                  ->references('id')
                  ->on('categories')
                  ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
        });
        
        Schema::dropIfExists('categories');
    }
};