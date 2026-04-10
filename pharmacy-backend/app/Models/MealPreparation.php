<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MealPreparation extends Model
{
    protected $fillable = [
        'recipe_id',
        'recipe_name',
        'meal_name',
        'ingredients',
        'quantity',
        'notes',
        'prepared_by'
    ];

    protected $casts = [
        'ingredients' => 'array'
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }

    public function recipe()
    {
        return $this->belongsTo(Recipe::class);
    }
}