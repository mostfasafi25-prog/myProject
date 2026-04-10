<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // إضافة 'app' لطريقة الدفع (كاش / تطبيق)
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE purchases MODIFY COLUMN payment_method ENUM('cash','credit','bank_transfer','check','app') DEFAULT 'cash'");
        } else {
            Schema::table('purchases', function (Blueprint $table) {
                $table->string('payment_method', 50)->default('cash')->change();
            });
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE purchases MODIFY COLUMN payment_method ENUM('cash','credit','bank_transfer','check') DEFAULT 'cash'");
        }
    }
};
