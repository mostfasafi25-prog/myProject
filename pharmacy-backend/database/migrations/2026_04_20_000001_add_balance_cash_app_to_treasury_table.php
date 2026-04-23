<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('treasury')) {
            return;
        }

        Schema::table('treasury', function (Blueprint $table) {
            if (!Schema::hasColumn('treasury', 'balance_cash')) {
                $table->decimal('balance_cash', 15, 2)->default(0)->after('balance');
            }
            if (!Schema::hasColumn('treasury', 'balance_app')) {
                $table->decimal('balance_app', 15, 2)->default(0)->after('balance_cash');
            }
        });

        // كل الرصيد الحالي يُعتبر كاشاً حتى تاريخ الترحيل (التطبيق يبدأ من الصفر)
        if (Schema::hasColumn('treasury', 'balance_cash') && Schema::hasColumn('treasury', 'balance')) {
            DB::statement('UPDATE treasury SET balance_cash = balance, balance_app = 0');
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('treasury')) {
            return;
        }

        Schema::table('treasury', function (Blueprint $table) {
            if (Schema::hasColumn('treasury', 'balance_app')) {
                $table->dropColumn('balance_app');
            }
            if (Schema::hasColumn('treasury', 'balance_cash')) {
                $table->dropColumn('balance_cash');
            }
        });
    }
};
