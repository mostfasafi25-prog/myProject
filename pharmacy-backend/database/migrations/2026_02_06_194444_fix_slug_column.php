<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE categories ALTER COLUMN slug DROP NOT NULL');

            return;
        }

        DB::statement('ALTER TABLE categories MODIFY slug VARCHAR(255) NULL');
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE categories ALTER COLUMN slug SET NOT NULL');

            return;
        }

        DB::statement('ALTER TABLE categories MODIFY slug VARCHAR(255) NOT NULL');
    }
};
