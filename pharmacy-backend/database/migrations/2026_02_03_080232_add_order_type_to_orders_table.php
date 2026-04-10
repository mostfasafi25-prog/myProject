<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('orders', function (Blueprint $table) {
            // ⭐ تحقق أولاً إذا الحقل موجود قبل إضافته
            
            // أضف order_type فقط إذا كان غير موجود
            if (!Schema::hasColumn('orders', 'order_type')) {
                $table->string('order_type')->nullable()->after('status')
                    ->comment('نوع الطلب: product_sale, meal_sale');
            }
            
            // لا تضيف total_profit لأنه موجود بالفعل
            // إذا كنت تريد تحقق من وجوده:
            // if (!Schema::hasColumn('orders', 'total_profit')) {
            //     $table->decimal('total_profit', 10, 2)->default(0)->after('total');
            // }
        });
    }

    public function down()
    {
        Schema::table('orders', function (Blueprint $table) {
            // إزالة الحقول إذا كنت تريد الرجوع
            if (Schema::hasColumn('orders', 'order_type')) {
                $table->dropColumn('order_type');
            }
        });
    }
};