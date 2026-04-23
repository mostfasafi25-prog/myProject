<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('pieces_per_strip', 10, 3)->nullable()->after('strip_unit_count');
            $table->decimal('strips_per_box', 10, 3)->nullable()->after('pieces_per_strip');
            $table->string('purchase_unit', 20)->nullable()->after('strips_per_box');
            $table->string('sale_unit', 20)->nullable()->after('purchase_unit');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['pieces_per_strip', 'strips_per_box', 'purchase_unit', 'sale_unit']);
        });
    }
};
