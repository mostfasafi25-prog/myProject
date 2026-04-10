<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // ⭐⭐ غير من table إلى create ⭐⭐
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            
            // جميع الحقول هنا مباشرة
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->decimal('subtotal', 10, 2);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('tax', 10, 2)->default(0);
            $table->decimal('total', 10, 2);
            $table->decimal('paid_amount', 10, 2)->default(0);
            $table->decimal('due_amount', 10, 2)->default(0);
$table->enum('payment_method', ['cash', 'app'])->default('cash');
            $table->enum('status', ['pending', 'paid', 'cancelled'])->default('pending');
            
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            
            $table->timestamps();
            
            // العلاقات
            $table->foreign('customer_id')->references('id')->on('customers')->onDelete('set null');
            $table->index('customer_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('orders');
    }
};