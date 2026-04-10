<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // أولاً: احذف الجدول إذا موجود (للأمان)
        Schema::dropIfExists('treasury_transactions');
        
        Schema::create('treasury_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('treasury_id')->nullable();
            $table->string('transaction_number')->unique(); 
            
            $table->unsignedBigInteger('purchase_id')->nullable();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('employee_id')->nullable();

            $table->enum('type', [
                'income', 
                'expense',
                'deposit',
                'withdraw',
                'manual_adjustment'
            ]);
            
            $table->decimal('amount', 15, 2);
            $table->string('description');
            
            $table->enum('category', [
                'deposit',
                'withdraw',
                'sales_income',
                'purchase_expense',
                'purchases',
                'salary_expense',
                'salaries',
                'other_income',
                'other_expense',
                'manual_addition',
                'manual_withdrawal',
                'balance_adjustment'
            ]);
            
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->enum('status', ['pending', 'completed', 'cancelled'])->default('completed');
            $table->date('transaction_date')->useCurrent();
            $table->enum('payment_method', ['cash', 'bank_transfer', 'check', 'card'])->default('cash');
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            // ⭐⭐⭐ بدون علاقات الآن ⭐⭐⭐
            // العلاقات ستضاف لاحقاً
            
            $table->index(['type', 'transaction_date']);
            $table->index(['reference_type', 'reference_id']);
            $table->index('category');
            $table->index(['order_id', 'purchase_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('treasury_transactions');
    }
};