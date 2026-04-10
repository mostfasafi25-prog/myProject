<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->engine = 'InnoDB';
            $table->id();
            $table->unsignedBigInteger('order_id');
            
            // Polymorphic relationship
            $table->unsignedBigInteger('item_id');
            $table->string('item_type'); // 'App\Models\Meal' أو 'App\Models\Product'
            $table->string('item_name');
            
            $table->decimal('quantity', 10, 2);
            $table->decimal('unit_price', 10, 2);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('total_price', 10, 2);
            $table->timestamps();
            
            // العلاقات
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            
            // Indexes
            $table->index('order_id');
            $table->index(['item_id', 'item_type']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('order_items');
    }
};