<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('username');
            $table->enum('role', ['admin', 'cashier'])->default('cashier');

            $table->string('password');
            $table->rememberToken(); // لحفظ حالة تسجيل الدخول
            $table->timestamps(); // يضيف created_at و updated_at تلقائياً
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};