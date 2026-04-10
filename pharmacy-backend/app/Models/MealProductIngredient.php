<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MealProductIngredient extends Model
{
    protected $fillable = [
        'meal_id',
        'product_id',
        'quantity_used',
    ];

    protected $casts = [
        'quantity_used' => 'decimal:3',
    ];

    public function meal(): BelongsTo
    {
        return $this->belongsTo(Meal::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
