<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            // للمنتجات الموجودة داخل القسم
            $table->decimal('cost_price', 10, 2)->nullable()->after('icon'); // سعر التكلفة
            $table->decimal('profit_margin', 10, 2)->nullable()->after('cost_price'); // هامش الربح
            $table->decimal('sale_price', 10, 2)->nullable()->after('profit_margin'); // سعر البيع
            $table->integer('quantity')->default(0)->after('sale_price'); // الكمية
            $table->integer('min_quantity')->default(0)->after('quantity'); // الحد الأدنى
            $table->integer('max_quantity')->default(1000)->after('min_quantity'); // الحد الأقصى
            
            // للحسابات
            $table->decimal('total_cost', 12, 2)->default(0)->after('max_quantity'); // إجمالي التكلفة
            $table->decimal('total_value', 12, 2)->default(0)->after('total_cost'); // إجمالي القيمة
            
            // للمراقبة
            $table->boolean('track_quantity')->default(false)->after('total_value'); // تتبع الكمية
            $table->boolean('auto_calculate')->default(true)->after('track_quantity'); // حساب تلقائي
            
            // فهارس للأداء
            $table->index('quantity');
            $table->index('sale_price');
            $table->index(['is_active', 'track_quantity']);
        });
    }

  public function down(): void
{
    Schema::table('categories', function (Blueprint $table) {
        $table->dropForeign(['category_id']); // ⭐ التصحيح هنا
    });
    
    Schema::dropIfExists('categories');
}
};