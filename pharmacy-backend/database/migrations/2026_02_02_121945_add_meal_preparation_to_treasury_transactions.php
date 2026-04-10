<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        // تغيير الـ ENUM فقط بدون حذف الجدول
        DB::statement("ALTER TABLE treasury_transactions MODIFY category ENUM(
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
            'balance_adjustment',
            'meal_preparation'
        )");
    }

    public function down()
    {
        DB::statement("ALTER TABLE treasury_transactions MODIFY category ENUM(
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
        )");
    }
};