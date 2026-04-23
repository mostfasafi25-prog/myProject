<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'full_unit_name')) {
                $table->string('full_unit_name', 120)->nullable();
            }
            if (!Schema::hasColumn('products', 'divide_into')) {
                $table->unsignedSmallInteger('divide_into')->nullable();
            }
            if (!Schema::hasColumn('products', 'allow_small_pieces')) {
                $table->boolean('allow_small_pieces')->default(false);
            }
            if (!Schema::hasColumn('products', 'pieces_count')) {
                $table->unsignedInteger('pieces_count')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'pieces_count')) {
                $table->dropColumn('pieces_count');
            }
            if (Schema::hasColumn('products', 'allow_small_pieces')) {
                $table->dropColumn('allow_small_pieces');
            }
            if (Schema::hasColumn('products', 'divide_into')) {
                $table->dropColumn('divide_into');
            }
            if (Schema::hasColumn('products', 'full_unit_name')) {
                $table->dropColumn('full_unit_name');
            }
        });
    }
};
