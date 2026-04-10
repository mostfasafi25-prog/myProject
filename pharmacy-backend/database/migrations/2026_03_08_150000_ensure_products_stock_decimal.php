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

            return;
        }
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE products ALTER COLUMN stock TYPE DECIMAL(12,3) USING stock::numeric(12,3)');
            DB::statement('ALTER TABLE products ALTER COLUMN stock SET DEFAULT 0');
            DB::statement('ALTER TABLE products ALTER COLUMN stock SET NOT NULL');
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE products MODIFY stock INT NOT NULL DEFAULT 0');

            return;
        }
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE products ALTER COLUMN stock TYPE INTEGER USING round(stock)::integer');
            DB::statement('ALTER TABLE products ALTER COLUMN stock SET DEFAULT 0');
            DB::statement('ALTER TABLE products ALTER COLUMN stock SET NOT NULL');
        }
    }
};
