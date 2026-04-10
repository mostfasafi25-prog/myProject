<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $d = DB::getDriverName();
        if ($d === 'mysql') {
            DB::statement('ALTER TABLE products MODIFY stock DECIMAL(12,3) NOT NULL DEFAULT 0');

            return;
        }
        if ($d === 'pgsql') {
            DB::statement('ALTER TABLE products ALTER COLUMN stock TYPE DECIMAL(12,3) USING stock::numeric(12,3)');
            DB::statement('ALTER TABLE products ALTER COLUMN stock SET DEFAULT 0');
            DB::statement('ALTER TABLE products ALTER COLUMN stock SET NOT NULL');
        }
    }

    public function down(): void
    {
        $d = DB::getDriverName();
        if ($d === 'mysql') {
            DB::statement('ALTER TABLE products MODIFY stock INT NOT NULL DEFAULT 0');

            return;
        }
        if ($d === 'pgsql') {
            DB::statement('ALTER TABLE products ALTER COLUMN stock TYPE INTEGER USING round(stock)::integer');
            DB::statement('ALTER TABLE products ALTER COLUMN stock SET DEFAULT 0');
            DB::statement('ALTER TABLE products ALTER COLUMN stock SET NOT NULL');
        }
    }
};
