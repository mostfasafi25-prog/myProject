<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('prepared_meals', function (Blueprint $table) {
            $table->id();
            $table->string('meal_name'); // اسم الوجبة
            $table->json('ingredients'); // المكونات المستخدمة
            $table->decimal('total_cost', 10, 2); // التكلفة
            $table->integer('quantity')->default(1); // الكمية المحضرة
            $table->string('prepared_by'); // من قام بالتحضير
            $table->text('notes')->nullable(); // ملاحظات
            $table->timestamp('prepared_at'); // وقت التحضير
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('prepared_meals');
    }
};