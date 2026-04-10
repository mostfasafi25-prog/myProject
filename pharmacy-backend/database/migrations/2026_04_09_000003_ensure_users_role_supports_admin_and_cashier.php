<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function syncUsersRoleCheck(array $roles): void
    {
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');

        $names = DB::select("
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'users'
              AND c.contype = 'c'
              AND (
                  c.conname ILIKE '%role%'
                  OR pg_get_constraintdef(c.oid) ILIKE '%role%'
              )
        ");
        foreach ($names as $row) {
            $cn = str_replace('"', '""', $row->conname);
            DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS \"{$cn}\"");
        }

        $list = implode(', ', array_map(
            fn ($x) => "'".str_replace("'", "''", $x)."'",
            $roles
        ));

        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (\"role\" in ({$list}))");
    }

    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            $this->syncUsersRoleCheck(['admin', 'cashier', 'manager', 'employee']);

            return;
        }

        DB::statement("ALTER TABLE users MODIFY role ENUM('admin','cashier','manager','employee') NOT NULL DEFAULT 'cashier'");
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            $this->syncUsersRoleCheck(['admin', 'cashier']);

            return;
        }

        DB::statement("ALTER TABLE users MODIFY role ENUM('admin','cashier') NOT NULL DEFAULT 'cashier'");
    }
};
