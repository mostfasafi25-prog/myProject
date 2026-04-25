<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('purchases')) {
            return;
        }

        // Add returned_quantity to purchase_items
        if (Schema::hasTable('purchase_items') && !Schema::hasColumn('purchase_items', 'returned_quantity')) {
            Schema::table('purchase_items', function (Blueprint $table) {
                $table->decimal('returned_quantity', 12, 2)->default(0)->after('quantity');
            });
        }

        // Update purchases status to include returned (cross-database)
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE purchases MODIFY COLUMN status ENUM('pending', 'partially_paid', 'completed', 'returned') DEFAULT 'pending'");
        } elseif ($driver === 'pgsql') {
            $this->syncPurchasesStatusCheck(['pending', 'partially_paid', 'completed', 'returned']);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('purchase_items') && Schema::hasColumn('purchase_items', 'returned_quantity')) {
            Schema::table('purchase_items', function (Blueprint $table) {
                $table->dropColumn('returned_quantity');
            });
        }

        if (!Schema::hasTable('purchases')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE purchases MODIFY COLUMN status ENUM('pending', 'partially_paid', 'completed') DEFAULT 'pending'");
        } elseif ($driver === 'pgsql') {
            $this->syncPurchasesStatusCheck(['pending', 'partially_paid', 'completed']);
        }
    }

    private function syncPurchasesStatusCheck(array $statuses): void
    {
        DB::statement('ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check');

        $names = DB::select("
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'purchases'
              AND c.contype = 'c'
              AND (
                  c.conname ILIKE '%status%'
                  OR pg_get_constraintdef(c.oid) ILIKE '%status%'
              )
        ");
        foreach ($names as $row) {
            $cn = str_replace('"', '""', $row->conname);
            DB::statement("ALTER TABLE purchases DROP CONSTRAINT IF EXISTS \"{$cn}\"");
        }

        $list = implode(', ', array_map(
            fn ($value) => "'" . str_replace("'", "''", $value) . "'",
            $statuses
        ));

        DB::statement("ALTER TABLE purchases ADD CONSTRAINT purchases_status_check CHECK (\"status\" in ({$list}))");
    }
};
