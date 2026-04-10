<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * التأكد من أن عمود stock يدعم الكسور العشرية (مثل 1.4)
     */
    public function up(): void
    {
        $driver = DB::getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE products MODIFY stock DECIMAL(12,3) NOT NULL DEFAULT 0');
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE products MODIFY stock INT NOT NULL DEFAULT 0');
        }
    }
};
