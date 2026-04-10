<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Recipe extends Model
{
    protected $fillable = [
        'name',
        'description',
        'category',
        'preparation_time',
        'servings',
        'cost',
        'price'
    ];

    public function ingredients()
    {
        return $this->hasMany(RecipeIngredient::class);
    }
}