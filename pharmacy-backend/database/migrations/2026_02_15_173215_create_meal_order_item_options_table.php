<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('meal_order_item_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meal_order_item_id')
                  ->constrained('meal_order_items')
                  ->onDelete('cascade');
            $table->foreignId('meal_option_id')
                  ->nullable()
                  ->constrained('meal_options')
                  ->onDelete('set null');
            $table->string('name');
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('additional_cost', 10, 2)->default(0);
            $table->string('group_name')->nullable();
            $table->timestamps();
            
            // Indexes for better performance
            $table->index('meal_order_item_id');
            $table->index('meal_option_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('meal_order_item_options');
    }
};