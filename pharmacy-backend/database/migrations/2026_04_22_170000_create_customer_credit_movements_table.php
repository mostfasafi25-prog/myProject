<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_credit_movements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('customer_id')->nullable()->index();
            $table->string('customer_name', 120)->nullable()->index();
            $table->string('movement_type', 40); // credit_sale | debt_payment | debt_settlement
            $table->decimal('delta_amount', 14, 2); // + increases debt, - decreases debt
            $table->unsignedBigInteger('reference_order_id')->nullable()->index();
            $table->string('payment_method', 30)->nullable();
            $table->unsignedBigInteger('cashier_id')->nullable()->index();
            $table->string('cashier_name', 120)->nullable();
            $table->string('note', 400)->nullable();
            $table->timestamp('occurred_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_credit_movements');
    }
};

