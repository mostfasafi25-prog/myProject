<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('orders', function (Blueprint $table) {
            // التحقق إذا كانت الأعمدة غير موجودة قبل إضافتها
            if (!Schema::hasColumn('orders', 'total_cost')) {
                $table->decimal('total_cost', 12, 2)->default(0)->after('total');
            }
            
            if (!Schema::hasColumn('orders', 'total_profit')) {
                $table->decimal('total_profit', 12, 2)->default(0)->after('total_cost');
            }
        });
        
        // أيضاً أضف عمود profit في order_items إذا لم يكن موجوداً
        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'profit')) {
                $table->decimal('profit', 12, 2)->default(0)->after('total_price');
            }
        });
    }

    public function down()
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['total_cost', 'total_profit']);
        });
        
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('profit');
        });
    }
};