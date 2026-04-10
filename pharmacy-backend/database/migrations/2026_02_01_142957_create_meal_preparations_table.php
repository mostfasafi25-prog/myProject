<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('meal_preparations', function (Blueprint $table) {
    $table->id();
    $table->foreignId('recipe_id')->nullable()->constrained()->nullOnDelete();
    $table->string('recipe_name')->nullable();
    $table->string('meal_name');
    $table->json('ingredients')->nullable();
    $table->integer('quantity')->default(1);
    $table->text('notes')->nullable();
            $table->string('prepared_by')->nullable(); // تغيير من integer إلى string

    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('meal_preparations');
    }
};
