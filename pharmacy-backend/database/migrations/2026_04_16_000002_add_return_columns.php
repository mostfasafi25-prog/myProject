<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add returned_quantity to purchase_items
        if (Schema::hasTable('purchase_items') && !Schema::hasColumn('purchase_items', 'returned_quantity')) {
            Schema::table('purchase_items', function (Blueprint $table) {
                $table->decimal('returned_quantity', 12, 2)->default(0)->after('quantity');
            });
        }

        // Update purchases status enum to include 'returned' using raw SQL
        DB::statement("ALTER TABLE purchases MODIFY COLUMN status ENUM('pending', 'partially_paid', 'completed', 'returned') DEFAULT 'pending'");
    }

    public function down(): void
    {
        if (Schema::hasTable('purchase_items') && Schema::hasColumn('purchase_items', 'returned_quantity')) {
            Schema::table('purchase_items', function (Blueprint $table) {
                $table->dropColumn('returned_quantity');
            });
        }

        DB::statement("ALTER TABLE purchases MODIFY COLUMN status ENUM('pending', 'partially_paid', 'completed') DEFAULT 'pending'");
    }
};
