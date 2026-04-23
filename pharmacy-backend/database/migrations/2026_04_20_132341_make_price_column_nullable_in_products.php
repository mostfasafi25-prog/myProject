<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // تعديل عمود price ليكون nullable
            $table->decimal('price', 10, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // إرجاع العمود كما كان (غير nullable)
            $table->decimal('price', 10, 2)->nullable(false)->change();
        });
    }
};