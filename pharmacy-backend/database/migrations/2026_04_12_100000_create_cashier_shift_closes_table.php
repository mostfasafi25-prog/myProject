<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cashier_shift_closes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('username', 64)->index();
            $table->string('display_name', 191)->nullable();
            /** يطابق id الصف من الواجهة (مثل ACT-…) لمنع التكرار */
            $table->string('client_row_id', 128)->unique();
            $table->timestamp('shift_started_at')->nullable();
            $table->timestamp('shift_ended_at');
            $table->unsignedInteger('invoice_count')->default(0);
            $table->decimal('total', 14, 2)->default(0);
            $table->decimal('cash', 14, 2)->default(0);
            $table->decimal('app', 14, 2)->default(0);
            $table->decimal('credit', 14, 2)->default(0);
            $table->longText('invoices_json')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cashier_shift_closes');
    }
};
