<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('purchases')) {
            return;
        }

        Schema::table('purchases', function (Blueprint $table) {
            if (!Schema::hasColumn('purchases', 'cash_amount')) {
                $table->decimal('cash_amount', 15, 2)->default(0)->after('paid_amount');
            }
            if (!Schema::hasColumn('purchases', 'app_amount')) {
                $table->decimal('app_amount', 15, 2)->default(0)->after('cash_amount');
            }
            if (!Schema::hasColumn('purchases', 'bank_amount')) {
                $table->decimal('bank_amount', 15, 2)->default(0)->after('app_amount');
            }
            if (!Schema::hasColumn('purchases', 'check_amount')) {
                $table->decimal('check_amount', 15, 2)->default(0)->after('bank_amount');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('purchases')) {
            return;
        }

        Schema::table('purchases', function (Blueprint $table) {
            if (Schema::hasColumn('purchases', 'cash_amount')) {
                $table->dropColumn('cash_amount');
            }
            if (Schema::hasColumn('purchases', 'app_amount')) {
                $table->dropColumn('app_amount');
            }
            if (Schema::hasColumn('purchases', 'bank_amount')) {
                $table->dropColumn('bank_amount');
            }
            if (Schema::hasColumn('purchases', 'check_amount')) {
                $table->dropColumn('check_amount');
            }
        });
    }
};
