<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 100)->nullable()->unique(); 
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->decimal('purchase_price', 10, 2)->nullable();
            $table->decimal('cost_price', 10, 2)->nullable();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->integer('stock')->default(0);
            $table->decimal('min_stock', 10, 2)->default(0);
            $table->decimal('max_stock', 10, 2)->nullable();
            $table->decimal('reorder_point', 10, 2)->default(0);
            $table->string('unit')->default('piece');
            $table->string('sku')->nullable()->unique();
            $table->string('barcode')->nullable()->unique();
            $table->boolean('has_addons')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Foreign key constraints
$table->foreign('category_id')->references('id')->on('categories')->onDelete('cascade');
            $table->foreign('supplier_id')->references('id')->on('suppliers')->onDelete('set null');
            
            // فهارس
            $table->index('sku');
            $table->index('barcode');
            $table->index(['is_active', 'stock']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};