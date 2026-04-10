<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('department');
            $table->enum('shift', ['صباحي', 'مسائي']);
            $table->decimal('salary', 10, 2)->nullable();
            $table->string('phone');
            $table->decimal('total_purchases', 10, 2)->default(0);
            $table->date('last_purchase_date')->nullable(); // ⭐ أزل after()
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};