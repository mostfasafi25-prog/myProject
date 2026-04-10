<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('treasury_transactions', function (Blueprint $table) {
            // تحقق إذا العمود notes مش موجود
            if (!Schema::hasColumn('treasury_transactions', 'notes')) {
                $table->text('notes')->nullable()->after('description');
            }
            
            // تحقق إذا العمود metadata مش موجود قبل إضافته
            if (!Schema::hasColumn('treasury_transactions', 'metadata')) {
                $table->json('metadata')->nullable()->after('notes');
            }
            // إذا موجود، لا تفعل شيء
        });
    }

    public function down()
    {
        Schema::table('treasury_transactions', function (Blueprint $table) {
            // احذف فقط الأعمدة التي أضفناها في هذا الملف
            if (Schema::hasColumn('treasury_transactions', 'notes')) {
                $table->dropColumn('notes');
            }
            
            // لا تحذف metadata إذا كانت موجودة من قبل
            // (اختياري: تحذف فقط إذا أضفتها أنت)
        });
    }
};