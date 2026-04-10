<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE products MODIFY stock DECIMAL(12,3) NOT NULL DEFAULT 0');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE products MODIFY stock INT NOT NULL DEFAULT 0');
        }
    }
};
