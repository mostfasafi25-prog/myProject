<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * scope: purchase = أقسام المشتريات (بهارات، لحوم مشتريات، خضار...)
     *        sales    = أقسام المبيعات (لحوم أطباق، عصائر، سلطات...)
     */
    public function up()
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->string('scope', 20)->default('purchase')->after('parent_id')
                ->comment('purchase=أقسام المشتريات, sales=أقسام المبيعات');
        });

        // الأقسام التي لها وجبات أو أسلافها = مبيعات، الباقي = مشتريات
        $idsWithMeals = DB::table('meals')->whereNotNull('category_id')->distinct()->pluck('category_id')->toArray();
        $salesIds = [];
        foreach ($idsWithMeals as $cid) {
            $current = $cid;
            while ($current) {
                $salesIds[$current] = true;
                $parent = DB::table('categories')->where('id', $current)->value('parent_id');
                $current = $parent;
            }
        }
        if (!empty($salesIds)) {
            DB::table('categories')->whereIn('id', array_keys($salesIds))->update(['scope' => 'sales']);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('scope');
        });
    }
};
