<?php
// app/Models/MealOrderItemOption.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MealOrderItemOption extends Model
{
    protected $table = 'meal_order_item_options';
    
    protected $fillable = [
        'meal_order_item_id',
        'meal_option_id',
        'name',
        'price',
        'additional_cost',
        'group_name'
    ];

    protected $casts = [
        'price' => 'float',
        'additional_cost' => 'float',
    ];

    public function mealOrderItem()
    {
        return $this->belongsTo(MealOrderItem::class, 'meal_order_item_id');
    }

    public function mealOption()
    {
        return $this->belongsTo(MealOption::class, 'meal_option_id');
    }
}