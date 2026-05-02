<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * جداول مجال الوجبات/المطعم — تُحذف بالكامل فقط إذا كانت كلها فارغة (0 صفوف في كل جدول موجود).
     */
    private array $tablesInDropOrder = [
        'order_item_options',
        'meal_order_item_options',
        'meal_order_items',
        'meal_option_ingredients',
        'meal_options',
        'meal_option_groups',
        'meal_ingredients',
        'meal_product_ingredients',
        'quick_meals',
        'prepared_meals',
        'saved_meals',
        'meal_preparations',
        'recipe_ingredients',
        'recipes',
        'meals',
    ];

    public function up(): void
    {
        foreach ($this->tablesInDropOrder as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }
            $count = (int) DB::table($table)->count();
            if ($count > 0) {
                throw new RuntimeException(
                    "تعذّر حذف جداول الوجبات: الجدول `{$table}` يحتوي على {$count} صف/صفوف. امسح البيانات أو انقلها ثم أعد تشغيل الهجرة."
                );
            }
        }

        Schema::disableForeignKeyConstraints();
        try {
            foreach ($this->tablesInDropOrder as $table) {
                Schema::dropIfExists($table);
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }
    }

    public function down(): void
    {
        throw new RuntimeException(
            'هذه الهجرة لا تُعيد إنشاء الجداول. استعد من نسخة احتياطية أو أعد تشغيل migrations الأصلية على بيئة جديدة.'
        );
    }
};
