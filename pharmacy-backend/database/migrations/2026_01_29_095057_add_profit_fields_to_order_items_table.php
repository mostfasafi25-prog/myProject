<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddProfitFieldsToOrderItemsTable extends Migration
{
    public function up()
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('unit_cost', 12, 2)->default(0)->after('unit_price');
            $table->decimal('unit_profit', 12, 2)->default(0)->after('unit_cost');
            $table->decimal('item_profit', 12, 2)->default(0)->after('unit_profit');
        });
    }

    public function down()
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['unit_cost', 'unit_profit', 'item_profit']);
        });
    }
}