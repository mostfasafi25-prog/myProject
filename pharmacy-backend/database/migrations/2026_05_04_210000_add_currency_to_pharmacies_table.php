<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('pharmacies')) {
            return;
        }
        Schema::table('pharmacies', function (Blueprint $table) {
            if (!Schema::hasColumn('pharmacies', 'currency_code')) {
                $table->string('currency_code', 8)->default('ILS')->after('name');
            }
            if (!Schema::hasColumn('pharmacies', 'currency_label')) {
                $table->string('currency_label', 32)->default('شيكل')->after('currency_code');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('pharmacies')) {
            return;
        }
        Schema::table('pharmacies', function (Blueprint $table) {
            foreach (['currency_label', 'currency_code'] as $col) {
                if (Schema::hasColumn('pharmacies', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
