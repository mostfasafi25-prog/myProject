<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('purchases') || !Schema::hasTable('suppliers')) {
            return;
        }

        if (Schema::hasColumn('purchases', 'supplier_id')) {
            return;
        }

        Schema::table('purchases', function (Blueprint $table) {
            $table->foreignId('supplier_id')->nullable()->after('invoice_number')->constrained('suppliers')->onDelete('set null');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('purchases') || !Schema::hasColumn('purchases', 'supplier_id')) {
            return;
        }

        Schema::table('purchases', function (Blueprint $table) {
            try {
                $table->dropForeign(['supplier_id']);
            } catch (\Throwable $e) {
                // قد لا يكون القيد موجوداً في بعض البيئات
            }
            $table->dropColumn('supplier_id');
        });
    }
};
