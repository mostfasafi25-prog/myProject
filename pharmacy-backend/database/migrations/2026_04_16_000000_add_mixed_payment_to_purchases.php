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

        Schema::table('purchases', function (Blueprint $table) {
            // إضافة حقول الدفع المختلط (بشكل آمن لو المايجريشن اتنفذ جزئياً)
            if (!Schema::hasColumn('purchases', 'cash_amount')) {
                $table->decimal('cash_amount', 15, 2)->default(0)->after('paid_amount');
            }
            if (!Schema::hasColumn('purchases', 'app_amount')) {
                $table->decimal('app_amount', 15, 2)->default(0)->after('cash_amount');
            }
            if (!Schema::hasColumn('purchases', 'bank_amount')) {
                $table->decimal('bank_amount', 15, 2)->default(0)->after('app_amount');
            }
            if (!Schema::hasColumn('purchases', 'check_amount')) {
                $table->decimal('check_amount', 15, 2)->default(0)->after('bank_amount');
            }

            // إضافة حقل المورد فقط إذا غير موجود
            if (!Schema::hasColumn('purchases', 'supplier_id')) {
                $table->unsignedBigInteger('supplier_id')->nullable()->after('category_id');
            }
        });

        // إضافة فهرس للمورد إن لم يكن موجوداً
        if (Schema::hasColumn('purchases', 'supplier_id') && !$this->hasIndex('purchases', 'purchases_supplier_id_index')) {
            Schema::table('purchases', function (Blueprint $table) {
                $table->index('supplier_id');
            });
        }

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
        if (!Schema::hasTable('purchases')) {
            return;
        }

        if ($this->hasIndex('purchases', 'purchases_supplier_id_index')) {
            Schema::table('purchases', function (Blueprint $table) {
                $table->dropIndex('purchases_supplier_id_index');
            });
        }

        Schema::table('purchases', function (Blueprint $table) {
            $dropCols = [];
            foreach (['cash_amount', 'app_amount', 'bank_amount', 'check_amount', 'supplier_id'] as $col) {
                if (Schema::hasColumn('purchases', $col)) {
                    $dropCols[] = $col;
                }
            }
            if (!empty($dropCols)) {
                $table->dropColumn($dropCols);
            }
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

    private function hasIndex(string $table, string $indexName): bool
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'pgsql') {
            $row = DB::selectOne(
                "SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND tablename = ? AND indexname = ? LIMIT 1",
                [$table, $indexName]
            );
            return (bool) $row;
        }
        if ($driver === 'mysql') {
            $row = DB::selectOne(
                "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1",
                [$table, $indexName]
            );
            return (bool) $row;
        }
        return false;
    }
};
