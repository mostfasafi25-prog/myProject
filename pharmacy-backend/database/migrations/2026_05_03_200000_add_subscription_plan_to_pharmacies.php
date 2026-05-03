<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('pharmacies')) {
            return;
        }
        Schema::table('pharmacies', function (Blueprint $table) {
            if (!Schema::hasColumn('pharmacies', 'subscription_plan')) {
                $table->string('subscription_plan', 24)->default('free')->after('name');
            }
            if (!Schema::hasColumn('pharmacies', 'subscription_status')) {
                $table->string('subscription_status', 24)->default('active')->after('subscription_plan');
            }
            if (!Schema::hasColumn('pharmacies', 'subscription_expires_at')) {
                $table->timestamp('subscription_expires_at')->nullable()->after('subscription_status');
            }
            if (!Schema::hasColumn('pharmacies', 'subscription_notes')) {
                $table->text('subscription_notes')->nullable()->after('subscription_expires_at');
            }
            if (!Schema::hasColumn('pharmacies', 'max_products_override')) {
                $table->unsignedInteger('max_products_override')->nullable()->after('subscription_notes');
            }
            if (!Schema::hasColumn('pharmacies', 'max_users_override')) {
                $table->unsignedInteger('max_users_override')->nullable()->after('max_products_override');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('pharmacies')) {
            return;
        }
        Schema::table('pharmacies', function (Blueprint $table) {
            foreach ([
                'max_users_override',
                'max_products_override',
                'subscription_notes',
                'subscription_expires_at',
                'subscription_status',
                'subscription_plan',
            ] as $col) {
                if (Schema::hasColumn('pharmacies', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
