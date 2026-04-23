<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('treasury_transactions')) {
            return;
        }
        try {
            DB::statement("ALTER TABLE treasury_transactions MODIFY COLUMN payment_method VARCHAR(32) NOT NULL DEFAULT 'cash'");
        } catch (\Throwable $e) {
            // قد يكون العمود نصياً مسبقاً أو محرك قاعدة مختلف
        }
    }

    public function down(): void
    {
        // لا نعيد ENUM لتجنب فقدان قيم app/mixed
    }
};
