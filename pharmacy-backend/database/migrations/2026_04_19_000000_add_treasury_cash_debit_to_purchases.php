<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $after = Schema::hasColumn('purchases', 'supplier_balance_delta') ? 'supplier_balance_delta' : 'supplier_id';
            $table->decimal('treasury_cash_debit', 14, 2)->nullable()->after($after);
        });
    }

    public function down(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->dropColumn('treasury_cash_debit');
        });
    }
};
