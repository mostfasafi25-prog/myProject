<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('meals', 'fixed_price')) {
            Schema::table('meals', function (Blueprint $table) {
                $table->boolean('fixed_price')->default(false)->after('sale_price');
            });
        }

        if (!Schema::hasTable('meal_product_ingredients')) {
            Schema::create('meal_product_ingredients', function (Blueprint $table) {
                $table->id();
                $table->foreignId('meal_id')->constrained('meals')->onDelete('cascade');
                $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
                $table->decimal('quantity_used', 12, 3)->default(0);
                $table->timestamps();
                $table->unique(['meal_id', 'product_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('meal_product_ingredients');
        if (Schema::hasColumn('meals', 'fixed_price')) {
            Schema::table('meals', function (Blueprint $table) {
                $table->dropColumn('fixed_price');
            });
        }
    }
};
