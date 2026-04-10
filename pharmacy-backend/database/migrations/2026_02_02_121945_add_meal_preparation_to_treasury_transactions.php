<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function categoryValues(bool $withMealPreparation): array
    {
        $v = [
            'deposit',
            'withdraw',
            'sales_income',
            'purchase_expense',
            'purchases',
            'salary_expense',
            'salaries',
            'other_income',
            'other_expense',
            'manual_addition',
            'manual_withdrawal',
            'balance_adjustment',
        ];
        if ($withMealPreparation) {
            $v[] = 'meal_preparation';
        }

        return $v;
    }

    private function syncPostgresCategoryCheck(bool $withMealPreparation): void
    {
        $names = DB::select("
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'treasury_transactions'
              AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) LIKE '%\"category\"%'
        ");
        foreach ($names as $row) {
            $cn = str_replace('"', '""', $row->conname);
            DB::statement("ALTER TABLE treasury_transactions DROP CONSTRAINT IF EXISTS \"{$cn}\"");
        }

        $list = implode(', ', array_map(
            fn ($x) => "'".str_replace("'", "''", $x)."'",
            $this->categoryValues($withMealPreparation)
        ));

        DB::statement("ALTER TABLE treasury_transactions ADD CONSTRAINT treasury_transactions_category_check CHECK (\"category\" in ({$list}))");
    }

    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            $this->syncPostgresCategoryCheck(true);

            return;
        }

        DB::statement("ALTER TABLE treasury_transactions MODIFY category ENUM(
            'deposit',
            'withdraw',
            'sales_income',
            'purchase_expense',
            'purchases',
            'salary_expense',
            'salaries',
            'other_income',
            'other_expense',
            'manual_addition',
            'manual_withdrawal',
            'balance_adjustment',
            'meal_preparation'
        )");
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            $this->syncPostgresCategoryCheck(false);

            return;
        }

        DB::statement("ALTER TABLE treasury_transactions MODIFY category ENUM(
            'deposit',
            'withdraw',
            'sales_income',
            'purchase_expense',
            'purchases',
            'salary_expense',
            'salaries',
            'other_income',
            'other_expense',
            'manual_addition',
            'manual_withdrawal',
            'balance_adjustment'
        )");
    }
};
