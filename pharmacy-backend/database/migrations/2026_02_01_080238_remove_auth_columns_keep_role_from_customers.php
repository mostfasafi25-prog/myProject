<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::table('customers', function (Blueprint $table) {
            // حذف حقول المصادقة إذا كانت موجودة
            $authColumns = ['email', 'password', 'email_verified_at', 'remember_token'];
            
            foreach ($authColumns as $column) {
                if (Schema::hasColumn('customers', $column)) {
                    $table->dropColumn($column);
                }
            }
            
            // التأكد من وجود حقل role
            if (!Schema::hasColumn('customers', 'role')) {
                $table->string('role')->default('user')->after('phone');
            }
        });
        
        // تحديث الموظفين الحاليين
        DB::table('customers')->whereNull('role')->update(['role' => 'user']);
    }
    
    public function down()
    {
        Schema::table('customers', function (Blueprint $table) {
            // استعادة حقول المصادقة (اختياري)
            if (!Schema::hasColumn('customers', 'email')) {
                $table->string('email')->unique()->nullable()->after('name');
            }
            
            if (!Schema::hasColumn('customers', 'password')) {
                $table->string('password')->nullable()->after('email');
            }
            
            if (!Schema::hasColumn('customers', 'email_verified_at')) {
                $table->timestamp('email_verified_at')->nullable()->after('password');
            }
            
            if (!Schema::hasColumn('customers', 'remember_token')) {
                $table->rememberToken()->after('email_verified_at');
            }
            
            // لا نحذف role لأننا نريده يبقى
        });
    }
};