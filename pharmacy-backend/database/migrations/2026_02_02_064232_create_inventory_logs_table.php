<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->string('type'); // quick_meal, order, purchase, etc.
            $table->decimal('quantity', 10, 3);
            $table->string('notes')->nullable();
            $table->integer('user_id')->nullable();
            $table->timestamps();
            
            // فهارس للبحث السريع
            $table->index('product_id');
            $table->index('type');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_logs');
    }
};