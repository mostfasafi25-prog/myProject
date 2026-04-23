<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            // إضافة حقول الدفع المختلط
            $table->decimal('cash_amount', 15, 2)->default(0)->after('paid_amount');
            $table->decimal('app_amount', 15, 2)->default(0)->after('cash_amount');
            $table->decimal('bank_amount', 15, 2)->default(0)->after('app_amount');
            $table->decimal('check_amount', 15, 2)->default(0)->after('bank_amount');
            
            // إضافة حقل المورد
            $table->unsignedBigInteger('supplier_id')->nullable()->after('category_id');
            
            // إضافة فهرس للمورد
            $table->index('supplier_id');
        });

        // تعديل قيد payment_method ليدعم 'mixed'
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE purchases MODIFY COLUMN payment_method ENUM('cash','credit','bank_transfer','check','app','mixed') DEFAULT 'cash'");
        } elseif ($driver === 'pgsql') {
            $this->syncPaymentMethodCheck(['cash', 'credit', 'bank_transfer', 'check', 'app', 'mixed']);
        }
    }

    public function down(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->dropColumn(['cash_amount', 'app_amount', 'bank_amount', 'check_amount', 'supplier_id']);
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE purchases MODIFY COLUMN payment_method ENUM('cash','credit','bank_transfer','check','app') DEFAULT 'cash'");
        } elseif ($driver === 'pgsql') {
            $this->syncPaymentMethodCheck(['cash', 'credit', 'bank_transfer', 'check', 'app']);
        }
    }

    private function syncPaymentMethodCheck(array $methods): void
    {
        DB::statement('ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_payment_method_check');

        $names = DB::select("
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'purchases'
              AND c.contype = 'c'
              AND (
                  c.conname ILIKE '%payment_method%'
                  OR pg_get_constraintdef(c.oid) ILIKE '%payment_method%'
              )
        ");
        foreach ($names as $row) {
            $cn = str_replace('"', '""', $row->conname);
            DB::statement("ALTER TABLE purchases DROP CONSTRAINT IF EXISTS \"{$cn}\"");
        }

        $list = implode(', ', array_map(
            fn ($x) => "'".str_replace("'", "''", $x)."'",
            $methods
        ));

        DB::statement("ALTER TABLE purchases ADD CONSTRAINT purchases_payment_method_check CHECK (\"payment_method\" in ({$list}))");
    }
};
