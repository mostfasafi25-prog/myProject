<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('purchase_items')) {
            return;
        }

        Schema::table('purchase_items', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_items', 'remaining_quantity')) {
                $table->decimal('remaining_quantity', 14, 4)->nullable()->after('returned_quantity');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('purchase_items')) {
            return;
        }

        Schema::table('purchase_items', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_items', 'remaining_quantity')) {
                $table->dropColumn('remaining_quantity');
            }
        });
    }
};
