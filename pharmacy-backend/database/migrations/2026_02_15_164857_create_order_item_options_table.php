<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('order_item_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_item_id')->constrained('meal_order_items')->onDelete('cascade');
            $table->foreignId('meal_option_id')->constrained('meal_options')->onDelete('cascade');
            $table->string('name');
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('additional_cost', 10, 2)->default(0);
            $table->string('group_name')->nullable();
            $table->timestamps();
            
            // indexes
            $table->index('order_item_id');
            $table->index('meal_option_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('order_item_options');
    }
};