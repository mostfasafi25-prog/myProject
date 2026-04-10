<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            
            // ⭐⭐⭐ غير foreignId إلى unsignedBigInteger ⭐⭐⭐
            $table->unsignedBigInteger('purchase_id');
            $table->unsignedBigInteger('product_id');
            
            $table->string('product_name')->nullable();
            $table->decimal('quantity', 10, 2);
            $table->decimal('unit_price', 15, 2);
            $table->decimal('total_price', 15, 2);
            $table->decimal('discount', 15, 2)->default(0);
            $table->decimal('tax', 15, 2)->default(0);
            $table->decimal('subtotal', 15, 2)->nullable();
            $table->timestamps();
            
            // فهارس
            $table->index('purchase_id');
            $table->index('product_id');
            $table->index(['purchase_id', 'product_id']);
            
            // ⭐⭐⭐ لا تضيف أي foreign keys هنا ⭐⭐⭐
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_items');
    }
};