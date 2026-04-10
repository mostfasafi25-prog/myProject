<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MealOrderItem extends Model
{
    protected $table = 'meal_order_items';

    protected $fillable = [
        'order_id',
        'meal_id',
        'meal_name',
        'quantity',
        'unit_price',
        'unit_cost',
        'unit_profit',
        'total_price',
        'total_profit',
    ];

    /**
     * العلاقة مع الطلب
     */
    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * العلاقة مع الوجبة
     */
    public function meal()
    {
        return $this->belongsTo(Meal::class);
    }

    /**
     * ⭐⭐ العلاقة مع الخيارات المختارة
     */
    public function selectedOptions()
    {
        return $this->hasMany(OrderItemOption::class, 'order_item_id');
    }
}