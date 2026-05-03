<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('pharmacies')) {
            return;
        }
        Schema::table('pharmacies', function (Blueprint $table) {
            if (! Schema::hasColumn('pharmacies', 'monthly_subscription_amount')) {
                $table->decimal('monthly_subscription_amount', 12, 2)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('pharmacies')) {
            return;
        }
        Schema::table('pharmacies', function (Blueprint $table) {
            if (Schema::hasColumn('pharmacies', 'monthly_subscription_amount')) {
                $table->dropColumn('monthly_subscription_amount');
            }
        });
    }
};
