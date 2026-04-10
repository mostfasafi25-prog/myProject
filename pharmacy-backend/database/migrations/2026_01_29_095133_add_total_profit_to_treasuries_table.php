<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddTotalProfitToTreasuriesTable extends Migration
{
    public function up()
    {
        Schema::table('treasuries', function (Blueprint $table) {
            // تحقق أولاً إذا كان الجدول اسمه treasury أو treasuries
            if (Schema::hasTable('treasury')) {
                $table = Schema::table('treasury', function (Blueprint $table) {
                    $table->decimal('total_profit', 12, 2)->default(0)->after('total_income');
                });
            } elseif (Schema::hasTable('treasuries')) {
                $table = Schema::table('treasuries', function (Blueprint $table) {
                    $table->decimal('total_profit', 12, 2)->default(0)->after('total_income');
                });
            }
        });
    }

    public function down()
    {
        if (Schema::hasTable('treasury')) {
            Schema::table('treasury', function (Blueprint $table) {
                $table->dropColumn('total_profit');
            });
        } elseif (Schema::hasTable('treasuries')) {
            Schema::table('treasuries', function (Blueprint $table) {
                $table->dropColumn('total_profit');
            });
        }
    }
}