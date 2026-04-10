<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->whereIn('role', ['manager', 'employee'])->update(['role' => 'cashier']);
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin','cashier','super_cashier') NOT NULL DEFAULT 'cashier'");
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'super_cashier')->update(['role' => 'cashier']);
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin','cashier','manager','employee') NOT NULL DEFAULT 'cashier'");
    }
};
