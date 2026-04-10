<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('meal_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->onDelete('cascade');
            $table->foreignId('meal_id')->constrained('meals')->onDelete('cascade');
            $table->string('meal_name');
            $table->decimal('quantity', 10, 3);
            $table->decimal('unit_price', 10, 2);
            $table->decimal('unit_cost', 10, 2)->nullable();
            $table->decimal('unit_profit', 10, 2)->nullable();
            $table->decimal('total_price', 10, 2);
            $table->decimal('total_profit', 10, 2)->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('order_id');
            $table->index('meal_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('meal_order_items');
    }
};