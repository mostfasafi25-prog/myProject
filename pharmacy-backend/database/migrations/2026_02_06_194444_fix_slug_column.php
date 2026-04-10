<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // استخدم SQL مباشر
        DB::statement("ALTER TABLE categories MODIFY slug VARCHAR(255) NULL");
        
        // أو يمكنك إضافة قيمة افتراضية
        // DB::statement("ALTER TABLE categories MODIFY slug VARCHAR(255) NULL DEFAULT NULL");
    }

    public function down(): void
    {
        // العودة للوضع السابق
        DB::statement("ALTER TABLE categories MODIFY slug VARCHAR(255) NOT NULL");
    }
};