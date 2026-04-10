<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function syncPurchasesPaymentMethodCheck(array $methods): void
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

    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE purchases MODIFY COLUMN payment_method ENUM('cash','credit','bank_transfer','check','app') DEFAULT 'cash'");

            return;
        }

        if ($driver === 'pgsql') {
            $this->syncPurchasesPaymentMethodCheck(['cash', 'credit', 'bank_transfer', 'check', 'app']);
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE purchases MODIFY COLUMN payment_method ENUM('cash','credit','bank_transfer','check') DEFAULT 'cash'");

            return;
        }

        if ($driver === 'pgsql') {
            $this->syncPurchasesPaymentMethodCheck(['cash', 'credit', 'bank_transfer', 'check']);
        }
    }
};
