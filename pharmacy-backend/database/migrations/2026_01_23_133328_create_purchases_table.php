<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number')->unique();
            
            // ⭐⭐⭐ التصحيح هنا ⭐⭐⭐
            $table->unsignedBigInteger('category_id')->nullable();
            
            // التاريخ
            $table->date('purchase_date');
            $table->date('due_date')->nullable();
            
            // المبالغ
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->decimal('discount', 15, 2)->default(0);
            $table->decimal('tax', 15, 2)->default(0);
            $table->decimal('grand_total', 15, 2)->default(0);
            
            // المدفوعات
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('remaining_amount', 15, 2)->default(0);
            $table->decimal('due_amount', 15, 2)->default(0);
            
            // الحالة
            $table->enum('status', ['pending', 'completed', 'cancelled', 'partially_paid'])->default('pending');
            $table->enum('payment_method', ['cash', 'credit', 'bank_transfer', 'check'])->default('cash');
            $table->text('notes')->nullable();
            
            $table->unsignedBigInteger('created_by')->nullable();
            
            $table->timestamps();
            $table->softDeletes();

            // فهارس
            $table->index('invoice_number');
            $table->index('purchase_date');
            $table->index('status');
            $table->index(['status', 'purchase_date']);
            $table->index('category_id');
            $table->index('created_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchases');
    }
};