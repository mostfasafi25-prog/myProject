<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB; // هذه مهمة!

return new class extends Migration
{
    public function up()
    {
        Schema::create('treasury', function (Blueprint $table) {        $table->engine = 'InnoDB'; // أضف هذا السطر

            $table->id();
            $table->decimal('balance', 15, 2)->default(0);
            $table->decimal('total_income', 15, 2)->default(0);
            $table->decimal('total_expenses', 15, 2)->default(0);
            $table->timestamps();
        });

        // إدخال سجل افتراضي
        DB::table('treasury')->insert([
            'balance' => 0,
            'total_income' => 0,
            'total_expenses' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down()
    {
        Schema::dropIfExists('treasury');
    }
};