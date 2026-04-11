<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('users') || DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement(
            "ALTER TABLE users MODIFY COLUMN role ENUM('admin','super_admin','cashier','super_cashier') NOT NULL DEFAULT 'cashier'"
        );
    }

    public function down(): void
    {
        if (!Schema::hasTable('users') || DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement(
            "ALTER TABLE users MODIFY COLUMN role ENUM('admin','cashier','super_cashier') NOT NULL DEFAULT 'cashier'"
        );
    }
};
