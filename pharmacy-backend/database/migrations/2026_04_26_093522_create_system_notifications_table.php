<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_notifications', function (Blueprint $table) {
            $table->id();
            $table->string('type')->nullable();
            $table->string('pref_category')->nullable();
            $table->string('title');
            $table->text('message');
            $table->longText('details')->nullable();
            $table->boolean('from_management')->default(false);
            $table->string('management_label')->nullable();
            $table->string('recipients_type')->default('all');
            $table->json('recipient_usernames')->nullable();
            $table->json('read_by')->nullable();
            $table->json('deleted_by')->nullable();
            $table->json('meta')->nullable();
            $table->string('created_by')->nullable();
            $table->timestamps();

            $table->index(['recipients_type', 'created_at']);
            $table->index('type');
            $table->index('pref_category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_notifications');
    }
};