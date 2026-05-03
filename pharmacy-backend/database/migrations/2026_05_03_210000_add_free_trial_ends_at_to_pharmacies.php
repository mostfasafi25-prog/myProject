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
            if (!Schema::hasColumn('pharmacies', 'free_trial_ends_at')) {
                $table->timestamp('free_trial_ends_at')->nullable()->after('max_users_override');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('pharmacies')) {
            return;
        }
        Schema::table('pharmacies', function (Blueprint $table) {
            if (Schema::hasColumn('pharmacies', 'free_trial_ends_at')) {
                $table->dropColumn('free_trial_ends_at');
            }
        });
    }
};
